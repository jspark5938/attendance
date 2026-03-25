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

  /** AdMob: initialize banner via Capacitor plugin */
  async _initAdMob() {
    try {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) return;

      await AdMob.initialize({
        requestTrackingAuthorization: false,
        initializeForTesting: USE_TEST_ADS,
      });

      // 배너 로드 완료 시 높이만큼 하단 패딩 추가
      AdMob.addListener('bannerAdLoaded', (info) => {
        const height = info?.adSize?.height ?? 60;
        document.body.style.paddingBottom = `${height}px`;
      });

      // 배너 닫힘/실패 시 패딩 제거
      AdMob.addListener('bannerAdFailedToLoad', () => {
        document.body.style.paddingBottom = '';
      });

      await AdMob.showBanner({
        adId: USE_TEST_ADS ? TEST_BANNER_ID : REAL_BANNER_ID,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0,
        npa: false,
      });
    } catch (e) {
      console.warn('[AdsService] AdMob init failed:', e);
    }
  },
};

export default AdsService;
