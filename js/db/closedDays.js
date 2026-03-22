/**
 * ClosedDays store — per-group holiday/closed day management
 * Key = `${groupId}_${date}`
 */

import { getByKey, getAllByIndex, put, del } from './database.js';

export const ClosedDaysDB = {
  /** Check if a specific date is closed for a group */
  async get(groupId, date) {
    return getByKey('closedDays', `${groupId}_${date}`);
  },

  /** Get all closed days for a group */
  async getByGroup(groupId) {
    return getAllByIndex('closedDays', 'by_group', groupId);
  },

  /** Get a Set of closed date strings for a group within a date range */
  async getSetByGroupDateRange(groupId, startDate, endDate) {
    const all = await this.getByGroup(groupId);
    const set = new Set();
    all.filter(r => r.date >= startDate && r.date <= endDate).forEach(r => set.add(r.date));
    return set;
  },

  /** Set a date as closed */
  async set(groupId, date, memo = '') {
    return put('closedDays', { id: `${groupId}_${date}`, groupId, date, memo });
  },

  /** Remove a closed day */
  async remove(groupId, date) {
    return del('closedDays', `${groupId}_${date}`);
  },

  /** Toggle: returns true if now closed, false if now open */
  async toggle(groupId, date) {
    const existing = await this.get(groupId, date);
    if (existing) {
      await this.remove(groupId, date);
      return false;
    } else {
      await this.set(groupId, date);
      return true;
    }
  },
};
