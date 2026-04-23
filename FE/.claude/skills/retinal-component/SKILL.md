---
name: retinal-component
description: RETINAL Svelte 프로젝트에서 공용 컴포넌트와 페이지 전용 조합 컴포넌트를 만들거나 수정할 때 사용한다. 고객 카드, 대시보드 사이드바, 검색창, 통계 카드, 테이블, 모달, 폼, 상태 배지 같은 UI 단위가 대상이다.
---

# RETINAL Component

원본 규칙은 `svelte/.codex/skills/component/SKILL.md`에 있다. **Read 툴로 해당 파일을 먼저 읽고** 배치/구현/완료 체크 규칙 전체를 적용한다.

네이밍은 `retinal-naming` 스킬(원본 `svelte/.codex/skills/naming/SKILL.md`)을 먼저 따른다.

## 핵심 요약 (상세는 원본 필독)

- 공용: `src/components/{role}/snake_case.svelte`
- 페이지 전용 조합: 해당 `src/router/{route}/` 하위
- Svelte 5 문법 기준, 버튼은 `button` 태그, 아이콘 온리 버튼은 `aria-label`
- 상태 배지는 색상+텍스트 함께, 모달은 dim/header/close/actions 구조
- 완료 전 `npm run build`로 검증

## 먼저 확인할 파일

- `src/components/`
- `src/router/`
- `src/app.css`
- `src/config/path.js`
- `src/config/routes.js`
