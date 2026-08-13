'use strict';

/* ============================================================
   api.js — TFT 서비스 API + 백그라운드 작업

   pixlol.kr(LoL)의 구조를 TFT API 스펙에 맞게 다시 짠 것.
     GET /api/search/:riotId          닉네임 검색 (프로필 + 리그 + 최근 10판)
     GET /api/matches/:puuid          전적 더 보기 (start/count 페이지네이션)
     GET /api/ranking                 챌린저~마스터 랭킹 (10분 주기 갱신 캐시)
     GET /api/autocomplete?q=         검색 자동완성 (Mongo 연결 시)
     GET /api/static                  챔피언/특성/아이템 정적 데이터

   백그라운드:
     · updateRanking          10분 주기. 티어별 마지막 성공 명단 유지 (pixlol 패턴)
     · resolveNamesInBackground  랭커 puuid → 닉네임. 개발 키(100req/2min)에
       맞춰 pixlol보다 훨씬 느리게 페이싱한다.
   ============================================================ */

const express = require('express');
const fs = require('fs');
const path = require('path');

const { api, isPaused, sleep } = require('./riot');
const { isDbReady, MatchCache, SummonerCache, toSearchFields, calcTierScore } = require('./db');
const { getStatic, profileIconUrl } = require('./tftdata');

const router = express.Router();

// ------------------------------------------------------------
// 초소형 TTL 메모리 캐시 (node-cache 의존성 대신)
// ------------------------------------------------------------
const memCache = new Map();

function cacheGet(key) {
    const entry = memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) { memCache.delete(key); return null; }
    return entry.val;
}

function cacheSet(key, val, ttlMs) {
    if (memCache.size > 500) memCache.clear();   // 폭주 방지용 안전핀
    memCache.set(key, { val, exp: Date.now() + ttlMs });
}

// ------------------------------------------------------------
// 랭킹 상태 (pixlol의 challengerList 패턴)
// ------------------------------------------------------------
const RANK_TIERS = ['challenger', 'grandmaster', 'master'];
const rankListByTier = { challenger: [], grandmaster: [], master: [] };
let rankingPlayers = [];          // 정렬·병합된 최종 명단
let rankingUpdatedAt = 0;
let isFetchingNames = false;

const resolvedNames = {};          // puuid → { displayName, updatedAt }
const failedPuuids = {};           // puuid → 실패 시각 (24시간 재시도 금지)

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const NAMES_FILE = path.join(CACHE_DIR, 'resolved_names.json');

function loadResolvedNamesFromDisk() {
    try {
        const saved = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
        Object.assign(resolvedNames, saved);
        console.log(`[Task] 닉네임 캐시 ${Object.keys(saved).length}건 로드 (디스크)`);
    } catch (e) { /* 첫 부팅이면 없음 */ }
}

function saveResolvedNamesToDisk() {
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(NAMES_FILE, JSON.stringify(resolvedNames));
    } catch (e) { /* 디스크 캐시는 없어도 치명적이지 않다 */ }
}

async function loadResolvedNamesFromDb() {
    if (!isDbReady()) return;
    try {
        const docs = await SummonerCache.find({}, { puuid: 1, displayName: 1, updatedAt: 1 }).limit(20000).lean();
        for (const d of docs) {
            if (!resolvedNames[d.puuid] || resolvedNames[d.puuid].updatedAt < d.updatedAt) {
                resolvedNames[d.puuid] = { displayName: d.displayName, updatedAt: d.updatedAt };
            }
        }
        console.log(`[Task] 닉네임 캐시 ${docs.length}건 로드 (DB)`);
    } catch (err) {
        console.error(`[Task] 닉네임 캐시 DB 로드 실패: ${err.message}`);
    }
}

// 504 같은 일시 오류 재시도 (pixlol fetchRankTier 이식)
async function fetchRankTier(tier, tries = 3) {
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            const data = await api.leagueTop(tier);
            const entries = data?.entries || [];
            if (entries.length > 0) return entries;
            console.warn(`[Task] ${tier} 빈 응답 (${attempt}/${tries})`);
        } catch (e) {
            console.warn(`[Task] ${tier} 조회 실패 ${e.status || e.message} (${attempt}/${tries})`);
            if (e.status === 429) return null;   // 한도 초과면 재시도가 독이다
        }
        if (attempt < tries) await sleep(3000 * attempt);
    }
    return null;
}

const TIER_LABEL = { challenger: 'CHALLENGER', grandmaster: 'GRANDMASTER', master: 'MASTER' };

async function updateRanking() {
    if (isPaused()) return;
    try {
        // 개발 키 부담을 줄이려고 티어를 순차 조회한다 (동시 3연발 금지)
        for (const tier of RANK_TIERS) {
            const entries = await fetchRankTier(tier);
            if (entries) {
                rankListByTier[tier] = entries;
            } else {
                console.error(`[Task] ${tier} 갱신 실패 — 기존 ${rankListByTier[tier].length}명 유지`);
            }
            await sleep(1000);
        }

        const combined = RANK_TIERS.flatMap(tier =>
            rankListByTier[tier].map(e => ({
                puuid: e.puuid || null,
                summonerId: e.summonerId || null,
                tier: TIER_LABEL[tier],
                lp: e.leaguePoints || 0,
                wins: e.wins || 0,        // TFT에서 wins = 4등 안(순방) 횟수
                losses: e.losses || 0
            }))
        );

        if (combined.length > 0) {
            // 티어 우선 → LP 순. (마스터 LP가 챌린저를 넘는 왜곡 방지)
            const tierOrder = { CHALLENGER: 0, GRANDMASTER: 1, MASTER: 2 };
            combined.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.lp - a.lp);
            rankingPlayers = combined;
            rankingUpdatedAt = Date.now();
            memCache.delete('ranking_payload');
            console.log(`[Task] TFT 랭킹 갱신 완료 (총 ${combined.length}명)`);
        }
    } catch (err) {
        console.error(`[Task] 랭킹 갱신 실패: ${err.message}`);
    }
}

// 랭커 puuid → 닉네임. 개발 키 한도(100req/2min)에 맞춰 페이싱:
//   사이클당 최대 8명, 호출 간 2.5초, 사이클 간 90초 → 백그라운드 ~11req/2min
async function resolveNamesInBackground() {
    if (rankingPlayers.length === 0 || isFetchingNames || isPaused()) return;
    isFetchingNames = true;

    const now = Date.now();
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const pending = rankingPlayers
        .map((p, i) => ({ ...p, rankIndex: i }))
        .filter(p => {
            if (!p.puuid) return false;   // puuid 없는 항목은 건너뜀 (구형 응답)
            if (failedPuuids[p.puuid] && now - failedPuuids[p.puuid] < ONE_DAY) return false;
            const known = resolvedNames[p.puuid];
            return !known || now - known.updatedAt > FOURTEEN_DAYS;
        });

    const targets = pending.slice(0, 8);   // 상위 랭커부터 (명단이 이미 정렬돼 있다)
    if (pending.length > 0) {
        console.log(`[Task] 닉네임 변환: 대기 ${pending.length}명, 이번 사이클 ${targets.length}명`);
    }

    let changed = false;
    for (const p of targets) {
        if (isPaused()) break;
        try {
            const acc = await api.accountByPuuid(p.puuid);
            if (acc.gameName) {
                const displayName = `${acc.gameName}#${acc.tagLine}`;
                resolvedNames[p.puuid] = { displayName, updatedAt: now };
                delete failedPuuids[p.puuid];
                changed = true;
                memCache.delete('ranking_payload');
                if (isDbReady()) {
                    SummonerCache.findOneAndUpdate(
                        { puuid: p.puuid },
                        {
                            displayName, updatedAt: now, ...toSearchFields(displayName),
                            tier: p.tier, rank: '', lp: p.lp,
                            tierScore: calcTierScore(p.tier, 'I', p.lp)
                        },
                        { upsert: true }
                    ).catch(() => { });
                }
            }
        } catch (err) {
            if (err.status === 404) failedPuuids[p.puuid] = now;
            else console.error(`[Name] 오류 ${p.puuid.slice(0, 8)}: ${err.status || err.message}`);
        }
        await sleep(2500);
    }

    if (changed) saveResolvedNamesToDisk();
    isFetchingNames = false;
}

// ------------------------------------------------------------
// 메타 통계 — 랭커 매치 수집 + 유닛/시너지/아이템 집계
//   상위 랭커의 랭크 매치를 5분마다 조금씩 MatchCache에 쌓고(개발 키 한도에
//   맞춰 사이클당 최대 5매치), 30분마다 Mongo 집계로 통계를 갱신한다.
//   덱(조합) 티어까지는 표본이 모자라므로 유닛/시너지/아이템 단위만 낸다.
// ------------------------------------------------------------
let metaStats = null;      // { updatedAt, sample, setNumber, units, traits, items }
let crawlCursor = 0;

async function crawlRankedMatches() {
    if (isPaused() || !isDbReady() || rankingPlayers.length === 0) return;

    const pool = rankingPlayers.slice(0, 300).filter(p => p.puuid);
    if (!pool.length) return;
    const target = pool[crawlCursor % pool.length];
    crawlCursor++;

    try {
        const ids = await api.matchIdsByPuuid(target.puuid, 0, 5);
        const known = await MatchCache.find({ matchId: { $in: ids } }, { matchId: 1 }).lean();
        const knownSet = new Set(known.map(d => d.matchId));
        const toFetch = ids.filter(id => !knownSet.has(id));

        let added = 0;
        for (const id of toFetch) {
            if (isPaused()) break;
            try {
                const detail = await api.matchById(id);
                await MatchCache.create({ matchId: id, detail }).catch(() => { });
                added++;
            } catch (e) {
                if (e.status === 429) break;
            }
            await sleep(2000);
        }
        if (added > 0) console.log(`[Task] 메타 수집: 매치 ${added}개 추가 (${target.tier} ${target.lp}LP 랭커)`);
    } catch (e) { /* 다음 사이클에 다른 랭커로 재시도 */ }
}

async function refreshMetaStats() {
    if (!isDbReady()) return;
    try {
        // 라이브 세트 번호는 하드코딩하지 않고, 쌓인 랭크 매치에서 다수결로 정한다.
        // (CDragon latest에는 선행 세트가 미리 들어와서 정적 데이터 기준은 못 쓴다)
        const setCounts = await MatchCache.aggregate([
            { $match: { 'detail.info.queue_id': 1100 } },
            { $group: { _id: '$detail.info.tft_set_number', n: { $sum: 1 } } },
            { $sort: { n: -1 } }, { $limit: 1 }
        ]);
        if (!setCounts.length) return;
        const setNumber = setCounts[0]._id;
        const sample = setCounts[0].n;

        const base = [
            { $match: { 'detail.info.queue_id': 1100, 'detail.info.tft_set_number': setNumber } },
            { $sort: { createdAt: -1 } },
            { $limit: 3000 },
            { $project: { parts: '$detail.info.participants' } },
            { $unwind: '$parts' }
        ];
        const acc = {
            games: { $sum: 1 },
            sumP: { $sum: '$parts.placement' },
            top4: { $sum: { $cond: [{ $lte: ['$parts.placement', 4] }, 1, 0] } },
            wins: { $sum: { $cond: [{ $eq: ['$parts.placement', 1] }, 1, 0] } }
        };

        const [unitAgg, unitItemAgg, traitAgg, itemAgg] = await Promise.all([
            MatchCache.aggregate([...base,
                { $unwind: '$parts.units' },
                { $group: { _id: '$parts.units.character_id', ...acc } }
            ]),
            MatchCache.aggregate([...base,
                { $unwind: '$parts.units' },
                { $unwind: '$parts.units.itemNames' },
                { $group: { _id: { u: '$parts.units.character_id', i: '$parts.units.itemNames' }, n: { $sum: 1 } } }
            ]),
            MatchCache.aggregate([...base,
                { $unwind: '$parts.traits' },
                { $match: { 'parts.traits.tier_current': { $gt: 0 } } },
                { $group: { _id: '$parts.traits.name', ...acc } }
            ]),
            MatchCache.aggregate([...base,
                { $unwind: '$parts.units' },
                { $unwind: '$parts.units.itemNames' },
                { $group: { _id: '$parts.units.itemNames', ...acc } }
            ])
        ]);

        // 유닛별 인기 아이템 상위 3개
        const topItemsByUnit = {};
        for (const row of unitItemAgg) {
            (topItemsByUnit[row._id.u] = topItemsByUnit[row._id.u] || []).push({ item: row._id.i, n: row.n });
        }
        for (const u of Object.keys(topItemsByUnit)) {
            topItemsByUnit[u] = topItemsByUnit[u].sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.item);
        }

        const boards = sample * 8;   // 매치당 8보드 기준 픽률 분모
        const minGames = Math.max(5, Math.round(boards * 0.005));
        const shape = (rows) => rows
            .filter(r => r._id && r.games >= minGames)
            .map(r => ({
                id: r._id,
                games: r.games,
                pickRate: boards > 0 ? r.games / boards : 0,
                avgPlacement: r.sumP / r.games,
                top4Rate: r.top4 / r.games,
                winRate: r.wins / r.games
            }))
            .sort((a, b) => a.avgPlacement - b.avgPlacement);

        metaStats = {
            updatedAt: Date.now(),
            sample,
            setNumber,
            units: shape(unitAgg).map(u => ({ ...u, items: topItemsByUnit[u.id] || [] })),
            traits: shape(traitAgg),
            items: shape(itemAgg).slice(0, 120)
        };
        console.log(`[Task] 메타 통계 갱신 — 세트 ${setNumber}, 표본 ${sample}게임, 유닛 ${metaStats.units.length} / 시너지 ${metaStats.traits.length} / 아이템 ${metaStats.items.length}`);
    } catch (err) {
        console.error(`[Task] 메타 통계 집계 실패: ${err.message}`);
    }
}

// ------------------------------------------------------------
// 매치 상세 조회 (Mongo 캐시 우선, 신규만 Riot 호출)
// ------------------------------------------------------------
async function getMatchDetails(matchIds) {
    let cachedDocs = [];
    if (isDbReady()) {
        try {
            cachedDocs = await MatchCache.find({ matchId: { $in: matchIds } }).lean();
        } catch (e) { /* DB가 잠깐 죽었어도 Riot으로 진행 */ }
    }

    const cachedById = new Map(cachedDocs.map(d => [d.matchId, d.detail]));
    const toFetch = matchIds.filter(id => !cachedById.has(id));

    if (toFetch.length > 0) {
        console.log(`[DB Cache] 매치 ${cachedById.size}개 적중 / ${toFetch.length}개 신규 호출`);
    }

    const fetched = await Promise.all(toFetch.map(async (matchId, index) => {
        try {
            await sleep(index * 150);   // 동시 폭주 방지 스태거 (pixlol 패턴)
            const detail = await api.matchById(matchId);
            if (isDbReady()) MatchCache.create({ matchId, detail }).catch(() => { });
            return detail;
        } catch (err) {
            if (err.status === 429) throw err;   // 한도 초과는 위로 올려 폴백 태운다
            return null;
        }
    }));

    for (const detail of fetched) {
        if (detail) cachedById.set(detail.metadata.match_id, detail);
    }

    // 요청한 matchIds 순서(최신순)를 유지한다
    return matchIds.map(id => cachedById.get(id)).filter(Boolean);
}

// ------------------------------------------------------------
// 매치 → 화면용 엔트리 변환
// ------------------------------------------------------------
function compactParticipant(p) {
    return {
        puuid: p.puuid,
        name: p.riotIdGameName
            ? `${p.riotIdGameName}#${p.riotIdTagline}`
            : (resolvedNames[p.puuid]?.displayName || null),
        placement: p.placement,
        level: p.level,
        lastRound: p.last_round,
        playersEliminated: p.players_eliminated || 0,
        damage: p.total_damage_to_players || 0,
        goldLeft: p.gold_left || 0,
        augments: p.augments || [],
        traits: (p.traits || [])
            .filter(t => t.tier_current > 0)
            .sort((a, b) => (b.style - a.style) || (b.num_units - a.num_units))
            .map(t => ({ name: t.name, num: t.num_units, style: t.style, tier: t.tier_current })),
        units: (p.units || []).map(u => ({
            id: u.character_id,
            tier: u.tier,
            rarity: u.rarity,
            items: u.itemNames || []
        }))
    };
}

function buildHistoryEntry(detail, puuid) {
    const info = detail?.info;
    if (!info || !Array.isArray(info.participants)) return null;
    const me = info.participants.find(p => p.puuid === puuid);
    if (!me) return null;

    const participants = info.participants
        .map(compactParticipant)
        .sort((a, b) => a.placement - b.placement);

    return {
        matchId: detail.metadata.match_id,
        gameDatetime: info.game_datetime,
        gameLength: Math.round(info.game_length || 0),
        queueId: info.queue_id,
        gameType: info.tft_game_type || '',
        setNumber: info.tft_set_number || null,
        me: compactParticipant(me),
        participants
    };
}

// 같은 게임 참가자 닉네임을 자동완성 후보로 축적 (pixlol saveParticipantNames)
function saveParticipantNames(details, excludePuuid) {
    if (!isDbReady()) return;
    const now = Date.now();
    const seen = new Map();
    for (const detail of details) {
        for (const p of detail?.info?.participants || []) {
            if (p.puuid === excludePuuid || !p.riotIdGameName || !p.riotIdTagline) continue;
            seen.set(p.puuid, `${p.riotIdGameName}#${p.riotIdTagline}`);
        }
    }
    for (const [puuid, name] of seen) {
        resolvedNames[puuid] = resolvedNames[puuid] || { displayName: name, updatedAt: now };
        SummonerCache.updateOne(
            { puuid },
            { $set: { displayName: name, updatedAt: now, ...toSearchFields(name) } },
            { upsert: true }
        ).catch(() => { });
    }
}

// ------------------------------------------------------------
// 리그 엔트리 → 화면용 큐 정보
//   초고속(TURBO)은 tier/rank 대신 ratedTier/ratedRating을 쓴다
// ------------------------------------------------------------
function buildQueues(leagueEntries) {
    const queues = {};
    for (const e of leagueEntries || []) {
        if (e.queueType === 'RANKED_TFT_TURBO') {
            queues[e.queueType] = {
                ratedTier: e.ratedTier || 'GRAY',
                ratedRating: e.ratedRating || 0,
                wins: e.wins || 0, losses: e.losses || 0
            };
        } else {
            queues[e.queueType] = {
                tier: e.tier || 'UNRANKED', rank: e.rank || '',
                lp: e.leaguePoints || 0,
                wins: e.wins || 0, losses: e.losses || 0
            };
        }
    }
    return queues;
}

// ------------------------------------------------------------
// 429 폴백 — DB에 있는 것만이라도 보여준다 (pixlol buildFallbackResponse)
// ------------------------------------------------------------
async function buildFallbackResponse(displayName) {
    if (!isDbReady()) return null;
    const doc = await SummonerCache.findOne({ nameLower: displayName.toLowerCase() }).lean();
    if (!doc) return null;

    const matches = await MatchCache.find({ 'detail.metadata.participants': doc.puuid })
        .sort({ 'detail.info.game_datetime': -1 })
        .limit(10)
        .lean();

    const history = matches
        .map(m => buildHistoryEntry(m.detail, doc.puuid))
        .filter(Boolean);

    return {
        stale: true,
        puuid: doc.puuid,
        profile: {
            name: doc.displayName,
            level: doc.level || null,
            icon: doc.iconId ? profileIconUrl(doc.iconId) : null,
            serverRank: null
        },
        queues: doc.tier && doc.tier !== 'UNRANKED'
            ? { RANKED_TFT: { tier: doc.tier, rank: doc.rank || '', lp: doc.lp || 0, wins: 0, losses: 0 } }
            : {},
        history
    };
}

// ============================================================
// 라우트
// ============================================================

// 닉네임 검색: 프로필 + 리그 + 최근 10판
router.get('/search/:riotId', async (req, res) => {
    const raw = String(req.params.riotId || '').trim();
    let [gameName, tagLine] = raw.split('#');
    gameName = (gameName || '').trim();
    tagLine = (tagLine || 'KR1').trim();   // 태그 생략 시 KR1

    if (!gameName) return res.status(400).json({ error: '닉네임을 입력해주세요. (예: 닉네임#KR1)' });

    const cacheKey = `search:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;

    // 전적 갱신: ?refresh=1 이면 캐시를 건너뛰되, IP당 30초 쿨다운을 둔다
    let skipCache = req.query.refresh === '1';
    if (skipCache) {
        const ip = req.ip || 'unknown';
        const last = cacheGet(`refresh:${ip}`);
        if (last) skipCache = false;
        else cacheSet(`refresh:${ip}`, 1, 30 * 1000);
    }

    const cached = skipCache ? null : cacheGet(cacheKey);
    if (cached) {
        console.log(`[API] 검색 캐시 적중: ${gameName}#${tagLine}`);
        return res.json(cached);
    }

    try {
        const account = await api.accountByRiotId(gameName, tagLine);
        const puuid = account.puuid;

        const [summoner, leagueEntries, matchIds] = await Promise.all([
            api.summonerByPuuid(puuid),
            api.leagueByPuuid(puuid).catch(() => []),   // 언랭이면 빈 배열
            api.matchIdsByPuuid(puuid, 0, 10)
        ]);

        const details = await getMatchDetails(matchIds);
        const history = details.map(d => buildHistoryEntry(d, puuid)).filter(Boolean);

        const queues = buildQueues(leagueEntries);
        const ranked = queues.RANKED_TFT || null;
        const rankIndex = rankingPlayers.findIndex(p => p.puuid === puuid);

        const canonicalName = `${account.gameName}#${account.tagLine}`;
        const payload = {
            puuid,
            profile: {
                name: canonicalName,
                level: summoner.summonerLevel,
                icon: profileIconUrl(summoner.profileIconId),
                serverRank: rankIndex !== -1 ? rankIndex + 1 : null
            },
            queues,
            history
        };

        // 소환사 캐시 저장 (자동완성 / 429 폴백 / 랭킹 닉네임 재사용)
        const now = Date.now();
        resolvedNames[puuid] = { displayName: canonicalName, updatedAt: now };
        if (isDbReady()) {
            SummonerCache.findOneAndUpdate(
                { puuid },
                {
                    displayName: canonicalName, updatedAt: now, ...toSearchFields(canonicalName),
                    tier: ranked?.tier || 'UNRANKED', rank: ranked?.rank || '', lp: ranked?.lp || 0,
                    tierScore: calcTierScore(ranked?.tier, ranked?.rank, ranked?.lp),
                    iconId: summoner.profileIconId, level: summoner.summonerLevel
                },
                { upsert: true }
            ).catch(() => { });
            saveParticipantNames(details, puuid);
        }

        cacheSet(cacheKey, payload, 120 * 1000);
        console.log(`[API] 검색 완료: ${canonicalName} (${history.length}판)`);
        res.json(payload);

    } catch (err) {
        if (err.status === 429) {
            console.log(`[API] 429 한도 초과 — ${gameName}#${tagLine} DB 폴백 시도`);
            try {
                const fallback = await buildFallbackResponse(`${gameName}#${tagLine}`);
                if (fallback) return res.json(fallback);
            } catch (e) { console.error(`[Fallback Error] ${e.message}`); }
            res.set('Retry-After', String(err.retryAfter || 30));
            return res.status(429).json({ error: '조회 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
        }
        if (err.status === 404) {
            return res.status(404).json({ error: '소환사를 찾을 수 없습니다. 닉네임#태그를 다시 확인해주세요.' });
        }
        if (err.status === 401 || err.status === 403) {
            console.error('[API] Riot API 키 인증 실패 — .env의 API_KEY가 만료됐을 수 있습니다.');
            return res.status(503).json({ error: '서버의 API 키가 만료되었습니다. 잠시 후 다시 시도해주세요.' });
        }
        console.error(`[Error] 검색 실패: ${err.message}`);
        res.status(500).json({ error: '데이터 처리 중 문제가 발생했습니다.' });
    }
});

// 전적 더 보기
router.get('/matches/:puuid', async (req, res) => {
    const puuid = String(req.params.puuid || '');
    const start = Math.max(0, parseInt(req.query.start, 10) || 0);
    const count = Math.min(10, Math.max(1, parseInt(req.query.count, 10) || 10));

    if (!/^[A-Za-z0-9_-]{20,120}$/.test(puuid)) {
        return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    try {
        const matchIds = await api.matchIdsByPuuid(puuid, start, count);
        const details = await getMatchDetails(matchIds);
        const history = details.map(d => buildHistoryEntry(d, puuid)).filter(Boolean);
        res.json({ history, nextStart: start + matchIds.length, hasMore: matchIds.length === count });
    } catch (err) {
        if (err.status === 429) {
            res.set('Retry-After', String(err.retryAfter || 30));
            return res.status(429).json({ error: '조회 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
        }
        console.error(`[Error] 매치 페이지네이션 실패: ${err.message}`);
        res.status(500).json({ error: '데이터 처리 중 문제가 발생했습니다.' });
    }
});

// 랭킹 (챌린저 → 그마 → 마스터, 상위 1000명)
router.get('/ranking', (req, res) => {
    let payload = cacheGet('ranking_payload');
    if (!payload) {
        payload = {
            updatedAt: rankingUpdatedAt,
            players: rankingPlayers.slice(0, 1000).map((p, i) => ({
                rank: i + 1,
                puuid: p.puuid,
                name: p.puuid ? (resolvedNames[p.puuid]?.displayName || null) : null,
                tier: p.tier,
                lp: p.lp,
                wins: p.wins,
                losses: p.losses
            }))
        };
        cacheSet('ranking_payload', payload, 60 * 1000);
    }
    res.json(payload);
});

// 자동완성 (Mongo 연결 시에만 동작)
router.get('/autocomplete', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2 || !isDbReady()) return res.json({ results: [] });

    try {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const field = q.includes('#') ? 'nameLower' : 'namePartLower';
        const docs = await SummonerCache.find({ [field]: { $regex: '^' + escaped } })
            .sort({ tierScore: -1 })
            .limit(7)
            .lean();
        res.json({
            results: docs.map(d => ({
                name: d.displayName,
                tier: d.tier || null, rank: d.rank || '', lp: d.lp || 0,
                icon: d.iconId ? profileIconUrl(d.iconId) : null
            }))
        });
    } catch (err) {
        res.json({ results: [] });
    }
});

// 메타 통계 (유닛/시너지/아이템 — 랭커 랭크 매치 집계)
router.get('/stats', (req, res) => {
    if (!metaStats) {
        return res.json({ building: true, sample: 0, units: [], traits: [], items: [] });
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(metaStats);
});

// 정적 데이터 (챔피언/특성/아이템/증강)
router.get('/static', (req, res) => {
    const data = getStatic();
    if (!data) return res.status(503).json({ error: '정적 데이터를 아직 불러오지 못했습니다.' });
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(data);
});

// ------------------------------------------------------------
// 백그라운드 작업 기동
// ------------------------------------------------------------
async function startRiotJobs() {
    loadResolvedNamesFromDisk();
    await loadResolvedNamesFromDb();
    await updateRanking();
    resolveNamesInBackground();   // 오래 걸리므로 기다리지 않는다

    setInterval(updateRanking, 10 * 60 * 1000);
    setInterval(resolveNamesInBackground, 90 * 1000);

    // 메타 통계: 수집은 5분 주기(사이클당 최대 6콜), 집계는 30분 주기
    refreshMetaStats();
    setInterval(crawlRankedMatches, 5 * 60 * 1000);
    setInterval(refreshMetaStats, 30 * 60 * 1000);
    setTimeout(crawlRankedMatches, 30 * 1000);   // 첫 수집은 부팅 30초 뒤
}

module.exports = { router, startRiotJobs };
