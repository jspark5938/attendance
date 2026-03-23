/**
 * Application bootstrap
 * Registers routes, initializes components, loads premium status.
 */

import { Router } from './router.js';
import Modal from './components/modal.js';
import Toast from './components/toast.js';
import { Sidebar } from './components/sidebar.js';
import { BottomNav } from './components/bottom-nav.js';
import { PremiumService } from './services/premium.js';
import { AdsService } from './services/ads.js';
import { AuthService } from './services/auth.js';

// Pages
import { LoginPage }       from './pages/login.js';
import { DashboardPage }    from './pages/dashboard.js';
import { GroupsPage }       from './pages/groups.js';
import { GroupDetailPage }  from './pages/group-detail.js';
import { AttendancePage }   from './pages/attendance.js';
import { CalendarPage }     from './pages/calendar.js';
import { StatisticsPage }   from './pages/statistics.js';
import { SettingsPage }     from './pages/settings.js';
import { PremiumPage }      from './pages/premium.js';
import { ExportPage }       from './pages/export.js';
import { GroupPickerPage }   from './pages/group-picker.js';
import { CalendarAllPage }  from './pages/calendar-all.js';

let _router = null;
let _appInitialized = false;

function _showAppShell(visible) {
  const sidebar   = document.querySelector('.sidebar');
  const bottomNav = document.querySelector('.bottom-nav');
  const mobileHdr = document.querySelector('.mobile-header');
  const pageHdr   = document.querySelector('.page-header');
  if (sidebar)   sidebar.style.display   = visible ? '' : 'none';
  if (bottomNav) bottomNav.style.display = visible ? '' : 'none';
  if (mobileHdr) mobileHdr.style.display = visible ? '' : 'none';
  if (pageHdr)   pageHdr.style.display   = visible ? '' : 'none';
}

async function _showLoginPage() {
  _showAppShell(false);
  const container = document.getElementById('app-content');
  if (!container) return;
  const page = new LoginPage();
  container.innerHTML = page.render();
  await page.mount();
}

async function _initApp() {
  if (_appInitialized) return;
  _appInitialized = true;

  // 1. Load premium status
  const isPremium = await PremiumService.load();

  // 2. Init persistent components
  Modal.init();
  Sidebar.init();
  BottomNav.init();

  // 3. Init ads (after premium check)
  await AdsService.init(isPremium);

  // 4. Register routes (only once)
  _router = new Router();
  _router.setContainer(document.getElementById('app-content'));

  _router.register('/', () => new DashboardPage());
  _router.register('/groups', (p, q) => new GroupsPage(p, q, _router));
  _router.register('/groups/:id', (p, q) => new GroupDetailPage(p, q));
  _router.register('/groups/:id/attend', (p, q) => new AttendancePage(p, q));
  _router.register('/groups/:id/calendar', (p) => new CalendarPage(p));
  _router.register('/groups/:id/stats', (p) => new StatisticsPage(p));
  _router.register('/groups/:id/export', (p) => new ExportPage(p));
  _router.register('/calendar', () => new CalendarAllPage());
  _router.register('/stats',    () => new GroupPickerPage({ mode: 'stats' }));
  _router.register('/settings', () => new SettingsPage());
  _router.register('/premium', () => new PremiumPage());

  // 5. Show app shell and start router
  _showAppShell(true);
  _router.start();

  // 6. Register service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW not supported in this context (file:// etc.)
    });
  }

  // 7. Backup reminder (every 30 days)
  _checkBackupReminder();
}

function _checkBackupReminder() {
  const key = 'last_backup_reminder';
  const last = localStorage.getItem(key);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  if (!last || now - Number(last) > THIRTY_DAYS) {
    setTimeout(() => {
      Toast.info('데이터를 정기적으로 백업하는 것을 권장합니다. (설정 → 백업)', 6000);
      localStorage.setItem(key, String(now));
    }, 5000);
  }
}

async function init() {
  // Handle redirect result first (for Capacitor Google Sign-In)
  await AuthService.handleRedirectResult();

  // Listen for auth state changes
  AuthService.onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in — run full app init
      await _initApp();
    } else {
      // User is not signed in — show login page
      _appInitialized = false;
      if (_router) {
        _router.stop?.();
        _router = null;
      }
      await _showLoginPage();
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
