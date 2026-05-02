/**
 * Sidebar navigation component (PC only)
 */

import { GroupsDB } from '../db/groups.js';
import { escapeHtml } from '../utils/dom.js';
import { t } from '../utils/i18n.js';

const NAV_ITEMS = [
  { icon: '⊞', labelKey: 'nav.dashboard', hash: '#/' },
  { icon: '👥', labelKey: 'nav.groupMgmt', hash: '#/groups' },
  { icon: '📅', labelKey: 'nav.calendar',  hash: '#/calendar' },
  { icon: '📊', labelKey: 'nav.stats',     hash: '#/stats' },
  { icon: '⚙',  labelKey: 'nav.settings',  hash: '#/settings' },
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
      <nav class="sidebar-nav" aria-label="${escapeHtml(t('nav.mainMenu'))}">
        ${NAV_ITEMS.map(item => `
          <a href="${item.hash}"
             class="sidebar-nav-item${this._isActive(item.hash, current) ? ' active' : ''}"
             aria-current="${this._isActive(item.hash, current) ? 'page' : 'false'}">
            <span class="nav-icon" aria-hidden="true">${item.icon}</span>
            ${escapeHtml(t(item.labelKey))}
          </a>
        `).join('')}

        <div class="sidebar-section-label">${escapeHtml(t('nav.myGroups'))}</div>
        <div class="sidebar-group-list">
          ${groups.map(g => `
            <a href="#/groups/${g.id}"
               class="sidebar-group-item${current.startsWith('#/groups/' + g.id) ? ' active' : ''}"
               data-group-id="${g.id}">
              <span class="sidebar-group-dot" style="background:${escapeHtml(g.color)}"></span>
              <span class="sidebar-group-name">${escapeHtml(g.name)}</span>
            </a>
          `).join('')}
          ${groups.length === 0 ? `<div style="padding: 8px 12px; font-size: 13px; color: var(--color-text-muted);">${escapeHtml(t('nav.noGroupsShort'))}</div>` : ''}
          <a href="#/groups" class="sidebar-nav-item" style="margin-top:4px; font-size:12px; color: var(--color-primary);">
            ${escapeHtml(t('nav.addGroup'))}
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
