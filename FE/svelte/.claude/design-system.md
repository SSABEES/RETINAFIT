# RETINAL Design System Reference

RETINAL FE 프로젝트의 디자인 토큰, 레이아웃 프레임, 컴포넌트 패턴을 정리한 자기완결형 레퍼런스입니다.

---

## 프로젝트 스택

| 항목       | 버전/라이브러리                          |
| ---------- | ---------------------------------------- |
| 프레임워크 | Svelte 5                                 |
| 빌드       | Vite                                     |
| 스타일링   | Tailwind CSS 4 + `src/app.css` 전역 토큰 |
| 라우터     | `@maks11060/svelte5-router`              |
| 언어       | JavaScript                               |

> 규칙: 화면의 최상위 렌더링 기준은 항상 `app-frame-shell`입니다. 모든 페이지는 `app-frame`의 1366x1024 캔버스 안에서 설계합니다.

---

## 레이아웃 프레임

```text
app-frame-shell       전체 뷰포트, 1366x1024 앱 프레임을 중앙 정렬
  app-frame           1366px x 1024px 고정 디자인 캔버스, overflow hidden
    app-frame-content 100% x 100%, 라우터 렌더링 영역
      [페이지]        app-frame-page, 각 페이지 루트 요소
```

### 클래스 설명

| 클래스              | 역할                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| `app-frame-shell`   | 전체 브라우저 뷰포트. 앱 프레임을 중앙 정렬하고 작은 화면에서는 외부 스크롤을 허용한다. |
| `app-frame`         | 기준 디자인 캔버스. `width: 1366px`, `height: 1024px`, `overflow: hidden`.              |
| `app-frame-content` | 라우터가 렌더링되는 내부 영역. `width: 100%`, `height: 100%`, `overflow: hidden`.       |
| `app-frame-page`    | 모든 페이지의 최상위 `main`에 붙이는 클래스. 프레임 높이를 꽉 채운다.                   |
| `app-page-scroll`   | 페이지 내부에서 세로 스크롤이 필요할 때 `app-frame-page` 안쪽에 사용한다.               |

### Svelte 루트 패턴

```svelte
<div class="app-frame-shell">
  <div class="app-frame">
    <div class="app-frame-content">
      <Router {url}>
        <!-- routes -->
      </Router>
    </div>
  </div>
</div>
```

### 표준 페이지 루트 패턴

```svelte
<main class="app-frame-page bg-[var(--retinal-page)] text-[var(--retinal-text)]">
  <!-- 페이지 콘텐츠 -->
</main>
```

스크롤이 필요한 대시보드 페이지는 아래처럼 분리합니다.

```svelte
<main class="app-frame-page bg-[var(--retinal-page)] text-[var(--retinal-text)]">
  <div class="app-page-scroll">
    <!-- 스크롤 콘텐츠 -->
  </div>
</main>
```

---

## 1366x1024 기준 영역

| 영역             | 크기/기준     | 용도                               |
| ---------------- | ------------- | ---------------------------------- |
| 전체 프레임      | `1366 x 1024` | 모든 화면의 기준 캔버스            |
| 사이드바         | `240px` 너비  | 로그인 이후 대시보드 내비게이션    |
| 콘텐츠 영역      | `1126px` 너비 | 사이드바를 제외한 우측 화면        |
| 상단 바          | `68px` 높이   | 제목, 뒤로가기, 우측 액션          |
| 콘텐츠 패딩      | `32px`        | 대시보드 페이지 기본 좌우 여백     |
| 카드 radius      | `8px` 이하    | 일반 카드, 테이블 컨테이너         |
| 인증 패널 radius | `24px`        | 로그인 카드, 모달 등 강조 컨테이너 |

---

## 디자인 토큰

### CSS 변수

| 토큰                       | 값        | 용도                       |
| -------------------------- | --------- | -------------------------- |
| `--retinal-primary-900`    | `#26002D` | 가장 어두운 보라 배경      |
| `--retinal-primary-800`    | `#3D0048` | 사이드바 보조 배경         |
| `--retinal-primary-700`    | `#4B0055` | 주요 브랜드 배경           |
| `--retinal-primary-600`    | `#5B006B` | 주요 버튼/활성 상태        |
| `--retinal-primary-500`    | `#65006F` | 강조 보라                  |
| `--retinal-accent`         | `#9A1BFF` | 로그인 CTA, 강한 강조      |
| `--retinal-surface`        | `#FFFFFF` | 카드, 테이블, 입력 배경    |
| `--retinal-page`           | `#F7F8FA` | 앱 페이지 배경             |
| `--retinal-soft-purple`    | `#F5EAF7` | 연한 보라 배너/아이콘 배경 |
| `--retinal-text`           | `#111827` | 본문 기본 텍스트           |
| `--retinal-text-secondary` | `#667085` | 보조 텍스트                |
| `--retinal-text-muted`     | `#98A2B3` | 비활성/희미한 텍스트       |
| `--retinal-border`         | `#E5E7EB` | 기본 테두리                |
| `--retinal-success-700`    | `#2E7D32` | 완료 상태 텍스트/배경      |
| `--retinal-success-soft`   | `#E8F5E9` | 완료 상태 보조 배경        |
| `--retinal-measure-auto`   | `#1F7A3A` | 자동 측정 SVG stroke/fill  |
| `--retinal-measure-manual` | `#FF6F00` | 수동 측정 SVG stroke/fill  |
| `--app-frame-width`        | `1366px`  | 앱 프레임 너비             |
| `--app-frame-height`       | `1024px`  | 앱 프레임 높이             |

### Tailwind 사용 규칙

- 반복되는 전역 값은 `src/app.css`의 CSS 변수를 우선 사용한다.
- 일회성 값은 Tailwind arbitrary class를 허용한다. 예: `bg-[var(--retinal-page)]`.
- 주요 색상은 raw hex보다 CSS variable 기반 클래스를 우선한다.
- 컴포넌트 내부에서만 쓰는 작은 스타일은 Tailwind 유틸리티로 유지한다.

---

## 페이지 패턴

### 로그인 페이지

```svelte
<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section class="relative grid min-h-full place-items-center px-5 py-10">
    <form class="w-full max-w-[364px] rounded-3xl bg-white/12 p-8">
      <!-- 인증 필드 -->
    </form>
  </section>
</main>
```

### 대시보드 페이지

```svelte
<main class="app-frame-page bg-[var(--retinal-page)] text-[var(--retinal-text)]">
  <div class="grid h-full grid-cols-[240px_1fr]">
    <aside><!-- Sidebar --></aside>
    <section class="min-w-0">
      <header class="h-[68px] border-b border-[var(--retinal-border)] bg-white"></header>
      <div class="app-page-scroll px-8 py-8">
        <!-- 콘텐츠 -->
      </div>
    </section>
  </div>
</main>
```

### 모달 오버레이

- 오버레이는 `bg-black/50`을 사용한다.
- 모달은 `app-frame` 내부에서만 떠야 한다.
- 모달 상단 바는 `bg-[var(--retinal-primary-600)] text-white`를 기본으로 한다.

---

## 컴포넌트 기준

### Button

| 종류      | 클래스 기준                                                          | 용도                     |
| --------- | -------------------------------------------------------------------- | ------------------------ |
| primary   | `min-h-12 rounded-lg bg-[var(--retinal-primary-600)] text-white`     | 저장, 등록, 로그인       |
| accent    | `min-h-12 rounded-lg bg-[var(--retinal-accent)] text-white`          | 로그인 CTA, 주요 강조    |
| secondary | `min-h-12 rounded-lg border border-[var(--retinal-border)] bg-white` | 취소, 보조 액션          |
| ghost     | `bg-transparent`                                                     | 텍스트 버튼, 아이콘 버튼 |

### Input

```svelte
<label class="grid gap-2 text-sm font-semibold">
  라벨
  <input
    class="min-h-12 rounded-lg border border-[var(--retinal-border)] bg-white px-4 text-base outline-none focus:border-[var(--retinal-primary-600)]"
  />
</label>
```

### Card

- 카드 배경은 `bg-white`.
- 일반 카드 radius는 `rounded-lg`.
- 테두리는 `border border-[var(--retinal-border)]`.
- 카드 내부 정보는 제목, 메타, 상태, 액션 순서로 배치한다.

### Status Badge

| 상태 | 색상 기준                                    |
| ---- | -------------------------------------------- |
| 완료 | `bg-green-50 text-green-700`                 |
| 대기 | `bg-red-50 text-red-700`                     |
| 상담 | `bg-orange-50 text-orange-700`               |
| 분석 | `bg-[var(--retinal-primary-600)] text-white` |

---

## 접근성 관례

- 모든 페이지 루트는 `main.app-frame-page`를 사용한다.
- 페이지 제목은 실제 heading으로 제공한다. 시각적으로 숨길 때는 `sr-only`를 사용한다.
- 아이콘만 있는 버튼에는 `aria-label`을 둔다.
- 폼 필드는 `label`과 `input`을 연결한다.
- 에러 메시지는 `role="alert"`를 사용한다.
- 클릭 가능한 카드는 키보드 접근을 고려해 `button` 또는 실제 링크로 구현한다.

---

## 완료 전 체크

- 페이지가 `app-frame-shell` 안의 1366x1024 프레임을 기준으로 보이는가?
- 페이지 루트에 `app-frame-page`가 있는가?
- 긴 콘텐츠는 `app-frame` 바깥이 아니라 내부 `app-page-scroll`에서 스크롤되는가?
- 사이드바, 상단 바, 카드, 모달이 같은 토큰을 쓰는가?
- `npm.cmd run build`가 통과하는가?
