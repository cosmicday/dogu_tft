'use strict';

/* ============================================================
   tftdata.js — TFT 정적 데이터 (챔피언 · 특성 · 아이템 · 증강체)

   세트가 몇 달마다 갈리는 게임이라 세트 데이터를 코드에 박으면 금방 썩는다.
   Community Dragon의 로컬라이즈 번들(ko_kr.json)을 부팅 시 + 24시간마다 받아서
     apiName → { 이름, 아이콘 URL, 코스트, 특성 }
   룩업 맵으로 압축해 /api/static 으로 프론트에 내려준다.

   원본이 10MB가 넘으므로 최신 2개 세트 + 공용 아이템/증강만 남긴다.
   (전적에 등장하는 매치는 사실상 현재 세트고, 직전 세트까지만 걸친다)

   네트워크가 죽어도 부팅은 돼야 하므로 마지막 성공본을 .cache/에 저장해 둔다.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const CDRAGON_JSON = 'https://raw.communitydragon.org/latest/cdragon/tft/ko_kr.json';
const CDRAGON_GAME = 'https://raw.communitydragon.org/latest/game/';
const DDRAGON_VERSIONS = 'https://ddragon.leagueoflegends.com/api/versions.json';

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'tft_static.json');

let staticData = null;        // { setNumber, champs, traits, items, updatedAt }
let ddragonVersion = '15.1.1'; // 프로필 아이콘용. 부팅 시 갱신.

// CDragon 아이콘 경로 → 실제 PNG URL
//   "ASSETS/UX/TFT/xx.TFT_Set15.tex" → ".../game/assets/ux/tft/xx.tft_set15.png"
function iconUrl(rawPath) {
    if (!rawPath) return null;
    return CDRAGON_GAME + String(rawPath).toLowerCase().replace(/\.(tex|dds)$/, '.png');
}

function buildStatic(raw) {
    // 챔피언이 실제로 들어 있는 세트 번호 중 최댓값 = 현재 세트
    const setNumbers = Object.keys(raw.sets || {})
        .map(Number)
        .filter(n => Number.isFinite(n) && (raw.sets[n]?.champions || []).length > 0)
        .sort((a, b) => a - b);

    const currentSet = setNumbers[setNumbers.length - 1];
    const keepSets = setNumbers.slice(-2);   // 현재 세트 + 직전 세트

    const champs = {};
    const traits = {};

    for (const setNum of keepSets) {
        const set = raw.sets[setNum];

        for (const t of set.traits || []) {
            if (!t.apiName) continue;
            traits[t.apiName] = { name: t.name || t.apiName, icon: iconUrl(t.icon) };
        }

        for (const c of set.champions || []) {
            if (!c.apiName) continue;
            champs[c.apiName] = {
                name: c.name || c.apiName,
                cost: c.cost || 0,
                icon: iconUrl(c.tileIcon || c.squareIcon || c.icon),
                traits: c.traits || []
            };
        }
    }

    // 아이템 + 증강체. 전 세트 것까지 수천 개라 현재/직전 세트 것만 남긴다.
    //   TFT_Item_*          : 세트 공용 아이템 → 유지
    //   TFT{n}_...          : 세트 귀속(증강 포함) → n이 keepSets에 있을 때만
    const keepSetTag = new Set(keepSets.map(n => `TFT${n}_`));
    const items = {};
    for (const it of raw.items || []) {
        if (!it.apiName || !it.icon) continue;
        const m = it.apiName.match(/^TFT(\d+)_/);
        if (m && !keepSetTag.has(`TFT${m[1]}_`)) continue;
        items[it.apiName] = { name: it.name || it.apiName, icon: iconUrl(it.icon) };
    }

    return {
        setNumber: currentSet,
        champs,
        traits,
        items,
        updatedAt: Date.now()
    };
}

async function refreshStaticData() {
    try {
        const res = await fetch(CDRAGON_JSON, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        const built = buildStatic(raw);
        if (Object.keys(built.champs).length === 0) throw new Error('챔피언 데이터가 비어 있음');

        staticData = built;
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(built));
        console.log(`[Task] TFT 정적 데이터 갱신 완료 — 세트 ${built.setNumber}, ` +
            `챔피언 ${Object.keys(built.champs).length} / 특성 ${Object.keys(built.traits).length} / 아이템·증강 ${Object.keys(built.items).length}`);
    } catch (err) {
        console.error(`[Task] TFT 정적 데이터 갱신 실패: ${err.message}`);
        if (!staticData && fs.existsSync(CACHE_FILE)) {
            try {
                staticData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                console.log('[Task] 캐시 파일로 폴백 성공');
            } catch (e) { /* 캐시도 깨졌으면 null 유지 */ }
        }
    }
}

async function refreshDdragonVersion() {
    try {
        const res = await fetch(DDRAGON_VERSIONS, { signal: AbortSignal.timeout(10000) });
        const versions = await res.json();
        if (Array.isArray(versions) && versions[0]) ddragonVersion = versions[0];
    } catch (err) {
        console.error(`[Task] DDragon 버전 갱신 실패: ${err.message}`);
    }
}

function getStatic() {
    return staticData;
}

function profileIconUrl(iconId) {
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${iconId}.png`;
}

async function startStaticJobs() {
    await Promise.all([refreshStaticData(), refreshDdragonVersion()]);
    setInterval(refreshStaticData, 24 * 60 * 60 * 1000);
    setInterval(refreshDdragonVersion, 24 * 60 * 60 * 1000);
}

module.exports = { startStaticJobs, getStatic, profileIconUrl };
