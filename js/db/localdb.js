/**
 * localStorage-based DB — same interface as database.js (Firestore)
 * Used when running in guest mode (not signed in).
 */

const PREFIX = 'attendance_local_';
const STORE_NAMES = ['groups', 'students', 'attendance', 'settings', 'contracts', 'closedDays'];
const INDEX_TO_FIELD = { by_group: 'groupId', by_student: 'studentId', by_date: 'date' };

function load(storeName) {
  try { return JSON.parse(localStorage.getItem(PREFIX + storeName) || '{}'); }
  catch { return {}; }
}

function save(storeName, data) {
  localStorage.setItem(PREFIX + storeName, JSON.stringify(data));
}

export function localGetAll(storeName) {
  return Object.values(load(storeName));
}

export function localGetByKey(storeName, key) {
  return load(storeName)[String(key)] ?? null;
}

export function localGetAllByIndex(storeName, indexName, value) {
  const field = INDEX_TO_FIELD[indexName];
  if (!field) throw new Error(`알 수 없는 인덱스: ${indexName}`);
  return Object.values(load(storeName)).filter(r => r[field] === value);
}

export function localPut(storeName, record) {
  const data = load(storeName);
  const key = record.id ?? record.key;
  data[String(key)] = record;
  save(storeName, data);
  return record;
}

export function localDel(storeName, key) {
  const data = load(storeName);
  delete data[String(key)];
  save(storeName, data);
}

export function localCount(storeName) {
  return Object.keys(load(storeName)).length;
}

export function localCountByIndex(storeName, indexName, value) {
  return localGetAllByIndex(storeName, indexName, value).length;
}

export function localPutBulk(storeName, records) {
  const data = load(storeName);
  records.forEach(r => { data[String(r.id ?? r.key)] = r; });
  save(storeName, data);
}

export function localDeleteByIndex(storeName, indexName, value) {
  const field = INDEX_TO_FIELD[indexName];
  if (!field) throw new Error(`알 수 없는 인덱스: ${indexName}`);
  const data = load(storeName);
  Object.keys(data).forEach(k => { if (data[k][field] === value) delete data[k]; });
  save(storeName, data);
}

export function localExportAllData() {
  const result = {};
  STORE_NAMES.forEach(name => { result[name] = localGetAll(name); });
  return { version: 3, exportedAt: new Date().toISOString(), ...result };
}

export function localImportData(data) {
  STORE_NAMES.forEach(name => {
    const records = data[name] || [];
    const obj = {};
    records.forEach(r => { obj[String(r.id ?? r.key)] = r; });
    save(name, obj);
  });
}

export function localClear() {
  STORE_NAMES.forEach(name => localStorage.removeItem(PREFIX + name));
}

export function localHasData() {
  return STORE_NAMES.some(name => Object.keys(load(name)).length > 0);
}
