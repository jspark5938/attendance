/**
 * Dashboard page
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, formatDateKo } from '../utils/date.js';
import { STATUS_LABELS } from '../utils/i18n.js';

export class DashboardPage {
  constructor() {
    this.today = todayStr();
  }

  async render() {
    const groups = await GroupsDB.getAll();

    // Load today's summaries for each group
    const groupStats = await Promise.all(groups.map(async g => {
      const students = await StudentsDB.getByGroup(g.id);
      const attMap = await AttendanceDB.getByGroupDate(g.id, this.today);
      const records = Object.values(attMap);
      const present = records.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'early').length;
      const absent  = records.filter(r => r.status === 'absent').length;
      const none    = students.length - records.length;
      const rate    = students.length > 0 ? Math.round(present / students.length * 100) : 0;
      return { group: g, students: students.length, present, absent, none, rate };
    }));

    const totalStudents = groupStats.reduce((s, g) => s + g.students, 0);
    const totalPresent  = groupStats.reduce((s, g) => s + g.present, 0);
    const totalAbsent   = groupStats.reduce((s, g) => s + g.absent, 0);

    return `
      <div class="page-header">
        <div class="page-header-left">
          <div>
            <h1 class="page-title">대시보드</h1>
            <div class="page-subtitle">${formatDateKo(this.today)}</div>
          </div>
        </div>
        <div class="page-header-actions">
        </div>
      </div>

      <div class="page-body">
        <!-- Overall stats -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-6);">
          <div class="stat-card">
            <div class="stat-card-label">전체 그룹</div>
            <div class="stat-card-value">${groups.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">전체 학생</div>
            <div class="stat-card-value">${totalStudents}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">오늘 출석</div>
            <div class="stat-card-value" style="color:var(--color-present)">${totalPresent}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">오늘 결석</div>
            <div class="stat-card-value" style="color:var(--color-absent)">${totalAbsent}</div>
          </div>
        </div>

        ${groups.length === 0 ? this._emptyGroups() : ''}

        <!-- Group cards with today's status -->
        ${groups.length > 0 ? `
          <div class="card" style="margin-bottom: var(--space-5);">
            <div class="card-header">
              <div class="card-title">오늘 그룹별 현황</div>
              <a href="#/groups" class="btn btn-ghost btn-sm" style="font-size:12px;">전체 관리 →</a>
            </div>
            <div>
              ${groupStats.map(gs => this._groupRow(gs)).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  _emptyGroups() {
    return `
      <div class="empty-state" style="padding: var(--space-10) var(--space-6);">
        <div class="empty-state-icon">👋</div>
        <div class="empty-state-title">환영합니다!</div>
        <div class="empty-state-desc">그룹을 만들어 출석을 시작해 보세요.</div>
        <a href="#/groups" class="btn btn-primary" style="margin-top: 12px;">+ 첫 그룹 만들기</a>
      </div>
    `;
  }

  _groupRow(gs) {
    const { group, students, present, absent, none, rate } = gs;
    return `
      <div class="list-item">
        <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(group.color)};flex-shrink:0;"></span>
        <div style="flex:1; min-width:0;">
          <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(group.name)}</div>
          <div class="att-summary">
            <span class="att-summary-item">
              <span class="att-summary-dot" style="background:var(--color-present)"></span>
              출석 ${present}
            </span>
            <span class="att-summary-item">
              <span class="att-summary-dot" style="background:var(--color-absent)"></span>
              결석 ${absent}
            </span>
            ${none > 0 ? `<span class="att-summary-item">
              <span class="att-summary-dot" style="background:var(--color-text-muted)"></span>
              미입력 ${none}
            </span>` : ''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size: 18px; font-weight: 700; color: var(--color-present);">${rate}%</div>
          <div style="font-size: 12px; color: var(--color-text-muted);">${students}명</div>
        </div>
        <a href="#/groups/${group.id}/attend" class="btn btn-primary btn-sm" style="flex-shrink:0;">출석 체크</a>
      </div>
    `;
  }

  async mount() {}
  destroy() {}
}
