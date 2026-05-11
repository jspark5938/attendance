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
import { STATUS_LIST, t } from '../utils/i18n.js';

export class AttendancePage {
  constructor(params, query) {
    this.groupId = params.id;
    this.date = query.date || todayStr();
    this.group = null;
    this.students = [];
    this.attendanceMap = {}; // { studentId: record }
    this.contractMap = {}; // studentId → active contract
    this._saving = new Set(); // prevent double-saves
    this._attendanceCache = {}; // studentId → record[] (built in _loadContracts)
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">${t('common.groupNotFound')}</div>
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
      <div class="page-body">
        <!-- Date navigator -->
        <div class="date-nav" style="justify-content:center; margin-bottom:var(--space-4);">
          <button class="date-nav-btn" id="prev-date" aria-label="${t('attendance.prevDay')}">←</button>
          <button class="date-nav-label" id="date-picker-trigger" title="${t('attendance.pickDate')}">${formatDateKo(this.date, { short: true })}</button>
          <button class="date-nav-btn" id="next-date" aria-label="${t('attendance.nextDay')}">→</button>
        </div>

        <!-- Summary bar -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
          ${this._summaryCard(t('status.present'), summary.present, 'var(--color-present)')}
          ${this._summaryCard(t('status.absent'), summary.absent, 'var(--color-absent)')}
          ${this._summaryCard(t('status.late'), summary.late, 'var(--color-late)')}
          ${this._summaryCard(t('status.early'), summary.early, 'var(--color-early)')}
        </div>

        <!-- Quick mark bar -->
        <div class="quick-mark-bar" style="margin-bottom: var(--space-3);">
          <span class="quick-mark-label">${t('attendance.allStudents')}</span>
          ${STATUS_LIST.map(s => `
            <button class="btn btn-sm btn-secondary quick-all-btn" data-status="${s}">
              ${t('attendance.markAll', { status: t('status.' + s) })}
            </button>
          `).join('')}
          <button class="btn btn-sm btn-ghost" id="clear-all-btn" style="margin-left:auto; color:var(--color-absent);">${t('attendance.clearAll')}</button>
        </div>
        ${hasGroups ? `
        <div class="quick-mark-bar">
          <span class="quick-mark-label" style="color:var(--color-present);">${t('attendance.scheduledOnly')}</span>
          ${STATUS_LIST.map(s => `
            <button class="btn btn-sm btn-secondary quick-scheduled-btn" data-status="${s}">
              ${t('attendance.markSched', { status: t('status.' + s) })}
            </button>
          `).join('')}
        </div>` : ''}

        <!-- Student cards -->
        <div id="student-attendance-list" style="display:flex; flex-direction:column; gap: var(--space-2); margin-top: var(--space-3);">
          ${this.students.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">${t('attendance.noStudents')}</div><div class="empty-state-desc"><a href="#/groups/${this.groupId}">${t('attendance.addStudents')}</a></div></div>`
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
      ${this._sectionHeader(t('attendance.scheduled'), this._scheduled.length, 'var(--color-present)')}
      ${this._scheduled.map(s => this._studentCard(s)).join('')}
    ` : '';

    const unscheduledHtml = `
      ${this._sectionHeader(t('attendance.unscheduled'), this._unscheduled.length, 'var(--color-text-muted)')}
      ${this._unscheduled.map(s => this._studentCard(s, true)).join('')}
    `;

    return scheduledHtml + unscheduledHtml;
  }

  _sectionHeader(label, count, color) {
    return `
      <div style="display:flex; align-items:center; gap:var(--space-2); padding: var(--space-2) 0; margin-top: var(--space-2);">
        <span style="font-size:12px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:.04em;">${label}</span>
        <span style="font-size:11px; font-weight:600; color:white; background:${color}; border-radius:10px; padding:1px 7px;">${t('attendance.count', { n: count })}</span>
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
              aria-label="${t('status.' + s)}">
              ${t('status.' + s)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  async _loadContracts() {
    let contracts = await ContractsDB.getByGroup(this.groupId);

    // Pre-pass: activate pending contracts if active ones are exhausted
    const byStudent = {};
    for (const c of contracts) {
      if (!byStudent[c.studentId]) byStudent[c.studentId] = { active: null, pending: [] };
      if (c.status === 'active') byStudent[c.studentId].active = c;
      else if (c.status === 'pending') byStudent[c.studentId].pending.push(c);
    }

    // Fetch all group attendance ONCE if any count-type active contract exists
    // Builds _attendanceCache for use in _checkAndActivatePending (avoids per-click reads)
    const hasCountActive = Object.values(byStudent).some(({ active }) => active?.type === 'count');
    if (hasCountActive) {
      const allRecords = await AttendanceDB.getByGroup(this.groupId);
      this._attendanceCache = {};
      allRecords.forEach(r => {
        if (!this._attendanceCache[r.studentId]) this._attendanceCache[r.studentId] = [];
        this._attendanceCache[r.studentId].push(r);
      });
    }

    let mutated = false;
    const today = todayStr();
    for (const [studentId, { active, pending }] of Object.entries(byStudent)) {
      if (!active || !pending.length) continue;

      let exhausted = false;
      if (active.type === 'period') {
        exhausted = active.endDate && active.endDate < today;
      } else if (active.type === 'count') {
        const records = this._attendanceCache[studentId] || [];
        const used = records.filter(r =>
          ['present', 'late', 'early'].includes(r.status) && r.date >= (active.startDate || '2000-01-01')
        ).length;
        exhausted = (active.totalCount || 0) - used <= 0;
      }

      if (exhausted) {
        await ContractsDB.end(active.id);
        pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        await ContractsDB.update(pending[0].id, { status: 'active' });
        mutated = true;
      }
    }

    if (mutated) contracts = await ContractsDB.getByGroup(this.groupId);

    this.contractMap = {};
    contracts
      .filter(c => c.status === 'active')
      .forEach(c => {
        if (!this.contractMap[c.studentId]) {
          this.contractMap[c.studentId] = c;
        }
      });
  }

  async _checkAndActivatePending(studentId) {
    const active = this.contractMap[studentId];
    if (!active || active.type !== 'count') return;

    // Use cached records (built in _loadContracts) + today's in-memory record
    // This avoids a Firestore read on every attendance mark
    const cached = this._attendanceCache[studentId] || [];
    const todayRec = this.attendanceMap[studentId];
    const records = [...cached.filter(r => r.date !== this.date), ...(todayRec ? [todayRec] : [])];

    const used = records.filter(r =>
      ['present', 'late', 'early'].includes(r.status) && r.date >= (active.startDate || '2000-01-01')
    ).length;
    if ((active.totalCount || 0) - used > 0) return;

    const all = await ContractsDB.getByStudent(studentId);
    const pending = all.filter(c => c.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!pending.length) return;

    await ContractsDB.end(active.id);
    await ContractsDB.update(pending[0].id, { status: 'active' });
    await this._loadContracts();
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
        // Check if count-based contract is exhausted → activate pending
        if (['present', 'late', 'early'].includes(status)) {
          await this._checkAndActivatePending(studentId);
        }
      }
      this._updateSummary();
    } catch (e) {
      Toast.error(t('messages.saveFailed'));
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
    } catch (e) { Toast.error(t('messages.saveFailed')); }
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
    } catch (e) { Toast.error(t('messages.saveFailed')); }
  }

  async _clearAll() {
    const ok = await Modal.confirm({
      title: t('messages.clearTitle'),
      message: t('messages.clearAttendanceConfirm'),
      danger: true,
      confirmText: t('messages.clearConfirmBtn'),
    });
    if (!ok) return;

    try {
      const results = await Promise.allSettled(
        this.students.map(s => AttendanceDB.remove(s.id, this.date))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        Toast.error(t('messages.clearFailed', { n: failed }));
        return;
      }
      this.attendanceMap = {};
      document.querySelectorAll('.att-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      this._updateSummary();
    } catch (e) { Toast.error(t('messages.saveFailed')); }
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

        <div id="makeup-date-panel" style="display:none; padding:12px; background:var(--color-surface-2); border-radius:var(--radius-md); border:1px solid var(--color-border);">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">${t('calendar.makeupDateTitle')}</div>
          <input type="date" id="makeup-date-input" class="form-input" style="width:100%; margin-bottom:8px;" min="${this.date}">
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

        await this._applyAbsence(student, type, null, clickedBtn);
        Modal.close();
      });
    });

    backdrop.querySelector('#makeup-confirm-btn')?.addEventListener('click', async () => {
      const makeupDate = backdrop.querySelector('#makeup-date-input').value;
      if (!makeupDate) { Toast.error(t('calendar.makeupDateRequired')); return; }
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
        makeupDate: (absentType === 'makeup') ? (makeupDate || null) : null,
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
        normal:    t('calendar.absentLabelNormal'),
        makeup:    makeupDate ? t('calendar.absentLabelMakeupWithDate', { date: makeupDate }) : t('calendar.absentLabelMakeupNoDate'),
        extend:    t('calendar.absentLabelExtend'),
        no_deduct: t('calendar.absentLabelNoDeduct'),
      };
      Toast.success(t('calendar.absentDone', { name: student.name, type: labels[absentType] || t('status.absent') }));
    } catch (e) {
      Toast.error(t('messages.saveFailed'));
    } finally {
      this._saving.delete(student.id);
    }
  }

  destroy() {}
}
