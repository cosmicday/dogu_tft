/* ============================================================
   ui.js — 페이지 전환 · 토스트 · 흔들기 등 화면 공통 동작
   ============================================================ */
(function (App) {
    'use strict';

    var toastTimer = null;

    // 모든 .page-container를 끄고 하나만 켠다.
    function hideAllPages() {
        var pages = document.querySelectorAll('.page-container');
        for (var i = 0; i < pages.length; i++) pages[i].style.display = 'none';
    }

    function showPage(pageId) {
        hideAllPages();
        var el = document.getElementById(pageId);
        if (el) el.style.display = 'block';
        return el;
    }

    function setActiveNav(navId) {
        var items = document.querySelectorAll('.nav-item');
        for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
        if (!navId) return;
        var active = document.getElementById(navId);
        if (active) active.classList.add('active');
    }

    function setTitle(pageTitle) {
        var site = App.config.siteName || document.title;
        document.title = pageTitle ? pageTitle + ' - ' + site : site;
    }

    function showToast(message, ms) {
        var toast = document.getElementById('toast');
        if (!toast) return;
        if (message) toast.textContent = message;
        toast.classList.add('toast-show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('toast-show');
        }, ms || 3000);
    }

    // 입력 오류 피드백: 클래스를 뗐다가 리플로우를 강제한 뒤 다시 붙여야
    // 연속 입력에서도 애니메이션이 매번 재생된다.
    function shake(el) {
        if (!el) return;
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
    }

    function copyText(text, okMessage) {
        var done = function () { showToast(okMessage || '복사되었습니다: ' + text); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () {
                showToast('복사에 실패했습니다. 직접 복사해 주세요: ' + text);
            });
        } else {
            showToast('복사를 지원하지 않는 브라우저입니다: ' + text);
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loading(message) {
        return '<div class="loading">' + escapeHtml(message || '불러오는 중입니다...') + '</div>';
    }

    App.ui = {
        hideAllPages: hideAllPages,
        showPage: showPage,
        setActiveNav: setActiveNav,
        setTitle: setTitle,
        showToast: showToast,
        shake: shake,
        copyText: copyText,
        escapeHtml: escapeHtml,
        loading: loading
    };
})(window.App);
