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
import { localHasData, migrateLocalToCloud } from './db/database.js';

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
  _router.register('/calendar', () => new CalendarAllPage());
  _router.register('/stats',    () => new GroupPickerPage({ mode: 'stats' }));
  _router.register('/settings', () => new SettingsPage());
  _router.register('/premium', () => new PremiumPage());

  // 5. Show app shell and start router
  _showAppShell(true);
  _router.start();

  // 6. Android 뒤로가기 버튼 처리
  _initBackButton();

  // 7. Register service worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW not supported in this context (file:// etc.)
    });
  }

}

function _initBackButton() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  // 홈에서 뒤로가기 2회 감지용 타임스탬프
  let _lastBackPress = 0;

  // 최상위 탭 화면 (뒤로가기 → 홈 이동)
  const TOP_LEVEL = new Set(['/groups', '/calendar', '/stats', '/settings', '/premium']);

  cap.Plugins.App?.addListener('backButton', () => {
    const path = (window.location.hash || '#/').slice(1).split('?')[0] || '/';

    if (path === '/') {
      // 홈: 2초 안에 한 번 더 누르면 종료
      const now = Date.now();
      if (now - _lastBackPress < 2000) {
        cap.Plugins.App.exitApp();
      } else {
        _lastBackPress = now;
        Toast.show('한 번 더 누르면 종료됩니다.', 'info', 2000);
      }
    } else if (TOP_LEVEL.has(path)) {
      // 최상위 탭: 홈으로 이동
      _router.navigate('/');
    } else {
      // 하위 화면: 이전 화면으로
      window.history.back();
    }
  });
}


async function _offerMigration() {
  if (!localHasData()) return;
  const ok = await Modal.confirm({
    title: '로컬 데이터 백업',
    message: '로그인 없이 저장된 데이터가 있습니다.\n지금 클라우드에 백업하시겠습니까?\n(취소하면 기존 데이터는 로컬에 남습니다)',
    confirmText: '백업하기',
  });
  if (!ok) return;
  try {
    await migrateLocalToCloud();
    Toast.success('데이터를 클라우드에 백업했습니다.');
  } catch (e) {
    Toast.error('백업 실패: ' + e.message);
  }
}

async function init() {
  // Handle Google redirect result (web only)
  await AuthService.handleRedirectResult().catch(() => {});

  // Listen for auth state changes
  AuthService.onAuthStateChanged(async (user) => {
    document.getElementById('app-loading')?.remove();
    if (user) {
      AuthService.exitGuestMode();
      await _offerMigration();
      if (_appInitialized && _router) {
        // 게스트 모드에서 로그인한 경우 — 앱 재초기화 없이 현재 페이지만 갱신
        await _router.refresh();
      } else {
        await _initApp();
      }
    } else if (AuthService.isGuestMode()) {
      await _initApp();
    } else {
      _appInitialized = false;
      if (_router) { _router.stop?.(); _router = null; }
      await _showLoginPage();
    }
  });

  // Guest mode entry from login page
  window.addEventListener('guest-mode-enter', () => _initApp());
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
