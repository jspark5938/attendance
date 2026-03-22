/**
 * Hash-based SPA router
 *
 * Routes are matched against window.location.hash.
 * Each route has a handler(params) that returns a Page instance.
 *
 * Usage:
 *   router.register('/groups/:id', (params) => new GroupDetailPage(params));
 *   router.start();
 */

export class Router {
  constructor() {
    this._routes = [];
    this._currentPage = null;
    this._container = null;
    this._titleEl = null;
    this._subtitleEl = null;
    this._headerActionsEl = null;
  }

  /**
   * Set the DOM container where page content is rendered
   */
  setContainer(el) {
    this._container = el;
    return this;
  }

  /**
   * Register a route
   * @param {string} pattern  e.g. '/groups/:id/attend'
   * @param {Function} handler  (params, query) => PageInstance
   */
  register(pattern, handler) {
    this._routes.push({ pattern, handler, regex: _patternToRegex(pattern), keys: _extractKeys(pattern) });
    return this;
  }

  /**
   * Start listening to hashchange events
   */
  start() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  }

  /**
   * Navigate to a hash path
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Set page header content (title, subtitle, actions)
   */
  setHeader({ title = '', subtitle = '', actions = '' } = {}) {
    const titleEl    = document.querySelector('.page-title');
    const subtitleEl = document.querySelector('.page-subtitle');
    const actionsEl  = document.querySelector('.page-header-actions');
    const headerEl   = document.querySelector('.page-header');
    const mobileHeaderEl = document.querySelector('.mobile-header-title');

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
      subtitleEl.textContent = subtitle;
      subtitleEl.style.display = subtitle ? '' : 'none';
    }
    if (actionsEl) actionsEl.innerHTML = actions;
    if (headerEl) headerEl.style.display = '';
    if (mobileHeaderEl) mobileHeaderEl.textContent = title;
  }

  async _resolve() {
    const hash    = window.location.hash || '#/';
    const path    = hash.slice(1).split('?')[0] || '/';
    const queryStr = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const query   = _parseQuery(queryStr);

    for (const route of this._routes) {
      const match = path.match(route.regex);
      if (!match) continue;

      const params = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });

      // Destroy current page
      if (this._currentPage?.destroy) {
        try { this._currentPage.destroy(); } catch (e) { /* ignore */ }
      }

      // Clear container
      if (this._container) this._container.innerHTML = '';

      // Instantiate and mount new page
      try {
        const page = route.handler(params, query);
        this._currentPage = page;
        if (page.render && this._container) {
          const html = await page.render();
          if (html !== undefined) this._container.innerHTML = html;
        }
        if (page.mount) await page.mount();
      } catch (e) {
        console.error('[Router] page error:', e);
        if (this._container) {
          this._container.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">⚠</div>
              <div class="empty-state-title">페이지를 불러올 수 없습니다</div>
              <div class="empty-state-desc">${e.message || '알 수 없는 오류'}</div>
            </div>`;
        }
      }
      return;
    }

    // No route matched — show 404
    if (this._container) {
      this._container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">페이지를 찾을 수 없습니다</div>
          <div class="empty-state-desc"><a href="#/">홈으로 돌아가기</a></div>
        </div>`;
    }
  }
}

function _patternToRegex(pattern) {
  // 1단계: 정규식 특수문자 이스케이프 (단, : 제외)
  // 2단계: :param 패턴을 ([^/]+) 로 치환
  const escaped = pattern
    .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    .replace(/:(\w+)/g, '([^/]+)');
  return new RegExp(`^${escaped}$`);
}

function _extractKeys(pattern) {
  const keys = [];
  const re = /:(\w+)/g;
  let m;
  while ((m = re.exec(pattern)) !== null) keys.push(m[1]);
  return keys;
}

function _parseQuery(queryStr) {
  if (!queryStr) return {};
  const obj = {};
  queryStr.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) obj[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return obj;
}

export default Router;
