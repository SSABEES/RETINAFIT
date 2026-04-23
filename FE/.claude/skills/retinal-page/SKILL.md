---
name: retinal-page
description: RETINAL Svelte 프로젝트에서 페이지와 라우트를 추가하거나 확장할 때 사용한다. 로그인, 대시보드, 고객 관리, 고객 상세, 기록 관리, 판매 통계, 지점 관리 화면이 대상이다. @maks11060/svelte5-router 기반.
---

# RETINAL Page

원본 규칙은 `svelte/.codex/skills/page/SKILL.md`에 있다. **Read 툴로 해당 파일을 먼저 읽고** 라우트 등록/레이아웃/완료 체크 규칙 전체를 적용한다.

네이밍은 `retinal-naming` 스킬을 먼저 따른다.

## 핵심 요약 (상세는 원본 필독)

- 페이지 컴포넌트: `src/router/{domain}/` 아래
- URL 상수: `src/config/path.js`의 `PATH` 또는 `ROUTE_PATH`
- 라우트 등록: `src/config/routes.js`
- 동적 라우트: `[id].svelte`
- 모든 페이지 최상위 `main`에 `app-frame-page` 클래스
- 1366x1024 `app-frame` 기준, 로그인 이후는 좌측 사이드바 + 우측 콘텐츠
- **페이지/섹션 제목 아래 부제목/설명 문단은 기본 작성 금지** (사용자 명시 요청 시만)
- 새 페이지는 `PATH` + `routes` + 사이드바 메뉴 3곳 모두 갱신
- 완료 전 `npm run build`

## 먼저 확인할 파일

- `.codex/design-system.md`
- `src/App.svelte`
- `src/config/path.js`
- `src/config/routes.js`
- `src/router/`
- `src/components/layout/`
- `src/app.css`
