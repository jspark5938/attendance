/**
 * Statistics page
 * Route: #/groups/:id/stats
 */

import { GroupsDB } from '../db/groups.js';
import { StudentsDB } from '../db/students.js';
import { StatsService } from '../services/stats.js';
import { escapeHtml } from '../utils/dom.js';
import { todayStr, shiftMonth, formatYearMonth, getDaysInMonth } from '../utils/date.js';
import { t, getMessages } from '../utils/i18n.js';

export class StatisticsPage {
  constructor(params) {
    this.groupId = params.id;
    this.group = null;
    this.yearMonth = todayStr().slice(0, 7);
    this._charts = [];
  }

  async render() {
    this.group = await GroupsDB.get(this.groupId);
    if (!this.group) {
      return `<div class="page-body"><div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">${t('common.groupNotFound')}</div></div></div>`;
    }

    return `
      <div class="page-body">
        <div class="date-nav" style="justify-content:center; margin-bottom:var(--space-4);">
          <button class="date-nav-btn" id="prev-month">←</button>
          <span class="date-nav-label" id="month-label">${formatYearMonth(this.yearMonth)}</span>
          <button class="date-nav-btn" id="next-month">→</button>
        </div>
        <div id="stats-content">
          <div class="loading-state"><div class="spinner"></div><span>${t('statistics.calculating')}</span></div>
        </div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('prev-month')?.addEventListener('click', () => this._changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => this._changeMonth(1));
    await this._renderStats();
  }

  async _changeMonth(delta) {
    this.yearMonth = shiftMonth(this.yearMonth, delta);
    const labelEl = document.getElementById('month-label');
    if (labelEl) labelEl.textContent = formatYearMonth(this.yearMonth);
    await this._renderStats();
  }

  async _renderStats() {
    const container = document.getElementById('stats-content');
    if (!container) return;

    this._destroyCharts();

    const [y, m] = this.yearMonth.split('-').map(Number);

    const studentStats = await StatsService.getStudentStats(
      this.groupId,
      `${this.yearMonth}-01`,
      getDaysInMonth(y, m).slice(-1)[0]
    );

    const monthlyRate = await StatsService.getMonthlyRate(this.groupId, y, m);

    container.innerHTML = `
      <!-- Summary -->
      <div class="stat-cards-grid" style="margin-bottom: var(--space-5);">
        <div class="stat-card">
          <div class="stat-card-label">${t('statistics.monthlyRate')}</div>
          <div class="stat-card-value" style="color:var(--color-present)">
            ${monthlyRate !== null ? monthlyRate + '%' : '—'}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">${t('statistics.studentCount')}</div>
          <div class="stat-card-value">${studentStats.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">${t('statistics.classDays')}</div>
          <div class="stat-card-value">${studentStats[0]?.total ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">${t('statistics.avgAbsent')}</div>
          <div class="stat-card-value" style="color:var(--color-absent)">
            ${studentStats.length > 0
              ? (studentStats.reduce((s, g) => s + g.absent, 0) / studentStats.length).toFixed(1)
              : '—'}
          </div>
        </div>
      </div>

      <!-- Daily chart -->
      <div class="card" style="margin-bottom: var(--space-5);">
        <div class="card-header"><div class="card-title">${t('statistics.dailyChart')}</div></div>
        <div class="card-body"><canvas id="daily-chart" height="120"></canvas></div>
      </div>

      <!-- Per-student table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">${t('statistics.studentTable')}</div>
        </div>
        <div style="overflow-x: auto;">
          <table style="width:100%; border-collapse:collapse; font-size: var(--font-size-sm);">
            <thead>
              <tr style="background: var(--color-surface-2);">
                <th style="padding: 10px 12px; text-align:left; font-weight:600; white-space:nowrap;">${t('statistics.colNumber')}</th>
                <th style="padding: 10px 12px; text-align:left; font-weight:600;">${t('statistics.colName')}</th>
                <th style="padding: 10px 12px; text-align:center; font-weight:600; color:var(--color-present);">${t('statistics.colPresent')}</th>
                <th style="padding: 10px 12px; text-align:center; font-weight:600; color:var(--color-absent);">${t('statistics.colAbsent')}</th>
                <th style="padding: 10px 12px; text-align:center; font-weight:600; color:var(--color-late);">${t('statistics.colLate')}</th>
                <th style="padding: 10px 12px; text-align:center; font-weight:600; color:var(--color-early);">${t('statistics.colEarly')}</th>
                <th style="padding: 10px 12px; text-align:center; font-weight:600;">${t('statistics.colRate')}</th>
              </tr>
            </thead>
            <tbody>
              ${studentStats.length === 0
                ? `<tr><td colspan="7" style="padding:32px; text-align:center; color:var(--color-text-muted);">${t('statistics.noData')}</td></tr>`
                : studentStats.map(s => `
                    <tr style="border-top: 1px solid var(--color-border-light);">
                      <td style="padding: 10px 12px; color:var(--color-text-muted);">${s.student.number}</td>
                      <td style="padding: 10px 12px; font-weight: 500;">${escapeHtml(s.student.name)}</td>
                      <td style="padding: 10px 12px; text-align:center; color:var(--color-present);">${s.present}</td>
                      <td style="padding: 10px 12px; text-align:center; color:var(--color-absent);">${s.absent}</td>
                      <td style="padding: 10px 12px; text-align:center; color:var(--color-late);">${s.late}</td>
                      <td style="padding: 10px 12px; text-align:center; color:var(--color-early);">${s.early}</td>
                      <td style="padding: 10px 12px; text-align:center;">
                        <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
                          <div style="width:50px; background:var(--color-surface-2); border-radius:4px; height:6px; overflow:hidden;">
                            <div style="width:${s.rate}%; height:100%; background:var(--color-present); border-radius:4px;"></div>
                          </div>
                          <span style="font-weight:600; min-width:36px;">${s.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this._renderDailyChart(y, m);
  }

  async _renderDailyChart(year, month) {
    const canvas = document.getElementById('daily-chart');
    if (!canvas || !window.Chart) return;

    const dailyStats = await StatsService.getDailyStats(this.groupId, year, month);
    const labels = dailyStats.map(d => d.date.slice(8));
    const presentData = dailyStats.map(d => d.present + d.late + d.early);
    const absentData  = dailyStats.map(d => d.absent);

    const chart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: t('statistics.colPresent'), data: presentData, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 3 },
          { label: t('statistics.colAbsent'),  data: absentData,  backgroundColor: 'rgba(239,68,68,0.7)',  borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
    this._charts.push(chart);
  }

  _destroyCharts() {
    this._charts.forEach(c => { try { c.destroy(); } catch (e) {} });
    this._charts = [];
  }

  destroy() {
    this._destroyCharts();
  }
}
