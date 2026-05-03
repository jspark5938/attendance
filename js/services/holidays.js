/**
 * 공휴일 서비스 — js/utils/holidays.js 하드코딩 데이터 사용 (2020-2030)
 * 한국어 로케일에서만 공휴일을 표시하고, 그 외 언어에서는 표시하지 않습니다.
 */

import { getHolidaysForYear, getHoliday as _getHoliday } from '../utils/holidays.js';
import { getLocale } from '../utils/i18n.js';

function isKorean() { return getLocale() === 'ko'; }

export const HolidayService = {
  /**
   * 연월의 공휴일 Map 반환 { 'YYYY-MM-DD' → '공휴일명' }
   * 한국어 로케일이 아니면 빈 Map을 반환합니다.
   */
  async getHolidaysForMonth(year, month) {
    if (!isKorean()) return new Map();
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
   * 한국어 로케일이 아니면 null을 반환합니다.
   */
  async getHoliday(dateStr) {
    if (!isKorean()) return null;
    return _getHoliday(dateStr);
  },
};
