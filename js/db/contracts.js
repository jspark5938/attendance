/**
 * Contracts store CRUD operations
 */

import { getAllByIndex, getByKey, put, del } from './database.js';
import { uuid, todayStr, strToDate, dateToStr } from '../utils/date.js';

export const ContractsDB = {
  async getByStudent(studentId) {
    const list = await getAllByIndex('contracts', 'by_student', studentId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getByGroup(groupId) {
    return getAllByIndex('contracts', 'by_group', groupId);
  },
  async get(id) {
    return getByKey('contracts', id);
  },
  async create({ studentId, groupId, type, startDate, endDate, totalCount, memo }) {
    const contract = {
      id: uuid(),
      studentId,
      groupId,
      type,
      startDate: startDate || todayStr(),
      endDate: endDate || '',
      totalCount: totalCount ? Number(totalCount) : null,
      memo: memo || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    await put('contracts', contract);
    return contract;
  },
  async update(id, fields) {
    const contract = await getByKey('contracts', id);
    if (!contract) throw new Error('계약을 찾을 수 없습니다.');
    const updated = { ...contract, ...fields, id };
    await put('contracts', updated);
    return updated;
  },
  async end(id) {
    return this.update(id, { status: 'ended' });
  },
  async delete(id) {
    return del('contracts', id);
  },
  async deleteByStudent(studentId) {
    const list = await this.getByStudent(studentId);
    for (const c of list) await del('contracts', c.id);
  },
  async extendEndDate(id, days = 1) {
    const contract = await getByKey('contracts', id);
    if (!contract?.endDate) throw new Error('기간제 계약이 없습니다.');
    const d = strToDate(contract.endDate);
    d.setDate(d.getDate() + days);
    return this.update(id, { endDate: dateToStr(d) });
  },
};
