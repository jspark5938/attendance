/**
 * Ads service
 * Handles AdSense (web) and AdMob (Android) branching.
 *
 * On web: AdSense blocks are statically in HTML; this service just controls visibility.
 * On Android: AdMob plugin is called via Capacitor bridge.
 */

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
      const { AdMob, BannerAdSize, BannerAdPosition } = await import(
        'https://cdn.jsdelivr.net/npm/@capacitor-community/admob@4/dist/esm/index.js'
      ).catch(() => ({}));

      if (!AdMob) return;

      await AdMob.initialize({ testingDevices: [] });

      await AdMob.showBanner({
        adId: 'ca-app-pub-1007656354860622/8325774890',
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
      });
    } catch (e) {
      // AdMob not available in browser
    }
  },
};

export default AdsService;
