import { supabase } from './supabase';

const DB_NAME = 'JexiOfflineDBv2';
const STORE_NAME = 'syncQueue';
const CACHE_STORE = 'dataCache';
const DB_VERSION = 1;
const WORKOUT_DELETE_TOMBSTONES_KEY = 'workout_delete_tombstones';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
  });
}

// Write data to cache
export async function cacheData(key, data) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    store.put({ key, data, timestamp: Date.now() });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Read data from cache
export async function getCachedData(key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const store = tx.objectStore(CACHE_STORE);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}

// Get pending sync items
export async function getPendingSyncItems() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function matchesWorkoutIdentity(workout, tombstone) {
  if (!workout || !tombstone) return false;

  if (tombstone.id && workout.id === tombstone.id) {
    return true;
  }

  return Boolean(
    tombstone.timestamp &&
    tombstone.exercise_name &&
    workout.timestamp === tombstone.timestamp &&
    workout.exercise_name === tombstone.exercise_name
  );
}

function filterDeletedWorkouts(workouts, tombstones) {
  if (!Array.isArray(workouts) || workouts.length === 0 || !Array.isArray(tombstones) || tombstones.length === 0) {
    return Array.isArray(workouts) ? workouts : [];
  }

  return workouts.filter((workout) => !tombstones.some((tombstone) => matchesWorkoutIdentity(workout, tombstone)));
}

export async function markWorkoutDeleted(workout) {
  if (!workout) return;

  const tombstones = await getCachedData(WORKOUT_DELETE_TOMBSTONES_KEY) || [];
  const nextTombstones = tombstones.some((tombstone) => matchesWorkoutIdentity(workout, tombstone))
    ? tombstones
    : [
        {
          id: workout.id,
          timestamp: workout.timestamp || null,
          exercise_name: workout.exercise_name || null,
          deleted_at: Date.now(),
        },
        ...tombstones,
      ].slice(0, 200);

  await cacheData(WORKOUT_DELETE_TOMBSTONES_KEY, nextTombstones);
}

export async function unmarkWorkoutDeleted(workout) {
  if (!workout) return;

  const tombstones = await getCachedData(WORKOUT_DELETE_TOMBSTONES_KEY) || [];
  const nextTombstones = tombstones.filter((tombstone) => !matchesWorkoutIdentity(workout, tombstone));
  await cacheData(WORKOUT_DELETE_TOMBSTONES_KEY, nextTombstones);
}

async function updateWorkoutsCache(action, payload, userId) {
  const cachedWorkouts = await getCachedData('workouts') || [];

  if (action === 'insert') {
    const newWorkout = {
      ...payload,
      id: payload.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      user_id: userId,
      is_local: true,
    };

    await cacheData('workouts', [newWorkout, ...cachedWorkouts]);
    return;
  }

  if (action === 'update' && payload?.id && payload?.data) {
    const updatedWorkouts = cachedWorkouts.map((workout) =>
      workout.id === payload.id ? { ...workout, ...payload.data } : workout
    );
    await cacheData('workouts', updatedWorkouts);
    return;
  }

  if (action === 'delete' && payload?.id) {
    const updatedWorkouts = filterDeletedWorkouts(cachedWorkouts, [payload]);
    await cacheData('workouts', updatedWorkouts);
  }
}

// Queue an operation when offline (Legacy support for 'insert')
export async function queueSyncData(table, payload) {
  return queueSyncAction('insert', table, payload);
}

// Queue an explicit action ('insert', 'update', 'delete')
export async function queueSyncAction(action, table, payload) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    // Check if user is authenticated
    supabase.auth.getSession().then(async ({ data }) => {
      const user_id = data?.session?.user?.id;
      
      // Keep the workout cache in sync with optimistic offline actions.
      if (table === 'workouts') {
        await updateWorkoutsCache(action, payload, user_id);
      }
      
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      if (user_id && payload && typeof payload === 'object' && action === 'insert') {
        payload.user_id = user_id;
      }
      
      const record = { action, table, payload, timestamp: Date.now() };
      store.add(record);
      
      tx.oncomplete = () => {
        console.log('Queued item for sync:', record);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  });
}

// Process the queue when back online
export async function processSyncQueue() {
  if (!navigator.onLine) {
    console.log('Offline, skipping sync');
    return;
  }
  
  const items = await getPendingSyncItems();
  if (items.length === 0) {
    console.log('No items to sync');
    return;
  }
  
  console.log(`Processing ${items.length} offline items...`);
  
  // We process sequentially to avoid DB lock issues or FK constraints
  for (const item of items) {
    try {
      const action = item.action || 'insert'; // Legacy items default to 'insert'
      let error = null;
      let resultData = null;

      if (action === 'insert') {
        const { data, error: insertErr } = await supabase
          .from(item.table)
          .insert(item.payload)
          .select();
        error = insertErr;
        resultData = data;
      } else if (action === 'update') {
        const { data, error: updateErr } = await supabase
          .from(item.table)
          .update(item.payload.data)
          .eq('id', item.payload.id)
          .select();
        error = updateErr;
        resultData = data;
      } else if (action === 'delete') {
        const { error: deleteErr } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.payload.id);
        error = deleteErr;
      }

      if (error) {
        console.error(`Failed to sync item to ${item.table}`, error);
        // If RLS error or permanent error, maybe keep for later, but let's continue
      } else {
        // Delete from queue on success
        const db = await getDB();
        await new Promise((res) => {
          const delTx = db.transaction(STORE_NAME, 'readwrite');
          const delStore = delTx.objectStore(STORE_NAME);
          delStore.delete(item.id).onsuccess = res;
        });
        
        // Update cache with server data if it's a workout
        if (item.table === 'workouts' && resultData?.[0]) {
          const cachedWorkouts = await getCachedData('workouts') || [];
          const updatedCache = cachedWorkouts.map(w => {
            if (w.timestamp === item.payload.timestamp && w.exercise_name === item.payload.exercise_name) {
              return { ...resultData[0], is_local: false };
            }
            return w;
          });
          await cacheData('workouts', updatedCache);
        }
        
        console.log('Successfully synced item:', item);
      }
    } catch (err) {
      console.error("Sync error", err);
    }
  }
}

// Load workouts, combining cached and server data
export async function loadWorkouts() {
  const tombstones = await getCachedData(WORKOUT_DELETE_TOMBSTONES_KEY) || [];
  const cachedWorkouts = filterDeletedWorkouts(await getCachedData('workouts') || [], tombstones);
  const localCachedWorkouts = cachedWorkouts.filter((workout) => workout.is_local);
  
  if (!navigator.onLine) {
    console.log('Offline, using cached workouts');
    return localCachedWorkouts;
  }
  
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);
      
    if (error) throw error;
    const filteredServerData = filterDeletedWorkouts(data || [], tombstones);
    // #region debug-point C:load-workouts-source
    fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'logbook-delete-reappears', runId: 'post-fix', hypothesisId: 'C', location: 'offlineSync.js:loadWorkouts:source', msg: '[DEBUG] loadWorkouts fetched sources', data: { cachedCount: cachedWorkouts.length, cachedLocalCount: localCachedWorkouts.length, cachedLocalIds: localCachedWorkouts.slice(0, 5).map((w) => w.id), serverCount: Array.isArray(filteredServerData) ? filteredServerData.length : -1, serverIds: Array.isArray(filteredServerData) ? filteredServerData.slice(0, 5).map((w) => w.id) : [], tombstoneCount: tombstones.length }, ts: Date.now() }) }).catch(() => {});
    // #endregion
    
    // Merge server data with local unsynced data
    const serverTimestamps = new Set(filteredServerData.map(w => w.timestamp) || []);
    const unsyncedLocal = localCachedWorkouts.filter(w => 
      w.is_local && !serverTimestamps.has(w.timestamp)
    );
    
    const mergedData = [
      ...filteredServerData,
      ...unsyncedLocal
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    // #region debug-point E:load-workouts-merged
    fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'logbook-delete-reappears', runId: 'post-fix', hypothesisId: 'E', location: 'offlineSync.js:loadWorkouts:merged', msg: '[DEBUG] loadWorkouts merged data', data: { unsyncedLocalCount: unsyncedLocal.length, unsyncedLocalIds: unsyncedLocal.slice(0, 5).map((w) => w.id), mergedCount: mergedData.length, mergedIds: mergedData.slice(0, 5).map((w) => w.id) }, ts: Date.now() }) }).catch(() => {});
    // #endregion
    
    await cacheData('workouts', unsyncedLocal);
    return mergedData;
    
  } catch (err) {
    console.error('Failed to load from server, using cache', err);
    return localCachedWorkouts;
  }
}

// Set up automatic listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('Back online. Attempting to sync...');
    await processSyncQueue();
  });
}
