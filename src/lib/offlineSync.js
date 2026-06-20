import { supabase } from './supabase';

const DB_NAME = 'JexiOfflineDB';
const STORE_NAME = 'syncQueue';
const CACHE_STORE = 'dataCache';
const DB_VERSION = 3; // Incremented version

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
      
      // First, save to local workout cache immediately so user sees it
      if (table === 'workouts') {
        const cachedWorkouts = await getCachedData('workouts') || [];
        const newWorkout = { 
          ...payload, 
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary local ID
          user_id,
          is_local: true 
        };
        await cacheData('workouts', [...cachedWorkouts, newWorkout]);
      }
      
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      if (user_id && payload && typeof payload === 'object' && action !== 'delete') {
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
  const cachedWorkouts = await getCachedData('workouts') || [];
  
  if (!navigator.onLine) {
    console.log('Offline, using cached workouts');
    return cachedWorkouts;
  }
  
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);
      
    if (error) throw error;
    
    // Merge server data with local unsynced data
    const serverTimestamps = new Set(data?.map(w => w.timestamp) || []);
    const unsyncedLocal = cachedWorkouts.filter(w => 
      w.is_local && !serverTimestamps.has(w.timestamp)
    );
    
    const mergedData = [
      ...(data || []),
      ...unsyncedLocal
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    await cacheData('workouts', mergedData);
    return mergedData;
    
  } catch (err) {
    console.error('Failed to load from server, using cache', err);
    return cachedWorkouts;
  }
}

// Set up automatic listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('Back online. Attempting to sync...');
    await processSyncQueue();
  });
}
