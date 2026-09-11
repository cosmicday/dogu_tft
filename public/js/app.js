/* ============================================================
   app.js — 페이지 동작과 화면 배선 (TFT 전적검색)

   페이지: 홈(검색 + 랭킹/통계 위젯) · 소환사 전적 · 랭킹 · 통계 · 약관/개인정보
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

    var SEARCH_PLACEHOLDER = '소환사명#태그 (예: Hide on bush#KR1)';

    // ------------------------------------------------------------
    // 홈 — 검색 제출 (헤더 1단 검색창 · 히어로 검색창 공통)
    //   빈 검색어 흔들기는 공통 파일이 처리한다. 여기엔 값이 있을 때만 온다.
    // ------------------------------------------------------------
    function submitSearch(query) {
        var value = (query || '').trim();
        if (!value) return;
        if (window.DoguUI) DoguUI.showSearchError('');
        hideSuggest();
        App.navigate('/summoner/' + encodeURIComponent(value));
    }

    // 공통 드롭다운(즐겨찾기/최근 검색)에 넘길 어댑터. 저장 형식은 { id } 그대로다.
    function listAdapter(list) {
        return {
            all: function () { return list.all(); },
            remove: function (key) { list.remove({ id: key }); }
        };
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
        var input = document.getElementById('dogu-search-input');
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

        // 공통 스크롤 래퍼 — 펼칠 때 DoguUI.scrollHint 를 불러 오른쪽 페이드를 붙인다 (S-2, DOGU_UI.md 15-1)
        return '<p class="dogu-scroll-hint">옆으로 밀어 더 볼 수 있습니다</p>' +
            '<div class="dogu-scroll-wrap"><table class="detail-table">' +
            '<thead><tr><th>순위</th><th>소환사</th><th class="num">레벨</th><th class="num">라운드</th><th class="num">딜량</th><th>덱</th></tr></thead>' +
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
                : DoguUI.emptyHtml({ icon: '🎮', title: '해당하는 전적이 없습니다', body: '다른 큐를 고르거나 전적 갱신을 눌러 최신 게임을 불러오세요.' })) +
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
        if (body && !refresh) body.innerHTML = '<div class="skel-box">' + DoguUI.skelRowsHtml(8) + '</div>';   // M-7: 글자 한 줄 대신 자리막이

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
            body.innerHTML = DoguUI.emptyHtml({ icon: '⚠️', title: '전적을 불러오지 못했습니다', body: err.message, retry: { text: '다시 시도', id: 'retry-btn' } });
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
    // 랭킹 페이지 — 표 + aside(닉네임 찾기 · 커트라인) 2단 (M-1). 행 렌더는 홈 위젯과 공유한다
    // ------------------------------------------------------------
    var rankingState = null;   // { players, updatedAt, filter, page, hit }
    var RANKING_PAGE_SIZE = 100;
    var SCROLL_HINT = '<p class="dogu-scroll-hint">옆으로 밀어 더 볼 수 있습니다</p>';

    var TIER_FILTERS = [
        { key: 'ALL', label: '전체' },
        { key: 'CHALLENGER', label: '챌린저' },
        { key: 'GRANDMASTER', label: '그랜드마스터' },
        { key: 'MASTER', label: '마스터' }
    ];

    function setMeta(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text || '';
    }

    function tierFilterHtml(current) {
        return '<div class="rank-filters">' + TIER_FILTERS.map(function (f) {
            return '<button class="rank-filter' + (current === f.key ? ' active' : '') +
                '" type="button" data-filter="' + f.key + '">' + f.label + '</button>';
        }).join('') + '</div>';
    }

    // 랭킹 행 하나. compact = 홈 위젯(순방/게임 열 없음)
    function rankRowHtml(p, compact) {
        var games = p.wins + p.losses;
        var nameCell = p.name
            ? '<a class="rank-name" href="' + esc(App.url('/summoner/' + encodeURIComponent(p.name))) + '" data-link>' + esc(p.name) + '</a>'
            : '<span class="rank-name rank-name-pending">집계 중…</span>';
        var hit = !compact && rankingState && rankingState.hit === p.rank;
        return '<tr data-rank="' + p.rank + '"' + (hit ? ' class="rank-row-hit"' : '') + '>' +
            '<td class="rank-no">' + p.rank + '</td>' +
            '<td class="rank-name-cell">' + nameCell + '</td>' +
            '<td><span class="tier-text tier-' + esc(p.tier) + '">' + esc(tft.tierKo(p.tier)) + '</span></td>' +
            '<td class="detail-num">' + Number(p.lp).toLocaleString() + ' LP</td>' +
            '<td class="detail-num">' + (games > 0 ? Math.round(p.wins / games * 100) + '%' : '-') + '</td>' +
            (compact ? '' : '<td class="detail-num col-games">' + p.wins + ' / ' + games + '</td>') +
            '</tr>';
    }

    function rankTableHtml(players, compact) {
        return '<table class="rank-table' + (compact ? ' compact' : '') + '">' +
            '<thead><tr><th class="col-no">#</th><th class="col-name">소환사</th><th class="col-tier">티어</th>' +
            '<th class="num col-lp">LP</th><th class="num col-top4">순방률</th>' +
            (compact ? '' : '<th class="num col-games">순방 / 게임</th>') + '</tr></thead>' +
            '<tbody>' + players.map(function (p) { return rankRowHtml(p, compact); }).join('') + '</tbody></table>';
    }

    // 숫자 페이지 5개 + ◀▶ (m-7). 한 페이지뿐이면 그리지 않는다
    function pagerHtml(page, totalPages) {
        if (totalPages <= 1) return '';
        var first = Math.max(0, Math.min(page - 2, totalPages - 5));
        var last = Math.min(totalPages, first + 5);
        var nums = '';
        for (var i = first; i < last; i++) {
            nums += '<button class="pager-btn' + (i === page ? ' active' : '') + '" type="button" data-page="' + i + '"' +
                (i === page ? ' aria-current="page"' : '') + ' aria-label="' + (i + 1) + '페이지">' + (i + 1) + '</button>';
        }
        return '<nav class="rank-pager" aria-label="랭킹 페이지">' +
            '<button class="pager-btn" type="button" data-page="prev" aria-label="이전 페이지"' + (page === 0 ? ' disabled' : '') + '>◀</button>' +
            nums +
            '<button class="pager-btn" type="button" data-page="next" aria-label="다음 페이지"' + (page >= totalPages - 1 ? ' disabled' : '') + '>▶</button>' +
            '</nav>';
    }

    function filteredPlayers(st) {
        return st.filter === 'ALL' ? st.players : st.players.filter(function (p) { return p.tier === st.filter; });
    }

    function renderRanking() {
        var main = document.getElementById('rank-main');
        if (!main || !rankingState) return;

        var st = rankingState;
        var players = filteredPlayers(st);
        var totalPages = Math.max(1, Math.ceil(players.length / RANKING_PAGE_SIZE));
        if (st.page >= totalPages) st.page = totalPages - 1;
        var pageItems = players.slice(st.page * RANKING_PAGE_SIZE, (st.page + 1) * RANKING_PAGE_SIZE);

        var bodyHtml;
        if (!st.players.length) {
            bodyHtml = DoguUI.emptyHtml({ icon: '🏆', title: '랭킹을 준비하는 중입니다', body: '10분마다 갱신됩니다. 잠시 후 다시 확인해 주세요.', retry: { text: '다시 확인', id: 'ranking-retry' } });
        } else if (!pageItems.length) {
            bodyHtml = DoguUI.emptyHtml({ icon: '🏆', title: '이 티어의 랭커가 아직 없습니다', body: '다른 티어를 고르거나 잠시 후 다시 확인해 주세요.' });
        } else {
            bodyHtml = SCROLL_HINT + '<div class="dogu-scroll-wrap" id="rank-wrap">' + rankTableHtml(pageItems, false) + '</div>' +
                pagerHtml(st.page, totalPages);
        }
        main.innerHTML = tierFilterHtml(st.filter) + bodyHtml;
        DoguUI.scrollHint('#rank-wrap');
    }

    // 커트라인 = 현재 목록에서 그 티어의 가장 낮은 LP (랭킹 응답만으로 계산, 0 LP 제외)
    function tierCutoff(players, tier) {
        var min = null;
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (p.tier === tier && p.lp > 0 && (min === null || p.lp < min)) min = p.lp;   // 0 LP(승급 직후·감소) 는 커트라인이 아니다
        }
        return min;
    }

    function rankingAsideHtml() {
        var st = rankingState;
        var chal = tierCutoff(st.players, 'CHALLENGER');
        var gm = tierCutoff(st.players, 'GRANDMASTER');
        var cutHtml = '';
        if (chal !== null || gm !== null) {
            cutHtml = '<div class="rank-card"><div class="rank-card-title">커트라인</div>' +
                (chal !== null ? '<div class="cut-row"><span class="tier-text tier-CHALLENGER">챌린저</span><span class="cut-lp">' + Number(chal).toLocaleString() + ' LP</span></div>' : '') +
                (gm !== null ? '<div class="cut-row"><span class="tier-text tier-GRANDMASTER">그랜드마스터</span><span class="cut-lp">' + Number(gm).toLocaleString() + ' LP</span></div>' : '') +
                '<p class="cut-note">현재 랭킹에 든 랭커 중 가장 낮은 LP · 승급 기준과는 다를 수 있습니다</p></div>';
        }
        return '<div class="rank-card">' +
            '<label class="rank-card-title" for="rank-find">닉네임 찾기</label>' +
            '<input class="rank-find" id="rank-find" type="search" placeholder="소환사명" autocomplete="off" spellcheck="false">' +
            '<div class="rank-find-result" id="rank-find-result" aria-live="polite"></div>' +
            '</div>' + cutHtml;
    }

    var findTimer = null;
    function findRanker(query) {
        var st = rankingState;
        if (!st) return;
        var result = document.getElementById('rank-find-result');
        var q = (query || '').trim().toLowerCase();
        if (!q) {
            st.hit = null;
            if (result) result.textContent = '';
            renderRanking();
            return;
        }
        var hit = null;
        for (var i = 0; i < st.players.length; i++) {
            var n = st.players[i].name;
            if (n && n.toLowerCase().indexOf(q) !== -1) { hit = st.players[i]; break; }
        }
        if (!hit) {
            st.hit = null;
            if (result) result.textContent = '목록에 없는 소환사입니다. 위 검색창에서 전적을 찾아보세요.';
            renderRanking();
            return;
        }
        if (st.filter !== 'ALL' && hit.tier !== st.filter) st.filter = 'ALL';
        var idx = filteredPlayers(st).indexOf(hit);
        st.page = Math.floor(idx / RANKING_PAGE_SIZE);
        st.hit = hit.rank;
        if (result) result.textContent = hit.rank + '위 · ' + hit.name + ' · ' + Number(hit.lp).toLocaleString() + ' LP';
        renderRanking();
        var row = document.querySelector('#rank-main tr[data-rank="' + hit.rank + '"]');
        if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
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

    // 표에 올릴 행: 정적 데이터에 없는 항목(소환물 등 원본 ID 로만 남는 것)은 뺀다 (S-4).
    // 정적 데이터가 아예 안 왔으면(전부 미해석) 거르지 않고 그대로 보여 준다
    function statsRows(data, tab, sort) {
        var lookup = tab === 'units' ? tft.champ : tab === 'traits' ? tft.trait : tft.item;
        var rows = (data[tab] || []).slice();
        var known = rows.filter(function (r) { return !!lookup(r.id); });
        if (known.length) rows = known;
        if (sort === 'pick') rows.sort(function (a, b) { return b.games - a.games; });
        else rows.sort(function (a, b) { return a.avgPlacement - b.avgPlacement; });
        return rows;
    }

    // 통계 행 하나. compact = 홈 위젯(1위율 · 추천 아이템 열 없음)
    function statsRowHtml(tab, r, i, compact) {
        var itemsCell = '';
        if (tab === 'units' && !compact) {
            var items = (r.items || []).map(function (n) { return tft.item(n); }).filter(function (it) { return it && it.icon; });
            itemsCell = '<td>' + (items.length
                ? '<div class="stats-items">' + items.map(function (it) {
                    return '<img class="unit-item" src="' + esc(it.icon) + '" alt="' + esc(it.name) + '" title="' + esc(it.name) + '" loading="lazy">';
                }).join('') + '<span class="stats-items-name">' + esc(items[0].name) + (items.length > 1 ? ' 외 ' + (items.length - 1) : '') + '</span></div>'
                : '<span class="stats-none">—</span>') + '</td>';
        }
        return '<tr>' +
            '<td class="rank-no">' + (i + 1) + '</td>' +
            '<td class="stats-name-cell">' + statsNameCell(tab, r) + '</td>' +
            '<td class="detail-num">' + pct(r.pickRate) + '</td>' +
            '<td class="detail-num stats-avg">#' + r.avgPlacement.toFixed(2) + '</td>' +
            '<td class="detail-num">' + pct(r.top4Rate) + '</td>' +
            (compact ? '' : '<td class="detail-num col-win">' + pct(r.winRate) + '</td>') +
            itemsCell +
            '</tr>';
    }

    function statsTabsHtml(tab) {
        return '<div class="stats-tabs" role="tablist">' + STATS_TABS.map(function (t) {
            return '<button class="stats-tab' + (tab === t.key ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (tab === t.key) +
                '" data-stats-tab="' + t.key + '">' + t.label + '</button>';
        }).join('') + '</div>';
    }

    // 표 머리 — 정렬은 픽률 · 평균 등수 머리 클릭 (M-5). compact 는 홈 위젯(정렬 없음)
    function statsHeadHtml(tab, sort, compact) {
        var label = tab === 'units' ? '챔피언' : tab === 'traits' ? '시너지' : '아이템';
        function sortTh(key, text, glyph) {
            if (compact) return '<th class="num">' + text + '</th>';
            var on = sort === key;
            return '<th class="num sortable' + (on ? ' sorted' : '') + '"' + (on ? ' aria-sort="' + (key === 'pick' ? 'descending' : 'ascending') + '"' : '') + '>' +
                '<button class="th-sort" type="button" data-stats-sort="' + key + '" title="' + text + '순으로 정렬">' + text +
                '<span class="sort-glyph" aria-hidden="true">' + (on ? glyph : '') + '</span></button></th>';
        }
        return '<thead><tr><th class="col-no">#</th><th>' + label + '</th>' +
            sortTh('pick', '픽률', '▼') + sortTh('avg', '평균 등수', '▲') +
            '<th class="num">순방률</th>' +
            (compact ? '' : '<th class="num col-win">1위율</th>' + (tab === 'units' ? '<th>추천 아이템</th>' : '')) +
            '</tr></thead>';
    }

    function statsReady(data) {
        return !!(data && !data.building && data.units && data.units.length);
    }

    function renderStats() {
        var body = document.getElementById('stats-body');
        if (!body || !statsState) return;

        var data = statsState.data;
        var tab = statsState.tab;
        var tabsHtml = statsTabsHtml(tab);

        if (!statsReady(data)) {
            setMeta('stats-meta', data && data.sample ? '· 현재 ' + Number(data.sample).toLocaleString() + '게임' : '');
            body.innerHTML = tabsHtml + DoguUI.emptyHtml({
                icon: '📊', title: '아직 표본을 수집하는 중입니다',
                body: '표본이 쌓이면 자동으로 채워집니다. 잠시 후 다시 확인해 주세요.',
                retry: { text: '다시 확인', id: 'stats-retry' }
            });
            return;
        }

        setMeta('stats-meta', '· 세트 ' + data.setNumber + ' · ' + Number(data.sample).toLocaleString() + '게임 표본 · ' + tft.timeAgo(data.updatedAt) + ' 갱신');

        var rows = statsRows(data, tab, statsState.sort);
        body.innerHTML = tabsHtml + (rows.length
            ? SCROLL_HINT + '<div class="dogu-scroll-wrap" id="stats-wrap"><table class="rank-table stats-table">' +
                statsHeadHtml(tab, statsState.sort, false) +
                '<tbody>' + rows.map(function (r, i) { return statsRowHtml(tab, r, i, false); }).join('') + '</tbody></table></div>' +
                '<p class="stats-note">픽률은 보드(참가자) 기준입니다. 표본이 적은 항목(게임 수 하위)은 집계에서 제외됩니다.</p>'
            : DoguUI.emptyHtml({ icon: '📊', title: '표시할 항목이 없습니다', body: '표본이 적은 항목은 집계에서 제외됩니다. 표본이 쌓이면 채워집니다.' }));
        DoguUI.scrollHint('#stats-wrap');
    }

    // ------------------------------------------------------------
    // 홈 위젯 — 랭킹 TOP 10 · 유닛 통계 TOP 5 (S-1). 같은 API · 같은 행 렌더
    // ------------------------------------------------------------
    function renderHomeRanking(players) {
        var box = document.getElementById('home-ranking');
        if (!box) return;
        var top = (players || []).slice(0, 10);
        box.innerHTML = top.length
            ? SCROLL_HINT + '<div class="dogu-scroll-wrap" id="home-rank-wrap">' + rankTableHtml(top, true) + '</div>'
            : '<div class="panel-pad">' + DoguUI.emptyHtml({ icon: '🏆', title: '랭킹을 준비하는 중입니다', body: '10분마다 갱신됩니다.' }) + '</div>';
        DoguUI.scrollHint('#home-rank-wrap');
    }

    function renderHomeStats(data) {
        var box = document.getElementById('home-stats');
        if (!box) return;
        var rows = statsReady(data) ? statsRows(data, 'units', 'avg').slice(0, 5) : [];
        box.innerHTML = rows.length
            ? SCROLL_HINT + '<div class="dogu-scroll-wrap" id="home-stats-wrap"><table class="rank-table stats-table compact">' +
                statsHeadHtml('units', 'avg', true) +
                '<tbody>' + rows.map(function (r, i) { return statsRowHtml('units', r, i, true); }).join('') + '</tbody></table></div>'
            : '<div class="panel-pad">' + DoguUI.emptyHtml({ icon: '📊', title: '아직 표본을 수집하는 중입니다', body: '표본이 쌓이면 자동으로 채워집니다.' }) + '</div>';
        DoguUI.scrollHint('#home-stats-wrap');
    }

    function loadHome() {
        var rankBox = document.getElementById('home-ranking');
        var statsBox = document.getElementById('home-stats');
        if (rankBox) rankBox.innerHTML = '<div class="skel-box">' + DoguUI.skelRowsHtml(10) + '</div>';
        if (statsBox) statsBox.innerHTML = '<div class="skel-box">' + DoguUI.skelRowsHtml(5) + '</div>';

        var staticReady = tft.loadStatic().catch(function () { return null; });

        App.api.get('/ranking').then(function (data) {
            renderHomeRanking(data.players);
        }, function (err) {
            if (rankBox) rankBox.innerHTML = '<div class="panel-pad">' + DoguUI.emptyHtml({ icon: '⚠️', title: '랭킹을 불러오지 못했습니다', body: err.message, retry: { text: '다시 시도', id: 'home-retry-rank' } }) + '</div>';
        });

        Promise.all([staticReady, App.api.get('/stats')]).then(function (results) {
            renderHomeStats(results[1]);
        }, function (err) {
            if (statsBox) statsBox.innerHTML = '<div class="panel-pad">' + DoguUI.emptyHtml({ icon: '⚠️', title: '통계를 불러오지 못했습니다', body: err.message, retry: { text: '다시 시도', id: 'home-retry-stats' } }) + '</div>';
        });
    }

    // ------------------------------------------------------------
    // 라우트 진입 핸들러
    // ------------------------------------------------------------
    App.pages = {
        home: function () {
            hideSuggest();
            var input = document.getElementById('dogu-search-input');
            if (input) input.value = '';
            if (window.DoguUI) DoguUI.showSearchError('');
            loadHome();
        },

        summoner: function (ctx) {
            var riotId = ctx.params.riotId || '';
            App.ui.setTitle(riotId + ' - 전적검색');
            summonerState = null;   // 다른 소환사로 넘어오면 큐 필터도 초기화
            loadSummonerPage(riotId, false);
        },

        ranking: function () {
            var body = document.getElementById('ranking-body');
            if (!body) return;
            // 2단 골격을 먼저 세우고 표 자리엔 칩 + 스켈레톤 (M-7: 표가 와도 높이가 크게 안 뛴다)
            body.innerHTML = '<div class="rank-layout">' +
                '<div class="rank-main" id="rank-main">' + tierFilterHtml((rankingState && rankingState.filter) || 'ALL') +
                '<div class="skel-box">' + DoguUI.skelRowsHtml(10) + '</div></div>' +
                '<aside class="rank-aside" id="rank-aside"></aside></div>';

            Promise.all([
                tft.loadStatic().catch(function () { return null; }),
                App.api.get('/ranking')
            ]).then(function (results) {
                var data = results[1];
                rankingState = {
                    players: data.players || [],
                    updatedAt: data.updatedAt,
                    filter: (rankingState && rankingState.filter) || 'ALL',
                    page: 0,
                    hit: null
                };
                setMeta('ranking-meta', data.updatedAt ? '· ' + tft.timeAgo(data.updatedAt) + ' 갱신' : '· 10분마다 갱신');
                var aside = document.getElementById('rank-aside');
                if (aside) aside.innerHTML = rankingAsideHtml();
                renderRanking();
            }, function (err) {
                var main = document.getElementById('rank-main');
                if (main) main.innerHTML = DoguUI.emptyHtml({ icon: '⚠️', title: '랭킹을 불러오지 못했습니다', body: err.message, retry: { text: '다시 시도', id: 'ranking-retry' } });
            });
        },

        stats: function () {
            var body = document.getElementById('stats-body');
            if (body) body.innerHTML = statsTabsHtml((statsState && statsState.tab) || 'units') + '<div class="skel-box">' + DoguUI.skelRowsHtml(10) + '</div>';

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
                if (body) body.innerHTML = statsTabsHtml((statsState && statsState.tab) || 'units') +
                    DoguUI.emptyHtml({ icon: '⚠️', title: '통계를 불러오지 못했습니다', body: err.message, retry: { text: '다시 시도', id: 'stats-retry' } });
            });
        },

        doc: function () { /* 정적 문서 페이지 — 추가 동작 없음 */ }
    };

    // ------------------------------------------------------------
    // 부팅
    // ------------------------------------------------------------
    // dogu.gg 공통 헤더 · 히어로 · 푸터 · 404 를 끼운다 (DOGU_UI.md 4~7절)
    function mountDoguUI() {
        var home = App.url('/');
        var common = { home: home, brand: 'DOGU', tld: '.GG', linkAttr: 'data-link' };

        DoguUI.mountHeader({
            site: 'tft',
            home: home,
            iconBase: App.url('/'),           // 스위처 아이콘 경로 앞부분(공통 규약 이름): public/header_{key}.png → /tft/header_*.png
            brand: common.brand, tld: common.tld, linkAttr: common.linkAttr,
            nav: App.navItems(),
            search: {
                placeholder: SEARCH_PLACEHOLDER,
                onSubmit: function (q) { submitSearch(q); }
            }
        });

        var hero = DoguUI.mountHero('#hero', {
            home: home,
            mascot: App.url('/favicon.png'),   // 히어로 로고 왼쪽 마스코트 (공통 옵션)
            brand: common.brand, tld: common.tld, linkAttr: common.linkAttr,
            search: {
                placeholder: SEARCH_PLACEHOLDER,
                onSubmit: function (q) { submitSearch(q); },
                favorites: listAdapter(favorites),
                recents: listAdapter(recents),
                itemLabel: function (it) { return it.id; },
                itemKey: function (it) { return it.id; },
                itemHref: function (it) { return App.url('/summoner/' + encodeURIComponent(it.id)); }
            }
        });

        // 자동완성 패널은 공통 검색창 래퍼 안에 둔다 (position: relative 기준점)
        var wrapper = hero.querySelector('.dogu-search-wrapper');
        if (wrapper) {
            var suggest = document.createElement('div');
            suggest.className = 'search-suggest';
            suggest.id = 'search-suggest';
            wrapper.appendChild(suggest);
        }

        DoguUI.mountFooter(null, {
            home: home,
            brand: common.brand, tld: common.tld, linkAttr: common.linkAttr,
            links: { terms: App.url('/terms'), privacy: App.url('/privacy') },
            notice: esc(App.config.siteName || '') + ' is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games ' +
                'or anyone officially involved in producing or managing Riot Games properties. Riot Games and ' +
                'Teamfight Tactics are trademarks or registered trademarks of Riot Games, Inc.',
            contact: App.config.contactEmail || '',
            notify: function (msg) { App.ui.showToast(msg); }
        });

        var notFound = document.getElementById('page-notfound');
        if (notFound) notFound.innerHTML = DoguUI.notFoundHtml({ home: home, linkAttr: common.linkAttr });
    }

    document.addEventListener('DOMContentLoaded', function () {
        App.router.define(App.routes);
        mountDoguUI();

        var searchInput = document.getElementById('dogu-search-input');
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') hideSuggest();
            });
            searchInput.addEventListener('input', onSearchInput);
        }

        // 자동완성 바깥 클릭 시 닫기 (제안 링크 클릭은 라우터가 가로챈 뒤에 닫힌다)
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#search-suggest') && !e.target.closest('#dogu-search-box')) hideSuggest();
        });

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
                        if (!detail.hidden) DoguUI.scrollHint(detail.querySelector('.dogu-scroll-wrap'));   // 펼친 뒤에야 폭을 잰다
                    }
                }
            });
        }

        // 랭킹 페이지 위임 배선
        var rankingBody = document.getElementById('ranking-body');
        if (rankingBody) {
            rankingBody.addEventListener('click', function (e) {
                if (e.target.closest('#ranking-retry')) { App.pages.ranking(); return; }
                var filter = e.target.closest('.rank-filter');
                if (filter && rankingState) {
                    rankingState.filter = filter.getAttribute('data-filter');
                    rankingState.page = 0;
                    renderRanking();
                    return;
                }
                var pager = e.target.closest('.pager-btn');
                if (pager && !pager.disabled && rankingState) {
                    var to = pager.getAttribute('data-page');
                    rankingState.page = to === 'next' ? rankingState.page + 1 : to === 'prev' ? rankingState.page - 1 : Number(to);
                    renderRanking();
                    window.scrollTo(0, 0);
                }
            });
            // 닉네임 찾기 (aside 입력) — 입력이 멈춘 뒤 200ms 에 목록에서 찾아 그 페이지로 옮기고 행을 표시한다
            rankingBody.addEventListener('input', function (e) {
                var find = e.target.closest('#rank-find');
                if (!find) return;
                if (findTimer) clearTimeout(findTimer);
                findTimer = setTimeout(function () { findRanker(find.value); }, 200);
            });
        }

        // 통계 페이지 위임 배선 (탭 · 정렬)
        var statsBody = document.getElementById('stats-body');
        if (statsBody) {
            statsBody.addEventListener('click', function (e) {
                if (e.target.closest('#stats-retry')) { App.pages.stats(); return; }
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

        // 홈 위젯 — 실패 시 다시 시도
        var homePage = document.getElementById('page-home');
        if (homePage) {
            homePage.addEventListener('click', function (e) {
                if (e.target.closest('#home-retry-rank, #home-retry-stats')) loadHome();
            });
        }

        App.router.start();
    });
})(window.App);
