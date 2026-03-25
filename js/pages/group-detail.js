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
import { STATUS_LABELS, MESSAGES } from '../utils/i18n.js';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const GENDER_LABELS = { male: '남', female: '여', other: '기타' };

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
        <div class="empty-state-title">그룹을 찾을 수 없습니다</div>
        <div class="empty-state-desc"><a href="#/groups">그룹 목록으로</a></div>
      </div></div>`;
    }

    this.students = await StudentsDB.getByGroup(this.groupId);
    this.todayAttendance = await AttendanceDB.getByGroupDate(this.groupId, this.today);

    const summary = this._calcSummary();

    return `
      <div class="page-header">
        <div class="page-header-left">
          <a href="#/groups" class="btn btn-ghost btn-icon" aria-label="뒤로" style="font-size:20px;">←</a>
          <div>
            <h1 class="page-title">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escapeHtml(this.group.color)};margin-right:8px;vertical-align:middle;"></span>
              ${escapeHtml(this.group.name)}
            </h1>
            <div class="page-subtitle">구성원 ${this.students.length}명 · ${formatDateKo(this.today, { monthDay: true })} 출석 현황</div>
          </div>
        </div>
        <div class="page-header-actions">
          <a href="#/groups/${this.groupId}/attend" class="btn btn-primary">오늘 출석 체크</a>
          <button class="btn btn-secondary" id="add-student-btn">+ 구성원 추가</button>
        </div>
      </div>

      <div class="page-body">
        <!-- 오늘 출석 요약 -->
        <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
          ${this._summaryCard('출석', summary.present, 'var(--color-present)')}
          ${this._summaryCard('결석', summary.absent, 'var(--color-absent)')}
          ${this._summaryCard('지각', summary.late, 'var(--color-late)')}
          ${this._summaryCard('미입력', summary.none, 'var(--color-text-muted)')}
        </div>

        <!-- 빠른 이동 -->
        <div style="display:flex; gap:8px; margin-bottom: var(--space-5); flex-wrap:wrap;">
          <a href="#/groups/${this.groupId}/attend" class="btn btn-outline btn-sm">📋 출석 체크</a>
          <a href="#/groups/${this.groupId}/calendar" class="btn btn-outline btn-sm">📅 달력</a>
          <a href="#/groups/${this.groupId}/stats" class="btn btn-outline btn-sm">📊 통계</a>
        </div>

        <!-- 구성원 목록 -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">구성원 목록</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="text" id="student-search" class="form-input"
                placeholder="이름 검색..." style="width:120px; padding: 6px 12px; font-size:13px;"
                value="${escapeHtml(this._searchQuery)}">
              <button class="btn btn-primary btn-sm" id="add-student-card-btn">+ 추가</button>
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
        <div class="empty-state-title">구성원이 없습니다</div>
        <div class="empty-state-desc">구성원을 추가해 출석을 관리해 보세요.</div>
        <button class="btn btn-primary" id="add-student-empty-btn" style="margin-top: 8px;">+ 구성원 추가</button>
      </div>
    `;
  }

  _studentTable() {
    const filtered = this._searchQuery
      ? this.students.filter(s => s.name.includes(this._searchQuery))
      : this.students;

    if (!filtered.length) {
      return `<div class="empty-state" style="padding: var(--space-8);">
        <div class="empty-state-desc">"${escapeHtml(this._searchQuery)}" 검색 결과가 없습니다.</div>
      </div>`;
    }

    return `
      <div style="overflow-x:auto;">
        <table class="student-table" style="width:100%; border-collapse:collapse; font-size: var(--font-size-sm);">
          <thead>
            <tr style="background:var(--color-surface-2);">
              <th style="${thStyle()}">번호</th>
              <th style="${thStyle('left')}">이름</th>
              <th style="${thStyle()}" class="col-age">나이</th>
              <th style="${thStyle()}" class="col-gender">성별</th>
              <th style="${thStyle('left')}" class="col-phone">연락처</th>
              <th style="${thStyle('left')}" class="col-days">출석 요일</th>
              <th style="${thStyle()}" class="col-time">시간</th>
              <th style="${thStyle()}" class="col-reg">등록일</th>
              <th style="${thStyle()}" class="col-contract">계약</th>
              <th style="${thStyle()}">오늘</th>
              <th style="${thStyle()}">관리</th>
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
    const days = (s.attendanceDays || []).join('·') || '—';
    const registered = s.registeredAt ? s.registeredAt.slice(0, 10).replace(/-/g, '.') : '—';
    const timeStr = (() => {
      if (!s.classTime) return '—';
      if (typeof s.classTime === 'string') return s.classTime || '—';
      const parts = (s.attendanceDays || []).filter(d => s.classTime[d]).map(d => `${d} ${s.classTime[d]}`);
      return parts.length ? parts.join(' / ') : '—';
    })();

    return `
      <tr style="border-top:1px solid var(--color-border-light); transition: background var(--transition-fast);"
          onmouseenter="this.style.background='var(--color-surface-2)'"
          onmouseleave="this.style.background=''">
        <td style="${tdStyle()}">${s.number}</td>
        <td style="${tdStyle('left')}">
          <button class="btn btn-ghost view-student-btn" data-id="${s.id}"
            style="font-weight:600; padding:2px 4px; text-align:left; color:var(--color-primary); text-decoration:underline; font-size:inherit;">
            ${escapeHtml(s.name)}
          </button>
        </td>
        <td style="${tdStyle()}" class="col-age">${s.age ?? '—'}</td>
        <td style="${tdStyle()}" class="col-gender">${GENDER_LABELS[s.gender] || '—'}</td>
        <td style="${tdStyle('left')}" class="col-phone">${s.phone ? `<a href="tel:${escapeHtml(s.phone)}" style="color:var(--color-primary);">${escapeHtml(s.phone)}</a>` : '—'}</td>
        <td style="${tdStyle('left')}" class="col-days">${escapeHtml(days)}</td>
        <td style="${tdStyle()}" class="col-time">${escapeHtml(timeStr)}</td>
        <td style="${tdStyle()}" class="col-reg" title="${registered}">${registered}</td>
        <td style="${tdStyle()}" class="col-contract">${this._contractCellHtml(s)}</td>
        <td style="${tdStyle()}">
          ${att
            ? `<span class="badge badge-${att.status}">${STATUS_LABELS[att.status]}</span>`
            : `<span class="badge badge-none">미입력</span>`}
        </td>
        <td style="${tdStyle()}">
          <div style="display:flex; gap:4px; justify-content:center;">
            <button class="btn btn-ghost btn-icon-sm edit-student-btn" data-id="${s.id}" title="수정">✎</button>
            <button class="btn btn-ghost btn-icon-sm delete-student-btn" data-id="${s.id}" title="삭제" style="color:var(--color-absent);">✕</button>
          </div>
        </td>
      </tr>
    `;
  }

  async mount() {
    this._loadContractStatus();

    // 구성원 추가
    document.getElementById('add-student-btn')?.addEventListener('click', () => this._openAddStudent());
    document.getElementById('add-student-card-btn')?.addEventListener('click', () => this._openAddStudent());
    document.getElementById('add-student-empty-btn')?.addEventListener('click', () => this._openAddStudent());

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
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
    const byMonth = {};
    records.forEach(r => {
      const ym = r.date.slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(r);
    });

    const monthsHtml = Object.entries(byMonth).map(([ym, recs]) => {
      const [y, m] = ym.split('-');
      const rows = recs.map(r => {
        const dow = DAY_NAMES[strToDate(r.date).getDay()];
        const mmdd = r.date.slice(5).replace('-', '/');
        return `
          <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid var(--color-border-light);">
            <span style="min-width:72px; font-size:13px; color:var(--color-text-muted);">${mmdd} (${dow})</span>
            <span class="badge badge-${r.status}">${STATUS_LABELS[r.status]}</span>
            ${r.note ? `<span style="font-size:12px; color:var(--color-text-muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.note)}</span>` : ''}
          </div>`;
      }).join('');
      return `
        <div style="margin-bottom:var(--space-4);">
          <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); margin-bottom:4px;">
            ${y}년 ${parseInt(m)}월 <span style="font-weight:400;">(${recs.length}건)</span>
          </div>
          ${rows}
        </div>`;
    }).join('');

    Modal.open({
      title: `${escapeHtml(s.name)} 출석 이력`,
      body: `
        <!-- 요약 통계 -->
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:var(--space-2); margin-bottom:var(--space-4); text-align:center;">
          <div>
            <div style="font-size:18px; font-weight:700;">${total}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">전체</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-present);">${summary.present}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">출석</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-absent);">${summary.absent}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">결석</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-late);">${summary.late}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">지각</div>
          </div>
          <div>
            <div style="font-size:18px; font-weight:700; color:var(--color-early);">${summary.early}</div>
            <div style="font-size:11px; color:var(--color-text-muted);">조퇴</div>
          </div>
        </div>
        <div style="text-align:center; font-size:13px; color:var(--color-text-muted); margin-bottom:var(--space-4);">
          출석률 <strong style="color:var(--color-present);">${attendRate}%</strong>
        </div>

        <!-- 이력 목록 -->
        <div style="max-height:340px; overflow-y:auto; padding-right:2px;">
          ${records.length === 0
            ? '<div style="text-align:center; color:var(--color-text-muted); padding:var(--space-8);">출석 기록이 없습니다.</div>'
            : monthsHtml}
        </div>
      `,
      confirmText: '정보 수정',
      cancelText: '닫기',
      onConfirm: () => this._openEditStudent(id),
    });
  }

  // ─── 구성원 추가 ────────────────────────────────────────────────

  async _openAddStudent() {
    const nextNum = await StudentsDB.nextNumber(this.groupId);
    Modal.open({
      title: '구성원 추가',
      body: this._studentForm(null, nextNum),
      confirmText: '추가',
      onConfirm: () => this._submitAdd(),
    });
    this._bindFormEvents();
  }

  // ─── 구성원 수정 ────────────────────────────────────────────────

  async _openEditStudent(id) {
    const student = await StudentsDB.get(id);
    if (!student) return;
    Modal.open({
      title: '구성원 수정',
      body: this._studentForm(student),
      confirmText: '저장',
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
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3);">기본 정보</div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-name">이름 <span style="color:var(--color-absent)">*</span></label>
            <input type="text" id="s-name" class="form-input" value="${escapeHtml(s?.name || '')}" placeholder="홍길동" maxlength="30" autocomplete="off">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-number">번호</label>
            <input type="number" id="s-number" class="form-input" value="${s?.number ?? nextNum}" min="0" max="999">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-age">나이</label>
            <input type="number" id="s-age" class="form-input" value="${s?.age ?? ''}" placeholder="예: 15" min="1" max="120">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-gender">성별</label>
            <select id="s-gender" class="form-select">
              <option value="">선택 안 함</option>
              <option value="male"   ${s?.gender === 'male'   ? 'selected' : ''}>남</option>
              <option value="female" ${s?.gender === 'female' ? 'selected' : ''}>여</option>
              <option value="other"  ${s?.gender === 'other'  ? 'selected' : ''}>기타</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label class="form-label" for="s-phone">연락처 <span class="form-label-optional">(선택)</span></label>
          <input type="tel" id="s-phone" class="form-input" value="${escapeHtml(s?.phone || '')}" placeholder="010-0000-0000">
        </div>

        <div class="divider"></div>

        <!-- 수업 정보 -->
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3); margin-top:var(--space-3);">수업 정보</div>

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">출석 요일 <span class="form-label-optional">(선택)</span></label>
          <div style="display:flex; gap:var(--space-1); flex-wrap:wrap;" id="days-picker">
            ${DAYS.map(d => {
              const checked = (s?.attendanceDays || []).includes(d);
              return `<button type="button" class="day-btn${checked ? ' day-btn-active' : ''}" data-day="${d}"
                style="width:38px; height:38px; border-radius:var(--radius-full); border:1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}; background:${checked ? 'var(--color-primary)' : 'transparent'}; color:${checked ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; transition:all var(--transition-fast); font-family:var(--font-family);">${d}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="s-days" value="${escapeHtml((s?.attendanceDays || []).join(','))}">
        </div>

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">수업 시간 <span class="form-label-optional">(선택 · 요일별)</span></label>
          <div id="time-inputs-container"></div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4);">
          <label class="form-label" for="s-registered">최초 등록일</label>
          <input type="date" id="s-registered" class="form-input" value="${s?.registeredAt || today}" max="${today}">
        </div>

        <div class="divider"></div>

        <!-- 메모 -->
        <div class="form-group" style="margin-top:var(--space-3); margin-bottom:${s === null ? 'var(--space-4)' : '0'};">
          <label class="form-label" for="s-memo">메모 <span class="form-label-optional">(선택)</span></label>
          <textarea id="s-memo" class="form-textarea" placeholder="특이사항, 학부모 연락처 등" maxlength="300" style="min-height:64px;">${escapeHtml(s?.memo || '')}</textarea>
        </div>

        ${s === null ? `
        <div class="divider"></div>

        <!-- 수강 계약 (추가 시) -->
        <div style="font-size:12px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-3); margin-top:var(--space-3);">수강 계약 <span style="font-weight:400; text-transform:none;">(선택)</span></div>

        <div style="display:flex; gap:4px; margin-bottom:var(--space-3);">
          ${['none', 'period', 'count'].map(type => {
            const labels = { none: '없음', period: '기간제', count: '횟수제' };
            const active = type === 'none';
            return `<button type="button" class="contract-type-btn" data-type="${type}"
              style="flex:1; padding:7px 4px; border-radius:var(--radius-md); border:1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}; background:${active ? 'var(--color-primary)' : 'transparent'}; color:${active ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font-family);">${labels[type]}</button>`;
          }).join('')}
        </div>
        <input type="hidden" id="s-contract-type" value="none">

        <div id="contract-period-fields" style="display:none;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-start">시작일</label>
              <input type="date" id="s-contract-start" class="form-input" value="${today}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-end">종료일</label>
              <input type="date" id="s-contract-end" class="form-input" value="">
            </div>
          </div>
        </div>

        <div id="contract-count-fields" style="display:none;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-start">시작일</label>
              <input type="date" id="s-contract-start" class="form-input" value="${today}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-contract-total">총 횟수</label>
              <input type="number" id="s-contract-total" class="form-input" value="" min="1" max="9999" placeholder="예: 50">
            </div>
          </div>
        </div>

        <div class="form-group" id="s-contract-memo-wrap" style="display:none; margin-bottom:0;">
          <label class="form-label" for="s-contract-memo">계약 메모 <span class="form-label-optional">(선택)</span></label>
          <input type="text" id="s-contract-memo" class="form-input" value="" placeholder="예: 3개월 등록" maxlength="100">
        </div>
        ` : ''}

      </div>
    `;
  }

  /** 요일 버튼 및 요일별 수업시간 입력 바인딩 (모달 열린 직후 호출) */
  _bindFormEvents(s = null) {
    setTimeout(() => {
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
          container.innerHTML = `<span style="font-size:13px; color:var(--color-text-muted);">출석 요일을 먼저 선택하세요.</span>`;
          return;
        }

        container.innerHTML = selectedDays.map(d => `
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span style="width:22px; font-size:13px; font-weight:700; color:var(--color-text); text-align:center;">${d}</span>
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
    if (!data.name) { Toast.error(MESSAGES.nameRequired); return; }
    try {
      const student = await StudentsDB.create({ groupId: this.groupId, ...data });

      // 계약 정보가 입력된 경우 함께 저장
      const contractType = document.getElementById('s-contract-type')?.value || 'none';
      if (contractType !== 'none') {
        const startDate  = document.getElementById('s-contract-start')?.value || todayStr();
        const endDate    = document.getElementById('s-contract-end')?.value || '';
        const totalCount = document.getElementById('s-contract-total')?.value
          ? Number(document.getElementById('s-contract-total').value) : null;
        const memo = document.getElementById('s-contract-memo')?.value?.trim() || '';

        if (contractType === 'period' && !endDate) {
          Toast.error('계약 종료일을 입력하세요.');
          await StudentsDB.delete(student.id); // 학생도 롤백
          return;
        }
        if (contractType === 'count' && !totalCount) {
          Toast.error('계약 총 횟수를 입력하세요.');
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

      Toast.success(MESSAGES.studentCreated);
      await this._reload();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _submitEdit(id) {
    const data = this._readForm();
    if (!data.name) { Toast.error(MESSAGES.nameRequired); return; }
    try {
      await StudentsDB.update(id, data);
      Toast.success(MESSAGES.studentUpdated);
      await this._reload();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _deleteStudent(id) {
    const student = await StudentsDB.get(id);
    if (!student) return;
    const ok = await Modal.confirm({
      title: '구성원 삭제',
      message: MESSAGES.deleteStudentConfirm(student.name),
      danger: true,
      confirmText: '삭제',
    });
    if (!ok) return;
    try {
      await AttendanceDB.deleteByStudent(id);
      await ContractsDB.deleteByStudent(id);
      await StudentsDB.delete(id);
      Toast.success(MESSAGES.studentDeleted);
      await this._reload();
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
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
    if (subtitle) subtitle.textContent = `구성원 ${this.students.length}명 · ${formatDateKo(this.today, { monthDay: true })} 출석 현황`;
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
        if (daysLeft < 0)        { label = '만료';                      color = 'var(--color-absent)'; bold = true; }
        else if (daysLeft === 0) { label = '오늘만료';                   color = 'var(--color-absent)'; bold = true; }
        else if (daysLeft <= 7)  { label = `~${endStr} D-${daysLeft}`;  color = 'var(--color-late)';   bold = true; }
        else                     { label = `~${endStr}`;                bold = true; }
      } else if (c.type === 'count') {
        const rem = c._remaining;
        if (rem === undefined)   { label = '계산중'; }
        else if (rem <= 0)       { label = '소진';          color = 'var(--color-absent)';  bold = true; }
        else if (rem <= 3)       { label = `잔여 ${rem}회`; color = 'var(--color-late)';    bold = true; }
        else                     { label = `잔여 ${rem}회`; color = 'var(--color-present)'; bold = true; }
      }
    }

    return `<button class="btn btn-ghost contract-history-btn" data-id="${studentId}"
      style="font-size:12px; padding:2px 4px; color:${color}; font-weight:${bold ? '600' : '400'}; text-decoration:underline; cursor:pointer;"
      title="계약 이력">${label}</button>`;
  }

  async _loadContractStatus() {
    const allContracts = await ContractsDB.getByGroup(this.groupId);
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
    const history = contracts.filter(c => c.status !== 'active');

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
              <span class="badge" style="background:var(--color-primary); color:white; margin-bottom:6px;">${active.type === 'period' ? '기간제' : '횟수제'}</span>
              <div style="font-size:14px; font-weight:600; margin-bottom:4px;">
                ${active.type === 'period'
                  ? `${active.startDate} ~ ${active.endDate || '—'}`
                  : `총 ${active.totalCount ?? 0}회 (${active.startDate}~)`}
              </div>
              ${active.type === 'count' ? `<div style="font-size:13px; color:${remaining <= 0 ? 'var(--color-absent)' : remaining <= 3 ? 'var(--color-late)' : 'var(--color-present)'}; font-weight:600;">잔여 ${remaining}회</div>` : ''}
              ${active.memo ? `<div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">${escapeHtml(active.memo)}</div>` : ''}
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
              <button class="btn btn-secondary btn-sm edit-contract-btn" data-id="${active.id}">수정</button>
              <button class="btn btn-sm end-contract-btn" data-id="${active.id}" style="background:var(--color-absent); color:white; border:none;">종료</button>
            </div>
          </div>
        </div>`
      : `<div style="padding:var(--space-4); background:var(--color-surface-2); border-radius:var(--radius-md); color:var(--color-text-muted); font-size:13px; text-align:center; margin-bottom:var(--space-4);">현재 활성 계약이 없습니다.</div>`;

    const historyHtml = history.length === 0 ? ''
      : `<div style="margin-top:var(--space-2);">
          <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-2);">이전 이력 (${history.length}건)</div>
          ${history.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-3) 0; border-top:1px solid var(--color-border-light); font-size:13px;">
              <div>
                <span style="font-weight:600;">${c.type === 'period' ? '기간제' : '횟수제'}</span>
                <span style="color:var(--color-text-muted); margin-left:6px;">
                  ${c.type === 'period' ? `${c.startDate} ~ ${c.endDate}` : `총 ${c.totalCount ?? 0}회 (${c.startDate}~)`}
                </span>
                ${c.memo ? `<div style="color:var(--color-text-muted); font-size:12px;">${escapeHtml(c.memo)}</div>` : ''}
              </div>
              <div style="display:flex; gap:4px; align-items:center;">
                <span style="font-size:11px; color:var(--color-text-muted);">종료됨</span>
                <button class="btn btn-ghost btn-icon-sm del-contract-btn" data-id="${c.id}" title="삭제" style="color:var(--color-absent);">✕</button>
              </div>
            </div>
          `).join('')}
        </div>`;

    Modal.open({
      title: `${escapeHtml(student.name)} — 수강 계약`,
      body: `
        <button class="btn btn-primary btn-sm" id="new-contract-btn" style="margin-bottom:var(--space-4); width:100%;">+ 새 계약 추가</button>
        <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:var(--space-2);">현재 계약</div>
        ${activeHtml}
        ${historyHtml}
      `,
      hideConfirm: true,
      cancelText: '닫기',
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
          const ok = await Modal.confirm({ title: '계약 종료', message: '현재 계약을 종료하시겠습니까?', confirmText: '종료', danger: true });
          if (ok) {
            await ContractsDB.end(btn.dataset.id);
            await this._loadContractStatus();
            await this._showContractList(student);
          }
        });
      });
      document.querySelectorAll('.del-contract-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await Modal.confirm({ title: '이력 삭제', message: '이 계약 이력을 삭제하시겠습니까?', confirmText: '삭제', danger: true });
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
      title: isEdit ? '계약 수정' : '새 계약 추가',
      body: `
        <div style="margin-bottom:var(--space-3);">
          <label class="form-label">계약 유형</label>
          <div style="display:flex; gap:4px;">
            ${['period', 'count'].map(t => {
              const labels = { period: '기간제', count: '횟수제' };
              const active = type === t;
              return `<button type="button" class="contract-type-btn2" data-type="${t}"
                style="flex:1; padding:7px 4px; border-radius:var(--radius-md); border:1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}; background:${active ? 'var(--color-primary)' : 'transparent'}; color:${active ? 'white' : 'var(--color-text-muted)'}; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font-family);">${labels[t]}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="cf-type" value="${type}">
        </div>

        <div class="form-group">
          <label class="form-label" for="cf-start">시작일</label>
          <input type="date" id="cf-start" class="form-input" value="${contract?.startDate || today}">
        </div>

        <div id="cf-period-fields" style="display:${type === 'period' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label" for="cf-end">종료일</label>
            <input type="date" id="cf-end" class="form-input" value="${contract?.endDate || ''}">
          </div>
        </div>

        <div id="cf-count-fields" style="display:${type === 'count' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label" for="cf-total">총 횟수</label>
            <input type="number" id="cf-total" class="form-input" value="${contract?.totalCount ?? ''}" min="1" max="9999" placeholder="예: 50">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="cf-memo">메모 <span class="form-label-optional">(선택)</span></label>
          <input type="text" id="cf-memo" class="form-input" value="${escapeHtml(contract?.memo || '')}" placeholder="예: 3개월 등록" maxlength="100">
        </div>
      `,
      confirmText: isEdit ? '저장' : '추가',
      cancelText: '뒤로',
      onConfirm: async () => {
        const t = document.getElementById('cf-type')?.value || 'period';
        const startDate  = document.getElementById('cf-start')?.value;
        const endDate    = document.getElementById('cf-end')?.value || '';
        const totalCount = document.getElementById('cf-total')?.value ? Number(document.getElementById('cf-total').value) : null;
        const memo       = document.getElementById('cf-memo')?.value?.trim() || '';

        if (t === 'period' && !endDate)    { Toast.error('종료일을 입력하세요.'); return; }
        if (t === 'count' && !totalCount)  { Toast.error('총 횟수를 입력하세요.'); return; }

        try {
          if (isEdit) {
            await ContractsDB.update(contract.id, { type: t, startDate, endDate, totalCount, memo });
          } else {
            // End any existing active contract first
            const existing = await ContractsDB.getByStudent(student.id);
            for (const c of existing) {
              if (c.status === 'active') await ContractsDB.end(c.id);
            }
            await ContractsDB.create({ studentId: student.id, groupId: this.groupId, type: t, startDate, endDate, totalCount, memo });
          }
          await this._loadContractStatus();
          onBack();
        } catch (e) { Toast.error('저장 실패: ' + e.message); }
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
          const t = btn.dataset.type;
          document.getElementById('cf-type').value = t;
          document.querySelectorAll('.contract-type-btn2').forEach(b => {
            const active = b.dataset.type === t;
            b.style.background  = active ? 'var(--color-primary)' : 'transparent';
            b.style.color       = active ? 'white' : 'var(--color-text-muted)';
            b.style.borderColor = active ? 'var(--color-primary)' : 'var(--color-border)';
          });
          document.getElementById('cf-period-fields').style.display = t === 'period' ? 'block' : 'none';
          document.getElementById('cf-count-fields').style.display  = t === 'count'  ? 'block' : 'none';
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
