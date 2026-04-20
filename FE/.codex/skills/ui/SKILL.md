---
name: ui
description: RETINAL Svelte 프로젝트에서 시각 스타일, Tailwind 사용 방식, 색상 토큰, 레이아웃 밀도, 카드/테이블/모달/폼 스타일을 맞출 때 사용한다.
---

# RETINAL UI

RETINAL의 화면 스타일과 시각 일관성을 맞출 때 이 스킬을 사용한다.

## 먼저 확인할 파일

- `.codex/design-system.md`
- `src/app.css`
- `src/components/layout/`
- `src/components/button/`
- `src/components/input/`
- `src/components/card/`
- 실제 작업할 `src/router/**.svelte`

## 브랜드 방향

- 서비스명은 `RETINAL` 또는 `Retin AI` 맥락을 유지한다.
- 성격은 안경점 실시간 AR 안경 피팅 서비스다.
- 화면은 관리자 대시보드에 가깝게 명확하고 조용한 정보 구조를 우선한다.
- 장식보다 검색, 목록, 상태, 수치, 액션 버튼의 가독성을 우선한다.

## 색상 규칙

- Primary: deep purple 계열 `#4B0055`, `#5B006B`, `#65006F`
- Accent: vivid purple `#9A1BFF` 또는 로그인 CTA 계열
- Surface: `#FFFFFF`, page background `#F7F8FA`, soft purple `#F5EAF7`
- Text: main `#111827`, secondary `#667085`, muted `#98A2B3`
- Border: `#E5E7EB`, soft border `#EFE7F2`
- Success: green badge background/text
- Waiting/Error: red badge background/text
- Consulting/Warning: orange badge background/text

색상은 Tailwind arbitrary value를 사용해도 된다. 반복이 많아지면 `src/app.css`에 CSS variable을 추가한다.

## 레이아웃 규칙

- 모든 화면은 `app-frame-shell > app-frame > app-frame-content > app-frame-page` 구조를 기준으로 한다.
- `app-frame`은 1366px x 1024px 고정 디자인 캔버스다.
- 데스크톱 대시보드 기본 구조는 `240px` 좌측 사이드바와 나머지 콘텐츠 영역이다.
- 콘텐츠 영역 배경은 밝은 회색, 카드와 테이블은 흰색 surface를 사용한다.
- 좌우 페이지 padding은 대시보드 기준 `32px`, 상단 바 높이는 약 `68px`를 기준으로 한다.
- 카드 radius는 `8px` 이하를 기본으로 하고, 모달과 인증 패널은 더 큰 radius를 허용한다.
- 카드 안에 또 다른 카드처럼 보이는 중첩 구조는 피한다.
- 고정 형식 요소는 `min-height`, `aspect-ratio`, grid track을 지정해 레이아웃 흔들림을 줄인다.

## 타이포그래피

- 기본 폰트는 현재 `src/app.css`의 system font stack을 유지한다.
- 제목은 굵게, 숫자 지표는 더 크고 무겁게 표현한다.
- letter spacing은 기본값을 유지한다.
- viewport 기반 폰트 크기 스케일링은 사용하지 않는다.
- 버튼과 배지 텍스트가 좁은 화면에서 잘리지 않도록 최소 너비와 줄바꿈을 고려한다.

## 컴포넌트 스타일 기준

- 사이드바: 진한 보라 배경, 흰색 로고 블록, 메뉴 아이콘+텍스트, 활성 메뉴는 반투명 밝은 보라 surface
- 상단 바: 흰색 배경, 하단 border, 중앙 제목 또는 좌측 제목, 우측 액션
- 검색창: 둥근 사각형, 아이콘 좌측, 충분한 높이, 회색 placeholder
- 주요 버튼: 진한 보라 배경, 흰색 텍스트, 아이콘+텍스트 조합
- 보조 버튼: 흰색 배경, 옅은 border, 진한 텍스트
- 고객 카드: 이니셜 원형 아바타, 이름, 상태 배지, 메타 정보, 우측 방문 횟수 박스
- 통계 카드: 아이콘 블록, 변화율 pill, 라벨, 큰 숫자
- 테이블: 헤더 옅은 회색, 행 구분선 최소화, 상태 배지 색상 명확화
- 모달: dim overlay, 상단 보라 header, 우측 닫기 아이콘, 하단 액션 버튼 2개

## 반응형 기준

- 현재 화면 기준은 데스크톱 중심이다. 모바일 대응이 필요하면 사이드바는 drawer 또는 상단 메뉴로 전환한다.
- 768px 이하에서는 카드 그리드를 1열로 전환한다.
- 테이블은 모바일에서 가로 스크롤 또는 카드 리스트 전환 중 하나를 선택한다.
- 로그인 화면은 모바일에서도 인증 패널이 화면 밖으로 넘치지 않도록 `max-width`와 padding을 둔다.

## 완료 전 체크

- 페이지 루트가 `app-frame-page`를 사용하고 1366x1024 프레임 안에서 깨지지 않는지 확인한다.
- 화면이 RETINAL의 정보 우선순위와 시각 밀도를 유지하는지 확인한다.
- 보라색 계열이 브랜드 축이지만 전체 화면이 단조로운 단색 팔레트로 보이지 않게 surface, text, status 색상을 분리한다.
- 텍스트와 버튼이 겹치거나 잘리지 않는지 확인한다.
- 전역 CSS는 꼭 필요한 토큰과 reset만 추가하고, 페이지 전용 스타일은 해당 컴포넌트 근처에 둔다.
- UI 변경 후 가능하면 `npm run build`를 실행한다.
