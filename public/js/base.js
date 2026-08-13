/* ============================================================
   base.js — BASE_PATH 규약의 단일 진입점

   규칙 하나만 지키면 된다.
     "코드에 '/' 로 시작하는 URL을 직접 쓰지 않는다."

     ✗ fetch('/api/items')            ✗ history.pushState(null,'','/browse')
     ○ fetch(App.api('/items'))       ○ App.navigate('/browse')

   앱 내부에서 다루는 경로(routePath)는 항상 BASE_PATH가 벗겨진 형태다.
   브라우저 주소창에 올라가는 순간에만 App.url()로 BASE_PATH를 다시 붙인다.
   ============================================================ */
(function (global) {
    'use strict';

    var cfg = global.__APP_CONFIG__ || {};

    function normalizeBasePath(raw) {
        var value = String(raw == null ? '' : raw).trim();
        if (!value || value === '/') return '';
        if (value.charAt(0) !== '/') value = '/' + value;
        value = value.replace(/\/+$/, '');
        return value === '/' ? '' : value;
    }

    var BASE_PATH = normalizeBasePath(cfg.basePath);

    // 내부 경로 → 브라우저에 노출되는 절대 경로
    //   url('/browse')  →  '/browse'      (BASE_PATH = '')
    //                   →  '/app/browse'  (BASE_PATH = '/app')
    function url(routePath) {
        var p = routePath == null ? '/' : String(routePath);
        if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.indexOf('//') === 0) return p; // 외부 URL은 그대로
        if (p.charAt(0) !== '/') p = '/' + p;
        return (BASE_PATH + p) || '/';
    }

    // 정적 자산 URL (+ 캐시버스팅 토큰)
    function asset(routePath) {
        var u = url(routePath);
        if (!cfg.buildId) return u;
        return u + (u.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(cfg.buildId);
    }

    // API URL. '/api' 접두사를 여기서만 알고 있게 한다.
    function api(routePath) {
        var p = routePath == null ? '' : String(routePath);
        if (p && p.charAt(0) !== '/') p = '/' + p;
        return url('/api' + p);
    }

    // 브라우저 경로 → 내부 경로 (BASE_PATH 제거, 끝 슬래시 정리)
    function toRoutePath(pathname) {
        var p = pathname == null ? global.location.pathname : String(pathname);
        if (BASE_PATH && (p === BASE_PATH || p.indexOf(BASE_PATH + '/') === 0)) {
            p = p.slice(BASE_PATH.length) || '/';
        }
        if (p.charAt(0) !== '/') p = '/' + p;
        if (p.length > 1) p = p.replace(/\/+$/, '') || '/';
        return p;
    }

    function currentPath() {
        return toRoutePath(global.location.pathname);
    }

    function query(search) {
        return new URLSearchParams(search == null ? global.location.search : search);
    }

    global.App = {
        config: cfg,
        BASE_PATH: BASE_PATH,
        url: url,
        asset: asset,
        api: api,
        toRoutePath: toRoutePath,
        currentPath: currentPath,
        query: query,
        normalizeBasePath: normalizeBasePath
    };
})(window);
