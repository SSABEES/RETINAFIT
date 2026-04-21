---
name: component
description: RETINAL Svelte 프로젝트에서 공용 컴포넌트와 페이지 전용 조합 컴포넌트를 만들거나 수정할 때 사용한다. 고객 카드, 대시보드 사이드바, 검색창, 통계 카드, 테이블, 모달, 폼, 상태 배지 같은 UI 단위가 대상이다.
---

# RETINAL Component

## Naming

- 코드 작성 및 수정 시 `.codex/skills/naming/SKILL.md`의 RETINAL 네이밍 규칙을 먼저 따른다.

RETINAL 화면을 구성하는 재사용 UI 단위를 만들 때 이 스킬을 사용한다.

## 먼저 확인할 파일

- `src/components/`
- `src/router/`
- `src/app.css`
- `src/config/path.js`
- `src/config/routes.js`

## 배치 규칙

- 여러 화면에서 반복되는 컴포넌트는 `src/components/{role}/snake_case.svelte`에 둔다.
- 특정 화면에서만 쓰는 조합 컴포넌트는 해당 `src/router/{route}/` 하위에 둔다.
- 파일명은 현재 프로젝트 패턴에 맞춰 `snake_case.svelte`를 사용한다.
- 상태와 이벤트를 포함한 컴포넌트는 props API를 작고 예측 가능하게 유지한다.
- 단순 텍스트, 숫자, 아이콘 표현은 데이터 props로 받고 내부에서 마크업과 스타일을 책임진다.

## 공용 컴포넌트 후보

- `layout/dashboard_sidebar.svelte`: RETINAL 로고, 메뉴, 활성 메뉴, 도움말 영역
- `layout/dashboard_top_bar.svelte`: 뒤로가기, 중앙 제목, 우측 액션 영역
- `input/search_input.svelte`: 아이콘 포함 검색 입력, placeholder, disabled 상태
- `button/primary_button.svelte`: 보라색 주요 액션 버튼, loading/disabled 상태
- `button/ghost_button.svelte`: 취소, 보조 액션, 기간 필터 비활성 상태
- `card/customer_list_item.svelte`: 고객 이니셜, 이름, 분석 완료 배지, 전화번호, 최근 방문일, 총 방문 횟수
- `card/customer_profile_card.svelte`: 고객 상세 상단 정보, 연락처, 생년월일, 방문 요약
- `card/action_card.svelte`: 측정값 입력, 얼굴 분석, 기록, 주문 같은 큰 액션 카드
- `card/stat_card.svelte`: 오늘 매출, 주문, 평균 주문액, 신규 고객 등 통계 카드
- `card/branch_card.svelte`: 지점명, 매니저, 주소, 전화, 이메일
- `modal/customer_create_modal.svelte`: 신규 고객 등록 폼 모달
- `form/labeled_field.svelte`: 라벨, 필수 표시, 입력, 에러 텍스트
- `table/record_table.svelte`: 기록 관리 테이블, 상태 배지, 페이지네이션
- `badge/status_badge.svelte`: 분석완료, 측정완료, 대기중, 상담중 상태

## 구현 규칙

- Svelte 5 문법을 기준으로 작성하고, 기존 파일 스타일과 import 방식을 따른다.
- 버튼에는 실제 `button`을 사용하고, 페이지 이동은 라우터가 기대하는 링크/네비게이션 방식으로 처리한다.
- 아이콘만 보이는 버튼은 `aria-label`을 반드시 둔다.
- 목록 아이템과 카드는 클릭 가능 여부를 명확히 구분한다. 클릭 가능하면 키보드 접근도 고려한다.
- 모달은 배경 dim, 제목 바, 닫기 버튼, 취소/확인 버튼, 포커스 가능한 입력 순서를 갖춘다.
- 폼 필드는 라벨과 입력을 연결하고, 필수 항목은 시각 표시와 검증 메시지를 함께 고려한다.
- 상태 배지는 색상만으로 의미를 전달하지 않고 텍스트를 포함한다.
- 차트는 실제 차트 라이브러리가 없으면 구조를 먼저 컴포넌트화하고 데이터 인터페이스를 분리한다.

## 완료 전 체크

- 공용으로 승격한 컴포넌트가 특정 페이지 데이터에 과도하게 묶여 있지 않은지 확인한다.
- 기존 `src/components` 역할 구분과 충돌하지 않는지 확인한다.
- Tailwind 유틸리티를 우선 사용하고, 전역 CSS 변경은 `ui` 규칙에 따른다.
- `npm run build`로 Svelte 문법과 import 오류를 확인한다.
