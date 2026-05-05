/**
 * Group detail page: student list + management
 * 학원 특화 구성원 정보 (이름/나이/성별/연락처/출석요일/시간/등록일)
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { ContractsDB } from '../db/contracts.js';
import { PremiumService } from '../services/premium.js';
import Modal from '../components/modal.js';
import Toast from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, formatDateKo, strToDate } from '../utils/date.js';
import { t, getMessages } from '../utils/i18n.js';

// DB에 저장되는 한글 요일 순서 (변경 금지 — DB 매칭용)
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 한글 요일 → locale 표시명 변환 (일=0, 월=1, ..., 토=6)
const KO_DAY_TO_DOW = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
function localizeDay(koDay) {
  const dow = KO_DAY_TO_DOW[koDay];
  if (dow === undefined) return koDay;
  return getMessages().date.daysShort[dow] ?? koDay;
}

const genderLabel = (g) => ({ male: t('groupDetail.genderMale'), female: t('groupDetail.genderFemale'), other: t('groupDetail.genderOther') }[g] || '—');

export class GroupDetailPage {
  constructor(params, query) {
    this.groupId = params.id;
    this.group = null;
    this.students = [];
    this.todayAttendance = {};
    this.today = todayStr();
    this._searchQuery = '';
    this.contractMap = {};
  }

  async render() {
    try { this.group = await GroupsDB.get(this.groupId); } catch (e) {}

    if (!this.group) {
      return `<div class="page-body"><div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">${t('common.groupNotFound')}</div>
        <div class="empty-state-desc"><a href="#/groups">${t('groupDetail.backToGroups')}</a></div>
      </div></div>`;
    }

    this.students = await StudentsDB.getByGroup(this.groupId);
    this.todayAttendance = await AttendanceDB.getByGroupDate(this.groupId, this.today);

    const summary = this._calcSummary();

    return `
      <div class="page-body">
        <!-- 오늘 출석 요약 -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
          ${this._summaryCard(t('status.present'), summary.present, 'var(--color-present)')}
          ${this._summaryCard(t('status.absent'), summary.absent, 'var(--color-absent)')}
          ${this._summaryCard(t('status.late'), summary.late, 'var(--color-late)')}
          ${this._summaryCard(t('status.none'), summary.none, 'var(--color-text-muted)')}
        </div>

        <!-- 빠른 이동 -->
        <div style="display:flex; gap:8px; margin-bottom: var(--space-5); flex-wrap:wrap;">
          <a href="#/groups/${this.groupId}/attend" class="btn btn-outline btn-sm">${t('groupDetail.attendLink')}</a>
          <a href="#/groups/${this.groupId}/calendar" class="btn btn-outline btn-sm">${t('groupDetail.calendarLink')}</a>
          <a href="#/groups/${this.groupId}/stats" class="btn btn-outline btn-sm">${t('groupDetail.statsLink')}</a>
        </div>

        <!-- 구성원 목록 -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">${t('groupDetail.memberList')}</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="text" id="student-search" class="form-input"
                placeholder="${t('placeholders.search')}" style="width:120px; padding: 6px 12px; font-size:13px;"
                value="${escapeHtml(this._searchQuery)}">
              <button class="btn btn-primary btn-sm" id="add-student-card-btn">${t('groupDetail.addShort')}</button>
            </div>
          </div>

          <div id="student-list">
            ${this.students.length === 0 ? this._emptyStudents() : this._studentTable()}
          </div>
        </div>
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
    const records = Object.values(this.todayAttendance);
    const s = { present: 0, absent: 0, late: 0, early: 0 };
    records.forEach(r => { s[r.status] = (s[r.status] || 0) + 1; });
    s.none = this.students.length - records.length;
    return s;
  }

  _emptyStudents() {
    return `
      <div class="empty-state" style="padding: var(--space-10);">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-title">${t('groupDetail.noMembers')}</div>
        <div class="empty-state-desc">${t('groupDetail.noMembersDesc')}</div>
        <button class="btn btn-primary" id="add-student-empty-btn" style="margin-top: 8px;">${t('groupDetail.addMemberEmpty')}</button>
      </div>
    `;
  }

  _studentTable() {
    const filtered = this._searchQuery
      ? this.students.filter(s => s.name.includes(this._searchQuery))
      : this.students;

    if (!filtered.length) {
      return `<div class="empty-state" style="padding: var(--space-8);">
        <div class="empty-state-desc">${t('groupDetail.searchNoResult', { query: escapeHtml(this._searchQuery) })}</div>
      </div>`;
    }

    return `
      <div style="overflow-x:auto;">
        <table class="student-table" style="width:100%; border-collapse:collapse; font-size: var(--font-size-sm);">
          <thead>
            <tr style="background:var(--color-surface-2);">
              <th style="${thStyle()}">${t('groupDetail.colNumber')}</th>
              <th style="${thStyle('left')}">${t('groupDetail.colName')}</th>
              <th style="${thStyle()}" class="col-age">${t('groupDetail.colAge')}</th>
              <th style="${thStyle()}" class="col-gender">${t('groupDetail.colGender')}</th>
              <th style="${thStyle('left')}" class="col-phone">${t('groupDetail.colPhone')}</th>
              <th style="${thStyle('left')}" class="col-days">${t('groupDetail.colDays')}</th>
              <th style="${thStyle()}" class="col-time">${t('groupDetail.colTime')}</th>
              <th style="${thStyle()}" class="col-reg">${t('groupDetail.colReg')}</th>
              <th style="${thStyle()}" class="col-contract">${t('groupDetail.colContract')}</th>
              <th style="${thStyle()}">${t('groupDetail.colToday')}</th>
              <th style="${thStyle()}">${t('groupDetail.colManage')}</th>
            </tr>
          </thead>
          <tbody id="student-tbody">
            ${filtered.map(s => this._studentRow(s)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _studentRow(s) {
    const att = this.todayAttendance[s.id];
    const days = (s.attendanceDays || []).map(localizeDay).join('·') || '—';
    const registered = s.registeredAt ? s.registeredAt.slice(0, 10).replace(/-/g, '.') : '—';
    const timeStr = (() => {
      if (!s.classTime) return '—';
      if (typeof s.classTime === 'string') return s.classTime || '—';
      const parts = (s.attendanceDays || []).filter(d => s.classTime[d]).map(d => `${localizeDay(d)} ${s.classTime[d]}`);
      return parts.length ? parts.join(' / ') : '—';
    })();

    return `
      <tr style="border-top:1px solid var(--color-border-light); transition: background var(--transition-fast);"
          onmouseenter="this.style.background='var(--color-surface-2)'"
          onmouseleave="this.style.background=''">
        <td style="${tdStyle()}">${s.number}</td>
        <td style="${tdStyle('left')}; max-width:120px;">
          <button class="btn btn-ghost view-student-btn" data-id="${s.id}"
            title="${escapeHtml(s.name)}"
            style="font-weight:600; padding:2px 4px; text-align:left; color:var(--color-primary); text-decoration:underline; font-size:inherit; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">
            ${escapeHtml(s.name)}
          </button>
        </td>
        <td style="${tdStyle()}" class="col-age">${s.age ?? '—'}</td>
        <td style="${tdStyle()}" class="col-gender">${genderLabel(s.gender)}</td>
        <td style="${tdStyle('left')}" class="col-phone">${s.phone ? `<a href="tel:${escapeHtml(s.phone)}" style="color:var(--color-primary);">${escapeHtml(s.phone)}</a>` : '—'}</td>
        <td style="${tdStyle('left')}" class="col-days">${escapeHtml(days)}</td>
        <td style="${tdStyle()}" class="col-time">${escapeHtml(timeStr)}</td>
        <td style="${tdStyle()}" class="col-reg" title="${registered}">${registered}</td>
        <td style="${tdStyle()}" class="col-contract">${this._contractCellHtml(s)}</td>
        <td style="${tdStyle()}">
          ${att
            ? `<span class="badge badge-${att.status}">${t('status.' + att.status)}</span>`
            : `<span class="badge badge-none">${t('status.none')}</span>`}
        </td>
        <td style="${tdStyle()}">
          <div style="display:flex; gap:4px; justify-content:center;">
            <button class="btn btn-ghost btn-icon-sm edit-student-btn" data-id="${s.id}" title="${t('common.edit')}">✎</button>
            <button class="btn btn-ghost btn-icon-sm delete-student-btn" data-id="${s.id}" title="${t('common.delete')}" style="color:var(--color-absent);">✕</button>
          </div>
        </td>
      </tr>
    `;
  }

  async mount() {
    this._loadContractStatus();

    // 구성원 추가 — async 오류가 묻히지 않도록 try/catch 포함
    const onAddClick = async () => {
      try {
        await this._openAddStudent();
      } catch (e) {
        Toast.error(t('groupDetail.addError', { msg: e.message || '' }));
      }
    };
    document.getElementById('add-student-btn')?.addEventListener('click', onAddClick);
    document.getElementById('add-student-card-btn')?.addEventListener('click', onAddClick);
    document.getElementById('add-student-empty-btn')?.addEventListener('click', onAddClick);

    // 검색
    document.getElementById('student-search')?.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.trim();
      this._refreshTable();
    });

    // 테이블 이벤트 (위임)
    document.getElementById('student-list')?.addEventListener('click', (e) => {
      const editBtn       = e.target.closest('.edit-student-btn');
      const deleteBtn     = e.target.closest('.delete-student-btn');
      const viewBtn       = e.target.closest('.view-student-btn');
      const contractBtn   = e.target.closest('.contract-history-btn');

      if (editBtn)       this._openEditStudent(editBtn.dataset.id);
      if (deleteBtn)     this._deleteStudent(deleteBtn.dataset.id);
      if (viewBtn)       this._openViewStudent(viewBtn.dataset.id);
      if (contractBtn)   this._openContractModal(contractBtn.dataset.id);
    });
  }

  _refreshTable() {
    const el = document.getElementById('student-list');
    if (!el) return;
    el.innerHTML = this.students.length === 0 ? this._emptyStudents() : this._studentTable();
    this._loadContractStatus();
  }

  // ─── 구성원 상세 보기 ───────────────────────────────────────────

  async _openViewStudent(id) {
    const s = this.students.find(st => st.id === id);
    if (!s) return;

    const records = await AttendanceDB.getByStudent(id);
    records.sort((a, b) => b.date.localeCompare(a.date));

    // 통계
    const summary = { present: 0, absent: 0, late: 0, early: 0 };
    records.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
    const total = records.length;
    const attendRate = total > 0
      ? Math.round((summary.present + summary.late + summary.early) / total * 100)
      : 0;

    // 월별 그룹
    const byMonth = {};
    records.forEach(r => {
      const ym = r.date.slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(r);
    });

    const monthsHtml = Object.entries(byMonth).map(([ym, recs]) => {
      const [y, m] = ym.split('-');
      const daysShort = getMessages().date.daysShort;
      const rows = recs.map(r => {
        const dow = daysShort[strToDate(r.date).getDay()];
        const mmdd = r.date.slice(5).replace('-', '/');
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--color-border-light);">
            <span style="min-width:72px; font-size:13px; color:var(--color-text-muted);">${mmdd} (${dow})</span>
            <span class="badge badge-${r.status}">${t('status.' + r.status)}</span>
            ${r.note ? `<span style="font-size:12px; color:var(--color-text-muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.note)}</span>` : ''}
          </div>`;
      }).join('');
      return `
        <div style="margin-bottom:var(--space-4);">
          <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); margin-bottom:4px;">
            ${t('groupDetail.histYearMonth', { y, m: parseInt(m) })} <span style="font-weight:400;">${t('groupDetail.histCount', { n: recs.length })}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');

    Modal.open({
      title: t('groupDetail.attendHistTitle', { name: s.name }),
      body: `
        <!-- 요약 통계 -->
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:var(--space-2); margin-bottom:var(--space-4); text-align:center;">
          <div>
            <div style="font-size:18px; font-weight:700;">${total}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">${t('groupDetail.histTotal')}</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-present);">${summary.present}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">${t('status.present')}</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-absent);">${summary.absent}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">${t('status.absent')}</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-late);">${summary.late}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">${t('status.late')}</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-early);">${summary.early}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">${t('status.early')}</div>
          </div>
        </div>
        <div style="text-align:center; font-size:13px; color:var(--color-text-muted); margin-bottom:var(--space-4);">
          ${t('groupDetail.attendRateLabel')} <strong style="color:var(--color-present);">${attendRate}%</strong>
        </div>

        <!-- 이력 목록 -->
        <div style="max-height:340px; overflow-y:auto; padding-right:2px;">
          ${records.length === 0
            ? `<div style="text-align:center; color:var(--color-text-muted); padding:var(--space-8);">${t('groupDetail.noAttendanceMsg')}</div>`
            : monthsHtml}
        </div>
      `,
      confirmText: t('groupDetail.editInfoBtn'),
      cancelText: t('common.close'),
      onConfirm: () => this._openEditStudent(id),
    });
  }

  // ─── 구성원 추가 ────────────────────────────────────────────────

  async _openAddStudent() {
    const nextNum = await StudentsDB.nextNumber(this.groupId);
    Modal.open({
      title: t('groupDetail.addTitle'),
      body: this._studentForm(null, nextNum),
      confirmText: t('common.add'),
      onConfirm: () => this._submitAdd(),
    });
    this._bindFormEvents();
  }

  // ─── 구성원 수정 ────────────────────────────────────────────────

  async _openEditStudent(id) {
    const student = await StudentsDB.get(id);
    if (!student) return;
    Modal.open({
      title: t('groupDetail.editTitle'),
      body: this._studentForm(student),
      confirmText: t('common.save'),
      onConfirm: () => this._submitEdit(id),
    });
    this._bindFormEvents(student);
  }

  // ─── 폼 HTML ────────────────────────────────────────────────────

  _studentForm(s = null, nextNum = 1) {
    const today = todayStr();

    return `
      <div style="display:flex; flex-direction:column; gap:0;">

        <!-- 기본 정보 -->
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3);">${t('groupDetail.basicInfo')}</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-name">${t('groupDetail.colName')} <span style="color:var(--color-absent)">${t('common.required')}</span></label>
            <input type="text" id="s-name" class="form-input" value="${escapeHtml(s?.name || '')}" placeholder="${t('groupDetail.namePH')}" maxlength="30" autocomplete="off">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-number">${t('groupDetail.colNumber')}</label>
            <input type="number" id="s-number" class="form-input" value="${s?.number ?? nextNum}" min="0" max="999">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-age">${t('groupDetail.colAge')}</label>
            <input type="number" id="s-age" class="form-input" value="${s?.age ?? ''}" placeholder="${t('groupDetail.agePH')}" min="1" max="120">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-gender">${t('groupDetail.colGender')}</label>
            <select id="s-gender" class="form-select">
              <option value="">${t('groupDetail.genderNone')}</option>
              <option value="male"   ${s?.gender === 'male'   ? 'selected' : ''}>${t('groupDetail.genderMale')}</option>
              <option value="female" ${s?.gender === 'female' ? 'selected' : ''}>${t('groupDetail.genderFemale')}</option>
              <option value="other"  ${s?.gender === 'other'  ? 'selected' : ''}>${t('groupDetail.genderOther')}</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label class="form-label" for="s-phone">${t('groupDetail.colPhone')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <input type="tel" id="s-phone" class="form-input" value="${escapeHtml(s?.phone || '')}" placeholder="${t('groupDetail.phonePH')}">
        </div>

        <div class="divider"></div>

        <!-- 수업 정보 -->
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3); margin-top:var(--space-3);">${t('groupDetail.classInfo')}</div>

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">${t('groupDetail.attendDaysLabel')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <div style="display:flex; gap:var(--space-1); flex-wrap:wrap;" id="days-picker">
            ${DAYS.map(d => {
              const checked = (s?.attendanceDays || []).includes(d);
              return `<button type="button" class="day-btn${checked ? ' day-btn-active' : ''}" data-day="${d}"
                style="width:38px; height:38px; border-radius:var(--radius-full); border:1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}; background:${checked ? 'var(--color-primary)' : 'transparent'}; color:${checked ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; transition:all var(--transition-fast); font-family:var(--font-family);">${localizeDay(d)}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="s-days" value="${escapeHtml((s?.attendanceDays || []).join(','))}">
        </div>

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">${t('groupDetail.classTimeLabel')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <div id="time-inputs-container"></div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label class="form-label" for="s-registered">${t('groupDetail.registeredAtLabel')}</label>
          <input type="date" id="s-registered" class="form-input" value="${s?.registeredAt || today}" max="${today}">
        </div>

        <div class="divider"></div>

        <!-- 메모 -->
        <div class="form-group" style="margin-top:var(--space-3); margin-bottom:${s === null ? 'var(--space-4)' : '0'};">
          <label class="form-label" for="s-memo">${t('groupDetail.memoLabel')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <textarea id="s-memo" class="form-textarea" placeholder="${t('groupDetail.memoPH')}" maxlength="300" style="min-height:64px;">${escapeHtml(s?.memo || '')}</textarea>
        </div>

        ${s === null ? `
        <div class="divider"></div>

        <!-- 수강 계약 (추가 시) -->
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3); margin-top:var(--space-3);">${t('groupDetail.contractSection')} <span style="font-weight:400; text-transform:none;">${t('common.optional')}</span></div>

        <div style="display:flex; gap:4px; margin-bottom:var(--space-3);">
          ${['none', 'period', 'count'].map(ctype => {
            const ctypeLabels = { none: t('groupDetail.contractTypeNone'), period: t('dashboard.periodBadge'), count: t('dashboard.countBadge') };
            const active = ctype === 'none';
            return `<button type="button" class="contract-type-btn" data-type="${ctype}"
              style="flex:1; padding:7px 4px; border-radius:var(--radius-md); border:1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}; background:${active ? 'var(--color-primary)' : 'transparent'}; color:${active ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font-family);">${ctypeLabels[ctype]}</button>`;
          }).join('')}
        </div>
        <input type="hidden" id="s-contract-type" value="none">

        <div id="contract-period-fields" style="display:none;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-period-start">${t('groupDetail.contractStartLabel')}</label>
              <input type="date" id="s-period-start" class="form-input" value="${today}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-end">${t('groupDetail.contractEndDateLabel')}</label>
              <input type="date" id="s-contract-end" class="form-input" value="">
            </div>
          </div>
        </div>

        <div id="contract-count-fields" style="display:none;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-count-start">${t('groupDetail.contractStartLabel')}</label>
              <input type="date" id="s-count-start" class="form-input" value="${today}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-total">${t('groupDetail.contractTotalLabel')}</label>
              <input type="number" id="s-contract-total" class="form-input" value="" min="1" max="9999" placeholder="${t('groupDetail.contractTotalPH')}">
            </div>
          </div>
        </div>

        <div class="form-group" id="s-contract-memo-wrap" style="display:none; margin-bottom:0;">
          <label class="form-label" for="s-contract-memo">${t('groupDetail.contractMemoLabel')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <input type="text" id="s-contract-memo" class="form-input" value="" placeholder="${t('groupDetail.contractMemoPH')}" maxlength="100">
        </div>
        ` : ''}

      </div>
    `;
  }

  /** 요일 버튼 및 요일별 수업시간 입력 바인딩 (모달 열린 직후 호출) */
  _bindFormEvents(s = null) {
    setTimeout(() => {
      // Android WebView에서 innerHTML로 생성된 date input의 .value가
      // HTML value 어트리뷰트로 초기화되지 않는 경우가 있어 JS로 명시적으로 설정
      const _today = todayStr();
      const regInput = document.getElementById('s-registered');
      if (regInput && !regInput.value) regInput.value = s?.registeredAt || _today;
      const periodStart = document.getElementById('s-period-start');
      if (periodStart && !periodStart.value) periodStart.value = _today;
      const countStart = document.getElementById('s-count-start');
      if (countStart && !countStart.value) countStart.value = _today;

      // 기존 classTime이 객체면 그대로, 구버전 문자열이면 빈 객체로
      const dayTimes = (typeof s?.classTime === 'object' && s?.classTime !== null)
        ? { ...s.classTime }
        : {};

      const updateTimeInputs = () => {
        const daysInput = document.getElementById('s-days');
        const selectedDays = daysInput?.value ? daysInput.value.split(',').filter(Boolean) : [];
        const container = document.getElementById('time-inputs-container');
        if (!container) return;

        // 현재 입력값 저장
        DAYS.forEach(d => {
          const inp = document.getElementById(`s-time-${d}`);
          if (inp) dayTimes[d] = inp.value;
        });

        if (!selectedDays.length) {
          container.innerHTML = `<span style="font-size:13px; color:var(--color-text-muted);">${t('groupDetail.selectDaysFirst')}</span>`;
          return;
        }

        container.innerHTML = selectedDays.map(d => `
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span style="width:36px; font-size:13px; font-weight:700; color:var(--color-text); text-align:center;">${localizeDay(d)}</span>
            <input type="time" id="s-time-${d}" class="form-input"
              value="${dayTimes[d] || ''}"
              style="flex:1; max-width:130px; padding:5px 8px; font-size:13px;">
          </div>
        `).join('');
      };

      // 초기 렌더
      updateTimeInputs();

      // 요일 버튼 토글
      document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const day = btn.dataset.day;
          const isActive = btn.classList.toggle('day-btn-active');
          btn.style.background  = isActive ? 'var(--color-primary)' : 'transparent';
          btn.style.borderColor = isActive ? 'var(--color-primary)' : 'var(--color-border)';
          btn.style.color       = isActive ? 'white' : 'var(--color-text-muted)';

          const daysInput = document.getElementById('s-days');
          if (daysInput) {
            const current = daysInput.value ? daysInput.value.split(',') : [];
            const idx = current.indexOf(day);
            if (isActive && idx === -1) current.push(day);
            else if (!isActive && idx !== -1) current.splice(idx, 1);
            daysInput.value = DAYS.filter(d => current.includes(d)).join(',');
          }

          updateTimeInputs();
        });
      });

      // 수강 계약 유형 버튼 (추가 모드에만 존재)
      document.querySelectorAll('.contract-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.type;
          document.getElementById('s-contract-type').value = type;
          document.querySelectorAll('.contract-type-btn').forEach(b => {
            const active = b.dataset.type === type;
            b.style.background  = active ? 'var(--color-primary)' : 'transparent';
            b.style.color       = active ? 'white' : 'var(--color-text-muted)';
            b.style.borderColor = active ? 'var(--color-primary)' : 'var(--color-border)';
          });
          document.getElementById('contract-period-fields').style.display = type === 'period' ? 'block' : 'none';
          document.getElementById('contract-count-fields').style.display  = type === 'count'  ? 'block' : 'none';
          const memoWrap = document.getElementById('s-contract-memo-wrap');
          if (memoWrap) memoWrap.style.display = type !== 'none' ? 'block' : 'none';
        });
      });
    }, 100);
  }

  // ─── 저장 ───────────────────────────────────────────────────────

  _readForm() {
    const daysRaw = document.getElementById('s-days')?.value || '';
    const attendanceDays = daysRaw ? daysRaw.split(',').filter(Boolean) : [];
    const classTime = {};
    attendanceDays.forEach(d => {
      const val = document.getElementById(`s-time-${d}`)?.value;
      if (val) classTime[d] = val;
    });
    return {
      name:         document.getElementById('s-name')?.value?.trim(),
      number:       document.getElementById('s-number')?.value,
      age:          document.getElementById('s-age')?.value || null,
      gender:       document.getElementById('s-gender')?.value || '',
      phone:        document.getElementById('s-phone')?.value?.trim() || '',
      attendanceDays,
      classTime,
      registeredAt: document.getElementById('s-registered')?.value || todayStr(),
      memo:         document.getElementById('s-memo')?.value?.trim() || '',
    };
  }

  async _submitAdd() {
    const data = this._readForm();
    if (!data.name) { Toast.error(t('messages.nameRequired')); return; }
    try {
      const student = await StudentsDB.create({ groupId: this.groupId, ...data });

      // 계약 정보가 입력된 경우 함께 저장
      const contractType = document.getElementById('s-contract-type')?.value || 'none';
      if (contractType !== 'none') {
        const startDate  = contractType === 'period'
          ? (document.getElementById('s-period-start')?.value || todayStr())
          : (document.getElementById('s-count-start')?.value  || todayStr());
        const endDate    = document.getElementById('s-contract-end')?.value || '';
        const totalCount = document.getElementById('s-contract-total')?.value
          ? Number(document.getElementById('s-contract-total').value) : null;
        const memo = document.getElementById('s-contract-memo')?.value?.trim() || '';

        if (contractType === 'period' && !endDate) {
          Toast.error(t('messages.contractEndReq'));
          await StudentsDB.delete(student.id); // 학생도 롤백
          return;
        }
        if (contractType === 'count' && !totalCount) {
          Toast.error(t('messages.contractTotalReq'));
          await StudentsDB.delete(student.id);
          return;
        }

        await ContractsDB.create({
          studentId: student.id,
          groupId: this.groupId,
          type: contractType,
          startDate,
          endDate,
          totalCount,
          memo,
        });
      }

      Toast.success(t('messages.studentCreated'));
      await this._reload();
    } catch (e) { Toast.error(t('messages.saveFailed')); }
  }

  async _submitEdit(id) {
    const data = this._readForm();
    if (!data.name) { Toast.error(t('messages.nameRequired')); return; }
    try {
      await StudentsDB.update(id, data);
      Toast.success(t('messages.studentUpdated'));
      await this._reload();
    } catch (e) { Toast.error(t('messages.saveFailed')); }
  }

  async _deleteStudent(id) {
    const student = await StudentsDB.get(id);
    if (!student) return;
    const ok = await Modal.confirm({
      title: t('common.delete'),
      message: t('messages.deleteStudentConfirm', { name: student.name }),
      danger: true,
      confirmText: t('common.delete'),
    });
    if (!ok) return;
    try {
      await AttendanceDB.deleteByStudent(id);
      await ContractsDB.deleteByStudent(id);
      await StudentsDB.delete(id);
      Toast.success(t('messages.studentDeleted'));
      await this._reload();
    } catch (e) { Toast.error(t('messages.saveFailed')); }
  }

  /** 페이지 데이터만 새로고침 (전체 라우터 이동 없이) */
  async _reload() {
    this.students = await StudentsDB.getByGroup(this.groupId);
    this.todayAttendance = await AttendanceDB.getByGroupDate(this.groupId, this.today);
    // 요약 카드 업데이트
    const summary = this._calcSummary();
    const cards = document.querySelectorAll('.stat-card .stat-card-value');
    const vals = [summary.present, summary.absent, summary.late, summary.none];
    cards.forEach((el, i) => { if (vals[i] !== undefined) el.textContent = vals[i]; });
    // 부제목 업데이트
    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) subtitle.textContent = `${t('groupDetail.memberCount', { n: this.students.length })} · ${t('groupDetail.todayStatus', { monthDay: formatDateKo(this.today, { monthDay: true }) })}`;
    // 테이블 업데이트
    this._refreshTable();
  }

  // ─── 수강 계약 ──────────────────────────────────────────────────

  _contractCellHtml(s) {
    return `<span id="contract-cell-${s.id}">${this._contractCellInner(s.id)}</span>`;
  }

  _contractCellInner(studentId) {
    const c = this.contractMap[studentId];
    let label = '—';
    let color = 'var(--color-text-muted)';
    let bold = false;

    if (c) {
      if (c.type === 'period') {
        const daysLeft = Math.ceil((new Date(c.endDate) - new Date(this.today)) / 86400000);
        const endStr = c.endDate ? c.endDate.slice(5).replace('-', '.') : '—';
        if (daysLeft < 0)        { label = t('groupDetail.contractExpired');               color = 'var(--color-absent)'; bold = true; }
        else if (daysLeft === 0) { label = t('groupDetail.contractEndsToday');             color = 'var(--color-absent)'; bold = true; }
        else if (daysLeft <= 7)  { label = `~${endStr} D-${daysLeft}`;                    color = 'var(--color-late)';   bold = true; }
        else                     { label = `~${endStr}`;                                   bold = true; }
      } else if (c.type === 'count') {
        const rem = c._remaining;
        if (rem === undefined)   { label = t('groupDetail.contractCalc'); }
        else if (rem <= 0)       { label = t('dashboard.exhausted');                       color = 'var(--color-absent)';  bold = true; }
        else if (rem <= 3)       { label = t('dashboard.remaining', { n: rem });           color = 'var(--color-late)';    bold = true; }
        else                     { label = t('dashboard.remaining', { n: rem });           color = 'var(--color-present)'; bold = true; }
      }
    }

    return `<button class="btn btn-ghost contract-history-btn" data-id="${studentId}"
      style="font-size:12px; padding:2px 4px; color:${color}; font-weight:${bold ? '600' : '400'}; text-decoration:underline; cursor:pointer;"
      title="${t('groupDetail.contractHistBtn')}">${label}</button>`;
  }

  async _loadContractStatus() {
    let allContracts = await ContractsDB.getByGroup(this.groupId);

    // Pre-pass: group by student to check if active contracts are exhausted
    const byStudent = {};
    for (const c of allContracts) {
      if (!byStudent[c.studentId]) byStudent[c.studentId] = { active: null, pending: [] };
      if (c.status === 'active') byStudent[c.studentId].active = c;
      else if (c.status === 'pending') byStudent[c.studentId].pending.push(c);
    }

    let mutated = false;
    for (const [studentId, { active, pending }] of Object.entries(byStudent)) {
      if (!active || !pending.length) continue;

      let exhausted = false;
      if (active.type === 'period') {
        exhausted = active.endDate && active.endDate < this.today;
      } else if (active.type === 'count') {
        const records = await AttendanceDB.getByStudent(studentId);
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

    // Reload if any contracts were activated
    if (mutated) allContracts = await ContractsDB.getByGroup(this.groupId);

    this.contractMap = {};
    // Build map: studentId -> most recent active contract
    for (const c of allContracts) {
      if (c.status === 'active') {
        const existing = this.contractMap[c.studentId];
        if (!existing || c.createdAt > existing.createdAt) {
          this.contractMap[c.studentId] = { ...c };
        }
      }
    }
    // Compute remaining for count-based
    for (const studentId of Object.keys(this.contractMap)) {
      const c = this.contractMap[studentId];
      if (c.type !== 'count') continue;
      const records = await AttendanceDB.getByStudent(studentId);
      const startDate = c.startDate || '2000-01-01';
      const used = records.filter(r =>
        ['present', 'late', 'early'].includes(r.status) && r.date >= startDate
      ).length;
      c._remaining = (c.totalCount || 0) - used;
    }
    // Update DOM cells
    this.students.forEach(s => {
      const cell = document.getElementById(`contract-cell-${s.id}`);
      if (cell) cell.innerHTML = this._contractCellInner(s.id);
    });
  }

  // ─── 계약 이력 모달 ─────────────────────────────────────────────

  async _openContractModal(studentId) {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return;
    await this._showContractList(student);
  }

  async _showContractList(student) {
    const contracts = await ContractsDB.getByStudent(student.id);
    const active = contracts.find(c => c.status === 'active');
    const pendingContracts = contracts.filter(c => c.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const history = contracts.filter(c => c.status === 'ended');

    // For count active contract, compute remaining
    let remaining = null;
    if (active?.type === 'count') {
      const records = await AttendanceDB.getByStudent(student.id);
      const startDate = active.startDate || '2000-01-01';
      const used = records.filter(r => ['present', 'late', 'early'].includes(r.status) && r.date >= startDate).length;
      remaining = (active.totalCount || 0) - used;
    }

    const activeHtml = active
      ? `<div style="border:1.5px solid var(--color-primary); border-radius:var(--radius-md); padding:var(--space-4); margin-bottom:var(--space-4);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <span class="badge" style="background:var(--color-primary); color:white; margin-bottom:6px;">${active.type === 'period' ? t('dashboard.periodBadge') : t('dashboard.countBadge')}</span>
              <div style="font-size:14px; font-weight:600; margin-bottom:4px;">
                ${active.type === 'period'
                  ? `${active.startDate} ~ ${active.endDate || '—'}`
                  : `${t('groupDetail.contractTotalLabel')} ${active.totalCount ?? 0} (${active.startDate}~)`}
              </div>
              ${active.type === 'count' ? `<div style="font-size:13px; color:${remaining <= 0 ? 'var(--color-absent)' : remaining <= 3 ? 'var(--color-late)' : 'var(--color-present)'}; font-weight:600;">${t('dashboard.remaining', { n: remaining })}</div>` : ''}
              ${active.memo ? `<div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">${escapeHtml(active.memo)}</div>` : ''}
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
              <button class="btn btn-secondary btn-sm edit-contract-btn" data-id="${active.id}">${t('common.edit')}</button>
              <button class="btn btn-sm end-contract-btn" data-id="${active.id}" style="background:var(--color-absent); color:white; border:none;">${t('groupDetail.contractEndBtn')}</button>
            </div>
          </div>
        </div>`
      : `<div style="padding:var(--space-4); background:var(--color-surface-2); border-radius:var(--radius-md); color:var(--color-text-muted); font-size:13px; text-align:center; margin-bottom:var(--space-4);">${t('groupDetail.noActiveContract')}</div>`;

    const pendingHtml = pendingContracts.length === 0 ? ''
      : `<div style="margin-bottom:var(--space-4);">
          <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-2);">대기 중 (${pendingContracts.length})</div>
          ${pendingContracts.map((c, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-3); border:1px dashed var(--color-border); border-radius:var(--radius-md); margin-bottom:6px; font-size:13px; background:var(--color-surface-2);">
              <div>
                <span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:#e0e7ff; color:#3730a3; margin-right:6px;">대기 ${idx + 1}</span>
                <span style="font-weight:600;">${c.type === 'period' ? t('dashboard.periodBadge') : t('dashboard.countBadge')}</span>
                <span style="color:var(--color-text-muted); margin-left:6px;">
                  ${c.type === 'period' ? `${c.startDate} ~ ${c.endDate}` : `${t('groupDetail.contractTotalLabel')} ${c.totalCount ?? 0} (${c.startDate}~)`}
                </span>
                ${c.memo ? `<div style="color:var(--color-text-muted); font-size:12px; margin-top:2px;">${escapeHtml(c.memo)}</div>` : ''}
              </div>
              <button class="btn btn-ghost btn-icon-sm del-contract-btn" data-id="${c.id}" title="${t('common.delete')}" style="color:var(--color-absent); flex-shrink:0;">✕</button>
            </div>
          `).join('')}
        </div>`;

    const historyHtml = history.length === 0 ? ''
      : `<div style="margin-top:var(--space-2);">
          <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-2);">${t('groupDetail.contractHistHeader', { n: history.length })}</div>
          ${history.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-3) 0; border-top:1px solid var(--color-border-light); font-size:13px;">
              <div>
                <span style="font-weight:600;">${c.type === 'period' ? t('dashboard.periodBadge') : t('dashboard.countBadge')}</span>
                <span style="color:var(--color-text-muted); margin-left:6px;">
                  ${c.type === 'period' ? `${c.startDate} ~ ${c.endDate}` : `${t('groupDetail.contractTotalLabel')} ${c.totalCount ?? 0} (${c.startDate}~)`}
                </span>
                ${c.memo ? `<div style="color:var(--color-text-muted); font-size:12px;">${escapeHtml(c.memo)}</div>` : ''}
              </div>
              <div style="display:flex; gap:4px; align-items:center;">
                <span style="font-size:11px; color:var(--color-text-muted);">${t('groupDetail.contractEndedLabel')}</span>
                <button class="btn btn-ghost btn-icon-sm del-contract-btn" data-id="${c.id}" title="${t('common.delete')}" style="color:var(--color-absent);">✕</button>
              </div>
            </div>
          `).join('')}
        </div>`;

    Modal.open({
      title: t('groupDetail.contractModalTitle', { name: student.name }),
      body: `
        <button class="btn btn-primary btn-sm" id="new-contract-btn" style="margin-bottom:var(--space-4); width:100%;">${t('groupDetail.newContractBtn')}</button>
        <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-2);">${t('groupDetail.activeContractLabel')}</div>
        ${activeHtml}
        ${pendingHtml}
        ${historyHtml}
      `,
      hideConfirm: true,
      cancelText: t('common.close'),
    });

    setTimeout(() => {
      document.getElementById('new-contract-btn')?.addEventListener('click', () => {
        this._openContractForm(student, null, () => this._showContractList(student));
      });
      document.querySelectorAll('.edit-contract-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const contract = await ContractsDB.get(btn.dataset.id);
          if (contract) this._openContractForm(student, contract, () => this._showContractList(student));
        });
      });
      document.querySelectorAll('.end-contract-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await Modal.confirm({ title: t('groupDetail.contractEndTitle'), message: t('groupDetail.contractEndMsg'), confirmText: t('groupDetail.contractEndBtn'), danger: true });
          if (ok) {
            await ContractsDB.end(btn.dataset.id);
            await this._loadContractStatus();
            await this._showContractList(student);
          }
        });
      });
      document.querySelectorAll('.del-contract-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await Modal.confirm({ title: t('groupDetail.contractDeleteTitle'), message: t('groupDetail.contractDeleteMsg'), confirmText: t('common.delete'), danger: true });
          if (ok) {
            await ContractsDB.delete(btn.dataset.id);
            await this._showContractList(student);
          }
        });
      });
    }, 50);
  }

  _openContractForm(student, contract, onBack) {
    const today = todayStr();
    const isEdit = !!contract;
    const type = contract?.type || 'period';

    Modal.open({
      title: isEdit ? t('groupDetail.contractFormEditTitle') : t('groupDetail.contractFormNewTitle'),
      body: `
        <div style="margin-bottom:var(--space-3);">
          <label class="form-label">${t('groupDetail.contractTypeLabel')}</label>
          <div style="display:flex; gap:4px;">
            ${['period', 'count'].map(ctype => {
              const ctypeLabels = { period: t('dashboard.periodBadge'), count: t('dashboard.countBadge') };
              const active = type === ctype;
              return `<button type="button" class="contract-type-btn2" data-type="${ctype}"
                style="flex:1; padding:7px 4px; border-radius:var(--radius-md); border:1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}; background:${active ? 'var(--color-primary)' : 'transparent'}; color:${active ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font-family);">${ctypeLabels[ctype]}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="cf-type" value="${type}">
        </div>

        <div class="form-group">
          <label class="form-label" for="cf-start">${t('groupDetail.contractStartLabel')}</label>
          <input type="date" id="cf-start" class="form-input" value="${contract?.startDate || today}">
        </div>

        <div id="cf-period-fields" style="display:${type === 'period' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label" for="cf-end">${t('groupDetail.contractEndDateLabel')}</label>
            <input type="date" id="cf-end" class="form-input" value="${contract?.endDate || ''}">
          </div>
        </div>

        <div id="cf-count-fields" style="display:${type === 'count' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label" for="cf-total">${t('groupDetail.contractTotalLabel')}</label>
            <input type="number" id="cf-total" class="form-input" value="${contract?.totalCount ?? ''}" min="1" max="9999" placeholder="${t('groupDetail.contractTotalPH')}">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="cf-memo">${t('groupDetail.contractMemoLabel')} <span class="form-label-optional">${t('common.optional')}</span></label>
          <input type="text" id="cf-memo" class="form-input" value="${escapeHtml(contract?.memo || '')}" placeholder="${t('groupDetail.contractMemoPH')}" maxlength="100">
        </div>
      `,
      confirmText: isEdit ? t('common.save') : t('common.add'),
      cancelText: t('common.back'),
      onConfirm: async () => {
        const contractType = document.getElementById('cf-type')?.value || 'period';
        const startDate  = document.getElementById('cf-start')?.value;
        const endDate    = document.getElementById('cf-end')?.value || '';
        const totalCount = document.getElementById('cf-total')?.value ? Number(document.getElementById('cf-total').value) : null;
        const memo       = document.getElementById('cf-memo')?.value?.trim() || '';

        if (contractType === 'period' && !endDate)    { Toast.error(t('messages.contractEndReq')); return; }
        if (contractType === 'count' && !totalCount)  { Toast.error(t('messages.contractTotalReq')); return; }

        try {
          if (isEdit) {
            await ContractsDB.update(contract.id, { type: contractType, startDate, endDate, totalCount, memo });
          } else {
            const existing = await ContractsDB.getByStudent(student.id);
            const activeContract = existing.find(c => c.status === 'active');

            if (activeContract) {
              // Active contract exists → always queue new contract as pending
              await ContractsDB.create({ studentId: student.id, groupId: this.groupId, type: contractType, startDate, endDate, totalCount, memo, status: 'pending' });
              Toast.success('계약이 대기열에 등록됐습니다. 현재 계약 소진 후 자동 활성화됩니다.');
            } else {
              // No active contract → create as active immediately
              await ContractsDB.create({ studentId: student.id, groupId: this.groupId, type: contractType, startDate, endDate, totalCount, memo });
            }
          }
          await this._loadContractStatus();
          onBack();
        } catch (e) { Toast.error(t('messages.saveFailed')); }
      },
    });

    // Override cancel to go back to list
    setTimeout(() => {
      const backdrop = document.getElementById('modal-backdrop');
      const cancelBtn = backdrop?.querySelector('.modal-cancel');
      if (cancelBtn) {
        cancelBtn._resolveRef = null;
        cancelBtn.onclick = () => { onBack(); };
      }

      // Type toggle
      document.querySelectorAll('.contract-type-btn2').forEach(btn => {
        btn.addEventListener('click', () => {
          const contractType = btn.dataset.type;
          document.getElementById('cf-type').value = contractType;
          document.querySelectorAll('.contract-type-btn2').forEach(b => {
            const active = b.dataset.type === contractType;
            b.style.background  = active ? 'var(--color-primary)' : 'transparent';
            b.style.color       = active ? 'white' : 'var(--color-text-muted)';
            b.style.borderColor = active ? 'var(--color-primary)' : 'var(--color-border)';
          });
          document.getElementById('cf-period-fields').style.display = contractType === 'period' ? 'block' : 'none';
          document.getElementById('cf-count-fields').style.display  = contractType === 'count'  ? 'block' : 'none';
        });
      });
    }, 50);
  }

  destroy() {}
}

// ─── 헬퍼 함수들 ──────────────────────────────────────────────────

function thStyle(align = 'center') {
  return `padding:10px 12px; text-align:${align}; font-weight:600; white-space:nowrap; color:var(--color-text); font-size:13px;`;
}

function tdStyle(align = 'center') {
  return `padding:10px 12px; text-align:${align}; font-size:13px; white-space:nowrap;`;
}

function infoRow(label, value, isHtml = false, fullWidth = false) {
  const val = isHtml ? value : escapeHtml(String(value ?? '—'));
  return `
    <div style="${fullWidth ? 'grid-column:1/-1;' : ''}">
      <div style="font-size:11px; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px;">${label}</div>
      <div style="font-size:14px; font-weight:500;">${val}</div>
    </div>
  `;
}
