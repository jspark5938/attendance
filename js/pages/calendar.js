/**
 * Calendar view page for a group
 * Route: #/groups/:id/calendar
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { ContractsDB } from '../db/contracts.js';
import { ClosedDaysDB } from '../db/closedDays.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftMonth, formatYearMonth, getDaysInMonth, daysToNextClass } from '../utils/date.js';
import { HolidayService } from '../services/holidays.js';
import Modal from '../components/modal.js';
import Toast from '../components/toast.js';
import { t, getMessages, getLocale } from '../utils/i18n.js';

// Korean day abbreviations — used for DB data matching, must NOT be translated
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export class CalendarPage {
  constructor(params) {
    this.groupId = params.id;
    this.group = null;
    this.yearMonth = todayStr().slice(0, 7); // YYYY-MM
    this.contractMap = {}; // studentId → active contract
    this._recordMap = {}; // cached month record map
    this._closedDays = new Set(); // cached closed days for current month
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">${t('common.groupNotFound')}</div></div></div>`;
    }
    this.students = await StudentsDB.getByGroup(this.groupId);

    return `
      <div class="page-body">
        <div class="date-nav" id="month-nav" style="justify-content:center; margin-bottom: var(--space-3);">
          <button class="date-nav-btn" id="prev-month">←</button>
          <span class="date-nav-label" id="month-label">${formatYearMonth(this.yearMonth)}</span>
          <button class="date-nav-btn" id="next-month">→</button>
        </div>
        <div class="card">
          <div class="card-body" id="calendar-container">
            <div class="loading-state"><div class="spinner"></div><span>${t('calendar.loading')}</span></div>
          </div>
        </div>
        <div id="day-detail" style="margin-top: var(--space-4);"></div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('prev-month')?.addEventListener('click', () => this._changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => this._changeMonth(1));
    await this._loadContracts();
    await this._renderCalendar();
  }

  async _loadContracts() {
    const contracts = await ContractsDB.getByGroup(this.groupId);
    this.contractMap = {};
    contracts
      .filter(c => c.status === 'active')
      .forEach(c => {
        if (!this.contractMap[c.studentId]) {
          this.contractMap[c.studentId] = c;
        }
      });
  }

  async _changeMonth(delta) {
    this.yearMonth = shiftMonth(this.yearMonth, delta);
    document.getElementById('month-label').textContent = formatYearMonth(this.yearMonth);
    document.getElementById('day-detail').innerHTML = '';
    await this._renderCalendar();
  }

  async _renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const [year, month] = this.yearMonth.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const startDate = days[0];
    const endDate = days[days.length - 1];

    const recordMap = await AttendanceDB.getByGroupDateRange(this.groupId, startDate, endDate);
    this._recordMap = recordMap;
    this._closedDays = await ClosedDaysDB.getSetByGroupDateRange(this.groupId, startDate, endDate);

    const makeupRecords = await AttendanceDB.getMakeupsByGroupDateRange(this.groupId, startDate, endDate);
    this._makeupDates = new Map();
    makeupRecords.forEach(r => {
      if (!this._makeupDates.has(r.makeupDate)) this._makeupDates.set(r.makeupDate, new Set());
      this._makeupDates.get(r.makeupDate).add(r.studentId);
    });
    const totalStudents = this.students.length;

    const holidays = await HolidayService.getHolidaysForMonth(year, month);

    const firstDayDate = new Date(year, month - 1, 1);
    const startWeekday = firstDayDate.getDay();
    const dayNames = getMessages().date.daysShort; // locale-aware header row
    const today = todayStr();

    let html = `
      <div style="display:grid; grid-template-columns: repeat(7,1fr); gap:2px; text-align:center;">
        ${dayNames.map((d, i) => `
          <div style="padding: 6px 2px; font-size: 12px; font-weight: 700; color: ${i === 0 ? 'var(--color-absent)' : i === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)'};\">${d}</div>
        `).join('')}
    `;

    for (let i = 0; i < startWeekday; i++) html += `<div></div>`;

    days.forEach((dateStr, idx) => {
      const dayNum = idx + 1;
      const dayOfWeek = (startWeekday + idx) % 7;
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const holiday = holidays.get(dateStr) || null;
      const isHoliday = !!holiday;

      const korDay = DOW_KO[dayOfWeek]; // Korean for DB matching
      const isClosed = this._closedDays.has(dateStr);
      const makeupStudentIds = this._makeupDates?.get(dateStr) ?? new Set();
      const scheduledStudents = this.students.filter(s =>
        s.attendanceDays?.includes(korDay) || makeupStudentIds.has(s.id));
      const scheduledCount = scheduledStudents.length;
      const unrecordedScheduled = scheduledStudents.filter(s => !recordMap[`${s.id}_${dateStr}`]).length;
      const hasUnrecordedPast = !isClosed && scheduledCount > 0 && unrecordedScheduled > 0 && dateStr < today;

      const dayRecords = this.students.map(s => recordMap[`${s.id}_${dateStr}`]).filter(Boolean);
      const presentCount = dayRecords.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'early').length;
      const absentCount = dayRecords.filter(r => r.status === 'absent').length;
      const hasData = dayRecords.length > 0;
      const rate = totalStudents > 0 && hasData ? Math.round(presentCount / totalStudents * 100) : null;

      const textColor = isToday ? 'white'
        : isClosed ? 'var(--color-text-muted)'
        : (isSunday || isHoliday) ? 'var(--color-absent)'
        : isSaturday ? 'var(--color-primary)'
        : 'var(--color-text)';

      html += `
        <div class="cal-day" data-date="${dateStr}" style="
          padding: 6px 2px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          background: ${isToday ? 'var(--color-primary)' : isClosed ? 'var(--color-surface-2)' : 'transparent'};
          color: ${isToday ? 'white' : textColor};
          transition: background var(--transition-fast);
          min-height: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          ${isClosed && !isToday ? 'opacity:0.7;' : ''}
        ">
          <div style="font-size: 14px; font-weight: ${isToday ? '700' : '500'};">${dayNum}</div>
          ${holiday ? `<div style="font-size:8px; line-height:1.2; text-align:center; color:${isToday ? 'rgba(255,255,255,0.85)' : 'var(--color-absent)'}; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 2px;">${holiday}</div>` : ''}
          ${isClosed ? `
            <div style="font-size:9px; font-weight:700; color:${isToday ? 'rgba(255,255,255,0.9)' : 'var(--color-text-muted)'}; background:${isToday ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'}; border-radius:3px; padding:0 4px; white-space:nowrap;">${t('calendar.closed')}</div>
          ` : hasData && totalStudents > 0 ? `
            <div style="font-size: 10px; font-weight: 700; color: ${isToday ? 'rgba(255,255,255,0.9)' : 'var(--color-present)'};">${rate}%</div>
            <div class="cal-dot-row">
              ${presentCount > 0 ? `<div class="cal-dot" style="background:${isToday ? 'white' : 'var(--color-present)'}"></div>` : ''}
              ${absentCount > 0 ? `<div class="cal-dot" style="background:${isToday ? 'rgba(255,255,255,0.7)' : 'var(--color-absent)'}"></div>` : ''}
            </div>
          ` : scheduledCount > 0 ? `
            <div style="font-size:9px; line-height:1.3; color:${isToday ? 'rgba(255,255,255,0.75)' : hasUnrecordedPast ? 'var(--color-late)' : 'var(--color-text-muted)'}; white-space:nowrap;">
              ${t('calendar.scheduledCount', {n: scheduledCount})}${hasUnrecordedPast ? `·${t('status.none')}${unrecordedScheduled}` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.cal-day').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        if (!cell.style.background.includes('primary')) {
          cell.style.background = 'var(--color-surface-2)';
        }
      });
      cell.addEventListener('mouseleave', () => {
        const ds = cell.dataset.date;
        if (ds !== today) cell.style.background = 'transparent';
      });
      cell.addEventListener('click', () => this._showDayDetail(cell.dataset.date));
    });
  }

  async _showDayDetail(dateStr) {
    const container = document.getElementById('day-detail');
    if (!container) return;

    const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
    const days = getDaysInMonth(year, month);
    this._recordMap = await AttendanceDB.getByGroupDateRange(this.groupId, days[0], days[days.length - 1]);
    this._closedDays = await ClosedDaysDB.getSetByGroupDateRange(this.groupId, days[0], days[days.length - 1]);
    const makeupRecords = await AttendanceDB.getMakeupsByGroupDateRange(this.groupId, days[0], days[days.length - 1]);
    this._makeupDates = new Map();
    makeupRecords.forEach(r => {
      if (!this._makeupDates.has(r.makeupDate)) this._makeupDates.set(r.makeupDate, new Set());
      this._makeupDates.get(r.makeupDate).add(r.studentId);
    });

    const [y, m, d] = dateStr.split('-');
    const dow = new Date(Number(y), Number(m) - 1, Number(d)).getDay();
    const korDay = DOW_KO[dow]; // Korean for DB matching
    const msgs = getMessages();
    const displayDow = msgs.date.daysShort[dow]; // locale-aware for display

    // Locale-aware date header
    const monthName = msgs.date.months ? msgs.date.months[+m - 1] : +m;
    const headerDate = getLocale() === 'ko'
      ? `${+m}월 ${+d}일 (${displayDow})`
      : `${monthName} ${+d} (${displayDow})`;

    const today = todayStr();
    const isFuture = dateStr > today;
    const isClosed = this._closedDays.has(dateStr);

    const makeupStudentIds = this._makeupDates?.get(dateStr) ?? new Set();
    const scheduledStudents = this.students.filter(s =>
      s.attendanceDays?.includes(korDay) || makeupStudentIds.has(s.id));
    const unscheduledStudents = this.students.filter(s =>
      !s.attendanceDays?.includes(korDay) && !makeupStudentIds.has(s.id));

    const renderRow = (student, isScheduled) => {
      const record = this._recordMap[`${student.id}_${dateStr}`];
      const isMakeup = makeupStudentIds.has(student.id) && !student.attendanceDays?.includes(korDay);
      const canEdit = !isFuture && !isClosed && (isScheduled || !!record);

      let badge = '';
      if (record) {
        const label = t('status.' + record.status);
        const extra = record.absentType ? this._absentTypeLabel(record.absentType, record.makeupDate) : '';
        badge = `<span class="badge badge-${record.status}" style="flex-shrink:0;">${label}${extra}</span>`;
      } else if (!isFuture) {
        badge = `<span class="badge badge-none" style="flex-shrink:0;">${t('status.none')}</span>`;
      }

      return `
        <div class="list-item" id="srow-${student.id}" style="flex-wrap:wrap; gap:4px;">
          <div class="student-number">${student.number}</div>
          <div class="student-name">${escapeHtml(student.name)}</div>
          ${isMakeup ? `<span style="font-size:10px; font-weight:600; color:var(--color-primary); background:var(--color-primary-light,#e8f4ff); border:1px solid var(--color-primary); border-radius:var(--radius-full); padding:0 6px; flex-shrink:0;">${t('calendar.makeupBadge')}</span>` : ''}
          <span style="flex:1;"></span>
          ${badge}
          ${canEdit ? `
            <button class="btn btn-ghost edit-att-btn"
              data-student-id="${student.id}"
              title="출석 수정"
              style="font-size:12px; padding:2px 8px; color:var(--color-text-muted); border:1px solid var(--color-border); border-radius:var(--radius-full); flex-shrink:0;">
              ✎
            </button>
          ` : ''}
        </div>
      `;
    };

    const headerSuffix = isClosed
      ? `— ${t('calendar.closed')}`
      : isFuture ? t('calendar.headerFuture') : t('calendar.headerPresent');

    let html = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${headerDate} ${headerSuffix}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="toggle-closed-btn" class="btn btn-sm" style="${isClosed ? 'color:var(--color-absent);border:1px solid var(--color-absent);' : 'color:var(--color-text-muted);border:1px solid var(--color-border);'} background:transparent; border-radius:var(--radius-full); font-size:12px; padding:2px 10px;">
              ${isClosed ? t('calendar.closedToggleOff') : t('calendar.closedToggle')}
            </button>
            ${!isClosed ? `<a href="#/groups/${this.groupId}/attend?date=${dateStr}" class="btn btn-primary btn-sm">${t('attendance.title')}</a>` : ''}
          </div>
        </div>
        <div>
    `;

    if (scheduledStudents.length > 0) {
      html += `
        <div style="padding:var(--space-2) var(--space-5); font-size:11px; font-weight:700; color:var(--color-text-muted); background:var(--color-surface-2); border-bottom:1px solid var(--color-border-light);">
          ${t('calendar.scheduledOf', {n: scheduledStudents.length})}
        </div>
      `;
      html += scheduledStudents.map(s => renderRow(s, true)).join('');
    }

    const unscheduledWithRecord = unscheduledStudents.filter(s => this._recordMap[`${s.id}_${dateStr}`]);
    if (unscheduledWithRecord.length > 0) {
      html += `
        <div style="padding:var(--space-2) var(--space-5); font-size:11px; font-weight:700; color:var(--color-text-muted); background:var(--color-surface-2); border-top:1px solid var(--color-border-light); border-bottom:1px solid var(--color-border-light);">
          ${t('calendar.otherAttend', {n: unscheduledWithRecord.length})}
        </div>
      `;
      html += unscheduledWithRecord.map(s => renderRow(s, false)).join('');
    }

    if (this.students.length === 0) {
      html += `<div class="empty-state" style="padding:var(--space-8);">${t('attendance.noStudents')}</div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    container.querySelector('#toggle-closed-btn')?.addEventListener('click', async () => {
      const nowClosed = await ClosedDaysDB.toggle(this.groupId, dateStr);
      Toast.success(nowClosed ? t('calendar.closedSet') : t('calendar.closedUnset'));
      await this._renderCalendar();
      await this._showDayDetail(dateStr);
    });

    container.querySelectorAll('.edit-att-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const student = this.students.find(s => s.id === btn.dataset.studentId);
        if (student) await this._openEditAttendanceModal(student, dateStr);
      });
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async _openEditAttendanceModal(student, dateStr) {
    const record = this._recordMap[`${student.id}_${dateStr}`];
    const currentStatus = record?.status ?? null;
    const contract = this.contractMap[student.id] || null;
    const hasPeriod = contract?.type === 'period';
    const hasCount  = contract?.type === 'count';

    const [, m, d] = dateStr.split('-');
    const headerDate = `${+m}월 ${+d}일`;

    const statuses = [
      { value: 'present', color: 'var(--color-present)' },
      { value: 'late',    color: 'var(--color-late)' },
      { value: 'early',   color: 'var(--color-early)' },
      { value: 'absent',  color: 'var(--color-absent)' },
    ];

    Modal.open({
      title: `${escapeHtml(student.name)} · ${headerDate} 출석 수정`,
      body: `
        <div id="edit-status-panel" style="display:flex; flex-direction:column; gap:6px;">
          ${statuses.map(s => {
            const isActive = currentStatus === s.value;
            return `
              <button class="btn edit-status-btn" data-status="${s.value}"
                style="text-align:left; display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:var(--radius-md); border:1.5px solid ${isActive ? s.color : 'var(--color-border)'}; background:${isActive ? s.color + '18' : 'transparent'}; font-family:var(--font-family); cursor:pointer;">
                <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
                <span style="font-weight:600; font-size:14px; color:var(--color-text);">${t('status.' + s.value)}</span>
                ${isActive ? '<span style="margin-left:auto;font-size:11px;font-weight:600;color:var(--color-text-muted);">현재</span>' : ''}
              </button>`;
          }).join('')}
          ${currentStatus !== null ? `
            <button class="btn edit-status-btn" data-status="none"
              style="text-align:left; display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:var(--radius-md); border:1.5px solid var(--color-border); background:transparent; font-family:var(--font-family); cursor:pointer;">
              <span style="width:10px;height:10px;border-radius:50%;background:var(--color-border);flex-shrink:0;"></span>
              <span style="font-weight:600; font-size:14px; color:var(--color-text-muted);">미기록으로 변경</span>
            </button>` : ''}
        </div>

        <div id="absence-sub-panel" style="display:none; margin-top:8px;">
          <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--color-border-light);">결석 처리 방식 선택</div>
          <div id="absence-options" style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-secondary absence-opt" data-type="normal"
              style="text-align:left; height:auto; padding:10px 14px; display:block;">
              <div style="font-weight:600;">${t('calendar.absenceNormalTitle')}</div>
              <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">${t('calendar.absenceNormalDesc')}</div>
            </button>
            <button class="btn btn-secondary absence-opt" data-type="makeup"
              style="text-align:left; height:auto; padding:10px 14px; display:block;">
              <div style="font-weight:600;">${t('calendar.absenceMakeupTitle')}</div>
              <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">${t('calendar.absenceMakeupDesc')}</div>
            </button>
            <button class="btn btn-secondary absence-opt" data-type="extend"
              ${hasPeriod ? '' : 'disabled'}
              style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasPeriod ? '' : 'opacity:0.4; cursor:not-allowed;'}">
              <div style="font-weight:600;">${t('calendar.absenceExtendTitle')} <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">${t('calendar.absenceExtendPeriod')}</span></div>
              <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
                ${hasPeriod ? t('calendar.absenceExtendDesc', { endDate: contract.endDate }) : t('calendar.absenceExtendNone')}
              </div>
            </button>
            <button class="btn btn-secondary absence-opt" data-type="no_deduct"
              ${hasCount ? '' : 'disabled'}
              style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasCount ? '' : 'opacity:0.4; cursor:not-allowed;'}">
              <div style="font-weight:600;">${t('calendar.absenceNoDeductTitle')} <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">${t('calendar.absenceNoDeductCount')}</span></div>
              <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
                ${hasCount ? t('calendar.absenceNoDeductDesc') : t('calendar.absenceNoDeductNone')}
              </div>
            </button>
          </div>

          <div id="makeup-date-panel" style="display:none; padding:12px; background:var(--color-surface-2); border-radius:var(--radius-md); border:1px solid var(--color-border); margin-top:8px;">
            <div style="font-size:13px; font-weight:600; margin-bottom:8px;">${t('calendar.makeupDateTitle')}</div>
            <input type="date" id="makeup-date-input" class="form-input" style="width:100%; margin-bottom:8px;" min="${dateStr}">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm" id="makeup-confirm-btn" style="flex:1;">${t('common.confirm')}</button>
              <button class="btn btn-secondary btn-sm" id="makeup-back-btn" style="flex:1;">${t('calendar.makeupBackBtn')}</button>
            </div>
          </div>
        </div>
      `,
      hideConfirm: true,
      cancelText: t('common.close'),
    });

    const backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;

    const refresh = async () => {
      Modal.close();
      await this._showDayDetail(dateStr);
      await this._renderCalendar();
    };

    // Status button clicks
    backdrop.querySelectorAll('.edit-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;

        if (status === 'none') {
          // Remove record
          await AttendanceDB.remove(student.id, dateStr);
          Toast.success(`${escapeHtml(student.name)} 출석 기록을 삭제했습니다.`);
          await refresh();
          return;
        }

        if (status === 'absent') {
          // Show absence sub-options
          backdrop.querySelector('#edit-status-panel').style.display = 'none';
          backdrop.querySelector('#absence-sub-panel').style.display = 'block';
          return;
        }

        // present / late / early — save directly
        await AttendanceDB.set({
          studentId: student.id,
          groupId: this.groupId,
          date: dateStr,
          status,
          absentType: null,
          makeupDate: null,
        });
        Toast.success(`${escapeHtml(student.name)} → ${t('status.' + status)}`);
        await refresh();
      });
    });

    // Absence sub-option clicks
    backdrop.querySelectorAll('.absence-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const type = btn.dataset.type;

        if (type === 'makeup') {
          backdrop.querySelector('#absence-options').style.display = 'none';
          backdrop.querySelector('#makeup-date-panel').style.display = 'block';
          return;
        }

        await this._applyAbsence(student, dateStr, type, null);
        await refresh();
      });
    });

    backdrop.querySelector('#makeup-confirm-btn')?.addEventListener('click', async () => {
      const makeupDate = backdrop.querySelector('#makeup-date-input').value;
      if (!makeupDate) { Toast.error(t('calendar.makeupDateRequired')); return; }
      await this._applyAbsence(student, dateStr, 'makeup', makeupDate);
      await refresh();
    });

    backdrop.querySelector('#makeup-back-btn')?.addEventListener('click', () => {
      backdrop.querySelector('#makeup-date-panel').style.display = 'none';
      backdrop.querySelector('#absence-options').style.display = 'flex';
    });
  }

  async _openAbsenceModal(student, dateStr) {
    const contract = this.contractMap[student.id] || null;
    const hasPeriod = contract?.type === 'period';
    const hasCount = contract?.type === 'count';

    const body = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:13px; color:var(--color-text-muted); padding-bottom:4px;">
          <strong>${escapeHtml(student.name)}</strong> · ${dateStr}
        </div>

        <div id="absence-options" style="display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-secondary absence-opt" data-type="normal"
            style="text-align:left; height:auto; padding:10px 14px; display:block;">
            <div style="font-weight:600;">${t('calendar.absenceNormalTitle')}</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">${t('calendar.absenceNormalDesc')}</div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="makeup"
            style="text-align:left; height:auto; padding:10px 14px; display:block;">
            <div style="font-weight:600;">${t('calendar.absenceMakeupTitle')}</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">${t('calendar.absenceMakeupDesc')}</div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="extend"
            ${hasPeriod ? '' : 'disabled'}
            style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasPeriod ? '' : 'opacity:0.4; cursor:not-allowed;'}">
            <div style="font-weight:600;">${t('calendar.absenceExtendTitle')} <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">${t('calendar.absenceExtendPeriod')}</span></div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
              ${hasPeriod ? t('calendar.absenceExtendDesc', {endDate: contract.endDate}) : t('calendar.absenceExtendNone')}
            </div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="no_deduct"
            ${hasCount ? '' : 'disabled'}
            style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasCount ? '' : 'opacity:0.4; cursor:not-allowed;'}">
            <div style="font-weight:600;">${t('calendar.absenceNoDeductTitle')} <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">${t('calendar.absenceNoDeductCount')}</span></div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
              ${hasCount ? t('calendar.absenceNoDeductDesc') : t('calendar.absenceNoDeductNone')}
            </div>
          </button>
        </div>

        <div id="makeup-date-panel" style="display:none; padding:12px; background:var(--color-surface-2); border-radius:var(--radius-md); border:1px solid var(--color-border);">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">${t('calendar.makeupDateTitle')}</div>
          <input type="date" id="makeup-date-input" class="form-input" style="width:100%; margin-bottom:8px;" min="${dateStr}">
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" id="makeup-confirm-btn" style="flex:1;">${t('common.confirm')}</button>
            <button class="btn btn-secondary btn-sm" id="makeup-back-btn" style="flex:1;">${t('calendar.makeupBackBtn')}</button>
          </div>
        </div>
      </div>
    `;

    Modal.open({ title: t('calendar.absenceModal'), body, hideConfirm: true, cancelText: t('common.close') });

    const backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;

    backdrop.querySelectorAll('.absence-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const type = btn.dataset.type;

        if (type === 'makeup') {
          backdrop.querySelector('#absence-options').style.display = 'none';
          backdrop.querySelector('#makeup-date-panel').style.display = 'block';
          return;
        }

        await this._applyAbsence(student, dateStr, type, null);
        Modal.close();
        await this._showDayDetail(dateStr);
        await this._renderCalendar();
      });
    });

    backdrop.querySelector('#makeup-confirm-btn')?.addEventListener('click', async () => {
      const makeupDate = backdrop.querySelector('#makeup-date-input').value;
      if (!makeupDate) { Toast.error(t('calendar.makeupDateRequired')); return; }
      await this._applyAbsence(student, dateStr, 'makeup', makeupDate);
      Modal.close();
      await this._showDayDetail(dateStr);
      await this._renderCalendar();
    });

    backdrop.querySelector('#makeup-back-btn')?.addEventListener('click', () => {
      backdrop.querySelector('#makeup-date-panel').style.display = 'none';
      backdrop.querySelector('#absence-options').style.display = 'flex';
    });
  }

  async _applyAbsence(student, dateStr, absentType, makeupDate) {
    await AttendanceDB.set({
      studentId: student.id,
      groupId: this.groupId,
      date: dateStr,
      status: 'absent',
      absentType,
      makeupDate: makeupDate || null,
    });

    if (absentType === 'extend') {
      const contract = this.contractMap[student.id];
      if (contract) {
        const days = daysToNextClass(contract.endDate, student.attendanceDays);
        await ContractsDB.extendEndDate(contract.id, days);
        await this._loadContracts();
      }
    }

    const labels = {
      normal:    t('calendar.absentLabelNormal'),
      makeup:    makeupDate ? t('calendar.absentLabelMakeupWithDate', {date: makeupDate}) : t('calendar.absentLabelMakeupNoDate'),
      extend:    t('calendar.absentLabelExtend'),
      no_deduct: t('calendar.absentLabelNoDeduct'),
    };
    Toast.success(t('calendar.absentDone', {name: escapeHtml(student.name), type: labels[absentType] || t('status.absent')}));
  }

  _absentTypeLabel(absentType, makeupDate) {
    const map = {
      normal:    '',
      makeup:    makeupDate ? t('calendar.absentTypeMakeupWith', {date: makeupDate}) : t('calendar.absentTypeMakeupNo'),
      extend:    t('calendar.absentTypeExtend'),
      no_deduct: t('calendar.absentTypeNoDeduct'),
    };
    return map[absentType] || '';
  }

  destroy() {}
}
