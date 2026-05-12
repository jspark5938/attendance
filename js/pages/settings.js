/**
 * Settings page
 * Route: #/settings
 */

import { getByKey, put, importAllData, localHasData, migrateLocalToCloud } from '../db/database.js';
import Toast from '../components/toast.js';
import Modal from '../components/modal.js';
import { AuthService } from '../services/auth.js';
import { readLegacyIndexedDB, hasLegacyData } from '../services/migration.js';
import { t, getLocale, setLocale } from '../utils/i18n.js';
import AdsService from '../services/ads.js';

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

    const savedLocale = (await getByKey('settings', 'locale'))?.value || 'system';
    const _isAndroid = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
    const showPrivacyBtn = _isAndroid && AdsService.getPrivacyOptionsStatus() === 'REQUIRED';

    const avatarUrl = user?.photoURL
      ? `<img src="${user.photoURL}" alt="${t('settings.account')}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:700;">${(user?.displayName || '?')[0]}</div>`;

    const migrationSection = this._hasLegacy ? `
      <div class="card" style="margin-bottom: var(--space-4); border:1.5px solid var(--color-warning, #f59e0b);">
        <div class="card-header">
          <div class="card-title">${t('settings.migrationTitle')}</div>
        </div>
        <div class="card-body" style="display:flex; flex-direction:column; gap: var(--space-3);">
          <div style="font-size:13px; color:var(--color-text-muted);">${t('settings.migrationDesc')}</div>
          <button class="btn btn-primary" id="migrate-legacy-btn">${t('settings.migrateBtn')}</button>
        </div>
      </div>
    ` : '';

    const localeOptions = [
      { value: 'system', label: t('settings.systemLanguage') },
      { value: 'ko',     label: '한국어' },
      { value: 'en',     label: 'English' },
      { value: 'ja',     label: '日本語' },
    ];

    return `
      <div class="page-body">

        <!-- User profile / Guest mode -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <div class="card-title">${t('settings.account')}</div>
          </div>
          <div class="card-body">
            ${isGuest ? `
              <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); padding:var(--space-3); background:var(--color-surface-2); border-radius:var(--radius-md);">
                <div style="font-size:28px;">👤</div>
                <div>
                  <div style="font-weight:700; font-size:15px;">${t('settings.localMode')}</div>
                  <div style="font-size:13px; color:var(--color-text-muted);">${t('settings.localModeDesc')}</div>
                </div>
              </div>
              <div style="font-size:13px; color:var(--color-text-muted); margin-bottom:var(--space-3);">${t('settings.loginGoogleDesc')}</div>
              <button class="btn btn-primary" id="login-btn" style="width:100%;">${t('settings.loginGoogle')}</button>
            ` : `
              <div style="display:flex; align-items:center; gap:var(--space-4); margin-bottom:var(--space-4);">
                ${avatarUrl}
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:700; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user?.displayName || t('settings.noName')}</div>
                  <div style="font-size:13px; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user?.email || ''}</div>
                </div>
              </div>
              <button class="btn btn-secondary" id="logout-btn" style="width:100%;">${t('settings.logout')}</button>
            `}
          </div>
        </div>

        <!-- Language selector -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-body" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
            <span style="font-weight:600; font-size:14px;">${t('settings.language')}</span>
            <select id="locale-select" class="form-select" style="width:auto; min-width:130px; padding:6px 10px; font-size:14px; color:#1C1917; background-color:#FFFFFF;">
              ${localeOptions.map(opt => `
                <option value="${opt.value}" ${savedLocale === opt.value ? 'selected' : ''}>${opt.label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        ${migrationSection}

        <!-- Contract alert thresholds -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header">
            <div class="card-title">${t('settings.contractAlert')}</div>
          </div>
          <div class="card-body" style="display:flex; flex-direction:column; gap: var(--space-4);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
              <div>
                <div style="font-weight:600; margin-bottom:2px;">${t('settings.periodType')}</div>
                <div style="font-size:13px; color:var(--color-text-muted);">${t('settings.periodTypeDesc')}</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <input type="number" id="alert-period-days" class="form-input"
                  value="${periodDays}" min="1" max="365"
                  style="width:70px; text-align:center; padding:6px 8px;">
                <span style="font-size:14px; color:var(--color-text-muted);">${t('settings.daysUnit')}</span>
              </div>
            </div>
            <div class="divider"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
              <div>
                <div style="font-weight:600; margin-bottom:2px;">${t('settings.countType')}</div>
                <div style="font-size:13px; color:var(--color-text-muted);">${t('settings.countTypeDesc')}</div>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <input type="number" id="alert-count-remaining" class="form-input"
                  value="${countRemaining}" min="0" max="999"
                  style="width:70px; text-align:center; padding:6px 8px;">
                <span style="font-size:14px; color:var(--color-text-muted);">${t('settings.countUnit')}</span>
              </div>
            </div>
            <div>
              <button class="btn btn-primary" id="save-alert-settings-btn">${t('settings.saveBtn')}</button>
            </div>
          </div>
        </div>

        <!-- App info -->
        <div class="card">
          <div class="card-header"><div class="card-title">${t('settings.appInfo')}</div></div>
          <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-2);">
            <div style="display:flex; justify-content:space-between; font-size:14px;">
              <span style="color:var(--color-text-muted);">${t('settings.version')}</span>
              <span style="font-weight:600;">1.0.0</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px;">
              <span style="color:var(--color-text-muted);">${t('settings.developer')}</span>
              <span style="font-weight:600;">ISTECH</span>
            </div>
            ${showPrivacyBtn ? `
            <div class="divider"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:14px;">
              <div>
                <div style="font-weight:600; margin-bottom:2px;">${t('settings.privacyOptions')}</div>
                <div style="font-size:13px; color:var(--color-text-muted);">${t('settings.privacyOptionsDesc')}</div>
              </div>
              <button class="btn btn-secondary" id="privacy-options-btn" style="flex-shrink:0; margin-left:var(--space-3);">
                ${t('settings.privacyOptionsBtn')}
              </button>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('logout-btn')?.addEventListener('click', () => this._logout());
    document.getElementById('login-btn')?.addEventListener('click', () => this._loginFromGuest());
    document.getElementById('save-alert-settings-btn')?.addEventListener('click', () => this._saveAlertSettings());

    if (this._hasLegacy) {
      document.getElementById('migrate-legacy-btn')?.addEventListener('click', () => this._migrateLegacy());
    }

    document.getElementById('locale-select')?.addEventListener('change', async (e) => {
      await setLocale(e.target.value);
    });

    document.getElementById('privacy-options-btn')?.addEventListener('click', async () => {
      try {
        await AdsService.showPrivacyOptions();
      } catch (e) {
        Toast.error(t('messages.unknownError') || 'Error');
      }
    });
  }

  async _loginFromGuest() {
    try {
      await AuthService.signIn();
    } catch (e) {
      Toast.error(t('messages.loginFailed', {msg: e.message || ''}));
    }
  }

  async _logout() {
    const ok = await Modal.confirm({
      title: t('settings.logout'),
      message: t('settings.logoutConfirm'),
      confirmText: t('settings.logout'),
    });
    if (!ok) return;
    try {
      await AuthService.signOut();
    } catch (e) {
      Toast.error(t('messages.logoutFailed', {msg: e.message}));
    }
  }

  async _migrateLegacy() {
    const ok = await Modal.confirm({
      title: t('settings.migrateModalTitle'),
      message: t('settings.migrateModalMsg'),
      danger: true,
      confirmText: t('settings.migrateModalBtn'),
    });
    if (!ok) return;

    const btn = document.getElementById('migrate-legacy-btn');
    if (btn) { btn.disabled = true; btn.textContent = t('settings.migratingBtn'); }

    try {
      const data = await readLegacyIndexedDB();
      if (!data) throw new Error(t('messages.migrateReadFailed'));
      await importAllData(data);
      Toast.success(t('messages.migrateSuccess'));
      setTimeout(() => { window.location.hash = '#/'; window.location.reload(); }, 1000);
    } catch (e) {
      Toast.error(t('messages.migrateFailed', {msg: e.message}));
      if (btn) { btn.disabled = false; btn.textContent = t('settings.migrateBtn'); }
    }
  }

  async _saveAlertSettings() {
    const periodDays     = parseInt(document.getElementById('alert-period-days')?.value, 10);
    const countRemaining = parseInt(document.getElementById('alert-count-remaining')?.value, 10);
    if (isNaN(periodDays) || periodDays < 1)    { Toast.error(t('messages.periodAlertError')); return; }
    if (isNaN(countRemaining) || countRemaining < 0) { Toast.error(t('messages.countAlertError')); return; }
    await put('settings', { key: 'contract_alert', periodDays, countRemaining });
    Toast.success(t('messages.alertSaved'));
  }

  destroy() {}
}
