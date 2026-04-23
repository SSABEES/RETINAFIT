# RETINAL Svelte FE

## 프로젝트 개요

RETINAL — 안경점 실시간 AR 안경 피팅 서비스의 관리자 대시보드 FE.

| 항목 | 버전/라이브러리 |
|---|---|
| 프레임워크 | Svelte 5 |
| 빌드 | Vite |
| 스타일링 | Tailwind CSS 4 + `src/app.css` 전역 토큰 |
| 라우터 | `@maks11060/svelte5-router` |
| 언어 | JavaScript |

## 코덱스 스킬

모든 코드 작성 전에 아래 스킬을 먼저 확인하고 규칙을 따른다.

| 스킬 | 파일 | 언제 사용 |
|---|---|---|
| **naming** | `.codex/skills/naming/SKILL.md` | 변수명, 함수명, 파일명 — **모든 코드 작업의 전제** |
| **ui** | `.codex/skills/ui/SKILL.md` | 색상, 레이아웃, 컴포넌트 스타일 적용 시 |
| **component** | `.codex/skills/component/SKILL.md` | 공용 컴포넌트 또는 페이지 전용 조합 컴포넌트 작성 시 |
| **page** | `.codex/skills/page/SKILL.md` | 새 페이지/라우트 추가 또는 확장 시 |

디자인 토큰 전체 레퍼런스: `.codex/design-system.md`

## 핵심 규칙 요약

- 네이밍은 **snake_case** 우선 (Svelte 컴포넌트 import 식별자만 PascalCase)
- HTML 바인딩 변수 → `ref_` 접두사, 파일 전역 상태 → `g_` 접두사
- 배열 → `_arr` 접미사, 객체 → `_obj` 접미사
- 이벤트 핸들러 → `on_이벤트_동작` 형태 (예: `on_click_submit`)
- 모든 함수 위에 한글 주석으로 용도 설명
- 모든 페이지 루트 `<main>` 에 `app-frame-page` 클래스 필수
- Primary 색상: `var(--retinal-primary-600)` (`#5B006B`)
- Tailwind arbitrary value 허용, 반복되면 `src/app.css` CSS variable로 승격

## 주요 파일 경로

```
src/
  App.svelte          # 라우터 루트
  app.css             # 전역 토큰 및 reset
  config/
    path.js           # PATH / ROUTE_PATH 상수
    routes.js         # 라우트 등록
  components/         # 공용 컴포넌트 (role별 폴더)
  router/             # 페이지 컴포넌트 (domain별 폴더)
  lib/api/            # API 레이어
```

## 완료 전 체크

- `npm run build` 로 Svelte 문법 및 import 오류 확인
- 새 페이지는 `PATH`, `routes.js`, 사이드바 메뉴에 모두 등록
- 페이지 루트에 `app-frame-page` 존재 확인
