/**
 * Export page
 * Route: #/groups/:id/export
 */

import { GroupsDB } from '../db/groups.js';
import { ExportService } from '../services/export.js';
import Toast from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftDate } from '../utils/date.js';
import { t } from '../utils/i18n.js';

export class ExportPage {
  constructor(params) {
    this.groupId = params.id;
    this.group = null;
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state"><div class="empty-state-title">${t('common.groupNotFound')}</div></div></div>`;
    }

    const today = todayStr();
    const monthStart = today.slice(0, 7) + '-01';

    return `
      <div class="page-body" style="max-width: 520px;">
        ${this._exportForm(monthStart, today)}
      </div>
    `;
  }

  _exportForm(defaultStart, defaultEnd) {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">${t('export.dateRange')}</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label" for="start-date">${t('export.startDate')}</label>
            <input type="date" id="start-date" class="form-input" value="${defaultStart}" max="${defaultEnd}">
          </div>
          <div class="form-group">
            <label class="form-label" for="end-date">${t('export.endDate')}</label>
            <input type="date" id="end-date" class="form-input" value="${defaultEnd}" max="${defaultEnd}">
          </div>
          <div style="display:flex; gap: var(--space-2); margin-top: var(--space-2); flex-wrap:wrap;">
            <button class="btn btn-primary" id="export-csv-btn">${t('export.csvBtn')}</button>
            <button class="btn btn-secondary" id="export-pdf-btn">${t('export.pdfBtn')}</button>
          </div>
        </div>
      </div>
      <div style="font-size:13px; color:var(--color-text-muted); margin-top:var(--space-3);">
        ${t('export.csvNote')}<br>
        ${t('export.pdfNote')}
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

    if (!startDate || !endDate) { Toast.error(t('messages.dateRequired')); return; }
    if (startDate > endDate)    { Toast.error(t('messages.dateRangeError')); return; }

    try {
      if (type === 'csv') {
        await ExportService.exportCSV(this.group, startDate, endDate);
      } else {
        await ExportService.exportPDF(this.group, startDate, endDate);
      }
      Toast.success(t('messages.exportDone'));
    } catch (e) {
      Toast.error(t('messages.exportFailed', {msg: e.message}));
    }
  }

  destroy() {}
}
