/**
 * 공휴일 서비스 — js/utils/holidays.js 하드코딩 데이터 사용 (2020-2030)
 */

import { getHolidaysForYear, getHoliday as _getHoliday } from '../utils/holidays.js';

export const HolidayService = {
  /**
   * 연월의 공휴일 Map 반환 { 'YYYY-MM-DD' → '공휴일명' }
   */
  async getHolidaysForMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const yearMap = getHolidaysForYear(year);
    const map = new Map();
    for (const [ds, name] of yearMap) {
      if (ds.startsWith(prefix)) map.set(ds, name);
    }
    return map;
  },

  /**
   * 특정 날짜의 공휴일명 반환 (없으면 null)
   */
  async getHoliday(dateStr) {
    return _getHoliday(dateStr);
  },
};
