/**
 * Statistics computation service
 */

import { AttendanceDB } from '../db/attendance.js';
import { StudentsDB } from '../db/students.js';
import { getDaysInMonth } from '../utils/date.js';

export const StatsService = {
  /**
   * Compute per-student statistics for a group within a date range.
   * Returns array of:
   *   { student, present, absent, late, early, none, total, rate }
   */
  async getStudentStats(groupId, startDate, endDate) {
    const students = await StudentsDB.getByGroup(groupId);
    if (!students.length) return [];

    const recordMap = await AttendanceDB.getByGroupDateRange(groupId, startDate, endDate);

    // Calculate school days (dates that have at least one record in the group)
    const datesWithRecords = await AttendanceDB.getDatesWithRecords(groupId);
    const datesInRange = datesWithRecords.filter(d => d >= startDate && d <= endDate);
    const totalDays = datesInRange.length;

    return students.map(student => {
      let present = 0, absent = 0, late = 0, early = 0;

      datesInRange.forEach(date => {
        const record = recordMap[`${student.id}_${date}`];
        if (record) {
          if (record.status === 'present') present++;
          else if (record.status === 'absent') absent++;
          else if (record.status === 'late') late++;
          else if (record.status === 'early') early++;
        }
      });

      const marked = present + absent + late + early;
      const none = totalDays - marked;
      // Rate: (present + late + early) / totalDays * 100
      const rate = totalDays > 0 ? Math.round((present + late + early) / totalDays * 100) : 0;

      return { student, present, absent, late, early, none, total: totalDays, rate };
    });
  },

  /**
   * Compute daily summary for a group in a given month.
   * Returns array of { date, present, absent, late, early, none, total }
   */
  async getDailyStats(groupId, year, month) {
    const students = await StudentsDB.getByGroup(groupId);
    const totalStudents = students.length;

    const days = getDaysInMonth(year, month);
    const startDate = days[0];
    const endDate   = days[days.length - 1];

    const recordMap = await AttendanceDB.getByGroupDateRange(groupId, startDate, endDate);

    return days.map(date => {
      const dayRecords = students.map(s => recordMap[`${s.id}_${date}`]).filter(Boolean);
      const summary = { date, present: 0, absent: 0, late: 0, early: 0, none: 0, total: totalStudents };
      dayRecords.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
      summary.none = totalStudents - dayRecords.length;
      return summary;
    });
  },

  /**
   * Monthly attendance rate for the group (present+late+early / total)
   */
  async getMonthlyRate(groupId, year, month) {
    const dailyStats = await this.getDailyStats(groupId, year, month);
    const daysWithRecords = dailyStats.filter(d => (d.present + d.absent + d.late + d.early) > 0);
    if (!daysWithRecords.length) return null;

    const totalPresent = daysWithRecords.reduce((s, d) => s + d.present + d.late + d.early, 0);
    const totalExpected = daysWithRecords.reduce((s, d) => s + d.total, 0);
    return totalExpected > 0 ? Math.round(totalPresent / totalExpected * 100) : 0;
  },
};

export default StatsService;
