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

// Pages
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

async function init() {
  // 1. Load premium status
  const isPremium = await PremiumService.load();

  // 2. Init persistent components
  Modal.init();
  Sidebar.init();
  BottomNav.init();

  // 3. Init ads (after premium check)
  await AdsService.init(isPremium);

  // 4. Register routes
  const router = new Router();
  router.setContainer(document.getElementById('app-content'));

  router.register('/', () => new DashboardPage());
  router.register('/groups', (p, q) => new GroupsPage(p, q, router));
  router.register('/groups/:id', (p, q) => new GroupDetailPage(p, q));
  router.register('/groups/:id/attend', (p, q) => new AttendancePage(p, q));
  router.register('/groups/:id/calendar', (p) => new CalendarPage(p));
  router.register('/groups/:id/stats', (p) => new StatisticsPage(p));
  router.register('/groups/:id/export', (p) => new ExportPage(p));
  router.register('/calendar', () => new CalendarAllPage());
  router.register('/stats',    () => new GroupPickerPage({ mode: 'stats' }));
  router.register('/settings', () => new SettingsPage());
  router.register('/premium', () => new PremiumPage());

  // 5. Start router
  router.start();

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
      Toast.info('💾 데이터를 정기적으로 백업하는 것을 권장합니다. (설정 → 백업)', 6000);
      localStorage.setItem(key, String(now));
    }, 5000);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
