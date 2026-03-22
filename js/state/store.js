/**
 * Lightweight reactive state store (pub/sub pattern)
 * No dependencies, no build tools needed.
 */

class Store {
  constructor(initial = {}) {
    this._state = { ...initial };
    this._listeners = {};
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    this._state[key] = value;
    const handlers = this._listeners[key];
    if (handlers) {
      handlers.forEach(fn => {
        try { fn(value, key); } catch (e) { console.error('[Store] listener error', e); }
      });
    }
  }

  /** Update multiple keys at once */
  update(obj) {
    Object.entries(obj).forEach(([k, v]) => this.set(k, v));
  }

  /**
   * Subscribe to changes on a key.
   * Returns an unsubscribe function.
   */
  subscribe(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
    return () => {
      this._listeners[key] = this._listeners[key].filter(f => f !== fn);
    };
  }

  /** Get a snapshot of the full state */
  snapshot() {
    return { ...this._state };
  }
}

/**
 * Application-level store
 * Keys:
 *   isPremium    {boolean}  — whether user has premium
 *   currentGroup {object|null} — currently viewed group
 *   currentDate  {string}   — currently selected date (YYYY-MM-DD)
 */
export const store = new Store({
  isPremium:    false,
  currentGroup: null,
  currentDate:  null,
});

export default store;
