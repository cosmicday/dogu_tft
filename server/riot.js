'use strict';

/* ============================================================
   riot.js — Riot API 호출기 + API 키 핫리로드

   TFT는 24시간마다 만료되는 Development API Key를 쓴다.
   키가 자주 바뀌는 게 전제이므로,
     · .env 파일을 감시해서 API_KEY 값이 바뀌면 재시작 없이 즉시 적용
     · 모든 요청이 호출 "시점"의 키를 헤더에 싣는다 (부팅 시점 키를 고정하지 않음)
   Railway처럼 .env 파일이 없는 환경에서는 플랫폼 주입 환경변수를 그대로 쓴다
   (Railway는 변수 변경 시 자동 재시작하므로 거기서도 재배포는 필요 없다).

   레이트리밋(개발 키: 20req/1s, 100req/2min)도 여기서 관리한다.
   429를 받으면 Retry-After 동안 백그라운드 작업을 전역으로 멈춘다.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

// TFT용 플랫폼/리전. pixlol과 같은 KR 고정.
const PLATFORM_HOST = 'https://kr.api.riotgames.com';
const REGION_HOST = 'https://asia.api.riotgames.com';

// ------------------------------------------------------------
// API 키 핫리로드
//   우선순위: .env 파일 값 > 프로세스 환경변수 (로컬은 파일, 배포는 변수)
//   pixlol 규칙인 API_KEY를 기본으로 쓰고, 예전 이름 TFT_API_KEY도 받아준다.
// ------------------------------------------------------------
function parseKeyFromEnvFile() {
    try {
        const text = fs.readFileSync(ENV_FILE, 'utf8');
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const m = line.match(/^(API_KEY|TFT_API_KEY)\s*=\s*(.+)$/);
            if (m) return m[2].trim().replace(/^["']|["']$/g, '');
        }
    } catch (e) { /* 파일이 없으면 환경변수만 쓴다 */ }
    return '';
}

let currentKey = parseKeyFromEnvFile() || process.env.API_KEY || process.env.TFT_API_KEY || '';

if (fs.existsSync(ENV_FILE)) {
    fs.watchFile(ENV_FILE, { interval: 3000 }, () => {
        const fresh = parseKeyFromEnvFile();
        if (fresh && fresh !== currentKey) {
            currentKey = fresh;
            console.log(`[Riot] .env 변경 감지 — API 키 즉시 교체 (${fresh.slice(0, 10)}...)`);
        }
    });
}

function getApiKey() {
    return currentKey;
}

// ------------------------------------------------------------
// 429 전역 잠금
//   개발 키는 한도가 빡빡해서, 한 번 429가 뜨면 백그라운드 작업(랭킹 갱신,
//   닉네임 변환)이 계속 부딪히며 사용자 검색 몫까지 갉아먹는다.
//   Retry-After 동안 전역으로 쉬게 한다.
// ------------------------------------------------------------
let pausedUntil = 0;

function isPaused() {
    return Date.now() < pausedUntil;
}

// ------------------------------------------------------------
// riotFetch — 인증 헤더/타임아웃/에러 정규화를 한곳에서
//   err.status 로 상태코드를 노출한다 (404, 429, 403 분기용)
// ------------------------------------------------------------
async function riotFetch(url, { timeout = 10000 } = {}) {
    const res = await fetch(url, {
        headers: { 'X-Riot-Token': getApiKey() },
        signal: AbortSignal.timeout(timeout)
    });

    if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 30;
        pausedUntil = Math.max(pausedUntil, Date.now() + retryAfter * 1000);
        console.warn(`[Riot] 429 한도 초과 — ${retryAfter}초간 백그라운드 작업 일시정지`);
    }

    if (!res.ok) {
        const err = new Error(`Riot API ${res.status}: ${url.replace(/\?.*$/, '')}`);
        err.status = res.status;
        if (res.status === 429) err.retryAfter = Number(res.headers.get('Retry-After')) || 30;
        throw err;
    }
    return res.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// TFT 엔드포인트 래퍼
// ------------------------------------------------------------
const api = {
    // 계정 (리전: asia)
    accountByRiotId: (gameName, tagLine) =>
        riotFetch(`${REGION_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`),
    accountByPuuid: (puuid) =>
        riotFetch(`${REGION_HOST}/riot/account/v1/accounts/by-puuid/${puuid}`),

    // 소환사 (플랫폼: kr)
    summonerByPuuid: (puuid) =>
        riotFetch(`${PLATFORM_HOST}/tft/summoner/v1/summoners/by-puuid/${puuid}`),
    summonerById: (summonerId) =>
        riotFetch(`${PLATFORM_HOST}/tft/summoner/v1/summoners/${summonerId}`),

    // 리그 (플랫폼: kr)
    leagueByPuuid: (puuid) =>
        riotFetch(`${PLATFORM_HOST}/tft/league/v1/by-puuid/${puuid}`),
    leagueTop: (tier) =>   // 'challenger' | 'grandmaster' | 'master'
        riotFetch(`${PLATFORM_HOST}/tft/league/v1/${tier}?queue=RANKED_TFT`, { timeout: 20000 }),

    // 매치 (리전: asia)
    matchIdsByPuuid: (puuid, start = 0, count = 10) =>
        riotFetch(`${REGION_HOST}/tft/match/v1/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`),
    matchById: (matchId) =>
        riotFetch(`${REGION_HOST}/tft/match/v1/matches/${matchId}`)
};

module.exports = { getApiKey, riotFetch, api, isPaused, sleep, PLATFORM_HOST, REGION_HOST };
