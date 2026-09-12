# 라이엇 이슈 초안 — TFT 매치 딜량 0 (2026-09-12)

**올릴 곳**: https://github.com/RiotGames/developer-relations/issues (New issue → Bug)
**아직 안 올렸다.** 올릴지 말지는 사용자가 정한다. 올릴 때 아래 본문을 그대로 붙여 넣으면 된다.

**왜 값어치가 있나**: 기존 이슈 [#1171](https://github.com/RiotGames/developer-relations/issues/1171)(7/29, PBE — 주 불만은 units/traits 누락)·[#1185](https://github.com/RiotGames/developer-relations/issues/1185)(9/2, 라이브 — `game_version` 플레이스홀더·augments 누락) 둘 다 Open·답변 없음이지만, **`total_damage_to_players` 가 전수 0 이라는 것을 표본으로 짚은 이슈는 아직 없다.** 아래 수치는 2026-09-12 에 우리 캐시 200경기를 직접 전수 조사한 것이다 (읽기 전용, 라이엇 API 호출 없음).

**근거 데이터 (내가 직접 잰 것)**

| 항목 | 값 |
|---|---|
| 매치 | 200 (KR, 2026-09-07 ~ 09-12) |
| 참가자 | 1,586 |
| `tft_set_core_name` | `TFTSet18` × 200 |
| `game_version` | `TFT Unreal Version ?.?.?.?` × 200 |
| `queue_id` | 1100 × 196 · 1220 × 2 · 1090 × 2 |
| `total_damage_to_players` > 0 | **0 / 1,586** (키는 1,586 전부에 존재) |
| `players_eliminated` > 0 | **0 / 1,586** (키는 전부 존재) |
| `time_eliminated` > 0 (대조군) | 1,586 / 1,586 |
| `level` > 0 (대조군) | 1,586 / 1,586 |
| `gold_left` > 0 (대조군) | 1,209 / 1,586 (0 은 정상값) |
| units/traits 빈 참가자 | 7 / 1,586 |
| 참가자 키 중 딜량 비슷한 것 | `total_damage_to_players` **하나뿐** (이름 변경 아님) |

**결정적 예**: `KR_8376484567` 의 1위 참가자 — `placement: 1`, `win: true`, `last_round: 35`, `level: 10`, units 10개, traits 13개, `time_eliminated: 2251` 인데 `total_damage_to_players: 0`, `players_eliminated: 0`. **1위로 끝까지 간 플레이어가 딜 0 · 처치 0 일 수는 없다.**

---

## 이슈 본문 (영문, 그대로 복사)

**Title**

```
[BUG][TFT-MATCH-V1] Set 18 live: total_damage_to_players and players_eliminated are 0 for every participant
```

**Body**

```markdown
### Summary

On TFT Set 18 (live, not PBE), `tft-match-v1` returns `total_damage_to_players: 0` and
`players_eliminated: 0` for **every participant in every match**. The fields are present in the
payload — they are simply always zero. Other per-participant fields in the same object
(`time_eliminated`, `level`, `last_round`, `gold_left`, `units`, `traits`) are populated normally,
so this is not a case of the response being broadly empty.

This makes both fields unusable for any post-game stats display.

### Expected behaviour

`total_damage_to_players` and `players_eliminated` reflect the participant's damage dealt to
other players and the number of players they eliminated, as documented for `tft-match-v1`.

### Actual behaviour

Both are `0` for all participants, including the 1st-place winner of a full-length game.

### Evidence

Full scan of our own match cache — 200 matches / 1,586 participants, KR, played
2026-09-07 to 2026-09-12, fetched from `/tft/match/v1/matches/{matchId}` (no filtering applied):

| Field | Participants with value > 0 |
|---|---|
| `total_damage_to_players` | **0 / 1,586** (key present on all 1,586) |
| `players_eliminated` | **0 / 1,586** (key present on all 1,586) |
| `time_eliminated` (control) | 1,586 / 1,586 |
| `level` (control) | 1,586 / 1,586 |
| `gold_left` (control) | 1,209 / 1,586 (0 is a legitimate value) |

All 200 matches report `"tft_set_core_name": "TFTSet18"` and
`"game_version": "TFT Unreal Version ?.?.?.?"`. Queues: 1100 (×196), 1220 (×2), 1090 (×2).

The full set of participant keys we observe is:

```
companion, gold_left, last_round, level, missions, placement, players_eliminated,
puuid, riotIdGameName, riotIdTagline, time_eliminated, total_damage_to_players,
traits, units, win
```

There is no alternative damage field under a different name — matching keys against
`/dam|dmg|deal|hurt/i` across all 1,586 participants returns only `total_damage_to_players`.
So this does not look like a rename.

**Concrete example** — match `KR_8376484567`, the 1st-place participant:

```json
{
  "placement": 1,
  "win": true,
  "last_round": 35,
  "level": 10,
  "time_eliminated": 2251,
  "gold_left": 5,
  "players_eliminated": 0,
  "total_damage_to_players": 0,
  "missions": { "PlayerScore2": 222 },
  "units": [ ...10 units... ],
  "traits": [ ...13 traits... ]
}
```

A player who finishes 1st after 35 rounds cannot have dealt 0 damage to players or
eliminated 0 players.

### Environment

- Endpoint: `GET /tft/match/v1/matches/{matchId}` (asia routing, KR players)
- Set 18, live servers (not PBE)
- Observed continuously from 2026-09-07 through 2026-09-12 — every match in the window

### Related

- #1171 — Set 18 PBE, missing player data. Its primary report is about empty `units`/`traits`
  arrays, but the sample payload there also shows `players_eliminated: 0` and
  `total_damage_to_players: 0`. In our live data `units`/`traits` are populated for all but
  7 of 1,586 participants, while the two counters are zero for all of them — so on live these
  look like two separate problems, and only the zeroed counters remain.
- #1185 — Set 18 live, `game_version` placeholder `TFT Unreal Version ?.?.?.?` and missing
  augments/partner groups. We see the same `game_version` placeholder on all 200 matches,
  which suggests the same Set 18 Unreal pipeline.

### Question

Is this a known gap in the Set 18 Unreal client's match reporting, and is there an ETA or an
alternative field we should read in the meantime?
```

---

## 올릴 때 확인할 것

- 올리기 전에 **최신 이슈 목록을 한 번 더 검색**해라 (`total_damage_to_players`, `players_eliminated`) — 9/12 이후 누가 먼저 올렸을 수 있다.
- `puuid` 는 본문에 안 넣었다. 매치 ID(`KR_8376484567`)는 공개 식별자라 그대로 둬도 된다.
- 우리 쪽 대응은 이미 끝났다 — 그 경기 전원이 0이면 화면에서 딜량을 숨기고, 값이 돌아오면 배포 없이 자동 복구된다 (`dogu_tft` `a5461f2`).
