/**
 * Dashboard page
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { ContractsDB } from '../db/contracts.js';
import { getAll, getByKey } from '../db/database.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, formatDateKo, shiftDate } from '../utils/date.js';
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

    // Load expiring contracts
    const expiringList = await this._loadExpiringContracts(groups);

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
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
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

        ${expiringList.length > 0 ? this._expiringCard(expiringList) : ''}

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

  async _loadExpiringContracts(groups) {
    const alertSettings  = await getByKey('settings', 'contract_alert') ?? {};
    const periodDays     = alertSettings.periodDays     ?? 7;
    const countRemaining = alertSettings.countRemaining ?? 3;
    const thresholdDate  = shiftDate(this.today, periodDays);

    // Build lookup maps
    const allStudents = await getAll('students');
    const studentMap  = {};
    allStudents.forEach(s => { studentMap[s.id] = s; });
    const groupMap = {};
    groups.forEach(g => { groupMap[g.id] = g; });

    // Get all active contracts across all groups
    const allContracts = await getAll('contracts');
    const activeContracts = allContracts.filter(c => c.status === 'active');

    const expiring = [];

    for (const c of activeContracts) {
      const student = studentMap[c.studentId];
      const group   = groupMap[c.groupId];
      if (!student || !group) continue;

      if (c.type === 'period') {
        if (!c.endDate) continue;
        // Show if endDate is today or within N days (include expired today/past)
        if (c.endDate >= this.today && c.endDate <= thresholdDate) {
          const daysLeft = Math.round((new Date(c.endDate + 'T00:00:00') - new Date(this.today + 'T00:00:00')) / 86400000);
          expiring.push({ student, group, contract: c, type: 'period', daysLeft, remaining: null });
        }
      } else if (c.type === 'count') {
        const records  = await AttendanceDB.getByStudent(c.studentId);
        const startDate = c.startDate || '2000-01-01';
        const used      = records.filter(r => ['present', 'late', 'early'].includes(r.status) && r.date >= startDate).length;
        const remaining = (c.totalCount || 0) - used;
        if (remaining <= countRemaining) {
          expiring.push({ student, group, contract: c, type: 'count', daysLeft: null, remaining });
        }
      }
    }

    // Sort: count-type (urgent) first, then by daysLeft / remaining
    expiring.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'count' ? -1 : 1;
      if (a.type === 'period') return a.daysLeft - b.daysLeft;
      return a.remaining - b.remaining;
    });

    return expiring;
  }

  _expiringCard(list) {
    const rows = list.map(({ student, group, contract, type, daysLeft, remaining }) => {
      const typeBadge = type === 'period'
        ? `<span style="font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:var(--color-primary-light); color:var(--color-primary);">기간제</span>`
        : `<span style="font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:#fef3c7; color:#92400e;">횟수제</span>`;
      const statusColor = type === 'period'
        ? (daysLeft <= 3 ? 'var(--color-absent)' : 'var(--color-late)')
        : (remaining <= 0 ? 'var(--color-absent)' : 'var(--color-late)');
      const statusText = type === 'period'
        ? (daysLeft === 0 ? '오늘 종료' : `${daysLeft}일 남음`)
        : (remaining <= 0 ? '소진' : `잔여 ${remaining}회`);

      return `
        <div class="list-item">
          <span style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(group.color)};flex-shrink:0;"></span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:14px;">${escapeHtml(student.name)}</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:1px;">${escapeHtml(group.name)}</div>
          </div>
          ${typeBadge}
          <div style="font-size:13px; font-weight:700; color:${statusColor}; flex-shrink:0;">${statusText}</div>
          <a href="#/groups/${group.id}" class="btn btn-ghost btn-sm" style="flex-shrink:0; font-size:12px;">관리 →</a>
        </div>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom: var(--space-5); border: 1.5px solid var(--color-late);">
        <div class="card-header">
          <div class="card-title" style="color:var(--color-late);">⚠ 계약 종료 예정
            <span style="font-size:12px; font-weight:600; background:var(--color-late); color:white; border-radius:10px; padding:1px 8px; margin-left:6px;">${list.length}</span>
          </div>
          <a href="#/settings" class="btn btn-ghost btn-sm" style="font-size:12px;">기준 설정 →</a>
        </div>
        <div>${rows}</div>
      </div>`;
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
