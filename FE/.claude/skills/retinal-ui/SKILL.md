---
name: retinal-ui
description: RETINAL Svelte 프로젝트에서 시각 스타일, Tailwind 사용 방식, 색상 토큰, 레이아웃 밀도, 카드/테이블/모달/폼 스타일을 맞출 때 사용한다. 보라 브랜드 팔레트, 1366x1024 app-frame, 대시보드 기반 레이아웃.
---

# RETINAL UI

원본 규칙은 `svelte/.codex/skills/ui/SKILL.md`에 있다. **Read 툴로 해당 파일을 먼저 읽고** 색상/레이아웃/타이포/컴포넌트 스타일/완료 체크 규칙 전체를 적용한다.

네이밍은 `retinal-naming` 스킬을 먼저 따른다.

## 핵심 요약 (상세는 원본 필독)

- 브랜드: 안경점 실시간 AR 안경 피팅, 관리자 대시보드 톤
- Primary: `#4B0055` `#5B006B` `#65006F` / Accent: `#9A1BFF`
- Surface: `#FFFFFF`, page bg `#F7F8FA`, soft purple `#F5EAF7`
- Text: `#111827` / `#667085` / `#98A2B3`, Border: `#E5E7EB` / `#EFE7F2`
- 레이아웃: `app-frame-shell > app-frame > app-frame-content > app-frame-page`
- 1366x1024 고정 캔버스, 사이드바 240px, 페이지 padding 32px, 상단바 68px
- 카드 radius 8px 이하, 카드 안 카드 중첩 피함
- Tailwind arbitrary value 허용, 반복되면 `src/app.css` CSS variable
- viewport 기반 폰트 스케일링 금지
- **페이지/섹션 제목 아래 부제목/설명 문단은 기본 작성 금지**
- 완료 전 `npm run build` 권장

## 먼저 확인할 파일

- `.codex/design-system.md`
- `src/app.css`
- `src/components/layout/`, `button/`, `input/`, `card/`
- 작업할 `src/router/**.svelte`
