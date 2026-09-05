# dogu_tft

전략적 팀 전투(TFT) 전적 사이트. 한국어로 대화해줘. 평서형 "~다" 말투 말고 "~야/~어" 쪽으로.

- Node/Express + 바닐라 JS SPA, 빌드 없음. `dogu.gg/tft` 로 서빙 (`BASE_PATH=/tft`). 로컬 `npm run dev` → `http://localhost:3000/tft/`
- 브랜치는 **`master`** 다 (다른 dogu 저장소는 main)
- 코드에 `/` 로 시작하는 URL 을 직접 쓰지 말 것 — `App.url()` / `App.api()` / `%BASE%` (dogu_er 의 CLAUDE.md 「BASE_PATH」 절과 같은 규약)

## dogu.gg 공통 UI (2026-08-22)

헤더(2단·게임 스위처·검색) · 히어로 검색창 · 푸터 · 404 · 배경 구조는 `public/dogu-ui.css` + `public/dogu-header.js` 가 그린다.
**둘 다 복사본이라 이 폴더에서 고치지 말 것** — 원본은 `dogu_template/dogu-ui/`(git HEAD), 사양·체크리스트는 `dogu_template/dogu-ui/DOGU_UI.md`.
손대기 전에 5곳 md5 가 같은지 본다 (`DOGU_UI.md` 11-0). 이 폴더의 `DOGU_UI.md`·`DOGU_UI_PLAN.md` 는 옛 복사본이니 원본 쪽을 볼 것.

- 마운트는 `public/js/app.js` 의 `mountDoguUI()`. 스위처 아이콘 경로 옵션 이름은 **`iconBase`** (`App.url('/')`). 한때 `icons` 로 갈라졌던 적이 있다
- **`#hero` 는 `main` 밖(헤더와 `main` 사이)에 있다.** `main` 의 좌우 20px 패딩 안에 두면 모바일 검색창이 568px 로 좁아져 다른 사이트와 어긋난다 (실측 후 옮김). 홈이 아닐 땐 공통 CSS 가 `body.dogu-home` 기준으로 숨긴다 — `router.js` 의 `DoguUI.setHome()` 호출이 표시 조건
- 자동완성 패널(`#search-suggest`)은 사이트 것이라 마운트 뒤 `.dogu-search-wrapper` 안에 끼운다
- `style.css` 엔 `button { font-family: inherit }` 리셋이 없다. 공통 파일은 그걸 전제하지 않도록 고쳐 뒀지만(검색 버튼이 Arial 로 나갔던 원인), 사이트 자체 버튼을 새로 만들 땐 글꼴을 직접 줄 것
- 사이트 CSS 에 `.dogu-*` 선택자를 쓰지 말 것. `:root` 의 `--dogu-*` 변수만 덮어쓴다

## 절대 건드리지 말 것

- `.env` (gitignore 대상)
- 푸터의 Riot Games 권리 고지 문구 (`app.js` `mountDoguUI()` 의 `notice`)

## 작업 규칙

- 파일을 고치기 전에 먼저 읽고 설명해줘. 내가 납득한 뒤에 수정
- 커밋 전에 `git status`. 화면을 고쳤으면 말로 끝내지 말고 실제로 열어서 확인할 것

## 글자 크기 계단 (2026-09-05)

5사이트 공통 계단이 확정됐다 — **`font-size` 는 11(미세 라벨만) / 12 / 13 / 14 / 15 / 17 / 20 / 24 / 28 만 쓴다. 0.5 단위 금지, 폰 전용 단 없음, 폰 입력창 16 은 예외.** 표와 규칙은 루트 `DOGU_UI.md` 13절, 근거·실측·사이트별 치환 내역은 `dogu_template/audit/font-scale.md`. 이 저장소는 9/5 에 계단으로 스냅했다(`git log --grep "글자 계단"`). 새 CSS 를 쓸 때 이 값 밖의 크기가 필요하면 먼저 그 표를 고칠 것.
