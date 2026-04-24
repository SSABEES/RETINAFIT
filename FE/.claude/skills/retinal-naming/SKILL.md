---
name: retinal-naming
description: RETINAL Svelte 프로젝트에서 변수명, 함수명, HTML 바인딩 변수명, 파일 내부 전역 변수명, 배열/객체 접미사, 이벤트 함수명 같은 코드 네이밍을 만들거나 수정할 때 사용한다. snake_case, ref_/g_/local_/temp_ 접두사, _arr/_obj 접미사, on_이벤트_동작 규칙.
---

# RETINAL Naming

원본 규칙은 `svelte/.codex/skills/naming/SKILL.md`에 있다. **Read 툴로 해당 파일을 먼저 읽고** 규칙 전체를 적용한다.

## 핵심 요약 (상세는 원본 필독)

- 변수/함수: `snake_case` (Svelte 컴포넌트 import는 `PascalCase` 예외)
- 파일명: `snake_case.svelte`, `snake_case.js`
- HTML 바인딩: `ref_` / `ref_this_` / `ref_checked_`
- 파일 내부 전역 상태: `g_`
- 배열: `_arr` 접미사 / 객체: `_obj` 접미사
- 이벤트 함수: `on_이벤트_동작` (예: `on_click_push_here`)
- 함수 내부: `local_` (의미 유지) / `temp_` (임시)
- 함수 선언 위에는 한글 용도 주석 필수 (JSDoc 있으면 JSDoc 첫 줄에)

외부 라이브러리 API, Svelte 컴포넌트 태그, HTML 표준 속성은 예외.
