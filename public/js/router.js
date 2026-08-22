/* ============================================================
   router.js — 경로 기반 SPA 라우터 (History API)

   · 라우터가 다루는 경로는 전부 BASE_PATH가 벗겨진 내부 경로다.
     주소창에 쓸 때만 App.url()로 다시 붙인다.
   · '/browse/:id' 형태의 파라미터를 지원한다.
   · hidden 라우트는 hideUnfinishedPages가 켜져 있으면 홈으로 되돌린다.
     (원본의 HIDE_UNFINISHED_PAGES 패턴 — 코드는 남기고 노출만 끈다)
   ============================================================ */
(function (App) {
    'use strict';

    var routes = [];
    var notFoundRoute = null;
    var current = null;
    var started = false;

    // '/browse/:id' → /^\/browse\/([^/]+)$/ + ['id']
    function compile(pattern) {
        var keys = [];
        var source = String(pattern)
            .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
            .replace(/\/:([A-Za-z0-9_]+)/g, function (m, name) {
                keys.push(name);
                return '/([^/]+)';
            });
        return { regex: new RegExp('^' + source + '$'), keys: keys };
    }

    function define(list) {
        routes = (list || []).map(function (route) {
            var compiled = compile(route.path);
            return Object.assign({}, route, { _regex: compiled.regex, _keys: compiled.keys });
        });
        notFoundRoute = routes.filter(function (r) { return r.notFound; })[0] || null;
        return routes;
    }

    function match(path) {
        for (var i = 0; i < routes.length; i++) {
            var route = routes[i];
            if (route.notFound) continue;
            var m = route._regex.exec(path);
            if (!m) continue;
            var params = {};
            for (var k = 0; k < route._keys.length; k++) {
                params[route._keys[k]] = decodeURIComponent(m[k + 1]);
            }
            return { route: route, params: params };
        }
        return null;
    }

    function isHidden(route) {
        return !!(route && route.hidden && App.config.hideUnfinishedPages);
    }

    // 화면을 실제로 그린다. 주소창은 건드리지 않는다.
    function render(path, search, state) {
        var routePath = App.toRoutePath(path);
        var found = match(routePath);
        var route = found ? found.route : notFoundRoute;
        var params = found ? found.params : {};

        if (!route) return null;

        if (isHidden(route)) {
            navigate('/', { replace: true });
            return null;
        }

        App.ui.showPage(route.page);
        App.ui.setActiveNav(route.nav);
        App.ui.setTitle(route.title);
        if (window.DoguUI) {
            DoguUI.setActiveNav(route.nav);          // routes.js navItems() 가 key 로 route.nav 를 줬다
            DoguUI.setHome(route.id === 'home');     // 홈 판정은 라우트 id 하나로 — 배경 오버레이 농도
        }
        window.scrollTo(0, 0);

        current = {
            route: route,
            path: routePath,
            params: params,
            query: App.query(search == null ? window.location.search : search),
            state: state || null
        };

        if (typeof route.onEnter === 'function') route.onEnter(current);
        return current;
    }

    // 주소창을 바꾸고 화면을 그린다. 앱 안의 모든 이동은 이 함수를 거친다.
    function navigate(path, options) {
        var opts = options || {};
        var raw = String(path == null ? '/' : path);
        var hashIndex = raw.indexOf('#');
        var hash = hashIndex === -1 ? '' : raw.slice(hashIndex);
        if (hashIndex !== -1) raw = raw.slice(0, hashIndex);

        var qIndex = raw.indexOf('?');
        var search = qIndex === -1 ? '' : raw.slice(qIndex);
        var routePath = App.toRoutePath(qIndex === -1 ? raw : raw.slice(0, qIndex));

        var target = App.url(routePath) + search + hash;
        var currentUrl = window.location.pathname + window.location.search + window.location.hash;

        if (target !== currentUrl) {
            if (opts.replace) window.history.replaceState(opts.state || null, '', target);
            else window.history.pushState(opts.state || null, '', target);
        }
        return render(routePath, search, opts.state);
    }

    // a[data-link]는 새로고침 없이 라우팅한다.
    function interceptLinks() {
        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            var link = e.target.closest ? e.target.closest('a[data-link]') : null;
            if (!link) return;

            var href = link.getAttribute('href');
            if (!href || href.charAt(0) === '#') return;
            if (link.target && link.target !== '_self') return;

            var target = new URL(href, window.location.href);
            if (target.origin !== window.location.origin) return;

            e.preventDefault();
            navigate(target.pathname + target.search + target.hash);
        });
    }

    function start() {
        if (started) return;
        started = true;
        interceptLinks();
        window.addEventListener('popstate', function (e) {
            render(App.currentPath(), window.location.search, e.state);
        });
        render(App.currentPath(), window.location.search, window.history.state);
    }

    App.router = {
        define: define,
        match: match,
        render: render,
        navigate: navigate,
        start: start,
        isHidden: isHidden,
        get routes() { return routes; },
        get current() { return current; }
    };

    App.navigate = navigate;
})(window.App);
