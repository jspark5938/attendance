import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db, auth } from '../services/firebase.js';

function uid() {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  return u.uid;
}

function coll(storeName) { return collection(db, 'users', uid(), storeName); }
function docRef(storeName, key) { return doc(db, 'users', uid(), storeName, String(key)); }

const INDEX_TO_FIELD = {
  by_group:   'groupId',
  by_student: 'studentId',
  by_date:    'date',
};

export async function getAll(storeName) {
  const snap = await getDocs(coll(storeName));
  return snap.docs.map(d => d.data());
}

export async function getByKey(storeName, key) {
  const snap = await getDoc(docRef(storeName, key));
  return snap.exists() ? snap.data() : null;
}

export async function getAllByIndex(storeName, indexName, value) {
  const field = INDEX_TO_FIELD[indexName];
  if (!field) throw new Error(`알 수 없는 인덱스: ${indexName}`);
  const q = query(coll(storeName), where(field, '==', value));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function put(storeName, record) {
  const key = record.id ?? record.key;
  await setDoc(docRef(storeName, key), record);
  return record;
}

export async function del(storeName, key) {
  await deleteDoc(docRef(storeName, key));
}

export async function count(storeName) {
  const snap = await getDocs(coll(storeName));
  return snap.size;
}

export async function countByIndex(storeName, indexName, value) {
  const recs = await getAllByIndex(storeName, indexName, value);
  return recs.length;
}

// Batch put with 500-op chunking
export async function putBulk(storeName, records) {
  if (!records.length) return;
  const u = uid();
  for (let i = 0; i < records.length; i += 400) {
    const batch = writeBatch(db);
    records.slice(i, i + 400).forEach(r => {
      batch.set(doc(db, 'users', u, storeName, String(r.id ?? r.key)), r);
    });
    await batch.commit();
  }
}

export async function deleteByIndex(storeName, indexName, value) {
  const records = await getAllByIndex(storeName, indexName, value);
  if (!records.length) return;
  const u = uid();
  for (let i = 0; i < records.length; i += 400) {
    const batch = writeBatch(db);
    records.slice(i, i + 400).forEach(r => {
      batch.delete(doc(db, 'users', u, storeName, String(r.id ?? r.key)));
    });
    await batch.commit();
  }
}

export async function exportAllData() {
  const [groups, students, attendance, settings, contracts, closedDays] = await Promise.all([
    getAll('groups'), getAll('students'), getAll('attendance'),
    getAll('settings'), getAll('contracts'), getAll('closedDays'),
  ]);
  return { version: 3, exportedAt: new Date().toISOString(), groups, students, attendance, settings, contracts, closedDays };
}

export async function importAllData(data) {
  if (!data?.groups || !data?.students || !data?.attendance) {
    throw new Error('올바르지 않은 백업 파일입니다.');
  }
  const u = uid();
  const storeNames = ['groups', 'students', 'attendance', 'settings', 'contracts', 'closedDays'];

  // Clear existing
  for (const name of storeNames) {
    const snap = await getDocs(collection(db, 'users', u, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Insert new
  const allData = {
    groups: data.groups || [], students: data.students || [],
    attendance: data.attendance || [], settings: data.settings || [],
    contracts: data.contracts || [], closedDays: data.closedDays || [],
  };
  for (const [name, records] of Object.entries(allData)) {
    for (let i = 0; i < records.length; i += 400) {
      const batch = writeBatch(db);
      records.slice(i, i + 400).forEach(r => {
        batch.set(doc(db, 'users', u, name, String(r.id ?? r.key)), r);
      });
      await batch.commit();
    }
  }
}

// openDB kept as no-op for legacy code compatibility
export async function openDB() { return null; }
