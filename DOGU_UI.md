# DOGU_UI — 공통 UI 사양서

`dogu-ui.css` / `dogu-header.js` 두 파일의 사양. 원본은 `dogu_template/dogu-ui/` 에 있고 (2026-08-25 `dogu_er/dogu-ui/` 에서 이동), 각 사이트의 `public/` 에 **복사해서** 쓴다. 사이트 폴더에서 직접 고치지 말 것 — 원본을 고치고 `dogu_template/sync-ui.ps1`(또는 `npm run sync:ui`)로 다시 복사한다.

모든 수치는 `dogu_er/public/style.css`(2026-08-22) 에서 그대로 가져왔다. 사양의 근거는 `DOGU_UI_PLAN.md`.

---

## 1. 적용 방법

```html
<head>
  <meta name="theme-color" content="#0a1224">   <!-- --dogu-bg 와 같은 값 -->
  <link rel="stylesheet" href="dogu-ui.css">
  <link rel="stylesheet" href="style.css">       <!-- 사이트 CSS 는 공통 CSS 뒤에 -->
</head>
<body class="dogu-body">
  <!-- 헤더는 DoguUI.mountHeader() 가 body 맨 앞에 끼운다 -->
  <div id="hero"></div>                          <!-- DoguUI.mountHero('#hero', …). 헤더와 main 사이, 풀폭·패딩 0 (5절) -->
  <main>
    <section id="page-home">
      …
    </section>
  </main>
  <!-- 푸터는 DoguUI.mountFooter() 가 body 끝에 붙인다 -->
  <script src="dogu-header.js"></script>
  <script src="app.js"></script>
</body>
```

사이트 `style.css` 맨 위에서 사이트별 변수만 덮어쓴다:

```css
:root {
    --dogu-bg: #0a1224;
    --dogu-accent: #45b3f2;
    --dogu-accent-dark: #1f6fd0;
    --dogu-bg-image: url('./img/bg.webp');
}
```

`body` 에 `dogu-body` 클래스가 **반드시** 있어야 배경·오버레이가 깔린다. `html` 에는 배경을 주지 말 것.

---

## 2. 사이트별 변수 (바꿔도 되는 것)

| 변수 | 기본값(er) | 용도 |
|---|---|---|
| `--dogu-bg` | `#0a1224` | 이미지 로드 전/밖 바탕색. `theme-color` 메타와 같은 값 |
| `--dogu-accent` | `#45b3f2` | 액센트 밝은쪽. 로고 `.GG`·네비 활성 밑줄·스위처 마크·포커스 테두리·검색 버튼 그라데이션 시작 |
| `--dogu-accent-dark` | `#1f6fd0` | 액센트 어두운쪽. 검색 버튼 그라데이션 끝 |
| `--dogu-bg-image` | `none` | 배경 이미지 `url(...)`. 사이트가 반드시 지정 |
| `search.suggest(q)` (옵션) | — | 히어로 검색창 자동완성. `[{key, label, sub, href}]` 또는 그 Promise 를 돌려주면 입력 중에 드롭다운이 결과로 바뀐다(200ms 디바운스, 늦게 온 응답은 버림). **안 주면 예전 그대로** 즐겨찾기/최근만 뜬다.<br>★ **`null` 을 돌려주면 자동완성을 안 켠다** — 빈 배열(`[]`)과 구분한다. `[]` 는 "찾아봤는데 없음"이라 안내가 뜨고, `null` 은 아무 일도 없던 것처럼 즐겨찾기/최근이 그대로 남는다. 글자 수가 모자랄 때 쓰라고 만든 것 (er 은 한글 2자·영숫자 3자) |
| `--dogu-bg-pos` | `center center` | 배경 초점(`background-position`). 일러스트마다 인물 위치가 달라서 사이트가 잡는다. **다만 이걸로 움직일 수 있는 폭은 뷰포트와 이미지의 비율 차이만큼뿐이다** — 그보다 크게 옮겨야 하면 이미지를 크롭하는 게 낫다 (er 이 그렇게 했다) |
| `--dogu-bg-blur` | `0px` | 배경 이미지 블러. **기본 0**. 꼭 필요할 때만 |
| `--dogu-overlay-rgb` | `6, 11, 26` | 오버레이 색 (쉼표 구분 RGB) |
| `--dogu-overlay-home-top` | `0.52` | 홈 오버레이 농도, 맨 위 |
| `--dogu-overlay-home-mid` | `0.56` | 홈, 520px 지점 |
| `--dogu-overlay-home-deep` | `0.9` | 홈, 880px 지점 |
| `--dogu-overlay-home-bottom` | `0.93` | 홈, 맨 아래 |
| `--dogu-overlay-page-top` | `0.8` | 홈 이외 페이지, 맨 위 |
| `--dogu-overlay-page-deep` | `0.93` | 홈 이외, 560px 부터 끝까지 |

사이트별 액센트 값은 `DOGU_UI_PLAN.md` 의 색 표를 따른다. 밝은 배경 이미지(메이플 하늘)는 `home-top`/`home-mid` 를 올려 쓴다.

`--dogu-accent-strong`(밝은 글자색) · `--dogu-accent-weak`(활성 배경) · `--dogu-accent-glow`(로고 광택)는 `color-mix()` 로 액센트에서 자동 파생된다. 따로 주지 않는다.

**그 외 토큰(`--dogu-text*`, `--dogu-card*`, `--dogu-line*`, `--dogu-gnb-*`, `--dogu-radius`, `--dogu-wrap`)은 건드리지 않는다.** 헤더·푸터·카드의 어두운 유리 색은 er 남색 고정이고, 이건 전 사이트 공통 분위기다.

---

## 3. 배경 구조

```
body.dogu-body           background: var(--dogu-bg)           ← 루트 캔버스로 승격
body.dogu-body::before   fixed, inset 0, z-index -2          ← 이미지 (var(--dogu-bg-pos) / cover, filter: blur(var(--dogu-bg-blur)))
body.dogu-body::after    fixed, inset -150px, z-index -1      ← 오버레이 그라데이션
```

- 페이지 전체를 덮는다. **히어로 안에만 이미지를 넣는 방식은 쓰지 않는다**
- er 원본은 이미지가 `body` 배경이고 오버레이가 `body::before` 하나다. 공통 파일은 블러 변수를 받으려고 이미지를 자기 레이어(`::before`)로 뺐다. 블러 0 이면 보이는 결과는 같다
- **홈 / 비홈 농도 전환은 `body.dogu-home` 클래스다.** 라우터가 홈을 켤 때 `DoguUI.setHome(true)`, 다른 페이지로 갈 때 `setHome(false)`. 클래스가 없으면 진한(비홈) 쪽이 기본

### 라우터 연결 (필수 — 복사만으로는 안 되는 부분)

사이트마다 라우터가 달라서 이 한 군데는 손으로 잇는다. **페이지가 바뀌는 지점 한 곳**에서 두 줄을 부른다:

```js
DoguUI.setHome(isHome);          // 홈이면 true — 오버레이 농도
DoguUI.setActiveNav(navKey);     // 2단 네비 활성 표시 (mountHeader 의 nav[].key)
```

er 에서 한 방법 (`public/js/router.js` 의 `render()`, 페이지를 켜는 바로 다음):

```js
App.ui.showPage(route.page);
App.ui.setActiveNav(route.nav);
if (window.DoguUI) {
    DoguUI.setActiveNav(route.nav);          // routes.js 의 navItems() 가 key 로 route.nav 를 줬다
    DoguUI.setHome(route.id === 'home');     // 홈 판정은 라우트 id 하나로. 페이지 전환 방식이 바뀌어도 안 깨진다
}
```

- 홈 판정을 "특정 섹션이 보이는지"(`:has`, `display` 검사)로 하지 말 것. er 이 그렇게 했다가 공통화하면서 버렸다 — 사이트의 페이지 전환 방식에 묶여서 옮길 수 없다
- 해시 라우터·멀티 페이지 사이트면 `DOMContentLoaded` 에서 현재 주소로 한 번, 이후 주소가 바뀔 때마다 한 번 부른다
- **확인법**: 홈에서 다른 메뉴로 갔다 오면서 배경 일러스트가 진해졌다 옅어지는지 본다. 개발자 도구로 `body.classList` 에 `dogu-home` 이 붙고 떨어지는지 보면 확실하다
- 이미지 레이어는 **뷰포트와 같은 크기**여야 한다. 상자를 키우면 `cover` 가 확대돼 er 보다 크게 보인다. 블러를 쓰면 가장자리가 살짝 밝아지는데, 기본이 0 이라 무시한다
- 오버레이의 px 지점(520/880/560)은 레이어가 위로 150px 삐져나가 있어 **뷰포트 기준 +150** 이다

### 스크롤바 (2026-08-22 공통화)

`::-webkit-scrollbar` 10px, 트랙 `--dogu-bg`, 손잡이 `--dogu-accent-dark`, hover `--dogu-accent` (Firefox 는 `scrollbar-color` 로 hover 없이). pixlol·tft 가 이미 이 모양이었고 er(회색·hover 없음)·maple(다른 색)·loa(규칙 없음)가 달라서 공통으로 올렸다. **전역 선택자라 사이트 `style.css` 에 `::-webkit-scrollbar*` 가 남아 있으면 그쪽이 이긴다** — 적용할 때 사이트 규칙을 지울 것 (내부 목록 전용 `.xxx::-webkit-scrollbar` 는 사이트 몫이라 둬도 된다)

---

## 4. 헤더

`DoguUI.mountHeader(opts)` — `<header class="dogu-gnb">` 를 만들어 `opts.container` 에, 없으면 body 맨 앞에 끼운다.

```js
DoguUI.mountHeader({
    site: 'er',                       // 스위처 활성 표시. lol | er | maple | loa | tft
    iconBase: '/er/',                 // 스위처 아이콘 경로 앞부분 (public/ 의 header_{key}.png 가 이 아래 있어야)
    home: '/er/',                     // 로고·⌂·홈으로 돌아가기 링크
    brand: 'DOGU', tld: '.GG',        // pixlol 만 'PIXLOL', '.KR'
    linkAttr: 'data-link',            // 내부 링크에 붙일 속성 (라우터가 가로채게). 없으면 생략
    nav: [
        { key: 'ranking', label: '순위표', href: '/er/ranking', active: true },
        …
    ],
    aside: '패치 <b>1.2.0</b>',        // 2단 우측 보조 정보 HTML. 없으면 빈칸
    search: {                         // false 를 주면 1단 검색창을 뺀다
        placeholder: '플레이어 닉네임을 입력해주세요.',
        onSubmit: function (query, inputEl) { … }
    }
});
```

- **2단 고정.** 1단 = 로고 / 게임 스위처 / (우) 검색창, 2단 = ⌂ + 네비 / (우) 보조 정보
- 1단: 높이 62px(768px 이하 52px), 배경 `rgba(8,15,32,.66)`. 2단: 46px, `rgba(15,27,52,.55)`. 헤더 전체 `sticky; blur(14px) saturate(1.3)`
- **1단 검색창은 상시 노출, 768px 이하에서만 숨김.** 스크롤 연동 없음. 드롭다운 없음
- 로고: 이탤릭 텍스트 두 조각, 아이콘 없음. 21px/900
- 후속 갱신: `DoguUI.setActiveNav(key)`, `DoguUI.setAside(html)`

### 게임 스위처

목록은 `dogu-header.js` 의 `GAMES` 에 고정돼 있다. **사이트에서 바꾸지 않는다.**

| 순서 | 이름 | 이동 |
|---|---|---|
| 1 | 리그 오브 레전드 | `https://pixlol.kr` (외부) |
| 2 | 이터널 리턴 | `/er` |
| 3 | 메이플스토리 | `/maple` |
| 4 | 로스트아크 | `/loa` |
| 5 | 전략적 팀 전투(TFT) | `/tft` |

현재 사이트(`opts.site`)는 `.active` 로 표시되고 링크가 아니다. 버튼 클릭으로 열고, 바깥 클릭으로 닫힌다. 랜딩(dogu.gg)에는 헤더 자체를 안 쓴다.

**아이콘**: 각 항목은 아이콘(32×32) + 게임명, 버튼은 현재 게임 아이콘(22×22) + 게임명. 파일은 **각 사이트 `public/` 에 `header_lol.png` `header_er.png` `header_maple.png` `header_loa.png` `header_tft.png` 다섯 개 전부** 복사해 둔다 (256×256 투명 PNG, 다크 배경 전제, 여백은 이미 맞춰져 있어 CSS 에서 padding·crop 을 더하지 않는다). `opts.iconBase` 가 경로 앞부분이다 — er 은 `App.url('/')` = `/er/`. `<img>` 에 `width`/`height` 속성을 박아 이미지가 늦게 와도 레이아웃이 안 밀리고, `alt` 에 게임 이름이 들어간다. 현재 게임 아이콘만 불투명, 나머지는 `opacity .55`(hover 시 1). 768px 이하에서는 **버튼만** 아이콘으로 줄이고 **펼친 목록은 아이콘+게임명 그대로다** (2026-08-24 — 예전엔 목록 이름까지 숨겼는데 아이콘만으로는 게임이 안 갈렸다).

- **옵션 이름은 `iconBase` 하나다.** 값은 `/tft/` 처럼 슬래시로 끝나는 경로 앞부분(루트 사이트는 `/`). 2026-08-22 에 tft 복사본이 `icons: '/tft'` 로 갈라진 적이 있어 공통 파일이 `icons` 도 받고 끝 슬래시도 맞춰 주지만, 새로 쓰는 곳은 `iconBase` 로
- `iconBase` 를 안 주면 액센트색 글자 타일(`.dogu-game-mark`, 첫 글자)로 떨어진다. 아이콘 파일을 못 둔 사이트의 임시 모습이지 규격은 아니다
- **`gamesOrigin` 옵션 (2026-08-24)**: GAMES 의 내부 주소(`/er` 등)는 dogu.gg 기준 상대 경로다. **dogu.gg 밖에서 도는 사이트(pixlol)는 `mountHeader` 에 `gamesOrigin: 'https://dogu.gg'` 를 줘야** 다른 게임 링크가 절대 주소가 된다 — 안 주면 pixlol.kr/er 로 가서 그 사이트 SPA 가 받아 "다른 게임을 눌러도 제자리" 가 된다. dogu.gg 계열 사이트는 안 준다 (상대 경로 유지 — 절대 주소면 로컬에서 프로덕션으로 튄다)
- **모바일 이중 헤더 정리 (2026-08-24)**: 768px 이하에서 2단 네비(`.dogu-gnb-main`)를 접고, 1단 오른쪽에 햄버거(`.dogu-menu-btn`, 세 줄)가 생긴다. 누르면 헤더에 `dogu-menu-open` 클래스가 붙고 2단이 1단 아래 **세로 메뉴 패널**(absolute)로 펼쳐진다. 바깥 클릭·메뉴 항목 클릭이 닫는다 (사이트 라우터가 preventDefault 만 하고 전파를 살려 두는 규약이라 document 리스너가 받는다). **마크업·`data-nav`·라우터 연결은 데스크톱과 같은 요소**라 `setActiveNav` 가 그대로 동작한다. `.dogu-nav-home`(⌂)은 모바일에서 숨긴다 — 홈은 로고가 맡는다
- **스위처 마크업을 사이트 쪽에서 DOM 으로 덧칠하지 말 것** (pixlol 이 `decorateSwitcherIcons()` 로 `.pix-game-*` 를 끼워 넣었다가 아이콘 크기·간격이 다른 사이트와 어긋났다. 2026-08-22 제거). 원하는 게 있으면 원본을 고쳐 다시 복사한다

---

## 5. 히어로 + 검색창

`DoguUI.mountHero(container, opts)` — 로고(52px, 768px 이하 36px) + 알약 검색창 + 포커스 드롭다운. 히어로 로고도 헤더 로고처럼 `opts.home` 으로 가는 링크다 (pointer, 드래그 선택 불가, 밑줄·색 변화 없음).

**모바일 입력창 글자 16px** (2026-08-25): iOS 사파리는 포커스한 input 글자가 16px 미만이면 화면을 확대한다. 그래서 768px 이하에서 `.dogu-search-input`·`.dogu-gnb-search input` 은 16px 이다 (데스크톱 14/12.5px). 사이트 자체 input 을 모바일에서 쓰는 곳(loa 입찰·maple 길드 등)은 각 사이트 CSS 에서 같은 규칙을 적용해야 한다. `maximum-scale=1` 로 막지 말 것 — 핀치 줌까지 죽는다.

**`opts.mascot`** (2026-08-25): 로고 왼쪽에 붙는 사이트 마스코트 이미지 경로 — 각 사이트의 파비콘(모자만 다른 도구 캐릭터)을 준다. er `favicon-192.png` · maple `icon-192.png` · loa `apple-touch-icon.png` · tft `favicon.png` · pixlol `/favicon_lol_180.png`. 크기는 글자에 비례(`height: 1.25em`)하므로 따로 맞출 게 없다. 헤더 로고에는 붙이지 않는다 — 헤더는 로고 오른쪽에 게임 스위처 아이콘이 이미 있어서 아이콘 둘이 글자를 끼는 모양이 된다.

**히어로 상자(`container`)의 규격: 헤더 바로 밑 · 화면 폭 전체 · 패딩 0.** 검색창 위치는 `.dogu-hero-inner` 의 패딩(74/62px)과 `.dogu-search-wrapper` 의 `max-width: 600px; margin: 26px auto 0` 만으로 정해져야 5개 사이트에서 같은 자리에 놓인다. 상자나 그 조상에 패딩·폭 제한이 있으면 그만큼 검색창이 내려앉거나 좁아지는데, 1280px 에서는 가운데 정렬 덕에 티가 안 나고 **모바일에서만 검색창 폭이 달라진다** (실측: 640px 에서 er·maple 600px, loa·tft 568px, pixlol 552px). `mountHero()` 가 마운트 직후 상자와 조상의 패딩·폭을 재서 벗어나면 콘솔에 `[dogu-ui] 히어로 상자가 규격…` 경고를 찍는다 — **적용 뒤 콘솔을 한 번 볼 것.** 정석은 `#hero` 를 **`main` 밖, 헤더와 `main` 사이**에 두는 것이다 (1절 골격). 그러면 페이지 컨테이너가 숨겨 주지 않으므로 **공통 CSS 가 `body.dogu-home` 이 없을 때 `.dogu-hero` 를 `display: none` 으로 숨긴다** — 라우터의 `DoguUI.setHome()` 연결(3절)이 곧 히어로 표시 조건이다. loa·tft·pixlol 은 2026-08-22 에 이렇게 옮겼고, er·maple 은 `#page-home` 안에 있어도 부모 패딩이 0 이라 그대로 뒀다.

```js
DoguUI.mountHero('#hero', {
    brand: 'DOGU', tld: '.GG', linkAttr: 'data-link',
    search: {
        placeholder: '플레이어 닉네임을 입력해주세요.',
        button: undefined,                    // 버튼 안 내용 HTML. 생략 = ".GG" 글자. pixlol 만 DoguUI.TEXT.searchIcon(돋보기)
        note: '쉼표(,)로 …',                   // 검색창 밑 안내문 HTML. 생략하면 "/ 키" 안내, '' 면 없음
                                              // 단축키 문구를 직접 넣을 땐 <span class="dogu-search-shortcut"> 으로 감쌀 것 (768px 이하에서 숨김)
        onSubmit: function (query, inputEl) { … },
        favorites: { all: function () { return [...] }, remove: function (key) { … } },
        recents:   { all: function () { return [...] }, remove: function (key) { … } },
        itemLabel: function (item) { return item.nickname; },   // 생략 시 문자열 또는 label/nickname/name
        itemKey:   function (item) { return item.nickname; },   // remove 에 넘겨줄 키. 생략 시 label
        itemHref:  function (item) { return '/er/profile/' + item.nickname; },
        onPick:    function (key) { … }                          // 주면 href 대신 이걸 부른다
    }
});
```

- 히어로 패딩 `74px 16px 62px`(768px 이하 `32px 16px 28px`). 높이 지정 없음, 판·경계선 없음
- 검색창: 높이 52px(모바일 42px), `border-radius: 999px`, `overflow: hidden`, 유리 `rgba(10,19,38,.58)` + `blur(12px)`. 버튼 58px, radius 없음, `linear-gradient(135deg, 액센트, 액센트-dark)`, `aria-label="검색"` 고정
- **버튼 안 내용은 사이트 설정값(`search.button`)이다.** 기본은 `.GG` 글자(15px·900·이탤릭, 로고와 같은 결). dogu.gg 계열(er·maple·loa·tft)은 기본값 그대로, **pixlol 만 돋보기**(`DoguUI.TEXT.searchIcon`). 헤더 1단의 작은 검색창은 항상 돋보기
- **검색창 안에 셀렉트 없음.** 월드/서버 선택 UI 는 공통 규격 밖 (maple 길드 검색처럼 구조상 필요한 곳은 사이트가 자기 페이지에 따로 둔다)
- **즐겨찾기/최근 검색은 포커스 드롭다운.** 포커스가 들어오면 열리고 나가면 닫힌다. `favorites`·`recents` 둘 다 안 주면 드롭다운이 안 뜬다
  - 라벨 `★ 즐겨찾기` / `🕘 최근 검색`, 안내문 `각각 10개까지 저장됩니다.`, 빈 상태 `저장된 항목이 없습니다.` — `DoguUI.TEXT` 에 있고 사이트에서 바꾸지 않는다
  - 목록이 바뀐 뒤 열려 있는 드롭다운을 갱신하려면 `DoguUI.refreshDropdown()`
- 빈 검색어로 제출하면 검색창을 흔들고 포커스만 준다. 오류 문구는 `DoguUI.showSearchError(msg)` (빈 문자열로 지움)
- **`/` 단축키** — 입력 중이 아닐 때 누르면 히어로 검색창(없으면 1단 검색창)으로 포커스. 전 사이트 공통

---

## 6. 푸터

`DoguUI.mountFooter(container, opts)` — `container` 가 없으면 body 끝에 붙인다.

```js
DoguUI.mountFooter(null, {
    home: '/er/', brand: 'DOGU', tld: '.GG', linkAttr: 'data-link',
    links: { terms: '/er/terms', privacy: '/er/privacy' },
    notice: '본 사이트는 님블뉴런(Nimble Neuron)이 승인하거나 후원하지 않은 비공식 팬 사이트이며, …',
    contact: '00.y4no@gmail.com',
    notify: function (msg) { App.ui.showToast(msg); }   // 선택. 사이트 토스트를 쓰고 싶을 때. 없으면 공통 토스트
});
```

구성 순서 고정: 로고 → 링크(`이용약관` | `개인정보 처리방침` | `버그제보 및 피드백`) → 게임사 권리 고지(`notice`, 사이트별 문구 유지, 배열이면 여러 줄) → `Contact: …`. 링크 문구는 바꾸지 않는다.

**「버그제보 및 피드백」은 `mailto` 가 아니라 클립보드 복사다.** 누르면 `contact` 이메일을 클립보드에 복사하고 "이메일 주소(…)가 클립보드에 복사되었습니다." 안내를 띄운다 (실패 시 "복사에 실패했습니다. 직접 복사해 주세요: …"). 안내는 공통 파일의 작은 토스트(`.dogu-toast`, er `.toast` 값 그대로)가 띄우고, 사이트에 자기 토스트가 있으면 `notify` 로 넘겨 그걸 쓴다. 전 사이트 같은 동작이어야 한다.

---

## 7. 404 · 준비중

마크업 문자열만 준다. 사이트의 페이지 컨테이너(`<section class="dogu-doc">`) 안에 넣는다.

```js
el.innerHTML = DoguUI.notFoundHtml({ home: '/er/', linkAttr: 'data-link' });
el.innerHTML = DoguUI.comingSoonHtml({ home: '/er/', linkAttr: 'data-link' });
```

| | 제목 | 본문 | 링크 |
|---|---|---|---|
| 404 | `404` | `요청하신 페이지를 찾을 수 없습니다.` | `← 홈으로 돌아가기` |
| 준비중 | `준비 중` | `아직 만드는 중인 페이지입니다. 조금만 기다려 주세요.` | `← 홈으로 돌아가기` |

---

## 8. 건드리면 안 되는 것

- `dogu-ui.css` 의 "공통 토큰" 블록과 모든 `.dogu-*` 규칙. 사이트 CSS 로 `.dogu-*` 를 덮어쓰지 말 것 — 한 사이트만 다르게 보이면 통일이 무너진다
- `dogu-header.js` 의 `GAMES` · `TEXT`
- 헤더 1단 검색창의 노출 규칙(상시 노출 · 768px 이하 숨김)
- 드롭다운의 포커스 열림/닫힘 방식
- 로고 형태(이탤릭 텍스트 2조각, 아이콘 없음, 둘 다 홈 링크)

사이트만의 요구가 생기면 여기 변수로 노출하거나 이 문서에 예외로 적고 원본을 고쳐 다시 복사한다.

---

## 9. 페이지 타이틀

`<title>` 과 `og:site_name` 은 `DOGU.GG: {게임명}` (예: `DOGU.GG: 이터널리턴`). pixlol 만 `PIXLOL.KR` 그대로.

**사이트 이름은 형식만 규격이고, 어디에 적는지는 사이트마다 다르다.** er 은 `.env` 의 `SITE_NAME` 이 `%SITE_NAME%` 토큰으로 `index.html` 에 들어가고 `ui.setTitle()` 이 페이지명 뒤에 붙인다. pixlol 은 `.env` 에 그 항목이 없어 코드에 박혀 있을 것이다. 공통 파일이 건드리는 값이 아니니 각 사이트에서 자기 방식대로 적용할 것.

---

## 10. 적용 기록

| 사이트 | 상태 | 라우터 연결 위치 |
|---|---|---|
| er | 2026-08-22 적용 | `public/js/router.js` `render()` / 네비 항목 `public/js/routes.js` `navItems()` |
| maple · loa · tft · pixlol | 2026-08-22 적용. 같은 날 5곳 실측으로 복사본 동기화 + 격리 원칙 반영 (11절) | 각 사이트 `app.js` 의 `mountDoguUI()` 부근 |

## 11. 기존 CSS 와의 충돌 확인

공통 파일은 `.dogu-*` 접두사라 이름은 안 겹치지만, **사이트의 전역·태그 선택자가 더 높은 특이도로 `.dogu-*` 안쪽을 덮어쓸 수 있다.** 실제로 공통 파일 안에서 `.dogu-gnb a { color: inherit }` (0,1,1) 이 `.dogu-nav-item` (0,1,0) 을 덮어써 네비가 전부 하얘진 적이 있다 (`:where()` 로 고침). 각 사이트에서 적용 뒤 아래를 본다:

### 11-0. 먼저 복사본이 원본과 같은지 본다 (2026-08-22 사고)

"공통 파일을 다 적용했는데 사이트마다 조금씩 다르다"의 **첫째 원인은 CSS 충돌이 아니라 복사본 드리프트였다.** 같은 날 세션 세 개가 각자 스위처 아이콘을 구현해서 원본(git HEAD)·maple·tft·pixlol 복사본이 네 가지 버전이었고, 심지어 `dogu_er/dogu-ui/` 작업본까지 maple 변형으로 덮여 있었다 (스위처 버튼 34/38px, 아이콘 22/32px, `iconBase`/`icons` 옵션 이름까지 갈라짐). 원본을 건드리기 전과 복사한 뒤에 반드시:

```bash
# Git Bash. 해시가 한 줄(=전부 동일)이어야 한다. 두 줄 이상이면 드리프트
cd /c/Users/admin/Desktop
md5sum dogu_template/dogu-ui/dogu-ui.css   dogu_*/public/dogu-ui.css   pixlol.kr/public/dogu-ui.css   | awk '{print $1}' | sort | uniq -c
md5sum dogu_template/dogu-ui/dogu-header.js dogu_*/public/dogu-header.js pixlol.kr/public/dogu-header.js | awk '{print $1}' | sort | uniq -c
git -C dogu_template status --short dogu-ui    # 원본 작업본이 미커밋 상태면 어느 세션이 덮었는지부터 확인
```

- 원본은 **항상 `dogu_template/dogu-ui/` 의 git HEAD** 다. 다른 사이트 세션에서 공통 파일을 고쳤으면 그 변경을 원본에 합치고 커밋한 뒤 5곳에 복사한다. 사이트 `public/` 에서 고친 것을 원본으로 역복사하지 말 것
- 복사는 다섯 곳 한 번에 — `dogu_template` 에서 `npm run sync:ui` (= `sync-ui.ps1`, bash 는 `./sync-ui.sh`). js·css 는 각 `public/` 으로, 이 문서는 각 저장소 루트로 간다. 사이트 하나만은 `.sync-ui.ps1 dogu_maple`

### 11-1. 격리 원칙 — 공통 파일이 지켜야 하는 것

사이트 CSS 가 뒤에 로드되므로 **같은 특이도면 사이트가 이긴다.** 그래서 공통 파일은 사이트의 리셋·상속에 **기대지 않는다**:

- **공통 뿌리(`.dogu-gnb` `.dogu-hero` `.dogu-footer` `.dogu-doc` `.dogu-toast`)에 `font-family`·`font-size: 13px`·`line-height`·`color` 를 직접 박는다.** 사이트 `body` 의 font-size 가 13/14/16px 제각각이라(er/maple/loa·tft·pixlol 실측) 상속받으면 `em`·`kbd`·안내문 높이가 사이트마다 달라진다
- **공통 파일이 만드는 `button`·`input`·`a`·`img` 는 전부 클래스(또는 `.dogu-x button` 후손) 규칙 안에 `font-family: inherit`·`margin`·`padding`·`border`·`appearance`·`text-decoration` 을 명시한다.** 사이트에 `button { font-family: inherit }` 리셋이 있는 곳(er·maple·loa)과 없는 곳(tft·pixlol)이 있어서, 빠뜨리면 없는 쪽만 **Arial** 로 나간다 (검색 버튼 `.GG`·돋보기가 실제로 그랬다). 클래스 규칙(0,1,0)은 태그 규칙(0,0,1)을 로드 순서와 무관하게 이긴다
- **flex 줄에 놓이는 고정폭 요소(`.dogu-brand` `.dogu-switcher` `.dogu-nav-home` `.dogu-gnb-search`)는 `flex: none`.** 네비가 긴 사이트(maple)에서 ⌂ 칸이 30→24px 로 줄어들었었다
- 사이트의 `img { max-width; border-radius }` 류에 대비해 `.dogu-game-icon` 도 `max-width: none; border-radius: 0` 을 갖는다
- 새 요소를 공통 파일에 추가할 때도 위 규칙대로: "사이트에 리셋이 없어도, body 폰트가 달라도 같은 모양인가"를 자문할 것

### 11-2. 사이트 쪽에서 볼 것

1. 사이트 CSS 에서 `a`, `button`, `input`, `h2`, `p`, `em`, `kbd` 같은 **태그 선택자**와 `*`, `body *`, `main a` 같은 **전역 규칙**을 grep 한다. 특이도가 `.dogu-*` 한 클래스(0,1,0)보다 높은 것(`.wrap a`, `header a`, `#app a` 등)이 있으면 의심 대상 — 11-1 의 명시값도 이건 못 이긴다
2. 개발자 도구로 아래 요소의 계산값을 확인한다 (정답은 er 값):
   - `.dogu-nav-item` 기본 `#a9bcd9`, `.active` `#fff`, hover `#fff`
   - `.dogu-brand` / `.dogu-hero-mark` `#fff`, `em` 은 `--dogu-accent`
   - `.dogu-doc-link` / `.dogu-dropdown-link` hover → `--dogu-accent-strong`
   - `.dogu-search-btn` · `.dogu-gnb-search button` · `.dogu-search-input` 의 `font-family` 가 `Pretendard, "Malgun Gothic", …` 인지 (**Arial 이면 버튼 리셋 누락**)
   - `.dogu-switcher-btn` 34px, 버튼 아이콘 22px, 목록 아이콘 32px, `.dogu-nav-home` 30×46
   - `.dogu-footer-links a` `#a9bcd9`, `.dogu-footer-note` `#7288ac`
   - `body` 의 `background-color` 가 `--dogu-bg` 이고 `html` 은 투명
3. **히어로 상자 규격(5절)** — 콘솔에 `[dogu-ui] 히어로 상자…` 경고가 없어야 한다. 사이트 `main`/`.page-container` 의 패딩·max-width 안에 `#hero` 를 두면 모바일에서 검색창 폭이 달라진다
4. `box-sizing`, `margin: 0` 리셋이 사이트에 없어도 공통 파일이 자기 영역에는 준다. 반대로 사이트가 `* { margin: 0 }` 를 쓰면 `.dogu-search-note` 의 `margin-top` 같은 건 공통 파일 쪽이 이긴다 (같은 특이도에서 뒤에 오는 쪽) — `dogu-ui.css` 를 사이트 CSS **앞에** 넣는 이유는 사이트가 변수를 덮어쓰기 위해서이지, 공통 규칙을 덮어쓰라는 뜻이 아니다. 사이트 CSS 에 `.dogu-*` 선택자가 생기면 안 되고, **JS 로 `.dogu-*` 안쪽 DOM 을 덧칠해서도 안 된다** (4절 스위처 항목)
5. 옛 헤더·푸터·검색창 CSS 를 지웠는지 grep 으로 본다 (`.gnb`, `.hero`, `.search-box`, `.footer`, `.dropdown` 등 사이트마다 이름이 다르다). 남아 있으면 당장은 안 보여도 나중에 누가 다시 쓴다
6. 스크린샷을 공통 미리보기(`dogu-ui-preview.html`)와 나란히 놓고 본다. 헤더 높이·검색창 모양·네비 색이 다르면 어딘가 덮어쓰고 있는 것
7. **눈으로는 못 잡는 차이가 있다** — 2026-08-22 의 Arial 버튼·24px ⌂ 는 스크린샷으로는 긴가민가했다. 확실히 하려면 5개 서버를 다른 포트로 띄우고 헤드리스 Edge 의 CDP 로 `.dogu-*` 요소들의 `getBoundingClientRect()` + `getComputedStyle()` 을 뽑아 표로 나란히 놓는다 (이 사양서의 수치가 곧 정답표다). 1280px 과 640px 두 폭에서. 그날 쓴 스크립트가 `dogu_er/tools/dogu-ui-check/` 에 있다 — 서버 5개를 3101~3105 포트로 띄운 뒤 `OUTDIR=out node measure.mjs 1280` → `OUTDIR=out node compare.mjs 1280` (차이 나는 속성만 마크다운 표로 찍는다. Node 24 내장 WebSocket, 의존성 없음)

## 12. 미리보기

`dogu-ui-preview.html` 을 더블클릭하면 서버 없이 열린다. 5개 사이트 액센트 전환, 홈/비홈 오버레이 농도 슬라이더, 블러 0/3/8px 비교가 들어 있다. 배경 이미지는 `../public/img/bg.webp` 를 상대경로로 본다 — 폴더째 옮기면 안 보인다.
