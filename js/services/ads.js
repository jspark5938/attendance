/**
 * Ads service
 * Handles AdSense (web) and AdMob (Android) branching.
 *
 * On web: AdSense blocks are statically in HTML; this service just controls visibility.
 * On Android: AdMob plugin is called via Capacitor bridge.
 */

// Google 공식 테스트 광고 ID (항상 테스트 광고 표시)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

// 실제 광고 ID
const REAL_BANNER_ID = 'ca-app-pub-1007656354860622/8325774890';

// true = 테스트 광고, false = 실제 광고
const USE_TEST_ADS = true;

const isAndroid = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export const AdsService = {
  /** Initialize ads (called on app startup, only for non-premium users) */
  async init(isPremium) {
    if (isPremium) {
      this.hide();
      return;
    }

    if (isAndroid) {
      await this._initAdMob();
    } else {
      this._showAdSense();
    }
  },

  /** Show ad containers */
  show() {
    document.querySelectorAll('.ad-container').forEach(el => {
      el.style.display = '';
    });
  },

  /** Hide all ad containers (premium users) */
  hide() {
    document.querySelectorAll('.ad-container').forEach(el => {
      el.style.display = 'none';
    });
  },

  /** AdSense: push ad units that haven't been initialized yet */
  _showAdSense() {
    try {
      this.show();
      if (typeof window.adsbygoogle !== 'undefined') {
        document.querySelectorAll('.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        });
      }
    } catch (e) {
      // AdSense not loaded (dev environment)
    }
  },

  /** 시스템 바(홈 버튼 영역) 높이를 px로 반환 */
  _getSafeAreaBottom() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;';
    document.body.appendChild(el);
    const h = el.offsetHeight;
    document.body.removeChild(el);
    return h;
  },

  /** AdMob: initialize banner via Capacitor plugin */
  async _initAdMob() {
    try {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) return;

      await AdMob.initialize({
        requestTrackingAuthorization: false,
        initializeForTesting: USE_TEST_ADS,
      });

      // Java에서 정확한 nav bar 높이 취득 (CSS env() 보다 타이밍에 안전)
      const safeBottom = window.AndroidBridge?.getNavBarHeight() || this._getSafeAreaBottom();

      // CSS 커스텀 프로퍼티로 오프셋 적용 (body 패딩 + 모달 max-height 등 일괄 반영)
      const setOffset = (px) => {
        document.documentElement.style.setProperty('--ad-bottom-offset', `${px}px`);
      };

      // 배너 로드 완료 시 (배너 높이 + nav bar 높이)만큼 오프셋 설정
      AdMob.addListener('bannerAdLoaded', (info) => {
        const height = info?.adSize?.height ?? 60;
        setOffset(height + safeBottom);
      });

      // 배너 실패 시 nav bar 높이만큼만 오프셋 유지
      AdMob.addListener('bannerAdFailedToLoad', () => {
        setOffset(safeBottom);
      });

      await AdMob.showBanner({
        adId: USE_TEST_ADS ? TEST_BANNER_ID : REAL_BANNER_ID,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: safeBottom,  // 시스템 바 위로 배너 띄우기
        npa: false,
      });
    } catch (e) {
      console.warn('[AdsService] AdMob init failed:', e);
    }
  },
};

export default AdsService;
