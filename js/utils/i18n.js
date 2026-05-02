/**
 * i18n utility
 *
 * API:
 *   await initLocale()           — call once in app.js at startup
 *   t('nav.home')                — get string in current locale
 *   t('messages.daysLeft', {n}) — with {{n}} variable substitution
 *   getLocale()                  — current locale code ('ko' | 'en')
 *   getMessages()                — full locale object (for array access)
 *   await setLocale('en')        — change locale + save to IndexedDB + dispatch localechange event
 */

import koMessages from '../locales/ko.js';
import enMessages from '../locales/en.js';
import { getByKey, put } from '../db/database.js';

const LOCALES = { ko: koMessages, en: enMessages };
export const SUPPORTED_LOCALES = ['ko', 'en'];

let _locale   = 'ko';
let _messages = koMessages;

/** Call once at app startup — reads saved locale from IndexedDB or detects from navigator.language */
export async function initLocale() {
  try {
    const saved = await getByKey('settings', 'locale');
    const savedValue = saved?.value;
    if (savedValue && savedValue !== 'system' && SUPPORTED_LOCALES.includes(savedValue)) {
      _locale = savedValue;
    } else {
      _locale = _detectFromNavigator();
    }
  } catch {
    _locale = _detectFromNavigator();
  }
  _messages = LOCALES[_locale];
}

function _detectFromNavigator() {
  const lang = (navigator.language || 'ko').split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(lang) ? lang : 'ko';
}

/** Returns current locale code */
export function getLocale() {
  return _locale;
}

/** Returns full locale object (for array access like getMessages().date.daysShort) */
export function getMessages() {
  return _messages;
}

/** Change locale, save to IndexedDB, dispatch localechange event */
export async function setLocale(code) {
  await put('settings', { key: 'locale', value: code });
  if (code === 'system') {
    _locale = _detectFromNavigator();
  } else if (SUPPORTED_LOCALES.includes(code)) {
    _locale = code;
  } else {
    _locale = 'ko';
  }
  _messages = LOCALES[_locale];
  window.dispatchEvent(new CustomEvent('localechange', { detail: { locale: _locale } }));
}

/**
 * Translation function.
 * @param {string} key  — dot-notation key e.g. 'nav.home', 'messages.deleteGroupConfirm'
 * @param {object} vars — substitution vars e.g. { n: 3 } replaces {{n}}
 * @returns {string}    — translated string, or key itself if not found
 */
export function t(key, vars) {
  const parts = key.split('.');
  let val = _messages;
  for (const p of parts) {
    if (val == null || typeof val !== 'object') { val = undefined; break; }
    val = val[p];
  }
  if (val == null || typeof val !== 'string') return key;
  if (!vars) return val;
  return val.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

// ─── Backward-compatible exports (existing code imports these) ────────────────

/** @deprecated Use t('status.*') directly */
export const STATUS_LABELS = new Proxy({}, {
  get(_, key) { return t('status.' + String(key)); },
});

export const STATUS_LIST = ['present', 'absent', 'late', 'early'];

export const GROUP_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16',
  '#F97316', '#14B8A6',
];

export const FREE_LIMITS = { groups: 1, students: 20 };

export const PREMIUM_PRICE = '₩9,900';

// Keys that were originally functions taking a name parameter
const _MSG_FUNCTION_KEYS = new Set(['deleteGroupConfirm', 'deleteStudentConfirm']);

/** @deprecated Use t('messages.*') directly */
export const MESSAGES = new Proxy({}, {
  get(_, key) {
    const skey = String(key);
    if (_MSG_FUNCTION_KEYS.has(skey)) {
      // Legacy: MESSAGES.deleteGroupConfirm(name) → interpolated string
      return (name) => t('messages.' + skey, { name });
    }
    // Legacy: MESSAGES.saveFailed → plain string
    return t('messages.' + skey);
  },
});

/** @deprecated Use t('placeholders.*') directly */
export const PLACEHOLDERS = new Proxy({}, {
  get(_, key) { return t('placeholders.' + String(key)); },
});

/** @deprecated Use t('nav.*') directly */
export const NAV_LABELS = new Proxy({}, {
  get(_, key) { return t('nav.' + String(key)); },
});
