/**
 * Date utility functions
 */

/**
 * Returns today's date as YYYY-MM-DD string
 */
export function todayStr() {
  return dateToStr(new Date());
}

/**
 * Converts a Date to YYYY-MM-DD string
 */
export function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date
 */
export function strToDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a YYYY-MM-DD string to Korean display format
 * e.g. "2024-03-15" → "2024년 3월 15일 (금)"
 */
export function formatDateKo(str, options = {}) {
  const date = strToDate(str);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];

  if (options.short) {
    return `${date.getMonth() + 1}/${date.getDate()}(${dayName})`;
  }
  if (options.monthDay) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayName})`;
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dayName})`;
}

/**
 * Returns the YYYY-MM string for a date string
 */
export function getYearMonth(dateStr) {
  return dateStr.slice(0, 7);
}

/**
 * Returns the year and month as { year, month } from a YYYY-MM-DD string
 */
export function parseYearMonth(str) {
  const [year, month] = str.split('-').map(Number);
  return { year, month };
}

/**
 * Returns all YYYY-MM-DD strings for a given year/month
 */
export function getDaysInMonth(year, month) {
  const days = [];
  const daysCount = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysCount; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

/**
 * Returns all YYYY-MM-DD strings in the current month
 */
export function getCurrentMonthDays() {
  const today = new Date();
  return getDaysInMonth(today.getFullYear(), today.getMonth() + 1);
}

/**
 * Shifts a YYYY-MM-DD string by n days
 */
export function shiftDate(dateStr, days) {
  const d = strToDate(dateStr);
  d.setDate(d.getDate() + days);
  return dateToStr(d);
}

/**
 * Shifts a YYYY-MM string by n months
 * Returns YYYY-MM string
 */
export function shiftMonth(yearMonthStr, months) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formats YYYY-MM string to Korean: "2024년 3월"
 */
export function formatYearMonthKo(yearMonthStr) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  return `${y}년 ${m}월`;
}

/**
 * Returns relative label for a date string: "오늘", "어제", or formatted date
 */
export function relativeDateLabel(dateStr) {
  const today = todayStr();
  const yesterday = shiftDate(today, -1);
  if (dateStr === today) return '오늘';
  if (dateStr === yesterday) return '어제';
  return formatDateKo(dateStr, { short: true });
}

/**
 * Returns whether dateStr is today
 */
export function isToday(dateStr) {
  return dateStr === todayStr();
}

/**
 * Returns whether dateStr is in the future
 */
export function isFuture(dateStr) {
  return dateStr > todayStr();
}

/**
 * Given a contract end date and a student's attendanceDays (e.g. ['월','수','금']),
 * returns the number of days to extend so that exactly one more class session fits.
 * Searches up to 14 days forward from the day after endDate.
 * Falls back to 1 if no match found (e.g. attendanceDays is empty).
 */
export function daysToNextClass(endDateStr, attendanceDays) {
  const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  if (!attendanceDays || attendanceDays.length === 0) return 1;
  const base = strToDate(endDateStr);
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    if (attendanceDays.includes(DOW_KO[d.getDay()])) return i;
  }
  return 1;
}

/**
 * Generates a UUID v4
 */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
