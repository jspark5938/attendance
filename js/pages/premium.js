/**
 * Premium upgrade page
 * Route: #/premium
 */

import { PremiumService } from '../services/premium.js';
import Toast from '../components/toast.js';
import Modal from '../components/modal.js';
import { t, PREMIUM_PRICE } from '../utils/i18n.js';
import store from '../state/store.js';

export class PremiumPage {
  async render() {
    const isPremium = store.get('isPremium');

    if (isPremium) {
      return `
        <div class="page-header">
          <div class="page-header-left"><h1 class="page-title">${t('premium.title')}</h1></div>
        </div>
        <div class="page-body">
          <div class="empty-state">
            <div style="font-size:64px; margin-bottom:8px;">★</div>
            <div class="empty-state-title">${t('premium.alreadyTitle')}</div>
            <div class="empty-state-desc">${t('premium.alreadyDesc')}</div>
            <a href="#/" class="btn btn-primary" style="margin-top:12px;">${t('premium.goHome')}</a>
          </div>
        </div>
      `;
    }

    const features = [
      { icon: t('premium.f1Icon'), title: t('premium.f1Title'), desc: t('premium.f1Desc') },
      { icon: t('premium.f2Icon'), title: t('premium.f2Title'), desc: t('premium.f2Desc') },
      { icon: t('premium.f3Icon'), title: t('premium.f3Title'), desc: t('premium.f3Desc') },
      { icon: t('premium.f4Icon'), title: t('premium.f4Title'), desc: t('premium.f4Desc') },
    ];

    return `
      <div class="page-header">
        <div class="page-header-left"><h1 class="page-title">${t('premium.upgradeTitle')}</h1></div>
      </div>
      <div class="page-body" style="max-width: 520px; margin: 0 auto;">
        <!-- Hero -->
        <div style="text-align:center; padding: var(--space-8) var(--space-4); background: linear-gradient(135deg, var(--color-primary), #7C3AED); border-radius: var(--radius-xl); color: white; margin-bottom: var(--space-5);">
          <div style="font-size: 48px; margin-bottom: var(--space-3);">★</div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: var(--space-2);">${t('premium.heroTitle')}</div>
          <div style="opacity: 0.85; font-size: 15px; margin-bottom: var(--space-5);">${t('premium.heroDesc')}</div>
          <div style="font-size: 36px; font-weight: 800;">${PREMIUM_PRICE}</div>
          <div style="opacity: 0.75; font-size: 13px;">${t('premium.lifetime')}</div>
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
            ${t('premium.payWeb', {price: PREMIUM_PRICE})}
          </button>
          <button class="btn btn-outline btn-lg btn-full" id="restore-btn">
            ${t('premium.restore')}
          </button>
        </div>

        <div style="text-align:center; margin-top: var(--space-4); font-size:12px; color:var(--color-text-muted);">
          ${t('premium.payFooter').replace(/\n/g, '<br>')}
        </div>

        <!-- Dev unlock (hidden in production) -->
        <div style="margin-top: var(--space-8); padding: var(--space-4); background: var(--color-surface-2); border-radius: var(--radius-md);">
          <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:8px;">${t('premium.devTest')}</div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="promo-code" class="form-input" placeholder="${t('placeholders.activationCode')}" style="font-size:13px;">
            <button class="btn btn-secondary" id="activate-code-btn">${t('premium.applyCode')}</button>
          </div>
        </div>
      </div>
    `;
  }

  async mount() {
    document.getElementById('buy-web-btn')?.addEventListener('click', () => {
      Modal.open({
        title: t('premium.payModalTitle'),
        body: `<p style="color:var(--color-text-muted); font-size:14px; line-height:1.8;">
          결제 링크는 출시 후 연결됩니다.<br><br>
          현재는 테스트 모드입니다.<br>
          아래 개발자 코드 <strong>PREMIUM2024</strong>를 입력해 기능을 체험해 보세요.
        </p>`,
        hideConfirm: true,
        cancelText: t('common.close'),
      });
    });

    document.getElementById('restore-btn')?.addEventListener('click', () => {
      Toast.info(t('premium.noHistory'));
    });

    document.getElementById('activate-code-btn')?.addEventListener('click', async () => {
      const code = document.getElementById('promo-code')?.value?.trim().toUpperCase();
      if (code === 'PREMIUM2024' || code === 'TEST') {
        await PremiumService.activate(code);
        Toast.success(t('messages.premiumActivated'));
        setTimeout(() => { window.location.hash = '#/'; }, 1200);
      } else {
        Toast.error(t('premium.invalidCode'));
      }
    });
  }

  destroy() {}
}
