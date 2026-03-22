/**
 * Settings page
 * Route: #/settings
 */

import { exportAllData, importAllData } from '../db/database.js';
import Toast from '../components/toast.js';
import Modal from '../components/modal.js';
import { MESSAGES } from '../utils/i18n.js';
export class SettingsPage {
  async render() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">설정</h1>
        </div>
      </div>
      <div class="page-body">

        <!-- Data backup -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <div class="card-title">데이터 백업 / 복원</div>
          </div>
          <div class="card-body" style="display:flex; flex-direction:column; gap: var(--space-3);">
            <div>
              <div style="font-weight:600; margin-bottom:4px;">백업 내보내기</div>
              <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:8px;">모든 데이터를 JSON 파일로 저장합니다.</div>
              <button class="btn btn-secondary" id="export-backup-btn">⬇ 백업 다운로드</button>
            </div>
            <div class="divider"></div>
            <div>
              <div style="font-weight:600; margin-bottom:4px;">백업 복원</div>
              <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:8px;">백업 파일을 불러와 데이터를 복원합니다. <strong>현재 데이터는 모두 삭제됩니다.</strong></div>
              <label class="btn btn-secondary" for="import-backup-input" style="cursor:pointer;">⬆ 백업 불러오기</label>
              <input type="file" id="import-backup-input" accept=".json" style="display:none;">
            </div>
          </div>
        </div>

        <!-- App info -->
        <div class="card">
          <div class="card-header"><div class="card-title">앱 정보</div></div>
          <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-2);">
            <div style="display:flex; justify-content:space-between; font-size:14px;">
              <span style="color:var(--color-text-muted);">버전</span>
              <span style="font-weight:600;">1.0.0</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px;">
              <span style="color:var(--color-text-muted);">개발자</span>
              <span style="font-weight:600;">출석부</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('export-backup-btn')?.addEventListener('click', () => this._exportBackup());

    const importInput = document.getElementById('import-backup-input');
    importInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._importBackup(file);
    });
  }

  async _exportBackup() {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `출석부_백업_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      Toast.success(MESSAGES.backupSaved);
    } catch (e) {
      Toast.error('백업 실패: ' + e.message);
    }
  }

  async _importBackup(file) {
    const ok = await Modal.confirm({
      title: '백업 복원',
      message: '현재 모든 데이터가 삭제되고 백업으로 대체됩니다.\n계속하시겠습니까?',
      danger: true,
      confirmText: '복원',
    });
    if (!ok) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      Toast.success(MESSAGES.backupLoaded);
      // Reload page
      setTimeout(() => { window.location.hash = '#/'; window.location.reload(); }, 1000);
    } catch (e) {
      Toast.error(MESSAGES.invalidFile + ': ' + e.message);
    }
  }

  destroy() {}
}
