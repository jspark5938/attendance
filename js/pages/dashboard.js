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
import { t } from '../utils/i18n.js';

export class DashboardPage {
  constructor() {
    this.today = todayStr();
  }

  async render() {
    const groups = await GroupsDB.getAll();

    // Load today's summaries for each group
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDay  = DAY_NAMES[new Date(this.today + 'T00:00:00').getDay()];

    const groupStats = await Promise.all(groups.map(async g => {
      const students = await StudentsDB.getByGroup(g.id);
      const attMap = await AttendanceDB.getByGroupDate(g.id, this.today);
      const records = Object.values(attMap);
      const present   = records.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'early').length;
      const absent    = records.filter(r => r.status === 'absent').length;
      const none      = students.length - records.length;
      const scheduled = students.filter(s => !s.attendanceDays?.length || s.attendanceDays.includes(todayDay)).length;
      const rate      = students.length > 0 ? Math.round(present / students.length * 100) : 0;
      return { group: g, students: students.length, present, absent, none, scheduled, rate };
    }));

    const totalStudents  = groupStats.reduce((s, g) => s + g.students, 0);
    const totalPresent   = groupStats.reduce((s, g) => s + g.present, 0);
    const totalAbsent    = groupStats.reduce((s, g) => s + g.absent, 0);
    const totalScheduled = groupStats.reduce((s, g) => s + g.scheduled, 0);

    // Load expiring contracts
    const expiringList = await this._loadExpiringContracts(groups);

    return `
      <div class="page-body">
        <!-- Overall stats -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
          <div class="stat-card">
            <div class="stat-card-label">${t('dashboard.totalGroups')}</div>
            <div class="stat-card-value">${groups.length}</div>
            <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:100%;"></div></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">${t('dashboard.totalStudents')}</div>
            <div class="stat-card-value">${totalStudents}</div>
            <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:100%;"></div></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">${t('dashboard.todayPresent')}</div>
            <div class="stat-card-value" style="color:var(--color-present);">
              ${totalPresent}<span style="font-size:0.55em;font-weight:500;color:var(--color-text-muted);"> / ${totalScheduled}</span>
            </div>
            <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:${totalScheduled > 0 ? Math.round(totalPresent/totalScheduled*100) : 0}%;background:var(--color-present);"></div></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">${t('dashboard.todayAbsent')}</div>
            <div class="stat-card-value" style="color:var(--color-absent)">${totalAbsent}</div>
            <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:${totalStudents > 0 ? Math.round(totalAbsent/totalStudents*100) : 0}%;background:var(--color-absent);"></div></div>
          </div>
        </div>

        ${expiringList.length > 0 ? this._expiringCard(expiringList) : ''}

        ${groups.length === 0 ? this._emptyGroups() : ''}

        <!-- Group cards with today's status -->
        ${groups.length > 0 ? `
          <div class="card" style="margin-bottom: var(--space-5);">
            <div class="card-header">
              <div class="card-title">${t('dashboard.todayStatus')}</div>
              <a href="#/groups" class="btn btn-ghost btn-sm" style="font-size:12px;">${t('dashboard.manageAll')}</a>
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

    // Get all contracts; build set of studentIds who have a pending contract
    const allContracts = await getAll('contracts');
    const pendingStudentIds = new Set(
      allContracts.filter(c => c.status === 'pending').map(c => c.studentId)
    );
    const activeContracts = allContracts.filter(c => c.status === 'active');

    const expiring = [];

    for (const c of activeContracts) {
      // Skip students who already have a queued (pending) contract
      if (pendingStudentIds.has(c.studentId)) continue;
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
        // Only show if still has sessions left (remaining > 0), matching period's endDate >= today behavior.
        // Exhausted contracts (remaining <= 0) are handled by auto-activation in _loadContractStatus.
        if (remaining > 0 && remaining <= countRemaining) {
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
        ? `<span style="font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:var(--color-primary-light); color:var(--color-primary);">${t('dashboard.periodBadge')}</span>`
        : `<span style="font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:#fef3c7; color:#92400e;">${t('dashboard.countBadge')}</span>`;
      const statusColor = type === 'period'
        ? (daysLeft <= 3 ? 'var(--color-absent)' : 'var(--color-late)')
        : (remaining <= 0 ? 'var(--color-absent)' : 'var(--color-late)');
      const statusText = type === 'period'
        ? (daysLeft === 0 ? t('dashboard.endsToday') : t('dashboard.daysLeft', { n: daysLeft }))
        : (remaining <= 0 ? t('dashboard.exhausted') : t('dashboard.remaining', { n: remaining }));

      return `
        <div class="list-item">
          <span style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(group.color)};flex-shrink:0;"></span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:14px;">${escapeHtml(student.name)}</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:1px;">${escapeHtml(group.name)}</div>
          </div>
          ${typeBadge}
          <div style="font-size:13px; font-weight:700; color:${statusColor}; flex-shrink:0;">${statusText}</div>
          <a href="#/groups/${group.id}" class="btn btn-ghost btn-sm" style="flex-shrink:0; font-size:12px;">${t('dashboard.manage')}</a>
        </div>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom: var(--space-5); border: 1.5px solid var(--color-late);">
        <div class="card-header">
          <div class="card-title" style="color:var(--color-late);">${t('dashboard.contractExpiry')}
            <span style="font-size:12px; font-weight:600; background:var(--color-late); color:white; border-radius:10px; padding:1px 8px; margin-left:6px;">${list.length}</span>
          </div>
          <a href="#/settings" class="btn btn-ghost btn-sm" style="font-size:12px;">${t('dashboard.criteriaSettings')}</a>
        </div>
        <div>${rows}</div>
      </div>`;
  }

  _emptyGroups() {
    return `
      <div class="empty-state" style="padding: var(--space-10) var(--space-6);">
        <div class="empty-state-icon">👋</div>
        <div class="empty-state-title">${t('dashboard.welcome')}</div>
        <div class="empty-state-desc">${t('dashboard.welcomeDesc')}</div>
        <a href="#/groups" class="btn btn-primary" style="margin-top: 12px;">${t('dashboard.firstGroup')}</a>
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
              ${t('dashboard.present')} ${present}
            </span>
            <span class="att-summary-item">
              <span class="att-summary-dot" style="background:var(--color-absent)"></span>
              ${t('dashboard.absent')} ${absent}
            </span>
            ${none > 0 ? `<span class="att-summary-item">
              <span class="att-summary-dot" style="background:var(--color-text-muted)"></span>
              ${t('dashboard.notEntered')} ${none}
            </span>` : ''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size: 18px; font-weight: 700; color: var(--color-present);">${rate}%</div>
          <div style="font-size: 12px; color: var(--color-text-muted);">${t('dashboard.studentCount', { n: students })}</div>
        </div>
        <a href="#/groups/${group.id}/attend" class="btn btn-primary btn-sm" style="flex-shrink:0;">${t('dashboard.attendCheck')}</a>
      </div>
    `;
  }

  async mount() {}
  destroy() {}
}
