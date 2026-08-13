/* ============================================================
   app.js — 페이지 동작과 화면 배선 (TFT 전적검색)

   페이지: 홈(검색) · 소환사 전적 · 랭킹 · 약관/개인정보
   base/router/store/api/ui 는 dogu_template 그대로 재사용한다.
   ============================================================ */
(function (App) {
    'use strict';

    var esc = App.ui.escapeHtml;
    var tft = App.tft;

    var favorites = App.storage.createList('favorites', {
        max: 10,
        identify: function (item) { return item.id; }
    });
    var recents = App.storage.createList('recent', {
        max: 10,
        identify: function (item) { return item.id; }
    });

    var activeTab = 'favorites';

    // ------------------------------------------------------------
    // 홈 — 즐겨찾기/최근검색 드롭다운
    // ------------------------------------------------------------
    function renderDropdown() {
        var listEl = document.getElementById('dropdown-list');
        if (!listEl) return;

        var source = activeTab === 'favorites' ? favorites.all() : recents.all();
        var items = source.map(function (f) {
            return { key: f.id, text: f.id, href: '/summoner/' + encodeURIComponent(f.id) };
        });

        if (!items.length) {
            listEl.innerHTML = '<div class="dropdown-empty">저장된 소환사가 없습니다.</div>';
            return;
        }

        listEl.innerHTML = items.map(function (item) {
            return '<div class="dropdown-row">' +
                '<a class="dropdown-link" href="' + esc(App.url(item.href)) + '" data-link>' + esc(item.text) + '</a>' +
                '<button class="dropdown-del" type="button" data-key="' + esc(item.key) + '" title="삭제">✕</button>' +
                '</div>';
        }).join('');
    }

    function setTab(tab) {
        activeTab = tab;
        var tabs = document.querySelectorAll('.dropdown-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
        }
        renderDropdown();
    }

    function submitSearch() {
        var input = document.getElementById('search-input');
        var errorEl = document.getElementById('search-error');
        var value = (input.value || '').trim();

        if (!value) {
            if (errorEl) {
                errorEl.textContent = '소환사명을 입력해 주세요. (예: Hide on bush#KR1)';
                errorEl.style.display = 'block';
            }
            App.ui.shake(document.getElementById('search-box'));
            return;
        }
        if (errorEl) errorEl.style.display = 'none';
        hideSuggest();
        App.navigate('/summoner/' + encodeURIComponent(value));
    }

    // ------------------------------------------------------------
    // 홈 — 검색 자동완성 (서버에 축적된 소환사)
    // ------------------------------------------------------------
    var suggestTimer = null;

    function hideSuggest() {
        var el = document.getElementById('search-suggest');
        if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    }

    function renderSuggest(results) {
        var el = document.getElementById('search-suggest');
        if (!el) return;
        if (!results || !results.length) { hideSuggest(); return; }

        el.innerHTML = results.map(function (r) {
            var tierText = r.tier && r.tier !== 'UNRANKED'
                ? tft.tierKo(r.tier) + (r.rank ? ' ' + r.rank : '') + ' · ' + r.lp + ' LP'
                : '';
            return '<a class="suggest-row" href="' + esc(App.url('/summoner/' + encodeURIComponent(r.name))) + '" data-link>' +
                (r.icon ? '<img class="suggest-icon" src="' + esc(r.icon) + '" alt="" loading="lazy">' : '<span class="suggest-icon suggest-icon-empty"></span>') +
                '<span class="suggest-name">' + esc(r.name) + '</span>' +
                '<span class="suggest-tier">' + esc(tierText) + '</span>' +
                '</a>';
        }).join('');
        el.style.display = 'block';
    }

    function onSearchInput() {
        var input = document.getElementById('search-input');
        var q = (input.value || '').trim();
        if (suggestTimer) clearTimeout(suggestTimer);
        if (q.length < 2) { hideSuggest(); return; }

        suggestTimer = setTimeout(function () {
            App.api.get('/autocomplete?q=' + encodeURIComponent(q)).then(function (data) {
                // 응답이 늦게 와도 입력이 이미 바뀌었으면 버린다
                if ((input.value || '').trim() === q) renderSuggest(data && data.results);
            }, function () { /* 자동완성 실패는 조용히 무시 */ });
        }, 300);
    }

    // ------------------------------------------------------------
    // 소환사 페이지
    // ------------------------------------------------------------
    var summonerState = null;   // { puuid, name, history: [], nextStart, hasMore, loadingMore }

    function statsStripHtml(history) {
        if (!history.length) return '';
        var games = history.length;
        var sum = 0, firsts = 0, top4 = 0;
        for (var i = 0; i < games; i++) {
            var p = history[i].me.placement;
            sum += p;
            if (p === 1) firsts++;
            if (p <= 4) top4++;
        }
        return '<div class="stat-item"><span class="stat-label">최근</span><span class="stat-value">' + games + '게임</span></div>' +
            '<div class="stat-item"><span class="stat-label">평균 등수</span><span class="stat-value">#' + (sum / games).toFixed(2) + '</span></div>' +
            '<div class="stat-item"><span class="stat-label">1위</span><span class="stat-value">' + firsts + '회</span></div>' +
            '<div class="stat-item"><span class="stat-label">순방률</span><span class="stat-value">' + Math.round(top4 / games * 100) + '%</span></div>';
    }

    // 큐 필터 (매치 리스트 · 요약 · 그래프에 공통 적용)
    var QUEUE_FILTERS = [
        { key: 'ALL', label: '전체' },
        { key: 1100, label: '랭크' },
        { key: 1090, label: '일반' },
        { key: 1160, label: '더블 업' },
        { key: 1130, label: '초고속' }
    ];

    function filteredHistory() {
        if (!summonerState) return [];
        if (summonerState.filter === 'ALL') return summonerState.history;
        return summonerState.history.filter(function (e) { return e.queueId === summonerState.filter; });
    }

    function queueFilterHtml() {
        var current = summonerState ? summonerState.filter : 'ALL';
        return '<div class="rank-filters match-filters">' + QUEUE_FILTERS.map(function (f) {
            return '<button class="rank-filter' + (current === f.key ? ' active' : '') +
                '" type="button" data-qf="' + f.key + '">' + f.label + '</button>';
        }).join('') + '</div>';
    }

    // 최근 등수 추이 그래프 (최신 20게임, 왼쪽이 과거)
    function placementGraphHtml(history) {
        var recent = history.slice(0, 20).reverse();
        if (recent.length < 2) return '';

        var step = 30, padX = 14, padY = 12, plotH = 70;
        var w = padX * 2 + (recent.length - 1) * step;
        var h = padY * 2 + plotH;

        function x(i) { return padX + i * step; }
        function y(p) { return padY + (p - 1) / 7 * plotH; }

        var points = recent.map(function (e, i) { return x(i) + ',' + y(e.me.placement); }).join(' ');

        var dots = recent.map(function (e, i) {
            var cls = e.me.placement === 1 ? 'pg-dot-1' : (e.me.placement <= 4 ? 'pg-dot-top4' : 'pg-dot-bottom');
            return '<circle class="pg-dot ' + cls + '" cx="' + x(i) + '" cy="' + y(e.me.placement) + '" r="4">' +
                '<title>' + tft.placementLabel(e.me.placement) + ' · ' + esc(tft.queueName(e.queueId, e.gameType)) + '</title></circle>';
        }).join('');

        var guides = [1, 4, 8].map(function (p) {
            return '<line class="pg-guide" x1="' + padX + '" y1="' + y(p) + '" x2="' + (w - padX) + '" y2="' + y(p) + '"></line>' +
                '<text class="pg-label" x="2" y="' + (y(p) + 3) + '">' + p + '</text>';
        }).join('');

        return '<div class="pg-card">' +
            '<div class="pg-title">등수 추이 <span class="pg-hint">최근 ' + recent.length + '게임 · 왼쪽이 과거</span></div>' +
            '<div class="pg-scroll"><svg class="pg-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
            guides +
            '<polyline class="pg-line" points="' + points + '"></polyline>' +
            dots +
            '</svg></div></div>';
    }

    function leagueCardHtml(label, q, isTurbo) {
        var body;
        if (!q) {
            body = '<div class="league-tier tier-UNRANKED">언랭크</div>';
        } else if (isTurbo) {
            body = '<div class="league-tier rated-' + esc(q.ratedTier) + '">' + esc(tft.tierKo(q.ratedTier)) + '</div>' +
                '<div class="league-lp">' + Number(q.ratedRating).toLocaleString() + '점</div>' +
                '<div class="league-record">순방 ' + q.wins + ' · ' + (q.wins + q.losses) + '게임</div>';
        } else {
            var games = q.wins + q.losses;
            body = '<div class="league-tier tier-' + esc(q.tier) + '">' + esc(tft.tierKo(q.tier)) + (q.rank ? ' ' + esc(q.rank) : '') + '</div>' +
                '<div class="league-lp">' + Number(q.lp).toLocaleString() + ' LP</div>' +
                '<div class="league-record">순방 ' + q.wins + ' · ' + games + '게임' +
                (games > 0 ? ' (' + Math.round(q.wins / games * 100) + '%)' : '') + '</div>';
        }
        return '<div class="league-card"><div class="league-label">' + esc(label) + '</div>' + body + '</div>';
    }

    function matchRowHtml(entry) {
        var me = entry.me;
        var plClass = tft.placementClass(me.placement);

        var augments = me.augments.map(tft.augmentHtml).join('');
        var traits = me.traits.map(tft.traitChipHtml).join('');
        var units = me.units.map(tft.unitHtml).join('');

        return '<div class="match-block">' +
            '<div class="match-row ' + plClass + '" role="button" tabindex="0">' +
            '<div class="match-left">' +
            '<div class="match-place">' + tft.placementLabel(me.placement) + '</div>' +
            '<div class="match-queue">' + esc(tft.queueName(entry.queueId, entry.gameType)) + '</div>' +
            '<div class="match-time">' + esc(tft.timeAgo(entry.gameDatetime)) + '</div>' +
            '<div class="match-len">' + esc(tft.fmtLength(entry.gameLength)) + ' · ' + esc(tft.fmtRound(me.lastRound)) + '</div>' +
            '</div>' +
            '<div class="match-main">' +
            (augments ? '<div class="match-augments">' + augments + '</div>' : '') +
            '<div class="match-traits">' + traits + '</div>' +
            '<div class="match-units">' + units + '</div>' +
            '</div>' +
            '<div class="match-right">' +
            '<div class="match-lv">Lv ' + me.level + '</div>' +
            '<div class="match-dmg" title="플레이어에게 가한 피해">🗡 ' + Number(me.damage).toLocaleString() + '</div>' +
            '<div class="expand-caret">▾</div>' +
            '</div>' +
            '</div>' +
            '<div class="match-detail" hidden>' + matchDetailHtml(entry) + '</div>' +
            '</div>';
    }

    function matchDetailHtml(entry) {
        var rows = entry.participants.map(function (p) {
            var nameCell = p.name
                ? '<a class="detail-name" href="' + esc(App.url('/summoner/' + encodeURIComponent(p.name))) + '" data-link>' + esc(p.name) + '</a>'
                : '<span class="detail-name detail-name-unknown">알 수 없음</span>';
            var mine = summonerState && p.puuid === summonerState.puuid ? ' detail-row-me' : '';
            return '<tr class="detail-row' + mine + '">' +
                '<td class="detail-place ' + tft.placementClass(p.placement) + '">' + tft.placementLabel(p.placement) + '</td>' +
                '<td>' + nameCell + '</td>' +
                '<td class="detail-num">Lv ' + p.level + '</td>' +
                '<td class="detail-num">' + esc(tft.fmtRound(p.lastRound)) + '</td>' +
                '<td class="detail-num">' + Number(p.damage).toLocaleString() + '</td>' +
                '<td class="detail-units"><div class="match-units">' + p.units.map(tft.unitHtml).join('') + '</div></td>' +
                '</tr>';
        }).join('');

        return '<div class="detail-scroll"><table class="detail-table">' +
            '<thead><tr><th>순위</th><th>소환사</th><th>레벨</th><th>라운드</th><th>딜량</th><th>덱</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    // 요약 · 그래프 · 큐 필터 · 매치 리스트 (필터가 바뀔 때마다 통째로 다시 그린다)
    function renderMatchArea() {
        var area = document.getElementById('match-area');
        if (!area || !summonerState) return;

        var shown = filteredHistory();
        area.innerHTML =
            '<div class="stats-strip" id="stats-strip">' + (statsStripHtml(shown) || '<span class="stat-label">해당 큐의 게임이 없습니다.</span>') + '</div>' +
            placementGraphHtml(shown) +
            queueFilterHtml() +
            '<div class="match-list" id="match-list">' +
            (shown.length
                ? shown.map(matchRowHtml).join('')
                : '<div class="empty">해당하는 전적이 없습니다.</div>') +
            '</div>' +
            (summonerState.hasMore ? '<button class="more-btn" type="button" id="more-btn">전적 더 보기</button>' : '');
    }

    function renderSummoner(data) {
        var body = document.getElementById('summoner-body');
        if (!body) return;

        var prevFilter = summonerState ? summonerState.filter : 'ALL';
        summonerState = {
            puuid: data.puuid,
            name: data.profile.name,
            history: data.history.slice(),
            nextStart: data.history.length,
            hasMore: data.history.length >= 10 && !data.stale,
            loadingMore: false,
            filter: prevFilter
        };

        var starred = favorites.has({ id: data.profile.name });

        var html =
            (data.stale ? '<div class="stale-banner">요청 한도 초과로 저장된 데이터를 표시하고 있습니다. 잠시 후 다시 검색해 주세요.</div>' : '') +
            '<div class="profile-card">' +
            (data.profile.icon
                ? '<img class="profile-icon" src="' + esc(data.profile.icon) + '" alt="">'
                : '<div class="profile-icon profile-icon-empty"></div>') +
            '<div class="profile-info">' +
            '<div class="profile-name">' + esc(data.profile.name) +
            '<button class="fav-btn' + (starred ? ' on' : '') + '" type="button" id="fav-btn">' + (starred ? '★' : '☆') + '</button>' +
            '</div>' +
            '<div class="profile-meta">' +
            (data.profile.level ? '레벨 ' + data.profile.level : '') +
            (data.profile.serverRank ? ' · KR 랭킹 ' + Number(data.profile.serverRank).toLocaleString() + '위' : '') +
            '</div>' +
            '</div>' +
            '<button class="refresh-btn" type="button" id="refresh-btn" title="캐시를 건너뛰고 최신 전적을 불러옵니다">전적 갱신</button>' +
            '</div>' +
            '<div class="league-cards">' +
            leagueCardHtml('랭크', data.queues.RANKED_TFT, false) +
            leagueCardHtml('더블 업', data.queues.RANKED_TFT_DOUBLE_UP, false) +
            leagueCardHtml('초고속 모드', data.queues.RANKED_TFT_TURBO, true) +
            '</div>' +
            '<div id="match-area"></div>';

        body.innerHTML = html;
        renderMatchArea();
    }

    function loadSummonerPage(riotId, refresh) {
        var body = document.getElementById('summoner-body');
        if (body && !refresh) body.innerHTML = App.ui.loading('전적을 불러오는 중입니다...');

        var refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '갱신 중...'; }

        Promise.all([
            tft.loadStatic().catch(function () { return null; }),   // 정적 데이터가 늦어도 전적은 보여준다
            App.api.get('/search/' + encodeURIComponent(riotId) + (refresh ? '?refresh=1' : ''))
        ]).then(function (results) {
            var data = results[1];
            recents.add({ id: data.profile.name, at: Date.now() });
            renderSummoner(data);
            if (refresh) App.ui.showToast('전적을 갱신했습니다.');
        }, function (err) {
            if (refresh) {
                var btn = document.getElementById('refresh-btn');
                if (btn) { btn.disabled = false; btn.textContent = '전적 갱신'; }
                App.ui.showToast(err.message);
                return;
            }
            if (!body) return;
            body.innerHTML = '<div class="error-box">' +
                '<div class="error-msg">' + esc(err.message) + '</div>' +
                '<button class="more-btn" type="button" id="retry-btn">다시 시도</button>' +
                '</div>';
        });
    }

    function loadMoreMatches() {
        if (!summonerState || summonerState.loadingMore || !summonerState.hasMore) return;
        summonerState.loadingMore = true;

        var btn = document.getElementById('more-btn');
        if (btn) { btn.disabled = true; btn.textContent = '불러오는 중...'; }

        App.api.get('/matches/' + encodeURIComponent(summonerState.puuid) +
            '?start=' + summonerState.nextStart + '&count=10')
            .then(function (data) {
                summonerState.loadingMore = false;
                summonerState.nextStart = data.nextStart;
                summonerState.hasMore = data.hasMore;
                summonerState.history = summonerState.history.concat(data.history);
                renderMatchArea();
            }, function (err) {
                summonerState.loadingMore = false;
                if (btn) { btn.disabled = false; btn.textContent = '전적 더 보기'; }
                App.ui.showToast(err.message);
            });
    }

    // ------------------------------------------------------------
    // 랭킹 페이지
    // ------------------------------------------------------------
    var rankingState = null;   // { players, updatedAt, filter, page }
    var RANKING_PAGE_SIZE = 100;

    var TIER_FILTERS = [
        { key: 'ALL', label: '전체' },
        { key: 'CHALLENGER', label: '챌린저' },
        { key: 'GRANDMASTER', label: '그랜드마스터' },
        { key: 'MASTER', label: '마스터' }
    ];

    function renderRanking() {
        var body = document.getElementById('ranking-body');
        if (!body || !rankingState) return;

        var st = rankingState;
        var players = st.filter === 'ALL'
            ? st.players
            : st.players.filter(function (p) { return p.tier === st.filter; });

        var totalPages = Math.max(1, Math.ceil(players.length / RANKING_PAGE_SIZE));
        if (st.page >= totalPages) st.page = totalPages - 1;
        var pageItems = players.slice(st.page * RANKING_PAGE_SIZE, (st.page + 1) * RANKING_PAGE_SIZE);

        var filterHtml = '<div class="rank-filters">' + TIER_FILTERS.map(function (f) {
            return '<button class="rank-filter' + (st.filter === f.key ? ' active' : '') +
                '" type="button" data-filter="' + f.key + '">' + f.label + '</button>';
        }).join('') + '</div>';

        var rowsHtml = pageItems.map(function (p) {
            var games = p.wins + p.losses;
            var nameCell = p.name
                ? '<a class="rank-name" href="' + esc(App.url('/summoner/' + encodeURIComponent(p.name))) + '" data-link>' + esc(p.name) + '</a>'
                : '<span class="rank-name rank-name-pending">집계 중…</span>';
            return '<tr>' +
                '<td class="rank-no">' + p.rank + '</td>' +
                '<td>' + nameCell + '</td>' +
                '<td><span class="tier-badge tier-' + esc(p.tier) + '">' + esc(tft.tierKo(p.tier)) + '</span></td>' +
                '<td class="detail-num">' + Number(p.lp).toLocaleString() + ' LP</td>' +
                '<td class="detail-num">' + (games > 0 ? Math.round(p.wins / games * 100) + '%' : '-') + '</td>' +
                '<td class="detail-num">' + p.wins + ' / ' + games + '</td>' +
                '</tr>';
        }).join('');

        var pagerHtml = '<div class="rank-pager">' +
            '<button class="pager-btn" type="button" data-page="prev"' + (st.page === 0 ? ' disabled' : '') + '>◀</button>' +
            '<span class="pager-info">' + (st.page + 1) + ' / ' + totalPages + '</span>' +
            '<button class="pager-btn" type="button" data-page="next"' + (st.page >= totalPages - 1 ? ' disabled' : '') + '>▶</button>' +
            '</div>';

        body.innerHTML = filterHtml +
            (pageItems.length
                ? '<div class="detail-scroll"><table class="rank-table">' +
                '<thead><tr><th>#</th><th>소환사</th><th>티어</th><th>LP</th><th>순방률</th><th>순방 / 게임</th></tr></thead>' +
                '<tbody>' + rowsHtml + '</tbody></table></div>' + pagerHtml
                : '<div class="empty">랭킹 데이터를 준비 중입니다. 잠시 후 새로고침해 주세요.</div>');
    }

    // ------------------------------------------------------------
    // 통계 페이지 (유닛 / 시너지 / 아이템)
    // ------------------------------------------------------------
    var statsState = null;   // { data, tab, sort }

    var STATS_TABS = [
        { key: 'units', label: '유닛' },
        { key: 'traits', label: '시너지' },
        { key: 'items', label: '아이템' }
    ];

    function pct(v) { return (v * 100).toFixed(1) + '%'; }

    function statsNameCell(tab, row) {
        if (tab === 'units') {
            var c = tft.champ(row.id);
            var name = c ? c.name : row.id.replace(/^TFT\d*_/, '');
            var cost = c && c.cost ? Math.min(c.cost, 7) : 1;
            return '<div class="stats-name cost-' + cost + '">' +
                (c && c.icon ? '<img class="unit-icon stats-icon" src="' + esc(c.icon) + '" alt="" loading="lazy">' : '') +
                '<span>' + esc(name) + '</span></div>';
        }
        if (tab === 'traits') {
            var t = tft.trait(row.id);
            return '<div class="stats-name">' +
                (t && t.icon ? '<img class="trait-icon stats-trait-icon" src="' + esc(t.icon) + '" alt="" loading="lazy">' : '') +
                '<span>' + esc(t ? t.name : row.id.replace(/^TFT\d*_/, '')) + '</span></div>';
        }
        var it = tft.item(row.id);
        return '<div class="stats-name">' +
            (it && it.icon ? '<img class="unit-item stats-item-icon" src="' + esc(it.icon) + '" alt="" loading="lazy">' : '') +
            '<span>' + esc(it ? it.name : row.id.replace(/^TFT_Item_/, '')) + '</span></div>';
    }

    function renderStats() {
        var body = document.getElementById('stats-body');
        if (!body || !statsState) return;

        var data = statsState.data;
        var desc = document.getElementById('stats-desc');

        if (!data || data.building || !data.units || !data.units.length) {
            if (desc) desc.textContent = '상위 랭커의 랭크 게임을 수집해 집계합니다.';
            body.innerHTML = '<div class="empty">아직 표본을 수집하는 중입니다' +
                (data && data.sample ? ' (현재 ' + data.sample + '게임)' : '') +
                '. 잠시 후 다시 확인해 주세요.</div>';
            return;
        }

        if (desc) {
            desc.textContent = '세트 ' + data.setNumber + ' · 상위 랭커 랭크 게임 ' + Number(data.sample).toLocaleString() +
                '게임 표본 · ' + tft.timeAgo(data.updatedAt) + ' 갱신';
        }

        var tab = statsState.tab;
        var rows = (data[tab] || []).slice();
        if (statsState.sort === 'pick') rows.sort(function (a, b) { return b.games - a.games; });
        else rows.sort(function (a, b) { return a.avgPlacement - b.avgPlacement; });

        var tabsHtml = '<div class="rank-filters">' + STATS_TABS.map(function (t) {
            return '<button class="rank-filter' + (tab === t.key ? ' active' : '') +
                '" type="button" data-stats-tab="' + t.key + '">' + t.label + '</button>';
        }).join('') +
            '<span class="stats-sort">' +
            '<button class="rank-filter' + (statsState.sort === 'avg' ? ' active' : '') + '" type="button" data-stats-sort="avg">평균 등수순</button>' +
            '<button class="rank-filter' + (statsState.sort === 'pick' ? ' active' : '') + '" type="button" data-stats-sort="pick">픽률순</button>' +
            '</span></div>';

        var headExtra = tab === 'units' ? '<th>추천 아이템</th>' : '';
        var rowsHtml = rows.map(function (r, i) {
            var itemsCell = '';
            if (tab === 'units') {
                itemsCell = '<td><div class="stats-items">' + (r.items || []).map(function (n) {
                    var it = tft.item(n);
                    return it && it.icon
                        ? '<img class="unit-item" src="' + esc(it.icon) + '" alt="" title="' + esc(it.name) + '" loading="lazy">'
                        : '';
                }).join('') + '</div></td>';
            }
            return '<tr>' +
                '<td class="rank-no">' + (i + 1) + '</td>' +
                '<td>' + statsNameCell(tab, r) + '</td>' +
                '<td class="detail-num">' + pct(r.pickRate) + '</td>' +
                '<td class="detail-num stats-avg">#' + r.avgPlacement.toFixed(2) + '</td>' +
                '<td class="detail-num">' + pct(r.top4Rate) + '</td>' +
                '<td class="detail-num">' + pct(r.winRate) + '</td>' +
                itemsCell +
                '</tr>';
        }).join('');

        body.innerHTML = tabsHtml +
            '<div class="detail-scroll"><table class="rank-table stats-table">' +
            '<thead><tr><th>#</th><th>' + (tab === 'units' ? '챔피언' : tab === 'traits' ? '시너지' : '아이템') + '</th>' +
            '<th>픽률</th><th>평균 등수</th><th>순방률</th><th>1위율</th>' + headExtra + '</tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table></div>' +
            '<p class="stats-note">픽률은 보드(참가자) 기준입니다. 표본이 적은 항목(' +
            '게임 수 하위)은 집계에서 제외됩니다.</p>';
    }

    // ------------------------------------------------------------
    // 라우트 진입 핸들러
    // ------------------------------------------------------------
    App.pages = {
        home: function () {
            renderDropdown();
            hideSuggest();
            var input = document.getElementById('search-input');
            if (input) input.value = '';
            var errorEl = document.getElementById('search-error');
            if (errorEl) errorEl.style.display = 'none';
        },

        summoner: function (ctx) {
            var riotId = ctx.params.riotId || '';
            App.ui.setTitle(riotId + ' - 전적검색');
            summonerState = null;   // 다른 소환사로 넘어오면 큐 필터도 초기화
            loadSummonerPage(riotId, false);
        },

        ranking: function () {
            var body = document.getElementById('ranking-body');
            if (body) body.innerHTML = App.ui.loading('랭킹을 불러오는 중입니다...');

            Promise.all([
                tft.loadStatic().catch(function () { return null; }),
                App.api.get('/ranking')
            ]).then(function (results) {
                var data = results[1];
                rankingState = {
                    players: data.players || [],
                    updatedAt: data.updatedAt,
                    filter: (rankingState && rankingState.filter) || 'ALL',
                    page: 0
                };
                var updated = document.getElementById('ranking-updated');
                if (updated && data.updatedAt) {
                    updated.textContent = 'KR 서버 랭크 TFT 상위 랭커 — ' + tft.timeAgo(data.updatedAt) + ' 갱신';
                }
                renderRanking();
            }, function (err) {
                if (body) body.innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
            });
        },

        stats: function () {
            var body = document.getElementById('stats-body');
            if (body) body.innerHTML = App.ui.loading('통계를 불러오는 중입니다...');

            Promise.all([
                tft.loadStatic().catch(function () { return null; }),
                App.api.get('/stats')
            ]).then(function (results) {
                statsState = {
                    data: results[1],
                    tab: (statsState && statsState.tab) || 'units',
                    sort: (statsState && statsState.sort) || 'avg'
                };
                renderStats();
            }, function (err) {
                if (body) body.innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
            });
        },

        doc: function () { /* 정적 문서 페이지 — 추가 동작 없음 */ }
    };

    // ------------------------------------------------------------
    // 부팅
    // ------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        App.router.define(App.routes);
        App.renderNav();

        var searchBtn = document.getElementById('search-btn');
        var searchInput = document.getElementById('search-input');
        if (searchBtn) searchBtn.addEventListener('click', submitSearch);
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') submitSearch();
                if (e.key === 'Escape') hideSuggest();
            });
            searchInput.addEventListener('input', onSearchInput);
        }

        // 자동완성 바깥 클릭 시 닫기 (제안 링크 클릭은 라우터가 가로챈 뒤에 닫힌다)
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#search-suggest') && !e.target.closest('#search-box')) hideSuggest();
        });

        var dropdown = document.getElementById('search-dropdown');
        if (dropdown) {
            dropdown.addEventListener('click', function (e) {
                var tab = e.target.closest('.dropdown-tab');
                if (tab) { setTab(tab.getAttribute('data-tab')); return; }

                var del = e.target.closest('.dropdown-del');
                if (del) {
                    var key = del.getAttribute('data-key');
                    if (activeTab === 'favorites') favorites.remove({ id: key });
                    else recents.remove({ id: key });
                    renderDropdown();
                }
            });
        }

        // 소환사 페이지 위임 배선 (내용이 통째로 갈리므로 컨테이너에 건다)
        var summonerBody = document.getElementById('summoner-body');
        if (summonerBody) {
            summonerBody.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;   // 링크는 라우터에 맡긴다

                var fav = e.target.closest('#fav-btn');
                if (fav && summonerState) {
                    favorites.toggle({ id: summonerState.name });
                    var on = favorites.has({ id: summonerState.name });
                    fav.classList.toggle('on', on);
                    fav.textContent = on ? '★' : '☆';
                    App.ui.showToast(on ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 제거했습니다.');
                    return;
                }

                if (e.target.closest('#more-btn')) { loadMoreMatches(); return; }

                if (e.target.closest('#refresh-btn')) {
                    if (summonerState) loadSummonerPage(summonerState.name, true);
                    return;
                }

                var qf = e.target.closest('[data-qf]');
                if (qf && summonerState) {
                    var raw = qf.getAttribute('data-qf');
                    summonerState.filter = raw === 'ALL' ? 'ALL' : Number(raw);
                    renderMatchArea();
                    return;
                }

                if (e.target.closest('#retry-btn')) {
                    var current = App.router.current;
                    if (current) App.pages.summoner(current);
                    return;
                }

                var row = e.target.closest('.match-row');
                if (row) {
                    var detail = row.parentElement.querySelector('.match-detail');
                    if (detail) {
                        detail.hidden = !detail.hidden;
                        row.classList.toggle('expanded', !detail.hidden);
                    }
                }
            });
        }

        // 랭킹 페이지 위임 배선
        var rankingBody = document.getElementById('ranking-body');
        if (rankingBody) {
            rankingBody.addEventListener('click', function (e) {
                var filter = e.target.closest('.rank-filter');
                if (filter && rankingState) {
                    rankingState.filter = filter.getAttribute('data-filter');
                    rankingState.page = 0;
                    renderRanking();
                    return;
                }
                var pager = e.target.closest('.pager-btn');
                if (pager && !pager.disabled && rankingState) {
                    rankingState.page += pager.getAttribute('data-page') === 'next' ? 1 : -1;
                    renderRanking();
                    window.scrollTo(0, 0);
                }
            });
        }

        // 통계 페이지 위임 배선 (탭 · 정렬)
        var statsBody = document.getElementById('stats-body');
        if (statsBody) {
            statsBody.addEventListener('click', function (e) {
                var tabBtn = e.target.closest('[data-stats-tab]');
                if (tabBtn && statsState) {
                    statsState.tab = tabBtn.getAttribute('data-stats-tab');
                    renderStats();
                    return;
                }
                var sortBtn = e.target.closest('[data-stats-sort]');
                if (sortBtn && statsState) {
                    statsState.sort = sortBtn.getAttribute('data-stats-sort');
                    renderStats();
                }
            });
        }

        var contact = document.getElementById('contact-link');
        if (contact) {
            contact.addEventListener('click', function (e) {
                e.preventDefault();
                var email = App.config.contactEmail || '';
                App.ui.copyText(email, '이메일 주소(' + email + ')가 클립보드에 복사되었습니다.');
            });
        }

        setTab('favorites');
        App.router.start();

        // 홈에 먼저 들어온 사용자를 위해 정적 데이터를 미리 데워 둔다
        tft.loadStatic().catch(function () { /* 실패해도 페이지 진입 시 재시도 */ });
    });
})(window.App);
