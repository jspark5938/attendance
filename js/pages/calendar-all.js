/**
 * 전체 통합 월별 달력 페이지
 * Route: #/calendar
 * 모든 그룹의 출석 현황을 한 화면에 표시
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { ContractsDB } from '../db/contracts.js';
import { ClosedDaysDB } from '../db/closedDays.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftMonth, formatYearMonthKo, getDaysInMonth, daysToNextClass } from '../utils/date.js';
import { HolidayService } from '../services/holidays.js';
import { STATUS_LABELS } from '../utils/i18n.js';
import Modal from '../components/modal.js';
import Toast from '../components/toast.js';

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export class CalendarAllPage {
  constructor() {
    this.yearMonth = todayStr().slice(0, 7);
    this.groups = [];
  }

  async render() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">📅 달력</h1>
        </div>
      </div>
      <div class="page-body">
        <div class="date-nav" style="justify-content:center; margin-bottom: var(--space-3);">
          <button class="date-nav-btn" id="prev-month">←</button>
          <span class="date-nav-label" id="month-label">${formatYearMonthKo(this.yearMonth)}</span>
          <button class="date-nav-btn" id="next-month">→</button>
        </div>
        <div id="cal-filter" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:var(--space-4);"></div>
        <div class="card">
          <div class="card-body" id="calendar-container">
            <div class="loading-state"><div class="spinner"></div><span>달력을 불러오는 중...</span></div>
          </div>
        </div>
        <div id="day-detail" style="margin-top:var(--space-4);"></div>
      </div>
    `;
  }

  async mount() {
    this.groups = await GroupsDB.getAll();
    this._renderFilter();
    document.getElementById('prev-month')?.addEventListener('click', () => this._changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => this._changeMonth(1));
    await this._renderCalendar();
  }

  get _activeGroupIds() {
    return this._activeIds ?? new Set(this.groups.map(g => g.id));
  }

  _renderFilter() {
    const el = document.getElementById('cal-filter');
    if (!el || this.groups.length === 0) return;
    if (!this._activeIds) this._activeIds = new Set(this.groups.map(g => g.id));

    el.innerHTML = `
      <span style="font-size:12px; font-weight:600; color:var(--color-text-muted); align-self:center;">그룹:</span>
      <button class="btn btn-sm ${this._activeIds.size === this.groups.length ? 'btn-primary' : 'btn-secondary'}" id="filter-all">전체</button>
      ${this.groups.map(g => `
        <button class="btn btn-sm filter-group-btn ${this._activeIds.has(g.id) ? 'btn-primary' : 'btn-secondary'}"
          data-id="${g.id}"
          style="${this._activeIds.has(g.id) ? `background:${escapeHtml(g.color)};border-color:${escapeHtml(g.color)};` : ''}">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${this._activeIds.has(g.id) ? 'rgba(255,255,255,0.8)' : escapeHtml(g.color)};margin-right:4px;"></span>
          ${escapeHtml(g.name)}
        </button>
      `).join('')}
    `;

    document.getElementById('filter-all')?.addEventListener('click', async () => {
      this._activeIds = new Set(this.groups.map(g => g.id));
      this._renderFilter();
      await this._renderCalendar();
    });
    document.querySelectorAll('.filter-group-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (this._activeIds.has(id)) {
          if (this._activeIds.size > 1) this._activeIds.delete(id);
        } else {
          this._activeIds.add(id);
        }
        this._renderFilter();
        await this._renderCalendar();
      });
    });
  }

  async _changeMonth(delta) {
    this.yearMonth = shiftMonth(this.yearMonth, delta);
    document.getElementById('month-label').textContent = formatYearMonthKo(this.yearMonth);
    document.getElementById('day-detail').innerHTML = '';
    await this._renderCalendar();
  }

  async _loadGroupData(startDate, endDate) {
    const activeGroups = this.groups.filter(g => this._activeIds?.has(g.id) ?? true);
    return Promise.all(activeGroups.map(async g => {
      const [students, recordMap, closedDays, makeupRecords, contracts] = await Promise.all([
        StudentsDB.getByGroup(g.id),
        AttendanceDB.getByGroupDateRange(g.id, startDate, endDate),
        ClosedDaysDB.getSetByGroupDateRange(g.id, startDate, endDate),
        AttendanceDB.getMakeupsByGroupDateRange(g.id, startDate, endDate),
        ContractsDB.getByGroup(g.id),
      ]);
      const makeupDates = new Map();
      makeupRecords.forEach(r => {
        if (!makeupDates.has(r.makeupDate)) makeupDates.set(r.makeupDate, new Set());
        makeupDates.get(r.makeupDate).add(r.studentId);
      });
      const contractMap = {};
      contracts.filter(c => c.status === 'active').forEach(c => {
        if (!contractMap[c.studentId]) contractMap[c.studentId] = c;
      });
      return { group: g, students, recordMap, closedDays, makeupDates, contractMap };
    }));
  }

  async _renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

    if (this.groups.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-title">그룹이 없습니다</div>
        <div class="empty-state-desc"><a href="#/groups">그룹 만들기</a></div>
      </div>`;
      return;
    }

    const [year, month] = this.yearMonth.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const startDate = days[0];
    const endDate = days[days.length - 1];

    const groupData = await this._loadGroupData(startDate, endDate);

    // 날짜별 통합 요약
    const daySummary = {};
    days.forEach(date => {
      let present = 0, absent = 0, late = 0, early = 0, total = 0, scheduled = 0, closedCount = 0;
      const [dy, dm, dd] = date.split('-');
      const korDay = DOW_KO[new Date(+dy, +dm - 1, +dd).getDay()];
      groupData.forEach(({ students, recordMap, closedDays, makeupDates }) => {
        total += students.length;
        if (closedDays.has(date)) closedCount++;
        students.forEach(s => {
          if (s.attendanceDays?.includes(korDay) || makeupDates?.get(date)?.has(s.id)) scheduled++;
          const rec = recordMap[`${s.id}_${date}`];
          if (rec) {
            if (rec.status === 'present') present++;
            else if (rec.status === 'absent') absent++;
            else if (rec.status === 'late') late++;
            else if (rec.status === 'early') early++;
          }
        });
      });
      daySummary[date] = { present, absent, late, early, total, scheduled, closedCount, groupCount: groupData.length };
    });

    const firstDayDate = new Date(year, month - 1, 1);
    const startWeekday = firstDayDate.getDay();
    const today = todayStr();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const holidays = await HolidayService.getHolidaysForMonth(year, month);

    let html = `
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; text-align:center;">
        ${dayNames.map((d, i) => `
          <div style="padding:6px 2px; font-size:12px; font-weight:700;
            color:${i === 0 ? 'var(--color-absent)' : i === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)'};">
            ${d}
          </div>
        `).join('')}
    `;

    for (let i = 0; i < startWeekday; i++) html += `<div></div>`;

    days.forEach((dateStr, idx) => {
      const dayNum = idx + 1;
      const dow = (startWeekday + idx) % 7;
      const isToday = dateStr === today;
      const isFutureDate = dateStr > today;
      const sum = daySummary[dateStr];
      const hasData = (sum.present + sum.absent + sum.late + sum.early) > 0;
      const rate = sum.total > 0 && hasData
        ? Math.round((sum.present + sum.late + sum.early) / sum.total * 100) : null;
      const holiday = holidays.get(dateStr) || null;
      const isHoliday = !!holiday;
      const allClosed = sum.groupCount > 0 && sum.closedCount === sum.groupCount;
      const someClosed = sum.closedCount > 0 && !allClosed;

      const textColor = isToday ? 'white'
        : allClosed ? 'var(--color-text-muted)'
        : (dow === 0 || isHoliday) ? 'var(--color-absent)'
        : dow === 6 ? 'var(--color-primary)'
        : 'var(--color-text)';

      html += `
        <div class="cal-day-cell" data-date="${dateStr}"
          style="
            border-radius:var(--radius-md);
            cursor:pointer;
            background:${isToday ? 'var(--color-primary)' : allClosed ? 'var(--color-surface-2)' : 'transparent'};
            color:${textColor};
            padding:6px 4px;
            min-height:64px;
            display:flex; flex-direction:column; align-items:center; gap:3px;
            transition:background var(--transition-fast);
            border:1px solid ${isToday ? 'var(--color-primary)' : 'transparent'};
            ${allClosed && !isToday ? 'opacity:0.7;' : ''}
          ">
          <div style="font-size:14px; font-weight:${isToday ? '700' : '500'};">${dayNum}</div>
          ${holiday ? `<div style="font-size:8px; line-height:1.2; text-align:center; color:${isToday ? 'rgba(255,255,255,0.85)' : 'var(--color-absent)'}; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 2px;">${holiday}</div>` : ''}
          ${allClosed ? `
            <div style="font-size:9px; font-weight:700; background:${isToday ? 'rgba(255,255,255,0.2)' : 'var(--color-border)'}; color:${isToday ? 'white' : 'var(--color-text-muted)'}; border-radius:3px; padding:0 4px;">휴무</div>
          ` : someClosed ? `
            <div style="font-size:9px; color:${isToday ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)'}; white-space:nowrap;">휴무${sum.closedCount}</div>
          ` : hasData ? `
            <div style="font-size:11px; font-weight:700; color:${isToday ? 'rgba(255,255,255,0.95)' : 'var(--color-present)'};">${rate}%</div>
            <div style="display:flex; gap:2px; flex-wrap:wrap; justify-content:center;">
              ${sum.present > 0 ? `<span style="font-size:10px; background:${isToday ? 'rgba(255,255,255,0.2)' : 'var(--color-present-light)'}; color:${isToday ? 'white' : 'var(--color-present)'}; border-radius:3px; padding:0 3px;">${sum.present}</span>` : ''}
              ${sum.absent  > 0 ? `<span style="font-size:10px; background:${isToday ? 'rgba(255,255,255,0.2)' : 'var(--color-absent-light)'};  color:${isToday ? 'white' : 'var(--color-absent)'};  border-radius:3px; padding:0 3px;">${sum.absent}</span>` : ''}
              ${sum.late    > 0 ? `<span style="font-size:10px; background:${isToday ? 'rgba(255,255,255,0.2)' : 'var(--color-late-light)'};    color:${isToday ? 'white' : 'var(--color-late)'};    border-radius:3px; padding:0 3px;">${sum.late}</span>` : ''}
            </div>
          ` : sum.scheduled > 0 ? `
            <div style="font-size:9px; line-height:1.3; color:${isToday ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)'}; white-space:nowrap;">예정${sum.scheduled}</div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>
    <div style="display:flex; gap:var(--space-4); margin-top:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--color-border-light); flex-wrap:wrap;">
      <span style="font-size:12px; color:var(--color-text-muted);">숫자: </span>
      <span class="att-summary-item" style="font-size:12px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--color-present-light);border:1px solid var(--color-present);margin-right:3px;"></span>출석
      </span>
      <span class="att-summary-item" style="font-size:12px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--color-absent-light);border:1px solid var(--color-absent);margin-right:3px;"></span>결석
      </span>
      <span class="att-summary-item" style="font-size:12px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--color-late-light);border:1px solid var(--color-late);margin-right:3px;"></span>지각
      </span>
      <span style="font-size:12px; color:var(--color-text-muted); margin-left:auto;">% = 출석률</span>
    </div>`;

    container.innerHTML = html;

    container.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.cal-day-cell');
      if (!cell || cell.dataset.date === today) return;
      cell.style.background = 'var(--color-surface-2)';
    });
    container.addEventListener('mouseout', (e) => {
      const cell = e.target.closest('.cal-day-cell');
      if (!cell || cell.dataset.date === today) return;
      cell.style.background = 'transparent';
    });
    container.addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-day-cell');
      if (!cell || !cell.dataset.date) return;
      this._showDayDetail(cell.dataset.date, groupData);
    });
  }

  // ── 날짜 상세 패널 ─────────────────────────────────────────────

  async _showDayDetail(dateStr, groupData) {
    const el = document.getElementById('day-detail');
    if (!el) return;

    const [y, m, d] = dateStr.split('-');
    const dowIdx = new Date(+y, +m - 1, +d).getDay();
    const dow = DOW_KO[dowIdx];
    const korDay = DOW_KO[dowIdx];
    const today = todayStr();
    const isFutureDate = dateStr > today;

    const renderRow = (student, record, isMakeup, isScheduled, isGroupClosed) => {
      const isUnrecorded = !record;
      const isAbsent = record?.status === 'absent';
      const showAbsenceBtn = isScheduled && !isGroupClosed && (isUnrecorded || isAbsent);

      let badge = '';
      if (record) {
        const label = { present: '출석', absent: '결석', late: '지각', early: '조퇴' }[record.status] || record.status;
        const extra = record.absentType ? this._absentTypeLabel(record.absentType, record.makeupDate) : '';
        badge = `<span class="badge badge-${record.status}" style="margin-left:auto; flex-shrink:0;">${label}${extra}</span>`;
      } else if (!isFutureDate) {
        badge = `<span class="badge badge-none" style="margin-left:auto; flex-shrink:0;">미입력</span>`;
      }

      return `
        <div class="list-item" style="flex-wrap:wrap; gap:4px;">
          <div class="student-number">${student.number}</div>
          <div class="student-name">${escapeHtml(student.name)}</div>
          ${isMakeup ? `<span style="font-size:10px; font-weight:600; color:var(--color-primary); background:var(--color-primary-light,#e8f4ff); border:1px solid var(--color-primary); border-radius:var(--radius-full); padding:0 6px; flex-shrink:0;">보충</span>` : ''}
          ${badge}
          ${showAbsenceBtn ? `
            <button class="btn btn-sm absence-action-btn"
              data-student-id="${student.id}"
              data-group-id="${student.groupId}"
              style="font-size:11px; padding:2px 8px; color:var(--color-absent); border:1px solid var(--color-absent); background:transparent; border-radius:var(--radius-full);">
              결석처리
            </button>
          ` : ''}
        </div>
      `;
    };

    let html = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${+m}월 ${+d}일 (${dow}) ${isFutureDate ? '출석 예정' : '출석 현황'}</div>
        </div>
    `;

    let hasAnyContent = false;

    for (const { group, students, recordMap, closedDays, makeupDates, contractMap } of groupData) {
      const makeupStudentIds = makeupDates?.get(dateStr) ?? new Set();
      const scheduledStudents = students.filter(s =>
        s.attendanceDays?.includes(korDay) || makeupStudentIds.has(s.id));
      const unscheduledWithRecord = students.filter(s =>
        !s.attendanceDays?.includes(korDay) && !makeupStudentIds.has(s.id) && recordMap[`${s.id}_${dateStr}`]);
      const isGroupClosed = closedDays.has(dateStr);

      if (scheduledStudents.length === 0 && unscheduledWithRecord.length === 0 && !isGroupClosed) continue;
      hasAnyContent = true;

      html += `
        <div style="padding:var(--space-3) var(--space-5); border-bottom:1px solid var(--color-border-light);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-2);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(group.color)};display:inline-block;"></span>
              ${escapeHtml(group.name)}
              ${isGroupClosed
                ? `<span style="font-size:11px; font-weight:700; color:var(--color-text-muted); background:var(--color-border); border-radius:3px; padding:0 5px;">휴무</span>`
                : scheduledStudents.length > 0 ? `<span style="font-size:12px; font-weight:400; color:var(--color-text-muted);">${scheduledStudents.length}명 예정</span>` : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="toggle-group-closed-btn btn btn-sm" data-group-id="${group.id}"
                style="${isGroupClosed ? 'color:var(--color-absent);border:1px solid var(--color-absent);' : 'color:var(--color-text-muted);border:1px solid var(--color-border);'} background:transparent; border-radius:var(--radius-full); font-size:11px; padding:2px 8px;">
                ${isGroupClosed ? '휴무 해제' : '휴무 설정'}
              </button>
              ${!isGroupClosed ? `<a href="#/groups/${group.id}/attend?date=${dateStr}" class="btn btn-outline btn-sm">${isFutureDate ? '출석 체크' : '수정'}</a>` : ''}
            </div>
          </div>
          ${isGroupClosed ? '' : `
            ${scheduledStudents.length > 0 ? `
              <div style="padding:var(--space-1) 0 var(--space-1) var(--space-1); font-size:11px; font-weight:700; color:var(--color-text-muted);">
                출석 예정 · ${scheduledStudents.length}명
              </div>
              ${scheduledStudents.map(s => {
                const isMakeup = makeupStudentIds.has(s.id) && !s.attendanceDays?.includes(korDay);
                return renderRow(s, recordMap[`${s.id}_${dateStr}`], isMakeup, true, isGroupClosed);
              }).join('')}
            ` : ''}
            ${unscheduledWithRecord.length > 0 ? `
              <div style="padding:var(--space-1) 0 var(--space-1) var(--space-1); font-size:11px; font-weight:700; color:var(--color-text-muted); margin-top:var(--space-1);">
                기타 출석 · ${unscheduledWithRecord.length}명
              </div>
              ${unscheduledWithRecord.map(s =>
                renderRow(s, recordMap[`${s.id}_${dateStr}`], false, false, isGroupClosed)
              ).join('')}
            ` : ''}
          `}
        </div>
      `;
    }

    if (!hasAnyContent) {
      html += `<div class="empty-state" style="padding:var(--space-8);">
        <div class="empty-state-desc">이 날은 출석 예정 학생이 없습니다.</div>
      </div>`;
    }

    html += `</div>`;
    el.innerHTML = html;

    // 휴무 토글
    el.querySelectorAll('.toggle-group-closed-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gid = btn.dataset.groupId;
        const nowClosed = await ClosedDaysDB.toggle(gid, dateStr);
        Toast.success(nowClosed ? '휴무로 설정했습니다.' : '휴무를 해제했습니다.');
        await this._renderCalendar();
        const [year2, month2] = dateStr.slice(0, 7).split('-').map(Number);
        const days2 = getDaysInMonth(year2, month2);
        const newGroupData = await this._loadGroupData(days2[0], days2[days2.length - 1]);
        await this._showDayDetail(dateStr, newGroupData);
      });
    });

    // 결석처리 버튼
    el.querySelectorAll('.absence-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const studentId = btn.dataset.studentId;
        const groupId   = btn.dataset.groupId;
        const gd = groupData.find(g => g.group.id === groupId);
        if (!gd) return;
        const student = gd.students.find(s => s.id === studentId);
        if (student) await this._openAbsenceModal(student, dateStr, gd.contractMap, groupId, groupData);
      });
    });

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 결석 처리 모달 ─────────────────────────────────────────────

  async _openAbsenceModal(student, dateStr, contractMap, groupId, groupData) {
    const contract  = contractMap[student.id] || null;
    const hasPeriod = contract?.type === 'period';
    const hasCount  = contract?.type === 'count';

    const body = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:13px; color:var(--color-text-muted); padding-bottom:4px;">
          <strong>${escapeHtml(student.name)}</strong> · ${dateStr}
        </div>

        <div id="absence-options" style="display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-secondary absence-opt" data-type="normal"
            style="text-align:left; height:auto; padding:10px 14px; display:block;">
            <div style="font-weight:600;">단순 결석</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">출석부에 결석으로 기록합니다</div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="makeup"
            style="text-align:left; height:auto; padding:10px 14px; display:block;">
            <div style="font-weight:600;">보충강의 예정</div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">결석 처리 후 보충강의 날짜를 입력합니다</div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="extend"
            ${hasPeriod ? '' : 'disabled'}
            style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasPeriod ? '' : 'opacity:0.4; cursor:not-allowed;'}">
            <div style="font-weight:600;">기간 연장 <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">(기간제)</span></div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
              ${hasPeriod ? `계약 종료일을 1일 연장합니다 (현재: ${contract.endDate})` : '활성 기간제 계약이 없습니다'}
            </div>
          </button>

          <button class="btn btn-secondary absence-opt" data-type="no_deduct"
            ${hasCount ? '' : 'disabled'}
            style="text-align:left; height:auto; padding:10px 14px; display:block; ${hasCount ? '' : 'opacity:0.4; cursor:not-allowed;'}">
            <div style="font-weight:600;">횟수 차감 없음 <span style="font-size:11px; font-weight:400; color:var(--color-text-muted);">(횟수제)</span></div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
              ${hasCount ? '결석 처리하되 남은 횟수에서 차감하지 않습니다' : '활성 횟수제 계약이 없습니다'}
            </div>
          </button>
        </div>

        <div id="makeup-date-panel" style="display:none; padding:12px; background:var(--color-surface-2); border-radius:var(--radius-md); border:1px solid var(--color-border);">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">보충강의 날짜 선택</div>
          <input type="date" id="makeup-date-input" class="form-input" style="width:100%; margin-bottom:8px;" min="${dateStr}">
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" id="makeup-confirm-btn" style="flex:1;">확인</button>
            <button class="btn btn-secondary btn-sm" id="makeup-back-btn" style="flex:1;">돌아가기</button>
          </div>
        </div>
      </div>
    `;

    Modal.open({ title: '결석 처리', body, hideConfirm: true, cancelText: '닫기' });

    const backdrop = document.getElementById('modal-backdrop');

    backdrop.querySelectorAll('.absence-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const type = btn.dataset.type;
        if (type === 'makeup') {
          backdrop.querySelector('#absence-options').style.display = 'none';
          backdrop.querySelector('#makeup-date-panel').style.display = 'block';
          return;
        }
        await this._applyAbsence(student, groupId, dateStr, type, null, contractMap);
        Modal.close();
        const [year2, month2] = dateStr.slice(0, 7).split('-').map(Number);
        const days2 = getDaysInMonth(year2, month2);
        const newGroupData = await this._loadGroupData(days2[0], days2[days2.length - 1]);
        await this._renderCalendar();
        await this._showDayDetail(dateStr, newGroupData);
      });
    });

    backdrop.querySelector('#makeup-confirm-btn')?.addEventListener('click', async () => {
      const makeupDate = backdrop.querySelector('#makeup-date-input').value;
      if (!makeupDate) { Toast.error('날짜를 선택해주세요.'); return; }
      await this._applyAbsence(student, groupId, dateStr, 'makeup', makeupDate, contractMap);
      Modal.close();
      const [year2, month2] = dateStr.slice(0, 7).split('-').map(Number);
      const days2 = getDaysInMonth(year2, month2);
      const newGroupData = await this._loadGroupData(days2[0], days2[days2.length - 1]);
      await this._renderCalendar();
      await this._showDayDetail(dateStr, newGroupData);
    });

    backdrop.querySelector('#makeup-back-btn')?.addEventListener('click', () => {
      backdrop.querySelector('#makeup-date-panel').style.display = 'none';
      backdrop.querySelector('#absence-options').style.display = 'flex';
    });
  }

  async _applyAbsence(student, groupId, dateStr, absentType, makeupDate, contractMap) {
    await AttendanceDB.set({
      studentId: student.id,
      groupId,
      date: dateStr,
      status: 'absent',
      absentType,
      makeupDate: makeupDate || null,
    });

    if (absentType === 'extend') {
      const contract = contractMap[student.id];
      if (contract) {
        const days = daysToNextClass(contract.endDate, student.attendanceDays);
        await ContractsDB.extendEndDate(contract.id, days);
      }
    }

    const labels = {
      normal: '단순 결석',
      makeup: makeupDate ? `보충강의 예정 (${makeupDate})` : '보충강의 예정',
      extend: '기간 연장',
      no_deduct: '횟수 차감 없음',
    };
    Toast.success(`${escapeHtml(student.name)} — ${labels[absentType] || '결석'} 처리 완료`);
  }

  _absentTypeLabel(absentType, makeupDate) {
    const map = {
      normal: '',
      makeup: makeupDate ? ` (보충 ${makeupDate})` : ' (보충예정)',
      extend: ' (기간연장)',
      no_deduct: ' (횟수무시)',
    };
    return map[absentType] || '';
  }

  destroy() {}
}
