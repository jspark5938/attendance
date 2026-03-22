/**
 * Sidebar navigation component (PC only)
 */

import { GroupsDB } from '../db/groups.js';
import { escapeHtml } from '../utils/dom.js';

const NAV_ITEMS = [
  { icon: '⊞', label: '대시보드',  hash: '#/' },
  { icon: '👥', label: '그룹 관리', hash: '#/groups' },
  { icon: '📅', label: '달력',      hash: '#/calendar' },
  { icon: '📊', label: '통계',      hash: '#/stats' },
  { icon: '⚙',  label: '설정',      hash: '#/settings' },
];

export const Sidebar = {
  _el: null,
  _unsubscribeHash: null,

  init() {
    this._el = document.querySelector('.sidebar');
    if (!this._el) return;
    this.render();
    this._bindHashChange();
  },

  async render() {
    if (!this._el) return;

    let groups = [];
    try { groups = await GroupsDB.getAll(); } catch (e) { /* ignore */ }

    const current = window.location.hash || '#/';

    this._el.innerHTML = `
      <div class="sidebar-header">
        <a href="#/" class="sidebar-logo" aria-label="홈으로">
          <div class="sidebar-logo-icon">출</div>
          <span class="sidebar-logo-text">출석부</span>
        </a>
      </div>

      <nav class="sidebar-nav" aria-label="메인 메뉴">
        ${NAV_ITEMS.map(item => `
          <a href="${item.hash}"
             class="sidebar-nav-item${this._isActive(item.hash, current) ? ' active' : ''}"
             aria-current="${this._isActive(item.hash, current) ? 'page' : 'false'}">
            <span class="nav-icon" aria-hidden="true">${item.icon}</span>
            ${escapeHtml(item.label)}
          </a>
        `).join('')}

        <div class="sidebar-section-label">내 그룹</div>
        <div class="sidebar-group-list">
          ${groups.map(g => `
            <a href="#/groups/${g.id}"
               class="sidebar-group-item${current.startsWith('#/groups/' + g.id) ? ' active' : ''}"
               data-group-id="${g.id}">
              <span class="sidebar-group-dot" style="background:${escapeHtml(g.color)}"></span>
              <span class="sidebar-group-name">${escapeHtml(g.name)}</span>
            </a>
          `).join('')}
          ${groups.length === 0 ? `<div style="padding: 8px 12px; font-size: 13px; color: var(--color-text-muted);">그룹이 없습니다</div>` : ''}
          <a href="#/groups" class="sidebar-nav-item" style="margin-top:4px; font-size:12px; color: var(--color-primary);">
            + 그룹 추가
          </a>
        </div>
      </nav>

    `;
  },

  _isActive(itemHash, current) {
    if (itemHash === '#/') return current === '#/' || current === '#';
    return current.startsWith(itemHash);
  },

  _bindHashChange() {
    if (this._unsubscribeHash) return;
    const handler = () => this.render();
    window.addEventListener('hashchange', handler);
    this._unsubscribeHash = () => window.removeEventListener('hashchange', handler);
  },

  /** Call when groups change to refresh the list */
  refresh() {
    this.render();
  },

  destroy() {
    if (this._unsubscribeHash) this._unsubscribeHash();
  },
};

export default Sidebar;
