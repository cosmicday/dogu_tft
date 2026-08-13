# dogu.gg/tft — TFT 전적검색

`dogu_template` 뼈대 + `pixlol.kr`의 서버 패턴을 TFT API 스펙에 맞게 다시 짠 사이트.
스택은 조직 표준 그대로: Node/Express + MongoDB Atlas + Railway + Cloudflare, 프론트는 바닐라 JS.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000/tft/  (.env의 BASE_PATH=/tft)
npm run dev:root   # http://localhost:3000/      (루트 마운트 점검용)
```

배포 시작 명령은 `npm start`. 헬스체크는 `GET /tft/healthz`.

## Riot API 키 (중요)

TFT는 pixlol(LoL)의 영구 키가 **안 먹힌다**. 24시간마다 만료되는
[Development API Key](https://developer.riotgames.com)를 쓴다.

- **로컬/VM**: `.env`의 `API_KEY` 값만 갈아끼우고 저장하면 끝. `server/riot.js`가
  `.env`를 3초 간격으로 감시해서 재시작 없이 즉시 반영된다.
- **Railway**: 대시보드 Variables의 `API_KEY`만 바꾸면 자동 재시작되며 반영된다.
- 키가 만료되면 검색 API가 503과 함께 "API 키가 만료되었습니다"를 내려준다.
  서버 로그에 `[API] Riot API 키 인증 실패`가 찍히면 키부터 갈 것.

개발 키 한도는 **20req/1s, 100req/2min**으로 빡빡하다. 그래서:
- 매치 상세는 MongoDB에 30일 캐시 (같은 매치를 두 번 안 부름)
- 검색 결과는 메모리 2분 캐시
- 랭킹 갱신은 10분 주기 · 순차 호출, 랭커 닉네임 변환은 90초당 8명으로 페이싱
- 429를 받으면 Retry-After 동안 백그라운드 작업 전역 정지 + DB 폴백 응답

## 환경변수 (.env)

| 키 | 무엇 |
|---|---|
| `API_KEY` | Riot Development API Key (pixlol 명명 규칙, 핫리로드 대상) |
| `MONGO_URI` | Atlas 연결 문자열. pixlol 클러스터 재사용. **비우면 DB 없이 동작** |
| `MONGO_DB_NAME` | `dogu_tft` — pixlol 컬렉션(기본 DB)과 분리용 |
| `BASE_PATH` | `/tft` (dogu.gg/tft 서브패스 마운트, dogu_template 규칙) |
| 나머지 | `SITE_ORIGIN` `SITE_NAME` `CONTACT_EMAIL` `BUILD_ID` 등 템플릿과 동일 |

## 구조

```
server/
  config.js    환경변수 로드 + BASE_PATH 정규화 (템플릿 그대로)
  riot.js      Riot 호출기 · API 키 핫리로드 · 429 전역 잠금
  db.js        MatchCache(30일 TTL) · SummonerCache (pixlol 패턴)
  tftdata.js   CDragon ko_kr.json → 챔피언/특성/아이템/증강 룩업 (부팅+24h 갱신)
  api.js       /api/search /api/matches /api/ranking /api/autocomplete /api/static
  server.js    정적 서빙 · 앱 셸 · SPA 폴백 (템플릿 + API 마운트)
public/
  js/tft.js    TFT 도메인 헬퍼 (정적 데이터 캐시 · 포맷터 · 유닛/특성 렌더러)
  js/app.js    페이지 핸들러 (홈 검색+자동완성 · 소환사 전적 · 랭킹)
  나머지       base/ui/store/api/router = dogu_template 그대로
```

## 기능

- **닉네임 검색** — `이름#태그` (태그 생략 시 KR1). 자동완성은 검색·랭킹으로
  축적된 SummonerCache에서 (Mongo 연결 시).
- **소환사 페이지** — 프로필 + 랭크/더블업/초고속 리그 카드 + 최근 게임 요약
  (평균 등수·1위·순방률) + 매치 리스트(등수·시너지·증강·유닛/아이템/성).
  행 클릭 시 8인 상세, "전적 더 보기" 페이지네이션.
- **랭킹** — 챌린저~마스터 상위 1000명, 10분 주기 갱신. 닉네임은 백그라운드
  변환이라 처음엔 "집계 중…"이 섞여 있다가 점차 채워진다 (`.cache/`와 Mongo에
  누적되므로 재시작해도 유지).

## 세트 교체 시

할 일 없음. 정적 데이터는 CDragon `latest`에서 최신 2개 세트를 자동으로 가져온다.
아이콘이 깨지면 서버 로그의 `[Task] TFT 정적 데이터` 라인부터 확인.
