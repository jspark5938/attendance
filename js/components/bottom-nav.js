/**
 * Bottom navigation bar (mobile only)
 */

import { escapeHtml } from '../utils/dom.js';

const NAV_ITEMS = [
  { icon: '⊞', label: '홈',   hash: '#/',        key: 'home' },
  { icon: '👥', label: '그룹', hash: '#/groups',  key: 'groups' },
  { icon: '📅', label: '달력', hash: '#/calendar', key: 'calendar' },
  { icon: '📊', label: '통계', hash: '#/stats',   key: 'stats' },
  { icon: '⚙',  label: '설정', hash: '#/settings',key: 'settings' },
];

export const BottomNav = {
  _el: null,

  init() {
    this._el = document.querySelector('.bottom-nav');
    if (!this._el) return;
    this._render();
    window.addEventListener('hashchange', () => this._updateActive());
  },

  _render() {
    this._el.innerHTML = `
      <nav class="bottom-nav-inner" aria-label="하단 메뉴">
        ${NAV_ITEMS.map(item => `
          <a href="${escapeHtml(item.hash)}"
             class="bottom-nav-item${this._isActive(item.hash) ? ' active' : ''}"
             data-key="${item.key}"
             aria-label="${escapeHtml(item.label)}"
             aria-current="${this._isActive(item.hash) ? 'page' : 'false'}">
            <span class="bottom-nav-icon" aria-hidden="true">${item.icon}</span>
            <span class="bottom-nav-label">${escapeHtml(item.label)}</span>
          </a>
        `).join('')}
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
