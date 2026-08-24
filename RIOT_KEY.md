# Riot API 키 — Personal Key 신청 (2026-08-24)

개발 키(24시간 만료) 때문에 사이트가 계속 죽는다. **Personal API Key** 로 갈아탄다.
만료가 없고 한도는 개발 키와 똑같다.

| | 한도 | 만료 | 심사 |
|---|---|---|---|
| Development | 20/1s · 100/2min | **24시간** | 없음 |
| **Personal** | **20/1s · 100/2min** | **없음** | 상세 설명 심사 (도메인 인증 불필요) |
| Production | 500/10s · 30,000/10min | 없음 | 프로토타입·도메인 인증 필요, 오래 걸림 |

출처: <https://developer.riotgames.com/application-process.html>

## 신청 절차

1. <https://developer.riotgames.com> 로그인 → **REGISTER PRODUCT**
2. **PERSONAL API KEY** 쪽을 고른다 (Production 아님)
3. 아래 「제출 문안」을 붙여넣는다. Personal 은 **상세한 제품 설명**이 심사의 전부다
4. 승인되면 포털의 앱 페이지에서 키를 받아 `.env` 의 `API_KEY` 와 Railway Variables 양쪽에 넣는다

### ⚠ 주의

- **pixlol.kr 의 Production 키 신청(2026-03-10, Pending Review)이 걸려 있다.**
  그 앱의 `EDIT` 는 절대 누르지 말 것 — 심사 대기열 뒤로 밀린다.
  이번 건은 **새 제품 등록**이라 그 앱을 건드리지 않는다.
- Personal 키 규정에 *"just the developer or a small private community"*, *"may not run
  your application for public consumption"* 이라는 문구가 있다. dogu.gg/tft 는 공개
  주소지만 지금은 사실상 개인·지인용이다. **아래 문안이 실제와 맞는지 한 번 읽어보고
  제출할 것.** 나중에 사람이 붙어 트래픽이 늘면 Production 으로 다시 신청해야 한다.
- Production 으로 갈 땐 **`dogu.gg/riot.txt` 가 필요하다. 지금 404 다**
  (pixlol.kr/riot.txt 는 200 — UUID 한 줄, `pixlol.kr/public/riot.txt`).
  dogu.gg 루트는 `dogu_main` (Cloudflare) 이니 토큰을 받으면 `dogu_main/public/riot.txt` 에 둔다.

---

## 제출 문안

### Product Name

```
dogu.gg TFT
```

`DOGU.GG` 는 사이트 묶음 전체 이름이라 제품 하나를 가리키기엔 넓고, `dogu.gg/tft` 는
이름 칸에 주소를 넣는 꼴이라 어색하다. 주소는 URL 칸에 따로 적으니 **`dogu.gg TFT`** 가 맞다.
(포털 앱 목록에서 pixlol 건과 한눈에 구분도 된다.)

### Product URL

```
https://dogu.gg/tft
```

### Description — 짧은 판 (이걸 붙여넣으면 된다)

```
dogu.gg/tft is a Korean-language Teamfight Tactics match history site that I build and
maintain by myself as a personal, non-commercial hobby project, for me and a few friends
who play on the KR server.

Search a Riot ID and the site shows that player's TFT profile and league entries (Ranked,
Double Up, Hyper Roll), a recent-games summary, and a match list with each game's placement,
traits, augments and units; clicking a match expands the full 8-player board. There is also
a KR Challenger/Grandmaster/Master leaderboard, and a meta page showing pick rate, average
placement and top-4 rate per unit, trait and item, aggregated from matches already stored in
my own database. Champion, trait and item names and icons come from Community Dragon, not
from the Riot API.

It calls ACCOUNT-V1, TFT-SUMMONER-V1, TFT-LEAGUE-V1 and TFT-MATCH-V1 on the KR platform host
and the ASIA regional host. To stay inside the 20/sec and 100/2min limits: match details are
stored in MongoDB for 30 days so the same match ID is never fetched twice, search responses
are cached for 2 minutes, the leaderboard refreshes at most once every 10 minutes with
sequential (never parallel) calls, background Riot ID lookups are paced at 8 accounts per 90
seconds, match crawling for the stats page is capped at 5 matches per 5-minute cycle, and on
a 429 the server reads Retry-After and suspends every background job for that duration
instead of retrying.

There are no ads and no monetization of any kind. The footer carries the required Riot legal
notice, and terms of service and privacy policy pages are published at /tft/terms and
/tft/privacy. No personally identifiable information is collected — only public match data
and the Riot IDs / PUUIDs the API returns.

Node.js / Express + MongoDB Atlas, hosted on Railway behind Cloudflare.
```

### Description — 긴 판 (심사가 더 캐물으면)

```
dogu.gg/tft is a Korean-language Teamfight Tactics match history site that I build and
maintain by myself as a non-commercial hobby project. It is used by me and a small group
of friends who play TFT on the KR server. It is one page of a small personal site family
(dogu.gg) I run for the games I play; it is not advertised or promoted anywhere.

WHAT THE SITE DOES

- Riot ID search (gameName#tagLine, tag defaults to KR1). Resolves the account and shows
  the player's TFT profile: level, profile icon, and the Ranked / Double Up / Hyper Roll
  league entries.
- A recent-games summary (average placement, number of 1st places, top-4 rate) and a match
  list. Each row shows the placement, active traits, augments, and the units with their
  items and star level. Clicking a row expands the full 8-player board for that match.
- A KR leaderboard page listing Challenger / Grandmaster / Master players.
- A meta statistics page: pick rate, average placement, top-4 rate and win rate per unit,
  trait and item, aggregated from ranked matches already stored in my own database.

Static game data (champion / trait / item / augment names and icons) comes from Community
Dragon, not from the Riot API.

RIOT APIS USED (KR platform host + ASIA regional host)

- ACCOUNT-V1     /riot/account/v1/accounts/by-riot-id/{name}/{tag}, /by-puuid/{puuid}
- TFT-SUMMONER-V1 /tft/summoner/v1/summoners/by-puuid/{puuid}
- TFT-LEAGUE-V1  /tft/league/v1/by-puuid/{puuid}, /tft/league/v1/{challenger|grandmaster|master}
- TFT-MATCH-V1   /tft/match/v1/matches/by-puuid/{puuid}/ids, /tft/match/v1/matches/{matchId}

HOW I STAY INSIDE THE RATE LIMIT (20/sec, 100/2min)

- Match details are stored in MongoDB with a 30-day TTL, so any given match ID is fetched
  from Riot exactly once and never again.
- Search responses are memory-cached for 2 minutes.
- The leaderboard refreshes at most once every 10 minutes, and its calls are sequential,
  never parallel.
- Riot ID lookups for leaderboard entries run in the background, paced at 8 accounts per
  90 seconds, and the resolved names are cached on disk and in the database so a restart
  does not re-request them.
- Match crawling for the statistics page is capped at 5 matches per 5-minute cycle with a
  2-second gap between calls.
- On any 429 the server reads Retry-After and globally suspends every background job for
  that duration, serving cached data instead of retrying.

COMPLIANCE

- No advertising, no payments, no monetization of any kind.
- The footer carries the required legal notice: "DOGU.GG: 전략적 팀 전투 is not endorsed by
  Riot Games and does not reflect the views or opinions of Riot Games or anyone officially
  involved in producing or managing Riot Games properties. Riot Games and Teamfight Tactics
  are trademarks or registered trademarks of Riot Games, Inc."
- Terms of Service and Privacy Policy are published at https://dogu.gg/tft/terms and
  https://dogu.gg/tft/privacy.
- No personally identifiable information is collected. The only data stored is public match
  data and the Riot IDs / PUUIDs returned by the API.

TECH: Node.js / Express + MongoDB Atlas, hosted on Railway behind Cloudflare.
```
