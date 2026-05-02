/**
 * Bottom navigation bar (mobile only)
 */

import { escapeHtml } from '../utils/dom.js';
import { t } from '../utils/i18n.js';

const NAV_ITEMS = [
  { icon: '⊞', labelKey: 'nav.home',     hash: '#/',         key: 'home' },
  { icon: '👥', labelKey: 'nav.groups',   hash: '#/groups',   key: 'groups' },
  { icon: '📅', labelKey: 'nav.calendar', hash: '#/calendar', key: 'calendar' },
  { icon: '📊', labelKey: 'nav.stats',    hash: '#/stats',    key: 'stats' },
  { icon: '⚙',  labelKey: 'nav.settings', hash: '#/settings', key: 'settings' },
];

export const BottomNav = {
  _el: null,

  init() {
    this._el = document.querySelector('.bottom-nav');
    if (!this._el) return;
    this.render();
    window.addEventListener('hashchange', () => this._updateActive());
  },

  render() {
    if (!this._el) return;
    this._el.innerHTML = `
      <nav class="bottom-nav-inner" aria-label="${escapeHtml(t('nav.bottomNav'))}">
        ${NAV_ITEMS.map(item => {
          const label = t(item.labelKey);
          return `
          <a href="${escapeHtml(item.hash)}"
             class="bottom-nav-item${this._isActive(item.hash) ? ' active' : ''}"
             data-key="${item.key}"
             aria-label="${escapeHtml(label)}"
             aria-current="${this._isActive(item.hash) ? 'page' : 'false'}">
            <span class="bottom-nav-icon" aria-hidden="true">${item.icon}</span>
            <span class="bottom-nav-label">${escapeHtml(label)}</span>
          </a>`;
        }).join('')}
      </nav>
    `;
  },

  _updateActive() {
    if (!this._el) return;
    this._el.querySelectorAll('.bottom-nav-item').forEach(item => {
      const hash = item.getAttribute('href');
      const active = this._isActive(hash);
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
  },

  _isActive(hash) {
    const current = window.location.hash || '#/';
    if (hash === '#/') return current === '#/' || current === '#';
    return current.startsWith(hash);
  },
};

export default BottomNav;
