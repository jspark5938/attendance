/**
 * Group picker page
 * 달력/통계처럼 그룹을 먼저 선택해야 하는 페이지에서 사용.
 * mode: 'calendar' | 'stats'
 */

import { GroupsDB } from '../db/groups.js';
import { escapeHtml } from '../utils/dom.js';

const MODE_CONFIG = {
  calendar: { label: '달력', icon: '📅', hash: (id) => `#/groups/${id}/calendar` },
  stats:    { label: '통계', icon: '📊', hash: (id) => `#/groups/${id}/stats` },
};

export class GroupPickerPage {
  constructor({ mode }) {
    this.mode = mode;
    this.config = MODE_CONFIG[mode] || MODE_CONFIG.calendar;
  }

  async render() {
    const groups = await GroupsDB.getAll();
    const { label, icon } = this.config;

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">${icon} ${label}</h1>
        </div>
      </div>
      <div class="page-body">
        ${groups.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-title">그룹이 없습니다</div>
            <div class="empty-state-desc">${label}을 보려면 먼저 그룹을 만들어 주세요.</div>
            <a href="#/groups" class="btn btn-primary" style="margin-top:12px;">+ 그룹 만들기</a>
          </div>
        ` : `
          <div style="margin-bottom: var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-muted);">
            ${label}을 볼 그룹을 선택하세요.
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
