// Reads from legacy IndexedDB and returns all data
export async function readLegacyIndexedDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('AttendanceAppDB', 3);
    req.onerror = () => resolve(null);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const storeNames = ['groups', 'students', 'attendance', 'contracts', 'closedDays', 'settings'];
      const result = {};
      let pending = storeNames.length;

      storeNames.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          result[name] = [];
          if (--pending === 0) resolve(result);
          return;
        }
        const tx = db.transaction(name, 'readonly');
        const req2 = tx.objectStore(name).getAll();
        req2.onsuccess = () => {
          result[name] = req2.result || [];
          if (--pending === 0) resolve(result);
        };
        req2.onerror = () => {
          result[name] = [];
          if (--pending === 0) resolve(result);
        };
      });
    };
    req.onupgradeneeded = () => resolve(null); // DB didn't exist
  });
}

export async function hasLegacyData() {
  const data = await readLegacyIndexedDB();
  return data && data.groups && data.groups.length > 0;
}
