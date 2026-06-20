import { supabase } from './supabase';

const DB_NAME = 'JexiOfflineDB';
const STORE_NAME = 'syncQueue';
const CACHE_STORE = 'dataCache';
const DB_VERSION = 2;

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

// Queue an operation when offline
export async function queueSyncData(table, payload) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data }) => {
      const user_id = data?.session?.user?.id;
      if (user_id) {
        payload.user_id = user_id;
      }
      
      const record = { table, payload, timestamp: Date.now() };
      store.add(record);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// Process the queue when back online
export async function processSyncQueue() {
  if (!navigator.onLine) return;
  
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = async () => {
      const items = getAllRequest.result;
      if (items.length === 0) return resolve();
      
      console.log(`Processing ${items.length} offline items...`);
      
      // We process sequentially to avoid DB lock issues or FK constraints
      for (const item of items) {
        try {
          const { error } = await supabase.from(item.table).insert(item.payload);
          if (error) {
            console.error(`Failed to sync item to ${item.table}`, error);
            // Decide if we should keep it or delete it.
            // If it's an RLS failure, it might never succeed, but we'll try later.
          } else {
            // Delete from queue on success
            await new Promise((res) => {
              const delTx = db.transaction(STORE_NAME, 'readwrite');
              const delStore = delTx.objectStore(STORE_NAME);
              delStore.delete(item.id).onsuccess = res;
            });
          }
        } catch (err) {
          console.error("Sync error", err);
        }
      }
      resolve();
    };
    
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

// Set up automatic listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online. Attempting to sync...');
    processSyncQueue();
  });
}
