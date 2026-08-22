/* ============================================================
   routes.js — 라우트 표 (이 파일 하나가 사이트 지도)

   라우트 하나를 추가하면 주소·화면·메뉴·진입 동작이 한꺼번에 정의된다.
   메뉴는 renderNav()가 이 표를 보고 그린다.
   ============================================================ */
(function (App) {
    'use strict';

    function page(name) {
        // app.js가 나중에 로드되므로 호출 시점에 조회한다.
        return function (ctx) {
            var fn = App.pages && App.pages[name];
            if (typeof fn === 'function') fn(ctx);
        };
    }

    var ROUTES = [
        {
            id: 'home',
            path: '/',
            page: 'page-home',
            nav: 'nav-home',
            label: '홈',
            inNav: true,
            onEnter: page('home')
        },
        {
            id: 'summoner',
            path: '/summoner/:riotId',
            page: 'page-summoner',
            nav: 'nav-home',
            title: '전적검색',
            onEnter: page('summoner')
        },
        {
            id: 'ranking',
            path: '/ranking',
            page: 'page-ranking',
            nav: 'nav-ranking',
            label: '랭킹',
            title: '랭킹',
            inNav: true,
            onEnter: page('ranking')
        },
        {
            id: 'stats',
            path: '/stats',
            page: 'page-stats',
            nav: 'nav-stats',
            label: '통계',
            title: '통계',
            inNav: true,
            onEnter: page('stats')
        },
        { id: 'terms', path: '/terms', page: 'page-terms', title: '이용약관', onEnter: page('doc') },
        { id: 'privacy', path: '/privacy', page: 'page-privacy', title: '개인정보 처리방침', onEnter: page('doc') },
        { id: 'notfound', path: '/__notfound', page: 'page-notfound', title: '404', notFound: true }
    ];

    // 공통 헤더(DoguUI.mountHeader)의 2단 네비 항목. key 는 route.nav 와 같아서
    // router.js 가 DoguUI.setActiveNav(route.nav) 로 활성 표시를 맞춘다.
    function navItems() {
        return ROUTES
            .filter(function (r) { return r.inNav && !App.router.isHidden(r); })
            .map(function (r) {
                return { key: r.nav, label: r.label, href: App.url(r.path) };
            });
    }

    App.routes = ROUTES;
    App.navItems = navItems;
})(window.App);
