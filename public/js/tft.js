/* ============================================================
   tft.js — TFT 도메인 헬퍼 (정적 데이터 · 포맷터 · 조각 렌더러)

   서버 /api/static 이 내려주는 룩업 맵(챔피언/특성/아이템·증강)을 한 번만
   받아 캐시하고, app.js가 쓰는 HTML 조각 생성기를 모아 둔다.
   ============================================================ */
(function (App) {
    'use strict';

    var esc = App.ui.escapeHtml;

    var staticData = null;
    var staticPromise = null;

    function loadStatic() {
        if (staticData) return Promise.resolve(staticData);
        if (staticPromise) return staticPromise;
        staticPromise = App.api.get('/static').then(function (data) {
            staticData = data;
            return data;
        }, function (err) {
            staticPromise = null;   // 실패하면 다음에 다시 시도
            throw err;
        });
        return staticPromise;
    }

    function champ(id) {
        return (staticData && staticData.champs && staticData.champs[id]) || null;
    }
    function trait(name) {
        return (staticData && staticData.traits && staticData.traits[name]) || null;
    }
    function item(name) {
        return (staticData && staticData.items && staticData.items[name]) || null;
    }

    // ------------------------------------------------------------
    // 상수 · 포맷터
    // ------------------------------------------------------------
    var QUEUE_NAMES = {
        1090: '일반',
        1100: '랭크',
        1110: '튜토리얼',
        1130: '초고속 모드',
        1160: '더블 업'
    };

    function queueName(queueId, gameType) {
        if (QUEUE_NAMES[queueId]) return QUEUE_NAMES[queueId];
        if (gameType === 'turbo') return '초고속 모드';
        if (gameType === 'pairs') return '더블 업';
        return '일반';
    }

    var TIER_KO = {
        IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드',
        PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아몬드',
        MASTER: '마스터', GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저',
        UNRANKED: '언랭크',
        // 초고속 모드 ratedTier
        GRAY: '그레이', GREEN: '그린', BLUE: '블루', PURPLE: '퍼플', ORANGE: '오렌지'
    };

    function tierKo(tier) {
        return TIER_KO[String(tier || '').toUpperCase()] || tier || '';
    }

    function timeAgo(ts) {
        var diff = Date.now() - Number(ts || 0);
        if (diff < 0) diff = 0;
        var m = Math.floor(diff / 60000);
        if (m < 1) return '방금 전';
        if (m < 60) return m + '분 전';
        var h = Math.floor(m / 60);
        if (h < 24) return h + '시간 전';
        var d = Math.floor(h / 24);
        if (d < 30) return d + '일 전';
        return Math.floor(d / 30) + '달 전';
    }

    function fmtLength(sec) {
        sec = Math.max(0, Math.round(Number(sec) || 0));
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + '분 ' + (s < 10 ? '0' : '') + s + '초';
    }

    // 마지막 라운드 → "N-M" 스테이지 표기 (1스테이지 3라운드, 이후 7라운드)
    function fmtRound(lastRound) {
        var r = Number(lastRound) || 0;
        if (r <= 3) return '1-' + r;
        var rest = r - 3;
        var stage = Math.floor((rest - 1) / 7) + 2;
        var round = ((rest - 1) % 7) + 1;
        return stage + '-' + round;
    }

    function placementClass(p) {
        if (p === 1) return 'pl-1';
        if (p <= 4) return 'pl-top4';
        return 'pl-bottom';
    }

    function placementLabel(p) {
        return '#' + p;
    }

    // 유닛 rarity → 코스트 (정적 데이터가 없을 때의 폴백)
    var RARITY_TO_COST = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 4, 5: 5, 6: 5 };

    function unitCost(unit) {
        var c = champ(unit.id);
        if (c && c.cost) return Math.min(c.cost, 7);
        return RARITY_TO_COST[unit.rarity] || 1;
    }

    // 특성 style → 등급 클래스 (1 브론즈 / 2 실버 / 3 골드 / 4+ 프리즘)
    function traitStyleClass(style) {
        if (style >= 4) return 'ts-prism';
        if (style === 3) return 'ts-gold';
        if (style === 2) return 'ts-silver';
        return 'ts-bronze';
    }

    // ------------------------------------------------------------
    // HTML 조각 렌더러
    // ------------------------------------------------------------
    function unitHtml(unit) {
        var c = champ(unit.id);
        var name = c ? c.name : unit.id.replace(/^TFT\d*_/, '');
        var cost = unitCost(unit);
        var stars = '';
        var i;
        for (i = 0; i < (unit.tier || 1); i++) stars += '★';

        var itemsHtml = '';
        for (i = 0; i < unit.items.length && i < 3; i++) {
            var it = item(unit.items[i]);
            if (it && it.icon) {
                itemsHtml += '<img class="unit-item" src="' + esc(it.icon) + '" alt="" title="' + esc(it.name) + '" loading="lazy">';
            }
        }

        var title = name + ' (' + (unit.tier || 1) + '성)';
        if (unit.items.length) {
            title += ' — ' + unit.items.map(function (n) {
                var it2 = item(n);
                return it2 ? it2.name : n;
            }).join(', ');
        }

        return '<div class="unit cost-' + cost + '" title="' + esc(title) + '">' +
            '<div class="unit-stars tier-' + (unit.tier || 1) + '">' + stars + '</div>' +
            (c && c.icon
                ? '<img class="unit-icon" src="' + esc(c.icon) + '" alt="' + esc(name) + '" loading="lazy">'
                : '<div class="unit-icon unit-icon-fallback">' + esc(name.slice(0, 2)) + '</div>') +
            '<div class="unit-items">' + itemsHtml + '</div>' +
            '</div>';
    }

    function traitChipHtml(t) {
        var info = trait(t.name);
        var label = info ? info.name : t.name.replace(/^TFT\d*_/, '');
        return '<span class="trait-chip ' + traitStyleClass(t.style) + '" title="' + esc(label + ' ' + t.num) + '">' +
            (info && info.icon ? '<img class="trait-icon" src="' + esc(info.icon) + '" alt="" loading="lazy">' : '') +
            '<span class="trait-num">' + t.num + '</span> ' + esc(label) +
            '</span>';
    }

    function augmentHtml(name) {
        var info = item(name);
        var label = info ? info.name : name.replace(/^TFT\d*_Augment_?/, '');
        return '<span class="augment" title="' + esc(label) + '">' +
            (info && info.icon ? '<img class="augment-icon" src="' + esc(info.icon) + '" alt="" loading="lazy">' : '') +
            '<span class="augment-name">' + esc(label) + '</span>' +
            '</span>';
    }

    App.tft = {
        loadStatic: loadStatic,
        champ: champ,
        trait: trait,
        item: item,
        queueName: queueName,
        tierKo: tierKo,
        timeAgo: timeAgo,
        fmtLength: fmtLength,
        fmtRound: fmtRound,
        placementClass: placementClass,
        placementLabel: placementLabel,
        unitCost: unitCost,
        traitStyleClass: traitStyleClass,
        unitHtml: unitHtml,
        traitChipHtml: traitChipHtml,
        augmentHtml: augmentHtml
    };
})(window.App);
