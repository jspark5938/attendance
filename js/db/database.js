/**
 * IndexedDB wrapper
 * Provides a singleton database connection.
 */

const DB_NAME = 'AttendanceAppDB';
const DB_VERSION = 3;

let _db = null;

/**
 * Opens (or returns cached) IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (e.oldVersion < 1) {
        // ----- groups -----
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' });
        }

        // ----- students -----
        if (!db.objectStoreNames.contains('students')) {
          const st = db.createObjectStore('students', { keyPath: 'id' });
          st.createIndex('by_group', 'groupId', { unique: false });
        }

        // ----- attendance -----
        // Key = `${studentId}_${date}` (deterministic, enables simple put-upsert)
        if (!db.objectStoreNames.contains('attendance')) {
          const at = db.createObjectStore('attendance', { keyPath: 'id' });
          at.createIndex('by_student',    'studentId',          { unique: false });
          at.createIndex('by_group',      'groupId',            { unique: false });
          at.createIndex('by_date',       'date',               { unique: false });
          at.createIndex('by_group_date', ['groupId', 'date'],  { unique: false });
        }

        // ----- settings -----
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      }

      if (e.oldVersion < 2) {
        // ----- contracts -----
        if (!db.objectStoreNames.contains('contracts')) {
          const ct = db.createObjectStore('contracts', { keyPath: 'id' });
          ct.createIndex('by_student', 'studentId', { unique: false });
          ct.createIndex('by_group',   'groupId',   { unique: false });
        }
      }

      if (e.oldVersion < 3) {
        // ----- closedDays -----
        // Key = `${groupId}_${date}` (e.g. "abc123_2026-03-25")
        if (!db.objectStoreNames.contains('closedDays')) {
          const cd = db.createObjectStore('closedDays', { keyPath: 'id' });
          cd.createIndex('by_group', 'groupId', { unique: false });
          cd.createIndex('by_date',  'date',    { unique: false });
        }
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };

    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked — close other tabs'));
  });
}

/**
 * Generic helpers
 */

/** Get all records from a store */
export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Get a record by key */
export async function getByKey(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Get all records from a store matching an index value */
export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Put (upsert) a record */
export async function put(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Delete a record by key */
export async function del(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Count records in a store */
export async function count(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Count records matching an index */
export async function countByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.count(IDBKeyRange.only(value));
    req.onsuccess = () => resolve(req.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

/** Bulk put (upsert) multiple records in a single transaction */
export async function putBulk(storeName, records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach(r => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/** Delete all records matching an index value */
export async function deleteByIndex(storeName, indexName, value) {
  const records = await getAllByIndex(storeName, indexName, value);
  if (!records.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach(r => store.delete(r.id));
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/**
 * Export entire database as JSON (for backup)
 */
export async function exportAllData() {
  const [groups, students, attendance, settings, contracts, closedDays] = await Promise.all([
    getAll('groups'),
    getAll('students'),
    getAll('attendance'),
    getAll('settings'),
    getAll('contracts'),
    getAll('closedDays'),
  ]);
  return { version: DB_VERSION, exportedAt: new Date().toISOString(), groups, students, attendance, settings, contracts, closedDays };
}

/**
 * Import backup JSON into database (replaces all data)
 */
export async function importAllData(data) {
  if (!data?.groups || !data?.students || !data?.attendance) {
    throw new Error('올바르지 않은 백업 파일입니다.');
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['groups', 'students', 'attendance', 'settings', 'contracts', 'closedDays'], 'readwrite');

    // Clear all stores first
    tx.objectStore('groups').clear();
    tx.objectStore('students').clear();
    tx.objectStore('attendance').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('contracts').clear();
    tx.objectStore('closedDays').clear();

    // Re-insert
    data.groups.forEach(r    => tx.objectStore('groups').put(r));
    data.students.forEach(r  => tx.objectStore('students').put(r));
    data.attendance.forEach(r => tx.objectStore('attendance').put(r));
    (data.settings   || []).forEach(r => tx.objectStore('settings').put(r));
    (data.contracts  || []).forEach(r => tx.objectStore('contracts').put(r));
    (data.closedDays || []).forEach(r => tx.objectStore('closedDays').put(r));

    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}
