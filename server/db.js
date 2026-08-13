'use strict';

/* ============================================================
   db.js — MongoDB Atlas (선택적)

   pixlol.kr과 같은 캐시 구조를 TFT에 맞게 가져왔다.
     · MatchCache    : 매치 상세 원본 (30일 TTL). 개발 키 한도가 빡빡해서
                       같은 매치를 두 번 안 부르는 게 특히 중요하다.
     · SummonerCache : 검색된 소환사 + 랭커 닉네임 (자동완성 / 429 폴백 / 랭킹 표시)

   MONGO_URI가 비어 있으면 연결하지 않고, 호출부는 isDbReady()로 분기한다.
   DB 없이도 사이트는 뜬다 (메모리 캐시만으로 동작, 폴백·자동완성만 꺼짐).
   ============================================================ */

const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

mongoose.connection.on('disconnected', () => console.error('[System] MongoDB 연결 끊김'));
mongoose.connection.on('reconnected', () => console.log('[System] MongoDB 재연결 완료'));

const matchCacheSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true },
    detail: { type: Object, required: true },
    createdAt: { type: Date, expires: '30d', default: Date.now }
});

// 429 폴백용: puuid로 저장된 매치를 최신순으로 긁는다
matchCacheSchema.index({ 'detail.metadata.participants': 1, 'detail.info.game_datetime': -1 });

const MatchCache = mongoose.model('MatchCache', matchCacheSchema);

const summonerCacheSchema = new mongoose.Schema({
    puuid: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },   // "Hide on bush#KR1"
    updatedAt: { type: Number, required: true },

    // 검색/자동완성용 소문자 사본 (pixlol 패턴)
    nameLower: { type: String },
    namePartLower: { type: String },

    // 자동완성 표시/정렬용
    tier: { type: String },
    rank: { type: String },
    lp: { type: Number },
    tierScore: { type: Number },
    iconId: { type: Number },
    level: { type: Number }
});

summonerCacheSchema.index({ displayName: 1 });
summonerCacheSchema.index({ namePartLower: 1, tierScore: -1 });

const SummonerCache = mongoose.model('SummonerCache', summonerCacheSchema);

function isDbReady() {
    return mongoose.connection.readyState === 1;
}

async function connectMongo() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn('[System] MONGO_URI가 비어 있음 — DB 캐시 없이 기동 (메모리 캐시만 사용)');
        return false;
    }
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
            // pixlol은 URI에 DB가 없어 기본 DB를 쓴다. 같은 클러스터를 나눠 쓰므로
            // 여기서는 DB 이름을 명시해 pixlol 컬렉션과 분리한다.
            dbName: process.env.MONGO_DB_NAME || 'dogu_tft'
        });
        console.log(`[System] MongoDB 연결 성공 (db: ${process.env.MONGO_DB_NAME || 'dogu_tft'})`);
        return true;
    } catch (err) {
        // pixlol은 연결 실패 시 프로세스를 내렸지만, 여기서는 DB가 선택 사항이라
        // 경고만 남기고 메모리 모드로 계속 간다.
        console.error(`[System] MongoDB 연결 실패 — 메모리 모드로 기동: ${err.message}`);
        return false;
    }
}

// pixlol의 toSearchFields / calcTierScore 이식
function toSearchFields(displayName) {
    const lower = String(displayName || '').toLowerCase();
    return { nameLower: lower, namePartLower: lower.split('#')[0] };
}

const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const RANK_ORDER = { IV: 0, III: 1, II: 2, I: 3 };

function calcTierScore(tier, rank, lp) {
    const t = TIER_ORDER.indexOf(String(tier || '').toUpperCase());
    if (t === -1) return 0;
    const r = RANK_ORDER[String(rank || '').toUpperCase()] || 0;
    return t * 1000000 + r * 10000 + (Number(lp) || 0);
}

module.exports = { connectMongo, isDbReady, MatchCache, SummonerCache, toSearchFields, calcTierScore };
