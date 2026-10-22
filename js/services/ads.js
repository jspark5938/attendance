/**
 * Ads service
 * Handles AdSense (web) and AdMob (Android) branching.
 *
 * On web: AdSense blocks are statically in HTML; this service just controls visibility.
 * On Android: AdMob plugin is called via Capacitor bridge.
 */

import store from '../state/store.js';

// Google 공식 테스트 광고 ID (항상 테스트 광고 표시)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

// 실제 광고 ID
const REAL_BANNER_ID = 'ca-app-pub-1007656354860622/8325774890';
// AdMob 콘솔에서 보상형 광고 단위 생성 후 입력. 비어 있으면 보상형 광고 없이 바로 내보내기 허용.
const REAL_REWARDED_ID = '';

// true = 테스트 광고, false = 실제 광고
const USE_TEST_ADS = false;

// UMP 디버그 지역 설정
// 0 = 실제 지역 기반 (배포용)
// 1 = EEA 강제 (GDPR 테스트)
// 3 = 미국 규제 주 강제 (CCPA 테스트)
const DEBUG_GEOGRAPHY = 0;

// 테스트 기기 해시 ID (테스트 시 adb logcat | grep TestDeviceHashedId 로 확인 후 입력)
const DEBUG_TEST_DEVICES = [];

// 배너 로드 실패 시 최대 재시도 횟수 및 대기 시간
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 30_000; // 30초

// 보상형 광고 로드 대기 한도. 넘으면 광고 없이 진행
const REWARDED_LOAD_TIMEOUT_MS = 10_000;

const isAndroid = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

/**
 * showRewardedAd() 결과
 * - REWARDED:    끝까지 시청해 보상 획득
 * - DISMISSED:   보상 전에 사용자가 닫음
 * - UNAVAILABLE: 광고를 띄울 수 없음 (웹, 프리미엄, 동의 거부, 로드 실패 등)
 */
export const RewardResult = Object.freeze({
  REWARDED:    'rewarded',
  DISMISSED:   'dismissed',
  UNAVAILABLE: 'unavailable',
});

export const AdsService = {
  /** Initialize ads (called on app startup, only for non-premium users) */
  async init(isPremium) {
    if (isPremium) {
      this.hide();
      return;
    }

    if (isAndroid) {
      await this._initAdMobWithConsent();
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

  /** Settings 페이지에서 사용자가 동의를 재설정할 때 호출 */
  async showPrivacyOptions() {
    try {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) return;
      await AdMob.showPrivacyOptionsForm();
    } catch (e) {
      console.warn('[AdsService] showPrivacyOptionsForm failed:', e);
    }
  },

  /** 보상형 광고를 띄울 수 있는 상태인지 (Android + AdMob 초기화 완료 + 광고 단위 ID 설정) */
  isRewardedAvailable() {
    if (store.get('isPremium')) return false;
    return isAndroid && this._admobReady === true && (USE_TEST_ADS || !!REAL_REWARDED_ID);
  },

  /**
   * 보상형 광고를 로드해서 표시하고, 광고가 닫힌 뒤 RewardResult를 반환.
   * 광고를 띄울 수 없는 경우 예외 대신 UNAVAILABLE을 반환한다.
   */
  async showRewardedAd() {
    if (!this.isRewardedAvailable()) return RewardResult.UNAVAILABLE;
    const AdMob = window.Capacitor?.Plugins?.AdMob;
    if (!AdMob) return RewardResult.UNAVAILABLE;

    try {
      await _withTimeout(
        AdMob.prepareRewardVideoAd({
          adId: USE_TEST_ADS ? TEST_REWARDED_ID : REAL_REWARDED_ID,
          npa: false,
        }),
        REWARDED_LOAD_TIMEOUT_MS,
      );
    } catch (e) {
      console.warn('[AdsService] Rewarded ad load failed:', e?.message ?? e);
      return RewardResult.UNAVAILABLE;
    }

    // showRewardVideoAd()는 보상 시점에만 resolve되고 중간에 닫으면 끝나지 않으므로
    // 결과는 이벤트로 판정한다. 공유 시트가 광고 위에 뜨지 않도록 Dismissed까지 기다린다.
    return new Promise((resolve) => {
      let rewarded = false;
      let done = false;
      const handles = [];
      const finish = (result) => {
        if (done) return;
        done = true;
        // addListener는 Promise<PluginListenerHandle>를 반환
        handles.forEach(h => Promise.resolve(h).then(x => x?.remove?.()));
        resolve(result);
      };

      handles.push(AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
      handles.push(AdMob.addListener('onRewardedVideoAdDismissed', () => {
        finish(rewarded ? RewardResult.REWARDED : RewardResult.DISMISSED);
      }));
      handles.push(AdMob.addListener('onRewardedVideoAdFailedToShow', (e) => {
        console.warn('[AdsService] Rewarded ad failed to show:', e?.message ?? e);
        finish(RewardResult.UNAVAILABLE);
      }));

      AdMob.showRewardVideoAd().catch((e) => {
        console.warn('[AdsService] showRewardVideoAd threw:', e?.message ?? e);
        finish(RewardResult.UNAVAILABLE);
      });
    });
  },

  /** 마지막으로 캐시된 동의 정보의 privacyOptionsRequirementStatus 반환 */
  getPrivacyOptionsStatus() {
    return this._lastConsentInfo?.privacyOptionsRequirementStatus ?? null;
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

  /** UMP 동의 획득 후 광고를 초기화하는 진입점 */
  async _initAdMobWithConsent() {
    try {
      const AdMob = window.Capacitor?.Plugins?.AdMob;
      if (!AdMob) return;

      const canRequestAds = await this._requestConsent(AdMob);
      if (!canRequestAds) {
        console.warn('[AdsService] canRequestAds=false, skipping banner.');
        return;
      }

      await this._initAdMob();
    } catch (e) {
      console.warn('[AdsService] consent/init failed:', e);
    }
  },

  /**
   * UMP 동의 요청.
   * 동의 폼이 필요하면 표시하고, 광고 요청 가능 여부(canRequestAds)를 반환.
   */
  async _requestConsent(AdMob) {
    const info = await AdMob.requestConsentInfo({
      debugGeography: DEBUG_GEOGRAPHY,
      ...(DEBUG_TEST_DEVICES.length > 0 && { testDeviceIdentifiers: DEBUG_TEST_DEVICES }),
    });
    this._lastConsentInfo = info;

    if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
      const updated = await AdMob.showConsentForm();
      this._lastConsentInfo = updated;
      return updated.canRequestAds ?? false;
    }

    return info.canRequestAds ?? false;
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
      this._admobReady = true;

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

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

export default AdsService;
