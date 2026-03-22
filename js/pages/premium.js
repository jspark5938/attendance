/**
 * Premium upgrade page
 * Route: #/premium
 */

import { PremiumService } from '../services/premium.js';
import Toast from '../components/toast.js';
import Modal from '../components/modal.js';
import { MESSAGES, PREMIUM_PRICE } from '../utils/i18n.js';
import store from '../state/store.js';

export class PremiumPage {
  async render() {
    const isPremium = store.get('isPremium');

    if (isPremium) {
      return `
        <div class="page-header">
          <div class="page-header-left"><h1 class="page-title">프리미엄</h1></div>
        </div>
        <div class="page-body">
          <div class="empty-state">
            <div style="font-size:64px; margin-bottom:8px;">★</div>
            <div class="empty-state-title">이미 프리미엄 사용자입니다!</div>
            <div class="empty-state-desc">모든 기능을 제한 없이 사용할 수 있습니다.</div>
            <a href="#/" class="btn btn-primary" style="margin-top:12px;">홈으로</a>
          </div>
        </div>
      `;
    }

    const features = [
      { icon: '👥', title: '무제한 그룹/학생', desc: '그룹과 학생 수에 제한 없이 사용' },
      { icon: '📊', title: '고급 통계 차트', desc: '일별/월별 출석 현황 차트 제공' },
      { icon: '📄', title: 'CSV/PDF 내보내기', desc: '출석 데이터를 엑셀, PDF로 내보내기' },
      { icon: '🚫', title: '광고 없음', desc: '광고 없이 쾌적한 환경' },
    ];

    return `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">프리미엄 업그레이드</h1></div>
      </div>
      <div class="page-body" style="max-width: 520px; margin: 0 auto;">
        <!-- Hero -->
        <div style="text-align:center; padding: var(--space-8) var(--space-4); background: linear-gradient(135deg, var(--color-primary), #7C3AED); border-radius: var(--radius-xl); color: white; margin-bottom: var(--space-5);">
          <div style="font-size: 48px; margin-bottom: var(--space-3);">★</div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: var(--space-2);">프리미엄으로 업그레이드</div>
          <div style="opacity: 0.85; font-size: 15px; margin-bottom: var(--space-5);">모든 기능을 제한 없이 사용하세요</div>
          <div style="font-size: 36px; font-weight: 800;">${PREMIUM_PRICE}</div>
          <div style="opacity: 0.75; font-size: 13px;">평생 이용권</div>
        </div>

        <!-- Features -->
        <div class="card" style="margin-bottom: var(--space-5);">
          <div class="card-body" style="display:flex; flex-direction:column; gap:var(--space-4);">
            ${features.map(f => `
              <div style="display:flex; align-items:flex-start; gap:var(--space-3);">
                <div style="font-size:24px; flex-shrink:0; width:36px; text-align:center;">${f.icon}</div>
                <div>
                  <div style="font-weight:600; margin-bottom:2px;">${f.title}</div>
                  <div style="font-size:13px; color:var(--color-text-muted);">${f.desc}</div>
                </div>
                <div style="margin-left:auto; color:var(--color-present); font-size:18px;">✓</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- CTA buttons -->
        <div style="display:flex; flex-direction:column; gap:var(--space-2);">
          <button class="btn btn-premium btn-lg btn-full" id="buy-web-btn">
            웹에서 결제하기 (${PREMIUM_PRICE})
          </button>
          <button class="btn btn-outline btn-lg btn-full" id="restore-btn">
            구매 복원
          </button>
        </div>

        <div style="text-align:center; margin-top: var(--space-4); font-size:12px; color:var(--color-text-muted);">
          결제는 안전한 외부 결제 페이지에서 진행됩니다.<br>
          구매 후 코드를 입력하면 즉시 활성화됩니다.
        </div>

        <!-- Dev unlock (hidden in production) -->
        <div style="margin-top: var(--space-8); padding: var(--space-4); background: var(--color-surface-2); border-radius: var(--radius-md);">
          <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">개발자용 테스트 활성화</div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="promo-code" class="form-input" placeholder="활성화 코드 입력" style="font-size:13px;">
            <button class="btn btn-secondary" id="activate-code-btn">적용</button>
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('buy-web-btn')?.addEventListener('click', () => {
      // In production: replace with actual Stripe Payment Link
      Modal.open({
        title: '결제 안내',
        body: `<p style="color:var(--color-text-muted); font-size:14px; line-height:1.8;">
          결제 링크는 출시 후 연결됩니다.<br><br>
          현재는 테스트 모드입니다.<br>
          아래 개발자 코드 <strong>PREMIUM2024</strong>를 입력해 기능을 체험해 보세요.
        </p>`,
        hideConfirm: true,
        cancelText: '닫기',
      });
    });

    document.getElementById('restore-btn')?.addEventListener('click', () => {
      Toast.info('구매 기록이 없습니다.');
    });

    document.getElementById('activate-code-btn')?.addEventListener('click', async () => {
      const code = document.getElementById('promo-code')?.value?.trim().toUpperCase();
      // Accept a simple hardcoded demo code (replace with real verification in prod)
      if (code === 'PREMIUM2024' || code === 'TEST') {
        await PremiumService.activate(code);
        Toast.success(MESSAGES.premiumActivated);
        setTimeout(() => { window.location.hash = '#/'; }, 1200);
      } else {
        Toast.error('올바르지 않은 코드입니다.');
      }
    });
  }

  destroy() {}
}
