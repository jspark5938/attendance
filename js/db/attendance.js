/**
 * Attendance store CRUD and query operations
 *
 * Attendance record key: `${studentId}_${date}` (YYYY-MM-DD)
 * This deterministic key means upsert = simple put(), no read-before-write needed.
 */

import { getByKey, put, del, getAllByIndex, deleteByIndex, putBulk } from './database.js';

export const AttendanceDB = {
  /**
   * Get attendance record for a student on a specific date
   */
  async get(studentId, date) {
    return getByKey('attendance', `${studentId}_${date}`);
  },

  /**
   * Set (upsert) attendance status for a student on a date
   * absentType: 'normal' | 'makeup' | 'extend' | 'no_deduct' | null
   * makeupDate: 'YYYY-MM-DD' | null
   */
  async set({ studentId, groupId, date, status, note = '', absentType = null, makeupDate = null }) {
    const record = {
      id: `${studentId}_${date}`,
      studentId,
      groupId,
      date,
      status,
      note,
      absentType: status === 'absent' ? (absentType || 'normal') : null,
      makeupDate: (status === 'absent' && absentType === 'makeup') ? makeupDate : null,
      markedAt: new Date().toISOString(),
    };
    await put('attendance', record);
    return record;
  },

  /**
   * Remove attendance record for a student on a date
   */
  async remove(studentId, date) {
    return del('attendance', `${studentId}_${date}`);
  },

  /**
   * Get all attendance records for a group on a specific date
   * Returns a map: { [studentId]: record }
   */
  async getByGroupDate(groupId, date) {
    const all = await getAllByIndex('attendance', 'by_group', groupId);
    const map = {};
    all.filter(r => r.date === date).forEach(r => { map[r.studentId] = r; });
    return map;
  },

  /**
   * Get all attendance records for a student (for stats)
   */
  async getByStudent(studentId) {
    return getAllByIndex('attendance', 'by_student', studentId);
  },

  /**
   * Get all attendance records for a group (for export, stats)
   */
  async getByGroup(groupId) {
    return getAllByIndex('attendance', 'by_group', groupId);
  },

  /**
   * Get attendance records for a group within a date range (YYYY-MM-DD)
   * Returns map: { [studentId_date]: record }
   */
  async getByGroupDateRange(groupId, startDate, endDate) {
    const all = await this.getByGroup(groupId);
    const filtered = all.filter(r => r.date >= startDate && r.date <= endDate);
    const map = {};
    filtered.forEach(r => { map[r.id] = r; });
    return map;
  },

  /**
   * Get all dates that have at least one record for a group
   * Returns sorted array of YYYY-MM-DD strings
   */
  async getDatesWithRecords(groupId) {
    const all = await this.getByGroup(groupId);
    const dates = [...new Set(all.map(r => r.date))].sort();
    return dates;
  },

  /**
   * Bulk set attendance for multiple students on a date (e.g. "mark all present")
   */
  async bulkSet(records) {
    const prepared = records.map(r => ({
      id: `${r.studentId}_${r.date}`,
      studentId: r.studentId,
      groupId:   r.groupId,
      date:      r.date,
      status:    r.status,
      note:      r.note || '',
      markedAt:  new Date().toISOString(),
    }));
    return putBulk('attendance', prepared);
  },

  /**
   * Get attendance records where makeupDate falls within a date range for a group
   * Returns array of records
   */
  async getMakeupsByGroupDateRange(groupId, startDate, endDate) {
    const all = await this.getByGroup(groupId);
    return all.filter(r => r.makeupDate && r.makeupDate >= startDate && r.makeupDate <= endDate);
  },

  /**
   * Delete all attendance records for a group (used when deleting a group)
   */
  async deleteByGroup(groupId) {
    return deleteByIndex('attendance', 'by_group', groupId);
  },

  /**
   * Delete all attendance records for a student
   */
  async deleteByStudent(studentId) {
    return deleteByIndex('attendance', 'by_student', studentId);
  },

  /**
   * Get a summary of statuses for a group on a date
   * Returns { present, absent, late, early, total }
   */
  async getSummaryByGroupDate(groupId, date, totalStudents) {
    const recordMap = await this.getByGroupDate(groupId, date);
    const records = Object.values(recordMap);
    const summary = { present: 0, absent: 0, late: 0, early: 0, none: 0 };
    records.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
    summary.none = totalStudents - records.length;
    summary.total = totalStudents;
    return summary;
  },
};
