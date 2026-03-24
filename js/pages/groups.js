/**
 * Groups list & management page
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { AttendanceDB } from '../db/attendance.js';
import { PremiumService } from '../services/premium.js';
import Modal from '../components/modal.js';
import Toast from '../components/toast.js';
import Sidebar from '../components/sidebar.js';
import { escapeHtml } from '../utils/dom.js';
import { GROUP_COLORS, MESSAGES, PLACEHOLDERS } from '../utils/i18n.js';

export class GroupsPage {
  constructor(params, query, router) {
    this.router = router;
    this._listeners = [];
  }

  async render() {
    const groups = await GroupsDB.getAll();

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">그룹 관리</h1>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="add-group-btn">+ 새 그룹</button>
        </div>
      </div>
      <div class="page-body">
        ${groups.length === 0 ? this._emptyState() : this._groupGrid(groups)}
      </div>
    `;
  }

  _emptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">그룹이 없습니다</div>
        <div class="empty-state-desc">새 그룹을 만들어 학생들을 관리해 보세요.</div>
        <button class="btn btn-primary" id="add-group-empty-btn" style="margin-top: 8px;">+ 새 그룹 만들기</button>
      </div>
    `;
  }

  _groupGrid(groups) {
    return `
      <div class="grid-3" id="group-grid">
        ${groups.map(g => this._groupCard(g)).join('')}
        <div class="group-card" id="add-group-card" style="border-style: dashed; display:flex; align-items:center; justify-content:center; min-height:120px; cursor:pointer; color: var(--color-text-muted);" role="button" tabindex="0">
          <div style="text-align:center;">
            <div style="font-size: 28px; margin-bottom: 8px;">+</div>
            <div style="font-size: 14px; font-weight: 600;">새 그룹 추가</div>
          </div>
        </div>
      </div>
    `;
  }

  _groupCard(g) {
    return `
      <div class="group-card" data-group-id="${g.id}" data-group-nav="#/groups/${g.id}" style="cursor:pointer;">
        <div class="group-card-header">
          <span class="group-card-color-dot" style="background:${escapeHtml(g.color)}"></span>
          <span class="group-card-name">${escapeHtml(g.name)}</span>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-ghost btn-icon-sm edit-group-btn" data-id="${g.id}" title="수정" aria-label="수정">✎</button>
            <button class="btn btn-ghost btn-icon-sm delete-group-btn" data-id="${g.id}" title="삭제" aria-label="삭제" style="color: var(--color-absent);">✕</button>
          </div>
        </div>
        ${g.description ? `<div class="group-card-desc">${escapeHtml(g.description)}</div>` : ''}
        <div class="group-card-meta">
          <span>학생 수 로딩중...</span>
        </div>
      </div>
    `;
  }

  async mount() {
    // Load student counts for each group card
    this._loadStudentCounts();

    // Add group button
    this._on('#add-group-btn', 'click', () => this._openAddModal());
    this._on('#add-group-empty-btn', 'click', () => this._openAddModal());
    this._on('#add-group-card', 'click', () => this._openAddModal());
    this._on('#add-group-card', 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') this._openAddModal(); });

    // Group card navigation
    document.querySelectorAll('.group-card[data-group-nav]').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = card.dataset.groupNav;
      });
    });

    // Edit / Delete buttons
    document.querySelectorAll('.edit-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openEditModal(btn.dataset.id);
      });
    });
    document.querySelectorAll('.delete-group-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._deleteGroup(btn.dataset.id);
      });
    });
  }

  async _loadStudentCounts() {
    document.querySelectorAll('.group-card[data-group-id]').forEach(async (card) => {
      const id = card.dataset.groupId;
      try {
        const cnt = await StudentsDB.countByGroup(id);
        const meta = card.querySelector('.group-card-meta');
        if (meta) meta.innerHTML = `<span>학생 ${cnt}명</span>`;
      } catch (e) { /* ignore */ }
    });
  }

  async _openAddModal() {
    Modal.open({
      title: '새 그룹',
      body: this._groupForm(),
      confirmText: '만들기',
      onConfirm: () => this._submitAdd(),
    });
  }

  async _openEditModal(id) {
    const group = await GroupsDB.get(id);
    if (!group) return;

    Modal.open({
      title: '그룹 수정',
      body: this._groupForm(group),
      confirmText: '저장',
      onConfirm: () => this._submitEdit(id),
    });
  }

  _groupForm(group = null) {
    const colorSwatches = GROUP_COLORS.map(c => `
      <button type="button" class="color-swatch${group?.color === c ? ' selected' : ''}"
        style="background:${c}" data-color="${c}" title="${c}" aria-label="색상 ${c}"></button>
    `).join('');

    return `
      <div class="form-group">
        <label class="form-label" for="group-name">그룹 이름 <span style="color:var(--color-absent)">*</span></label>
        <input type="text" id="group-name" class="form-input"
          placeholder="${PLACEHOLDERS.groupName}"
          value="${escapeHtml(group?.name || '')}"
          maxlength="50" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label" for="group-desc">설명 <span class="form-label-optional">(선택)</span></label>
        <input type="text" id="group-desc" class="form-input"
          placeholder="${PLACEHOLDERS.groupDesc}"
          value="${escapeHtml(group?.description || '')}"
          maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">색상</label>
        <div class="color-picker-row" id="color-picker">
          ${colorSwatches}
        </div>
        <input type="hidden" id="group-color" value="${group?.color || GROUP_COLORS[0]}">
      </div>
    `;
  }

  async _submitAdd() {
    const name  = document.getElementById('group-name')?.value?.trim();
    const desc  = document.getElementById('group-desc')?.value?.trim();
    const color = document.getElementById('group-color')?.value || GROUP_COLORS[0];

    if (!name) { Toast.error(MESSAGES.nameRequired); return; }
    try {
      await GroupsDB.create({ name, description: desc, color });
      Toast.success(MESSAGES.groupCreated);
      Sidebar.refresh();
      // Re-render page
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _submitEdit(id) {
    const name  = document.getElementById('group-name')?.value?.trim();
    const desc  = document.getElementById('group-desc')?.value?.trim();
    const color = document.getElementById('group-color')?.value;

    if (!name) { Toast.error(MESSAGES.nameRequired); return; }
    try {
      await GroupsDB.update(id, { name, description: desc, color });
      Toast.success(MESSAGES.groupUpdated);
      Sidebar.refresh();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  async _deleteGroup(id) {
    const group = await GroupsDB.get(id);
    if (!group) return;
    const ok = await Modal.confirm({
      title: '그룹 삭제',
      message: MESSAGES.deleteGroupConfirm(group.name),
      danger: true,
      confirmText: '삭제',
    });
    if (!ok) return;
    try {
      await AttendanceDB.deleteByGroup(id);
      await StudentsDB.deleteByGroup(id);
      await GroupsDB.delete(id);
      Toast.success(MESSAGES.groupDeleted);
      Sidebar.refresh();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) { Toast.error(MESSAGES.saveFailed); }
  }

  _on(selector, event, handler) {
    const el = document.querySelector(selector);
    if (el) {
      el.addEventListener(event, handler);
      this._listeners.push({ el, event, handler });
    }
  }

  destroy() {
    this._listeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
  }
}

// Color picker interaction — delegated, bound after modal opens
document.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  swatch.classList.add('selected');
  const colorInput = document.getElementById('group-color');
  if (colorInput) colorInput.value = swatch.dataset.color;
});
