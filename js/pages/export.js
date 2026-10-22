/**
 * Export page
 * Route: #/groups/:id/export
 */

import { GroupsDB } from '../db/groups.js';
import { ExportService } from '../services/export.js';
import { AdsService, RewardResult } from '../services/ads.js';
import Toast from '../components/toast.js';
import { todayStr, shiftMonth, formatYearMonth, getDaysInMonth } from '../utils/date.js';
import { t } from '../utils/i18n.js';

export class ExportPage {
  constructor(params) {
    this.groupId = params.id;
    this.group = null;
    // 내보내기는 한 달 단위. 미래 월은 선택 불가
    this.maxYearMonth = todayStr().slice(0, 7);
    this.yearMonth = this.maxYearMonth;
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state"><div class="empty-state-title">${t('common.groupNotFound')}</div></div></div>`;
    }

    return `
      <div class="page-body" style="max-width: 520px;">
        ${this._exportForm()}
      </div>
    `;
  }

  _exportForm() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">${t('export.selectMonth')}</div></div>
        <div class="card-body">
          <div class="date-nav" style="justify-content:center; margin-bottom: var(--space-4);">
            <button class="date-nav-btn" id="prev-month">←</button>
            <span class="date-nav-label" id="month-label">${formatYearMonth(this.yearMonth)}</span>
            <button class="date-nav-btn" id="next-month" disabled>→</button>
          </div>
          <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
            <button class="btn btn-primary" id="export-csv-btn">${t('export.csvBtn')}</button>
            <button class="btn btn-secondary" id="export-pdf-btn">${t('export.pdfBtn')}</button>
          </div>
          ${AdsService.isRewardedAvailable() ? `
          <div style="font-size:13px; color:var(--color-text-muted); margin-top:var(--space-3);">
            ▶ ${t('export.adNotice')}
          </div>` : ''}
        </div>
      </div>
      <div style="font-size:13px; color:var(--color-text-muted); margin-top:var(--space-3);">
        ${t('export.csvNote')}<br>
        ${t('export.pdfNote')}
      </div>
    `;
  }

  async mount() {
    document.getElementById('prev-month')?.addEventListener('click', () => this._changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => this._changeMonth(1));
    document.getElementById('export-csv-btn')?.addEventListener('click', () => this._doExport('csv'));
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => this._doExport('pdf'));
  }

  _changeMonth(delta) {
    const next = shiftMonth(this.yearMonth, delta);
    if (next > this.maxYearMonth) return;
    this.yearMonth = next;
    document.getElementById('month-label').textContent = formatYearMonth(this.yearMonth);
    document.getElementById('next-month').disabled = this.yearMonth >= this.maxYearMonth;
  }

  async _doExport(type) {
    if (this._busy) return;

    const [year, month] = this.yearMonth.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const startDate = days[0];
    const endDate   = days[days.length - 1];

    this._setBusy(true);
    try {
      // 광고를 띄울 수 없는 경우(웹·프리미엄·로드 실패 등)는 광고 없이 진행
      const reward = await AdsService.showRewardedAd();
      if (reward === RewardResult.DISMISSED) {
        Toast.info(t('export.adDismissed'));
        return;
      }

      if (type === 'csv') {
        await ExportService.exportCSV(this.group, startDate, endDate);
      } else {
        await ExportService.exportPDF(this.group, startDate, endDate);
      }
      Toast.success(t('messages.exportDone'));
    } catch (e) {
      Toast.error(t('messages.exportFailed', {msg: e.message}));
    } finally {
      this._setBusy(false);
    }
  }

  /** 광고 로드·내보내기 중 버튼 중복 클릭 방지 */
  _setBusy(busy) {
    this._busy = busy;
    ['export-csv-btn', 'export-pdf-btn', 'prev-month'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = busy;
    });
    const nextBtn = document.getElementById('next-month');
    if (nextBtn) nextBtn.disabled = busy || this.yearMonth >= this.maxYearMonth;
  }

  destroy() {}
}
