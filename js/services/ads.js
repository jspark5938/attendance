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
const USE_TEST_ADS = false;

// 배너 로드 실패 시 최대 재시도 횟수 및 대기 시간
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 30_000; // 30초

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

  /**
   * CSS env()가 레이아웃에 반영된 후 safe-area-inset-bottom 높이를 반환.
   * rAF 두 번으로 렌더링 완료를 보장해 동기 측정 시 0이 나오는 문제 방지.
   */
  _getSafeAreaBottom() {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        const el = document.createElement('div');
        el.style.cssText =
          'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);' +
          'pointer-events:none;visibility:hidden;';
        document.body.appendChild(el);
        requestAnimationFrame(() => {
          const h = el.offsetHeight || 0;
          document.body.removeChild(el);
          resolve(h);
        });
      });
    });
  },

  /** --ad-bottom-offset CSS 변수 설정 (body 패딩·모달 높이 일괄 반영) */
  _setOffset(px) {
    document.documentElement.style.setProperty('--ad-bottom-offset', `${px}px`);
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

      await this._showBannerWithRetry(AdMob, 0);
    } catch (e) {
      console.warn('[AdsService] AdMob init failed:', e);
    }
  },

  /**
   * 배너 표시 + 실패 시 자동 재시도.
   * attempt: 현재 시도 횟수 (0부터 시작)
   */
  async _showBannerWithRetry(AdMob, attempt) {
    if (attempt >= MAX_RETRY) {
      console.warn('[AdsService] Banner failed after max retries, giving up.');
      return;
    }

    // CSS env() 반영 이후 안전 영역 높이 측정
    const safeBottom =
      window.AndroidBridge?.getNavBarHeight?.() ??
      (await this._getSafeAreaBottom());

    // 이전 리스너 정리 (재시도 시 중복 등록 방지)
    this._bannerListeners?.forEach(h => h.remove?.());
    this._bannerListeners = [];

    this._bannerListeners.push(
      AdMob.addListener('bannerAdLoaded', (info) => {
        const height = info?.adSize?.height ?? 60;
        this._setOffset(height + safeBottom);
      })
    );

    this._bannerListeners.push(
      AdMob.addListener('bannerAdFailedToLoad', (error) => {
        console.warn(`[AdsService] Banner load failed (attempt ${attempt + 1}/${MAX_RETRY}):`, error?.message ?? error);
        this._setOffset(safeBottom);
        setTimeout(
          () => this._showBannerWithRetry(AdMob, attempt + 1),
          RETRY_DELAY_MS
        );
      })
    );

    try {
      await AdMob.showBanner({
        adId: USE_TEST_ADS ? TEST_BANNER_ID : REAL_BANNER_ID,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: safeBottom,
        npa: false,
      });
    } catch (e) {
      console.warn('[AdsService] showBanner threw:', e);
      setTimeout(
        () => this._showBannerWithRetry(AdMob, attempt + 1),
        RETRY_DELAY_MS
      );
    }
  },
};

export default AdsService;
