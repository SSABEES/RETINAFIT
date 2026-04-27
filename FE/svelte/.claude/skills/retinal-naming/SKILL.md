---
name: retinal-naming
description: Use BEFORE writing or modifying any code in the RETINAL Svelte project. Establishes snake_case naming, ref_/g_/local_/temp_ prefixes, _arr/_obj suffixes, on_event_action handler names, and the rule that every function gets a Korean usage comment. Trigger on any variable rename, new function, new file, or component prop work.
type: rigid
---

# RETINAL Naming

RETINAL 코드 작성과 수정 시 기존 코드보다 이 규칙을 우선 적용한다. 외부 라이브러리 API, Svelte 컴포넌트 태그, HTML 표준 속성처럼 프레임워크가 요구하는 이름은 예외로 둔다.

> 이 스킬은 **rigid** 입니다 — 다른 RETINAL 스킬(`retinal-ui`, `retinal-component`, `retinal-page`) 보다 우선 적용합니다.

## 기본 규칙

- 모든 변수와 함수는 카멜 케이스 대신 스네이크 케이스를 사용한다.
- Svelte 컴포넌트 import 식별자는 태그로 사용해야 하므로 `PascalCase`를 유지한다.
- 파일명은 기존 프로젝트 규칙에 맞춰 `snake_case.svelte`, `snake_case.js`를 사용한다.

```js
const params = {
  p_nm: 'PKG_RTN_CHAIN.SP_L_CHAIN',
  out1: 'cursor',
  out2: 'num',
}

const result = exec_procedure_post(params)

function notice_update(params) {}
```

## HTML 바인딩 변수

- HTML 또는 입력 컴포넌트의 값에 바인딩되는 변수는 `ref_`로 시작한다.
- `bind:value` 또는 value/oninput 조합: `ref_`
- `bind:this`: `ref_this_`
- `bind:checked`: `ref_checked_`

```svelte
<input
  type="text"
  bind:this={ref_this_start_dt}
  bind:value={ref_start_dt}
  placeholder="시작일"
  required
  readonly
/>
```

## 파일 내부 전역 변수

- Svelte `<script>` 최상위처럼 파일 내부 전역으로 쓰이는 상태는 지역 변수와 구분하기 위해 `g_`로 시작한다.
- HTML 바인딩 상태라면 `ref_` 규칙을 우선한다.

```js
let g_selected_opt_no
```

## 배열 변수

- 배열은 `list` 대신 `_arr` 접미사를 사용한다.

```js
let ref_frame_type_arr = []
let ref_frame_kind_arr = [
  { FRAME_KIND: '', label: '선택' },
  { FRAME_KIND: '온테', label: '온테' },
]
```

## 객체 변수

- 객체는 `_obj` 접미사를 사용한다.

```js
let g_auto_selected_product_obj = {}
let ref_this_diopter_obj = {
  R_SPH: '',
  R_CYL: '',
  R_AXIS: '',
  R_ADD: '',
  L_SPH: '',
  L_CYL: '',
  L_AXIS: '',
  L_ADD: '',
}
```

## 이벤트 함수

- DOM 이벤트 또는 Svelte 이벤트에 연결되는 함수는 `on_이벤트_동작` 형태로 작성한다.
- 예: `on_click_push_here`, `on_submit_login`, `on_input_store_id`

```svelte
<script>
  function on_click_push_here() {
    alert('잘 하셨습니다.')
  }
</script>

<button onclick={on_click_push_here}>여기를 눌러주세요!</button>
```

## 함수 내부 변수

- 함수 내부에서만 사용하는 변수는 `local_` 또는 `temp_`로 시작한다.
- 계산/검증처럼 의미가 유지되는 값은 `local_`, 임시 변환/중간 결과는 `temp_`를 사용한다.

```js
function sum_calc(input_number) {
  const local_number = 30

  return input_number + local_number
}
```

## 함수 주석

- 모든 함수 선언과 주요 화살표 함수 위에는 해당 함수가 무슨 용도로 쓰이는지 한글 주석을 작성한다.
- 이벤트 핸들러 함수는 어떤 사용자 동작을 처리하고 어떤 상태 변경이나 화면 이동을 수행하는지 적는다.
- 폼 제출 함수는 어떤 검증, 저장, 등록, 이동을 수행하는지 적는다.
- API 함수는 어떤 요청을 보내고 어떤 응답 처리를 표준화하는지 적는다.
- 타입 JSDoc이 이미 있는 함수는 JSDoc 안 첫 줄에 한글 용도 설명을 넣고, 별도의 중복 `//` 주석은 만들지 않는다.
- 단순한 내부 콜백이나 라이브러리 옵션 콜백은 독립 함수로 분리되지 않는 한 주석을 생략할 수 있다.

```js
// 선택한 안경사를 전역 상태에 저장하고 고객 관리 화면으로 이동한다.
function on_click_select_optician(optician_obj) {
  selected_admin_obj.set(optician_obj)
  navigate(PATH.users)
}

/**
 * 로그인 폼 제출 시 필수값을 확인하고 안경사 선택 화면으로 이동한다.
 * @param {SubmitEvent} local_event
 */
const on_submit_login = (local_event) => {
  local_event.preventDefault()
}
```

## 빠른 체크리스트

- [ ] 새 변수/함수가 snake_case 인가
- [ ] HTML 바인딩이면 `ref_`, 그 외 파일전역이면 `g_` 인가
- [ ] 배열은 `_arr`, 객체는 `_obj` 접미사가 있는가
- [ ] 이벤트 핸들러가 `on_이벤트_동작` 형태인가
- [ ] 함수 위에 한글 용도 주석이 있는가
