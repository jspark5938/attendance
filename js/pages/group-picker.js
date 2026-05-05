/**
 * Group picker page
 * 달력/통계처럼 그룹을 먼저 선택해야 하는 페이지에서 사용.
 * mode: 'calendar' | 'stats'
 */

import { GroupsDB } from '../db/groups.js';
import { escapeHtml } from '../utils/dom.js';
import { t } from '../utils/i18n.js';

const MODE_CONFIG = {
  calendar: { labelKey: 'nav.calendar', icon: '📅', hash: (id) => `#/groups/${id}/calendar` },
  stats:    { labelKey: 'nav.stats',    icon: '📊', hash: (id) => `#/groups/${id}/stats` },
};

export class GroupPickerPage {
  constructor({ mode }) {
    this.mode = mode;
    this.config = MODE_CONFIG[mode] || MODE_CONFIG.calendar;
  }

  async render() {
    const groups = await GroupsDB.getAll();
    const { labelKey, icon } = this.config;
    const label = t(labelKey);

    return `
      <div class="page-body">
        ${groups.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-title">${t('groupPicker.noGroups')}</div>
            <div class="empty-state-desc">${t('groupPicker.noGroupsDesc', { label })}</div>
            <a href="#/groups" class="btn btn-primary" style="margin-top:12px;">${t('groupPicker.addGroup')}</a>
          </div>
        ` : `
          <div style="margin-bottom: var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-muted);">
            ${t('groupPicker.selectGroup', { label })}
          </div>
          <div class="grid-2">
            ${groups.map(g => `
              <a href="${escapeHtml(this.config.hash(g.id))}" class="group-card" style="text-decoration:none;">
                <div class="group-card-header">
                  <span class="group-card-color-dot" style="background:${escapeHtml(g.color)}"></span>
                  <span class="group-card-name">${escapeHtml(g.name)}</span>
                  <span style="font-size:20px;">${icon}</span>
                </div>
                ${g.description ? `<div class="group-card-desc">${escapeHtml(g.description)}</div>` : ''}
              </a>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  async mount() {}
  destroy() {}
}
