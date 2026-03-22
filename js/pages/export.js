/**
 * Export page
 * Route: #/groups/:id/export
 */

import { GroupsDB } from '../db/groups.js';
import { ExportService } from '../services/export.js';
import Toast from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftDate } from '../utils/date.js';
import { MESSAGES } from '../utils/i18n.js';

export class ExportPage {
  constructor(params) {
    this.groupId = params.id;
    this.group = null;
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state"><div class="empty-state-title">그룹을 찾을 수 없습니다</div></div></div>`;
    }

    const today = todayStr();
    const monthStart = today.slice(0, 7) + '-01';

    return `
      <div class="page-header">
        <div class="page-header-left">
          <a href="#/groups/${this.groupId}" class="btn btn-ghost btn-icon" aria-label="뒤로" style="font-size:20px;">←</a>
          <h1 class="page-title">${escapeHtml(this.group.name)} — 내보내기</h1>
        </div>
      </div>
      <div class="page-body" style="max-width: 520px;">
        ${this._exportForm(monthStart, today)}
      </div>
    `;
  }

  _exportForm(defaultStart, defaultEnd) {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">기간 선택</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label" for="start-date">시작일</label>
            <input type="date" id="start-date" class="form-input" value="${defaultStart}" max="${defaultEnd}">
          </div>
          <div class="form-group">
            <label class="form-label" for="end-date">종료일</label>
            <input type="date" id="end-date" class="form-input" value="${defaultEnd}" max="${defaultEnd}">
          </div>
          <div style="display:flex; gap: var(--space-2); margin-top: var(--space-2); flex-wrap:wrap;">
            <button class="btn btn-primary" id="export-csv-btn">📄 CSV 내보내기</button>
            <button class="btn btn-secondary" id="export-pdf-btn">📑 PDF 내보내기</button>
          </div>
        </div>
      </div>
      <div style="font-size:13px; color:var(--color-text-muted); margin-top:var(--space-3);">
        * CSV 파일은 Excel에서 한국어로 올바르게 열립니다.<br>
        * PDF는 A4 용지 기준으로 출력 최적화됩니다.
      </div>
    `;
  }

  async mount() {
    document.getElementById('export-csv-btn')?.addEventListener('click', () => this._doExport('csv'));
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => this._doExport('pdf'));
  }

  async _doExport(type) {
    const startDate = document.getElementById('start-date')?.value;
    const endDate   = document.getElementById('end-date')?.value;

    if (!startDate || !endDate) { Toast.error('날짜를 선택해 주세요.'); return; }
    if (startDate > endDate)    { Toast.error('시작일이 종료일보다 늦습니다.'); return; }

    try {
      if (type === 'csv') {
        await ExportService.exportCSV(this.group, startDate, endDate);
      } else {
        await ExportService.exportPDF(this.group, startDate, endDate);
      }
      Toast.success(MESSAGES.exportDone);
    } catch (e) {
      Toast.error('내보내기 실패: ' + e.message);
    }
  }

  destroy() {}
}
