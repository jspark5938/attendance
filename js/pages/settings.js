/**
 * Settings page
 * Route: #/settings
 */

import { exportAllData, importAllData, getByKey, put, localHasData, migrateLocalToCloud } from '../db/database.js';
import Toast from '../components/toast.js';
import Modal from '../components/modal.js';
import { MESSAGES } from '../utils/i18n.js';
import { AuthService } from '../services/auth.js';
import { readLegacyIndexedDB, hasLegacyData } from '../services/migration.js';

export class SettingsPage {
  constructor() {
    this._hasLegacy = false;
  }

  async render() {
    const alertSettings = await getByKey('settings', 'contract_alert') ?? {};
    const periodDays     = alertSettings.periodDays     ?? 7;
    const countRemaining = alertSettings.countRemaining ?? 3;

    const user = AuthService.currentUser();
    const isGuest = !user;
    this._hasLegacy = await hasLegacyData();

    const avatarUrl = user?.photoURL
      ? `<img src="${user.photoURL}" alt="프로필" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:700;">${(user?.displayName || '?')[0]}</div>`;

    const migrationSection = this._hasLegacy ? `
      <!-- Data migration from IndexedDB -->
      <div class="card" style="margin-bottom: var(--space-4); border:1.5px solid var(--color-warning, #f59e0b);">
        <div class="card-header">
          <div class="card-title">기존 데이터 마이그레이션</div>
        </div>
        <div class="card-body" style="display:flex; flex-direction:column; gap: var(--space-3);">
          <div style="font-size:13px; color:var(--color-text-muted);">이전 버전(로컬 저장)의 데이터가 감지되었습니다. 아래 버튼을 눌러 클라우드로 가져오세요.</div>
          <button class="btn btn-primary" id="migrate-legacy-btn">기기 데이터 가져오기</button>
        </div>
      </div>
    ` : '';

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">설정</h1>
        </div>
      </div>
      <div class="page-body">

        <!-- User profile / Guest mode -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <div class="card-title">계정</div>
          </div>
          <div class="card-body">
            ${isGuest ? `
              <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); padding:var(--space-3); background:var(--color-surface-2); border-radius:var(--radius-md);">
                <div style="font-size:28px;">👤</div>
                <div>
                  <div style="font-weight:700; font-size:15px;">로컬 모드</div>
                  <div style="font-size:13px; color:var(--color-text-muted);">데이터가 이 기기에만 저장됩니다</div>
                </div>
              </div>
              <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:var(--space-3);">Google 로그인 시 현재 데이터를 클라우드에 백업하고 모든 기기에서 동기화할 수 있습니다.</div>
              <button class="btn btn-primary" id="login-btn" style="width:100%;">Google로 로그인</button>
            ` : `
              <div style="display:flex; align-items:center; gap:var(--space-4); margin-bottom:var(--space-4);">
                ${avatarUrl}
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:700; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user?.displayName || '이름 없음'}</div>
                  <div style="font-size:13px; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user?.email || ''}</div>
                </div>
              </div>
              <button class="btn btn-secondary" id="logout-btn" style="width:100%;">로그아웃</button>
            `}
          </div>
        </div>

        ${migrationSection}

        <!-- Contract alert thresholds -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <div class="card-title">계약 종료 예정 알림 기준</div>
          </div>
          <div class="card-body" style="display:flex; flex-direction:column; gap: var(--space-4);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
              <div>
                <div style="font-weight:600; margin-bottom:2px;">기간제</div>
                <div style="font-size:13px; color:var(--color-text-muted);">종료일 N일 이내인 학생을 홈에 표시</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <input type="number" id="alert-period-days" class="form-input"
                  value="${periodDays}" min="1" max="365"
                  style="width:70px; text-align:center; padding:6px 8px;">
                <span style="font-size:14px; color:var(--color-text-muted);">일 이내</span>
              </div>
            </div>
            <div class="divider"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
              <div>
                <div style="font-weight:600; margin-bottom:2px;">횟수제</div>
                <div style="font-size:13px; color:var(--color-text-muted);">잔여 횟수가 N회 이하인 학생을 홈에 표시</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <input type="number" id="alert-count-remaining" class="form-input"
                  value="${countRemaining}" min="0" max="999"
                  style="width:70px; text-align:center; padding:6px 8px;">
                <span style="font-size:14px; color:var(--color-text-muted);">회 이하</span>
              </div>
            </div>
            <div>
              <button class="btn btn-primary" id="save-alert-settings-btn">저장</button>
            </div>
          </div>
        </div>

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
    document.getElementById('logout-btn')?.addEventListener('click', () => this._logout());
    document.getElementById('login-btn')?.addEventListener('click', () => this._loginFromGuest());

    document.getElementById('save-alert-settings-btn')?.addEventListener('click', () => this._saveAlertSettings());

    document.getElementById('export-backup-btn')?.addEventListener('click', () => this._exportBackup());

    const importInput = document.getElementById('import-backup-input');
    importInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._importBackup(file);
    });

    if (this._hasLegacy) {
      document.getElementById('migrate-legacy-btn')?.addEventListener('click', () => this._migrateLegacy());
    }
  }

  async _loginFromGuest() {
    try {
      await AuthService.signIn();
    } catch (e) {
      Toast.error('로그인에 실패했습니다: ' + (e.message || ''));
    }
  }

  async _logout() {
    const ok = await Modal.confirm({
      title: '로그아웃',
      message: '로그아웃하시겠습니까?',
      confirmText: '로그아웃',
    });
    if (!ok) return;
    try {
      await AuthService.signOut();
    } catch (e) {
      Toast.error('로그아웃 실패: ' + e.message);
    }
  }

  async _migrateLegacy() {
    const ok = await Modal.confirm({
      title: '기기 데이터 가져오기',
      message: '기기에 저장된 기존 데이터를 클라우드로 가져옵니다.\n현재 클라우드 데이터는 모두 교체됩니다.\n계속하시겠습니까?',
      danger: true,
      confirmText: '가져오기',
    });
    if (!ok) return;

    const btn = document.getElementById('migrate-legacy-btn');
    if (btn) { btn.disabled = true; btn.textContent = '가져오는 중...'; }

    try {
      const data = await readLegacyIndexedDB();
      if (!data) throw new Error('기존 데이터를 읽을 수 없습니다.');
      await importAllData(data);
      Toast.success('기기 데이터를 성공적으로 가져왔습니다.');
      setTimeout(() => { window.location.hash = '#/'; window.location.reload(); }, 1000);
    } catch (e) {
      Toast.error('마이그레이션 실패: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '기기 데이터 가져오기'; }
    }
  }

  async _saveAlertSettings() {
    const periodDays     = parseInt(document.getElementById('alert-period-days')?.value, 10);
    const countRemaining = parseInt(document.getElementById('alert-count-remaining')?.value, 10);
    if (isNaN(periodDays) || periodDays < 1)    { Toast.error('기간제 기준은 1일 이상이어야 합니다.'); return; }
    if (isNaN(countRemaining) || countRemaining < 0) { Toast.error('횟수제 기준은 0 이상이어야 합니다.'); return; }
    await put('settings', { key: 'contract_alert', periodDays, countRemaining });
    Toast.success('알림 기준이 저장되었습니다.');
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
