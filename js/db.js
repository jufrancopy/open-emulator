const DB_NAME = 'open-emulator-db';
const DB_VERSION = 1;
const STORE_GAMES = 'games';
const SETTINGS_KEY = 'open-emulator-settings-v1';

export const DEFAULT_SETTINGS = {
  touchPreset: 'default',  // 'default' (EmulatorJS adaptive + editable) | 'tablet11'
  cdnChannel: 'stable',    // 'stable' | 'latest'
  startOnLoaded: true,
  language: 'es-419',
  autoFullscreen: true,
  defaultSystem: 'auto'
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        const store = db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
        store.createIndex('systemId', 'systemId', { unique: false });
        store.createIndex('lastPlayed', 'lastPlayed', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listGames() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readonly');
    const store = tx.objectStore(STORE_GAMES);
    const req = store.getAll();
    req.onsuccess = () => {
      // Return lightweight records (omit large blob until launched)
      const items = (req.result || []).map(({ blob, ...meta }) => meta);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getGameWithBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readonly');
    const req = tx.objectStore(STORE_GAMES).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGame({ id, title, filename, systemId, size, blob, favorite = false }) {
  const db = await openDB();
  const record = {
    id: id || `rom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    filename,
    systemId,
    size: size || blob.size || 0,
    favorite,
    addedAt: Date.now(),
    lastPlayed: 0,
    blob
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readwrite');
    tx.objectStore(STORE_GAMES).put(record);
    tx.oncomplete = () => {
      const { blob: _omit, ...meta } = record;
      resolve(meta);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateGameMeta(id, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readwrite');
    const store = tx.objectStore(STORE_GAMES);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result;
      if (!current) {
        resolve(null);
        return;
      }
      const updated = { ...current, ...patch };
      store.put(updated);
      tx.oncomplete = () => {
        const { blob: _omit, ...meta } = updated;
        resolve(meta);
      };
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGame(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readwrite');
    tx.objectStore(STORE_GAMES).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllGames() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GAMES, 'readwrite');
    tx.objectStore(STORE_GAMES).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return { usage: est.usage || 0, quota: est.quota || 0 };
    } catch {
      return null;
    }
  }
  return null;
}
