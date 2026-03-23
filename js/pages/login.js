import { AuthService } from '../services/auth.js';
import Toast from '../components/toast.js';

export class LoginPage {
  render() {
    return `
      <div style="position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:var(--color-bg); padding:var(--space-6); z-index:999;">
        <div style="max-width:380px; width:100%; text-align:center;">
          <div style="width:72px; height:72px; background:var(--color-primary); border-radius:20px; display:flex; align-items:center; justify-content:center; color:white; font-size:32px; font-weight:700; margin:0 auto var(--space-6);">출</div>
          <h1 style="font-size:28px; font-weight:800; color:var(--color-text); margin-bottom:8px;">출석부</h1>
          <p style="font-size:14px; color:var(--color-text-muted); margin-bottom:var(--space-8);">학생 출결을 쉽고 빠르게 관리하세요</p>
          <button id="google-signin-btn"
            style="display:flex; align-items:center; justify-content:center; gap:12px; width:100%; padding:14px 24px; border:1.5px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); color:var(--color-text); font-size:15px; font-weight:600; cursor:pointer; transition:background var(--transition-fast);">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 로그인
          </button>
          <p style="font-size:12px; color:var(--color-text-muted); margin-top:var(--space-6);">로그인하면 모든 기기에서 데이터가 동기화됩니다</p>
        </div>
      </div>
    `;
  }

  async mount() {
    const btn = document.getElementById('google-signin-btn');
    if (!btn) return;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--color-surface-2)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--color-surface)'; });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '로그인 중...';
      try {
        await AuthService.signIn();
      } catch (e) {
        Toast.error('로그인에 실패했습니다: ' + (e.message || ''));
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google로 로그인`;
      }
    });
  }

  destroy() {}
}
