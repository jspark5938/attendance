/**
 * Attendance marking page (핵심 기능)
 * Route: #/groups/:id/attend?date=YYYY-MM-DD
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { ContractsDB } from '../db/contracts.js';
import Modal from '../components/modal.js';
import Toast from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftDate, formatDateKo, isFuture, daysToNextClass } from '../utils/date.js';
import { STATUS_LABELS, STATUS_LIST, MESSAGES } from '../utils/i18n.js';

export class AttendancePage {
  constructor(params, query) {
    this.groupId = params.id;
    this.date = query.date || todayStr();
    this.group = null;
    this.students = [];
    this.attendanceMap = {}; // { studentId: record }
    this.contractMap = {}; // studentId → active contract
    this._saving = new Set(); // prevent double-saves
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">그룹을 찾을 수 없습니다</div>
      </div></div>`;
    }

    this.students = await StudentsDB.getByGroup(this.groupId);
    this.attendanceMap = await AttendanceDB.getByGroupDate(this.groupId, this.date);

    // Split students into scheduled / unscheduled for this date's day-of-week
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDay  = DAY_NAMES[new Date(this.date + 'T00:00:00').getDay()];
    // Students with no attendanceDays set → treat as always scheduled
    this._scheduled   = this.students.filter(s => !s.attendanceDays?.length || s.attendanceDays.includes(todayDay));
    this._unscheduled = this.students.filter(s =>  s.attendanceDays?.length && !s.attendanceDays.includes(todayDay));

    const summary = this._calcSummary();
    const hasGroups = this._scheduled.length > 0 && this._unscheduled.length > 0;

    return `
      <div class="page-header">
        <div class="page-header-left">
          <a href="#/groups/${this.groupId}" class="btn btn-ghost btn-icon" aria-label="뒤로" style="font-size:20px;">←</a>
          <div>
            <h1 class="page-title">${escapeHtml(this.group.name)} — 출석 체크</h1>
            <div class="page-subtitle">${formatDateKo(this.date)}</div>
          </div>
        </div>
        <div class="page-header-actions">
          <!-- Date navigator -->
          <div class="date-nav">
            <button class="date-nav-btn" id="prev-date" aria-label="이전날">←</button>
            <button class="date-nav-label" id="date-picker-trigger" title="날짜 선택">${formatDateKo(this.date, { short: true })}</button>
            <button class="date-nav-btn" id="next-date" aria-label="다음날">→</button>
          </div>
        </div>
      </div>

      <div class="page-body">
        <!-- Summary bar -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
          ${this._summaryCard('출석', summary.present, 'var(--color-present)')}
          ${this._summaryCard('결석', summary.absent, 'var(--color-absent)')}
          ${this._summaryCard('지각', summary.late, 'var(--color-late)')}
          ${this._summaryCard('조퇴', summary.early, 'var(--color-early)')}
        </div>

        <!-- Quick mark bar -->
        <div class="quick-mark-bar" style="margin-bottom: var(--space-3);">
          <span class="quick-mark-label">전체:</span>
          ${STATUS_LIST.map(s => `
            <button class="btn btn-sm btn-secondary quick-all-btn" data-status="${s}">
              모두 ${STATUS_LABELS[s]}
            </button>
          `).join('')}
          <button class="btn btn-sm btn-ghost" id="clear-all-btn" style="margin-left:auto; color:var(--color-absent);">초기화</button>
        </div>
        ${hasGroups ? `
        <div class="quick-mark-bar">
          <span class="quick-mark-label" style="color:var(--color-present);">예정만:</span>
          ${STATUS_LIST.map(s => `
            <button class="btn btn-sm btn-secondary quick-scheduled-btn" data-status="${s}">
              예정 ${STATUS_LABELS[s]}
            </button>
          `).join('')}
        </div>` : ''}

        <!-- Student cards -->
        <div id="student-attendance-list" style="display:flex; flex-direction:column; gap: var(--space-2); margin-top: var(--space-3);">
          ${this.students.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">학생이 없습니다</div><div class="empty-state-desc"><a href="#/groups/${this.groupId}">학생 추가하기</a></div></div>`
            : this._renderGroupedList()
          }
        </div>

        <!-- Hidden flatpickr input -->
        <input type="text" id="date-picker-input" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0;" readonly>
      </div>
    `;
  }

  _renderGroupedList() {
    if (!this._unscheduled.length) {
      // No unscheduled students → just render flat list (no section headers needed)
      return this._scheduled.map(s => this._studentCard(s)).join('');
    }

    const scheduledHtml = this._scheduled.length > 0 ? `
      ${this._sectionHeader('오늘 출석 예정', this._scheduled.length, 'var(--color-present)')}
      ${this._scheduled.map(s => this._studentCard(s)).join('')}
    ` : '';

    const unscheduledHtml = `
      ${this._sectionHeader('출석 비예정', this._unscheduled.length, 'var(--color-text-muted)')}
      ${this._unscheduled.map(s => this._studentCard(s, true)).join('')}
    `;

    return scheduledHtml + unscheduledHtml;
  }

  _sectionHeader(label, count, color) {
    return `
      <div style="display:flex; align-items:center; gap:var(--space-2); padding: var(--space-2) 0; margin-top: var(--space-2);">
        <span style="font-size:12px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:.04em;">${label}</span>
        <span style="font-size:11px; font-weight:600; color:white; background:${color}; border-radius:10px; padding:1px 7px;">${count}명</span>
        <div style="flex:1; height:1px; background:var(--color-border-light);"></div>
      </div>
    `;
  }

  _summaryCard(label, count, color) {
    return `<div class="stat-card">
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-value" style="color:${color}">${count}</div>
    </div>`;
  }

  _calcSummary() {
    const records = Object.values(this.attendanceMap);
    const s = { present: 0, absent: 0, late: 0, early: 0 };
    records.forEach(r => { s[r.status] = (s[r.status] || 0) + 1; });
    return s;
  }

  _studentCard(student, dimmed = false) {
    const rec = this.attendanceMap[student.id];
    const activeStatus = rec?.status || null;

    return `
      <div class="student-card" data-student-id="${student.id}" style="${dimmed ? 'opacity:0.55;' : ''}">
        <div class="student-number">${student.number}</div>
        <div class="student-name">${escapeHtml(student.name)}</div>
        <div class="attendance-buttons">
          ${STATUS_LIST.map(s => `
            <button class="att-btn${activeStatus === s ? ' active' : ''}"
              data-status="${s}"
              data-student-id="${student.id}"
              aria-pressed="${activeStatus === s ? 'true' : 'false'}"
              aria-label="${STATUS_LABELS[s]}">
              ${STATUS_LABELS[s]}
            </button>
          `).join('')}
        </div>
      </div>
    `;
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

  async mount() {
    await this._loadContracts();

    // Attendance button clicks (delegated)
    const list = document.getElementById('student-attendance-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.att-btn');
        if (!btn) return;
        const studentId = btn.dataset.studentId;
        const status    = btn.dataset.status;

        // If clicking absent and it's NOT a toggle-off, show absence type modal
        if (status === 'absent') {
          const currentRec = this.attendanceMap[studentId];
          if (currentRec?.status !== 'absent') {
            const student = this.students.find(s => s.id === studentId);
            if (student) {
              this._openAbsenceModal(student, btn);
              return;
            }
          }
        }

        this._markAttendance(studentId, status, btn);
      });
    }

    // Date navigation
    document.getElementById('prev-date')?.addEventListener('click', () => {
      window.location.hash = `#/groups/${this.groupId}/attend?date=${shiftDate(this.date, -1)}`;
    });
    document.getElementById('next-date')?.addEventListener('click', () => {
      window.location.hash = `#/groups/${this.groupId}/attend?date=${shiftDate(this.date, 1)}`;
    });

    // Date picker (Flatpickr)
    const pickerTrigger = document.getElementById('date-picker-trigger');
    const pickerInput   = document.getElementById('date-picker-input');
    if (pickerTrigger && pickerInput && window.flatpickr) {
      const fp = window.flatpickr(pickerInput, {
        defaultDate: this.date,
        locale: 'ko',
        maxDate: 'today',
        onChange: ([date]) => {
          if (date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            window.location.hash = `#/groups/${this.groupId}/attend?date=${y}-${m}-${d}`;
          }
        },
      });
      pickerTrigger.addEventListener('click', () => fp.open());
    }

    // Quick mark all
    document.querySelectorAll('.quick-all-btn').forEach(btn => {
      btn.addEventListener('click', () => this._markAll(btn.dataset.status));
    });

    // Quick mark scheduled only
    document.querySelectorAll('.quick-scheduled-btn').forEach(btn => {
      btn.addEventListener('click', () => this._markScheduled(btn.dataset.status));
    });

    // Clear all
    document.getElementById('clear-all-btn')?.addEventListener('click', () => this._clearAll());
  }

  async _markAttendance(studentId, status, clickedBtn) {
    if (this._saving.has(studentId)) return;
    this._saving.add(studentId);

    // Optimistic UI update
    const card = document.querySelector(`[data-student-id="${studentId}"].student-card`);
    if (card) {
      const allBtns = card.querySelectorAll('.att-btn');
      const alreadyActive = clickedBtn.classList.contains('active');

      allBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });

      if (!alreadyActive) {
        clickedBtn.classList.add('active');
        clickedBtn.setAttribute('aria-pressed', 'true');
      }
    }

    // Update local map
    const student = this.students.find(s => s.id === studentId);

    try {
      const currentRec = this.attendanceMap[studentId];
      const isToggle = currentRec?.status === status;

      if (isToggle) {
        // Toggle off: remove record
        await AttendanceDB.remove(studentId, this.date);
        delete this.attendanceMap[studentId];
      } else {
        const rec = await AttendanceDB.set({
          studentId,
          groupId: this.groupId,
          date: this.date,
          status,
        });
        this.attendanceMap[studentId] = rec;
      }
      this._updateSummary();
    } catch (e) {
      Toast.error(MESSAGES.saveFailed);
    } finally {
      this._saving.delete(studentId);
    }
  }

  async _markAll(status) {
    const records = this.students.map(s => ({
      studentId: s.id,
      groupId: this.groupId,
      date: this.date,
      status,
    }));

    try {
      await AttendanceDB.bulkSet(records);
      // Update local map
      records.forEach(r => { this.attendanceMap[r.studentId] = { ...r, id: `${r.studentId}_${r.date}`, markedAt: new Date().toISOString() }; });
      // Update all buttons in UI
      document.querySelectorAll('.att-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
        btn.setAttribute('aria-pressed', btn.dataset.status === status ? 'true' : 'false');
      });
      this._updateSummary();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _markScheduled(status) {
    const targets = this._scheduled || [];
    if (!targets.length) return;
    const records = targets.map(s => ({ studentId: s.id, groupId: this.groupId, date: this.date, status }));
    try {
      await AttendanceDB.bulkSet(records);
      records.forEach(r => { this.attendanceMap[r.studentId] = { ...r, id: `${r.studentId}_${r.date}`, markedAt: new Date().toISOString() }; });
      targets.forEach(s => {
        const card = document.querySelector(`[data-student-id="${s.id}"].student-card`);
        if (!card) return;
        card.querySelectorAll('.att-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.status === status);
          b.setAttribute('aria-pressed', b.dataset.status === status ? 'true' : 'false');
        });
      });
      this._updateSummary();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _clearAll() {
    const ok = await Modal.confirm({
      title: '출석 초기화',
      message: MESSAGES.clearAttendanceConfirm,
      danger: true,
      confirmText: '초기화',
    });
    if (!ok) return;

    try {
      await Promise.all(this.students.map(s => AttendanceDB.remove(s.id, this.date)));
      this.attendanceMap = {};
      document.querySelectorAll('.att-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      this._updateSummary();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  _updateSummary() {
    const summary = this._calcSummary();
    const cards = document.querySelectorAll('.stat-card');
    const values = [summary.present, summary.absent, summary.late, summary.early];
    cards.forEach((card, i) => {
      const valEl = card.querySelector('.stat-card-value');
      if (valEl && values[i] !== undefined) valEl.textContent = values[i];
    });
  }

  async _openAbsenceModal(student, clickedBtn) {
    const contract = this.contractMap[student.id] || null;
    const hasPeriod = contract?.type === 'period';
    const hasCount = contract?.type === 'count';

    const body = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:13px; color:var(--color-text-muted); padding-bottom:4px;">
          <strong>${escapeHtml(student.name)}</strong> · ${this.date}
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
          <input type="date" id="makeup-date-input" class="form-input" style="width:100%; margin-bottom:8px;" min="${this.date}">
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

        await this._applyAbsence(student, type, null, clickedBtn);
        Modal.close();
      });
    });

    backdrop.querySelector('#makeup-confirm-btn')?.addEventListener('click', async () => {
      const makeupDate = backdrop.querySelector('#makeup-date-input').value;
      if (!makeupDate) { Toast.error('날짜를 선택해주세요.'); return; }
      await this._applyAbsence(student, 'makeup', makeupDate, clickedBtn);
      Modal.close();
    });

    backdrop.querySelector('#makeup-back-btn')?.addEventListener('click', () => {
      backdrop.querySelector('#makeup-date-panel').style.display = 'none';
      backdrop.querySelector('#absence-options').style.display = 'flex';
    });
  }

  async _applyAbsence(student, absentType, makeupDate, clickedBtn) {
    if (this._saving.has(student.id)) return;
    this._saving.add(student.id);

    try {
      const rec = await AttendanceDB.set({
        studentId: student.id,
        groupId: this.groupId,
        date: this.date,
        status: 'absent',
        absentType,
        makeupDate: makeupDate || null,
      });
      this.attendanceMap[student.id] = rec;

      if (absentType === 'extend') {
        const contract = this.contractMap[student.id];
        if (contract) {
          const days = daysToNextClass(contract.endDate, student.attendanceDays);
          await ContractsDB.extendEndDate(contract.id, days);
          await this._loadContracts();
        }
      }

      // Update UI buttons
      const card = document.querySelector(`[data-student-id="${student.id}"].student-card`);
      if (card) {
        card.querySelectorAll('.att-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        if (clickedBtn) {
          clickedBtn.classList.add('active');
          clickedBtn.setAttribute('aria-pressed', 'true');
        }
      }

      this._updateSummary();

      const labels = {
        normal: '단순 결석',
        makeup: makeupDate ? `보충강의 예정 (${makeupDate})` : '보충강의 예정',
        extend: '기간 연장',
        no_deduct: '횟수 차감 없음',
      };
      Toast.success(`${escapeHtml(student.name)} — ${labels[absentType] || '결석'} 처리 완료`);
    } catch (e) {
      Toast.error(MESSAGES.saveFailed);
    } finally {
      this._saving.delete(student.id);
    }
  }

  destroy() {}
}
