# DOGU_UI — 공통 UI 사양서

`dogu-ui.css` / `dogu-header.js` 두 파일의 사양. 원본은 `dogu_er/dogu-ui/` 에 있고, 각 사이트의 `public/` 에 **복사해서** 쓴다. 사이트 폴더에서 직접 고치지 말 것 — 원본을 고치고 다시 복사한다.

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
  <main>
    <section id="page-home">
      <div id="hero"></div>                      <!-- DoguUI.mountHero('#hero', …) -->
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
| `--dogu-accent` | `#45b3f2` | 액센트 밝은쪽. 로고 `.GG`·네비 활성 밑줄·스위처 활성 배경·포커스 테두리·검색 버튼 그라데이션 시작 |
| `--dogu-accent-dark` | `#1f6fd0` | 액센트 어두운쪽. 검색 버튼 그라데이션 끝 |
| `--dogu-bg-image` | `none` | 배경 이미지 `url(...)`. 사이트가 반드시 지정 |
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
body.dogu-body::before   fixed, inset 0, z-index -2          ← 이미지 (cover, filter: blur(var(--dogu-bg-blur)))
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

---

## 4. 헤더

`DoguUI.mountHeader(opts)` — `<header class="dogu-gnb">` 를 만들어 `opts.container` 에, 없으면 body 맨 앞에 끼운다.

```js
DoguUI.mountHeader({
    site: 'er',                       // 스위처 활성 표시. lol | er | maple | loa | tft
    icons: '/er',                     // 스위처 아이콘 폴더. {icons}/header_{key}.png 를 읽는다 (아래 참조)
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

**아이콘.** 각 항목은 게임 아이콘 + 게임명이다. 아이콘 파일 5개(`header_lol.png` `header_er.png` `header_maple.png` `header_loa.png` `header_tft.png`, 256x256 투명 PNG, 다크 배경 전제)를 **각 사이트의 `public/` 에 전부 복사**하고, `mountHeader` 에 `icons` 로 그 폴더의 절대 주소를 준다 (er `'/er'`, tft `'/tft'`, pixlol `''`). SPA 라우트 밑에서 상대경로가 깨지므로 절대경로여야 한다.

- `<img class="dogu-game-icon" width="32" height="32" alt="{게임명}">` — 32x32 를 속성으로 못박아 로드 전 레이아웃이 안 밀린다
- 이미지에 여백이 이미 맞춰져 있다. **padding·crop·border-radius 를 더 주지 말 것**
- 현재 사이트 아이콘은 `opacity: 1`, 나머지는 `0.55`(hover `0.85`)
- 768px 이하에서는 게임명(`.dogu-game-name`)을 숨기고 아이콘만 보인다

---

## 5. 히어로 + 검색창

`DoguUI.mountHero(container, opts)` — 로고(52px) + 알약 검색창 + 포커스 드롭다운. 히어로 로고도 헤더 로고처럼 `opts.home` 으로 가는 링크다 (pointer, 드래그 선택 불가, 밑줄·색 변화 없음).

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

## 11. 기존 CSS 와의 충돌 확인

공통 파일은 `.dogu-*` 접두사라 이름은 안 겹치지만, **사이트의 전역·태그 선택자가 더 높은 특이도로 `.dogu-*` 안쪽을 덮어쓸 수 있다.** 실제로 공통 파일 안에서 `.dogu-gnb a { color: inherit }` (0,1,1) 이 `.dogu-nav-item` (0,1,0) 을 덮어써 네비가 전부 하얘진 적이 있다 (`:where()` 로 고침). 각 사이트에서 적용 뒤 아래를 본다:

1. 사이트 CSS 에서 `a`, `button`, `input`, `h2`, `p`, `em`, `kbd` 같은 **태그 선택자**와 `*`, `body *`, `main a` 같은 **전역 규칙**을 grep 한다. 특이도가 `.dogu-*` 한 클래스(0,1,0)보다 높은 것(`.wrap a`, `header a`, `#app a` 등)이 있으면 의심 대상
2. 개발자 도구로 아래 요소의 계산값을 확인한다 (정답은 er 값):
   - `.dogu-nav-item` 기본 `#a9bcd9`, `.active` `#fff`, hover `#fff`
   - `.dogu-brand` / `.dogu-hero-mark` `#fff`, `em` 은 `--dogu-accent`
   - `.dogu-doc-link` / `.dogu-dropdown-link` hover → `--dogu-accent-strong`
   - `.dogu-search-input` 의 `font-family` 가 사이트 폰트인지 (`inherit` 라 사이트 `body` 폰트를 따른다 — `input { font-family }` 전역 규칙이 있으면 그게 이긴다)
   - `.dogu-footer-links a` `#a9bcd9`, `.dogu-footer-note` `#7288ac`
   - `body` 의 `background-color` 가 `--dogu-bg` 이고 `html` 은 투명
3. `box-sizing`, `margin: 0` 리셋이 사이트에 없어도 공통 파일이 자기 영역에는 준다. 반대로 사이트가 `* { margin: 0 }` 를 쓰면 `.dogu-search-note` 의 `margin-top` 같은 건 공통 파일 쪽이 이긴다 (같은 특이도에서 뒤에 오는 쪽) — `dogu-ui.css` 를 사이트 CSS **앞에** 넣는 이유는 사이트가 변수를 덮어쓰기 위해서이지, 공통 규칙을 덮어쓰라는 뜻이 아니다. 사이트 CSS 에 `.dogu-*` 선택자가 생기면 안 된다
4. 옛 헤더·푸터·검색창 CSS 를 지웠는지 grep 으로 본다 (`.gnb`, `.hero`, `.search-box`, `.footer`, `.dropdown` 등 사이트마다 이름이 다르다). 남아 있으면 당장은 안 보여도 나중에 누가 다시 쓴다
5. 스크린샷을 공통 미리보기(`dogu-ui-preview.html`)와 나란히 놓고 본다. 헤더 높이·검색창 모양·네비 색이 다르면 어딘가 덮어쓰고 있는 것

## 12. 미리보기

`dogu-ui-preview.html` 을 더블클릭하면 서버 없이 열린다. 5개 사이트 액센트 전환, 홈/비홈 오버레이 농도 슬라이더, 블러 0/3/8px 비교가 들어 있다. 배경 이미지는 `../public/img/bg.webp` 를 상대경로로 본다 — 폴더째 옮기면 안 보인다.
