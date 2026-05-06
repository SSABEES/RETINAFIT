/**
 * Flutter WebView ↔ Svelte 웹앱 브릿지 어댑터.
 *
 * 동작 모델:
 *   - Flutter 앱은 부팅 후 WebView 의 `window` 객체에 `__retinafit_flutter_bridge__`
 *     라는 단일 진입점 객체를 주입한다. (`flutter/lib/main.dart` 의 JavaScriptChannel 설정)
 *   - 본 모듈은 그 객체를 안전하게 감싸 Svelte 쪽 호출자가 항상 동일한 형태의
 *     async 함수 (Promise) 로 native 메서드를 부를 수 있게 한다.
 *   - WebView 가 아닌 일반 브라우저 환경에서는 브릿지 객체가 없으므로 `is_ready`
 *     체크 / `wait_for_flutter_bridge` 폴링으로 분기 처리해야 한다.
 *
 * 자세한 양방향 메시지 스키마는 `flutter/BRIDGE_PROTOCOL.md` 참조.
 */

import { get_flutter_asset_path } from '@/lib/flutter/asset_map'

// 브릿지 단일 호출 timeout. 15초로 잡은 이유:
//   - 일반 RPC (`checkAvailability`, `cancel`) 는 즉시 응답
//   - `launch` 첫 호출 시 ARCore 가용성 체크 + GLB 원격 다운로드가 직렬로 일어나는
//     경우가 있어 짧게 잡으면 정상 케이스도 timeout 으로 끊김
//   - 사용자 체감 한계 (네트워크 끊김 의심) 와의 절충점
const g_bridge_request_timeout_ms = 15000

// Flutter → Web 단방향 이벤트를 전달할 때 사용하는 DOM CustomEvent 이름.
// `retinafit:` prefix 로 다른 라이브러리 이벤트와 네임스페이스 충돌 방지.
const g_flutter_event_name = 'retinafit:flutter_event'

/**
 * window 에 주입된 Flutter 브릿지 객체를 안전하게 꺼낸다.
 *
 * 본 프로젝트는 CSR(SPA) 이라 일반 실행에서는 window 가 항상 존재한다. 다만
 * vitest 가 node env 로 돌거나 모듈을 단순 import 만 하는 경우 window 가 없을
 * 수 있어 `typeof window === 'undefined'` 방어 가드를 둔다. 일반 브라우저에서도
 * Flutter WebView 가 아닌 경우엔 주입이 일어나지 않으므로 `null` 을 반환한다.
 *
 * @returns {null | {
 *   is_ready?: boolean,
 *   invoke?: (method_name: string, params_obj?: Record<string, unknown>) => Promise<unknown>
 * }}
 */
function get_flutter_bridge_obj() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.__retinafit_flutter_bridge__ ?? null
}

/**
 * Flutter WebView 브릿지가 즉시 사용 가능한 상태인지 동기적으로 판정한다.
 *
 * 두 조건을 모두 만족해야 true:
 *   1. 브릿지 객체가 주입되어 있음
 *   2. Flutter 측이 `is_ready` 플래그를 켰고 `invoke` 함수가 실제 함수 형태
 *
 * 단순히 객체 존재만으로는 부족 — Flutter 가 객체를 먼저 만들어두고
 * native plugin 초기화 후에 `is_ready=true` 로 전환하는 케이스가 있어
 * `is_ready` 까지 확인해야 함부로 호출하지 않게 된다.
 *
 * @returns {boolean}
 */
export function is_flutter_bridge_ready() {
  const local_bridge_obj = get_flutter_bridge_obj()

  return Boolean(local_bridge_obj?.is_ready && typeof local_bridge_obj?.invoke === 'function')
}

/**
 * 브릿지 준비 완료까지 polling 으로 대기한다.
 *
 * Flutter 앱 부팅 직후 WebView 의 첫 페이지 로드 시점과 브릿지 주입 시점이
 * 미세하게 어긋날 수 있다. (특히 핫리로드 시) 페이지 mount 시점에 즉시
 * `is_flutter_bridge_ready()` 가 false 더라도 수백 ms 안에 true 가 되는
 * 일반적 케이스를 흡수하기 위한 짧은 폴링 루프.
 *
 * - 기본 timeout 3초: 그 이상 기다려도 안 오면 사실상 비-WebView 환경.
 * - 기본 interval 120ms: rAF 한 틱 (~16ms) 보다 느슨하게 잡아 main thread 부담 최소화.
 * - timeout 만료 직후에도 한번 더 ready 체크 — 마지막 sleep 동안 주입됐을 수 있음.
 *
 * @param {number} [timeout_ms=3000]  최대 대기 시간 (ms)
 * @param {number} [interval_ms=120]  폴링 주기 (ms)
 * @returns {Promise<boolean>}        준비 여부
 */
export async function wait_for_flutter_bridge(timeout_ms = 3000, interval_ms = 120) {
  const local_started_at = Date.now()

  while (Date.now() - local_started_at < timeout_ms) {
    if (is_flutter_bridge_ready()) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, interval_ms))
  }

  // timeout 직후 한 번 더 — 마지막 sleep 사이에 ready 됐을 수 있어 false 확정 전 재확인.
  return is_flutter_bridge_ready()
}

/**
 * Flutter 브릿지 메서드를 공통 형식 + timeout 으로 호출한다.
 *
 * 모든 native 메서드 호출은 본 함수를 거치도록 통일했다. 이유:
 *   - 호출 시점에 ready 체크를 한 번 더 (consumer 가 잊어도 즉시 throw)
 *   - timeout 을 한 곳에서 관리 (consumer 마다 setTimeout 흩어지지 않음)
 *   - native 측이 응답을 누락해도 Promise 가 영원히 pending 되지 않음
 *
 * 실패 시나리오:
 *   - 브릿지 미준비 → 'Flutter bridge is not ready.' 동기적 throw
 *   - native 측 미응답 / 처리 지연 → 'Flutter bridge request timed out.' reject
 *   - native 측에서 명시적 에러 반환 → native 가 던진 에러 그대로 reject
 *
 * @param {string} method_name                       native 측 메서드 식별자 (camelCase)
 * @param {Record<string, unknown>} [params_obj={}]  메서드 인자 (camelCase 키 권장)
 * @returns {Promise<unknown>}                       native 측 반환값
 */
export async function invoke_flutter_bridge(method_name, params_obj = {}) {
  const local_bridge_obj = get_flutter_bridge_obj()

  if (!local_bridge_obj || typeof local_bridge_obj.invoke !== 'function') {
    throw new Error('Flutter bridge is not ready.')
  }

  // Promise.race 패턴으로 timeout 경쟁. 정상 응답이 먼저 들어오면 timeout 은 leak 되지만
  // setTimeout 핸들 하나라 GC 부담 없음 — 단순성 우선.
  const local_timeout_promise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Flutter bridge request timed out.')),
      g_bridge_request_timeout_ms,
    )
  })

  return Promise.race([local_bridge_obj.invoke(method_name, params_obj), local_timeout_promise])
}

/**
 * 네이티브 가상 피팅 가능 여부를 조회한다.
 *
 * native 측은 ARCore 상태값을 문자열로 반환:
 *   - 'SUPPORTED_INSTALLED'   ARCore 설치됨, 즉시 사용 가능
 *   - 'SUPPORTED_NOT_INSTALLED' / 'SUPPORTED_APK_TOO_OLD'  설치/업데이트 필요
 *   - 'UNSUPPORTED_DEVICE_NOT_CAPABLE'  단말이 ARCore 지원 안 함
 *   - 'UNKNOWN_*'  체크 도중 오류 / 미정 상태
 *
 * 호출자는 이 문자열로 UI 분기 (피팅 버튼 활성화, 안내 토스트 등) 한다.
 * 응답이 누락되거나 null 이면 'UNKNOWN' 으로 정규화해 호출자가
 * 항상 string 만 다루도록 했다.
 *
 * @returns {Promise<string>}
 */
export async function check_virtual_fitting_availability() {
  const local_result = await invoke_flutter_bridge('checkAvailability')

  return String(local_result ?? 'UNKNOWN')
}

/**
 * 안경 정보 객체에서 네이티브에 전달할 asset 경로를 우선순위에 따라 결정한다.
 *
 * 안경 데이터가 백엔드 / 시드 / 어드민 입력 등 여러 소스에서 들어오면서
 * 같은 의미의 필드명이 다양하게 존재한다. 모든 호출자가 매번 분기하지 않도록
 * 본 함수가 후보 키 배열을 순회하며 첫 번째 유효한 값을 채택한다.
 *
 * 우선순위 (위가 우선):
 *   1. asset_path                  명시적 asset 경로 (가장 신뢰)
 *   2. glasses_asset_path          legacy 필드명
 *   3. virtual_fitting_asset_path  legacy 필드명
 *   4. glasses_3d_url              URL 이지만 asset_map 이 매핑 가능하면 채택
 *
 * `get_flutter_asset_path` 가 빈 문자열을 반환하면 (= asset_map 에 매칭 없음)
 * 다음 후보로 넘어간다. 모든 후보가 실패하면 `''` 반환 → 호출자가
 * `model_url` 경로로 fallback 하도록 한다 (`launch_virtual_fitting` 참조).
 *
 * @param {Record<string, unknown>} glasses_obj
 * @returns {string}  네이티브 asset 경로, 없으면 빈 문자열
 */
export function get_virtual_fitting_asset_path(glasses_obj) {
  const local_asset_candidate_arr = [
    glasses_obj?.asset_path,
    glasses_obj?.glasses_asset_path,
    glasses_obj?.virtual_fitting_asset_path,
    glasses_obj?.glasses_3d_url,
  ]

  for (const local_asset_candidate of local_asset_candidate_arr) {
    const local_asset_path = get_flutter_asset_path(String(local_asset_candidate ?? ''))

    if (local_asset_path) {
      return local_asset_path
    }
  }

  return ''
}

/**
 * 안경 정보 객체에서 원격 GLB 모델 URL 후보를 추출한다.
 *
 * `get_virtual_fitting_asset_path` 가 빈 문자열을 반환했을 때 (= 번들된 asset 이
 * 없는 새 안경 / CMS 등록 안경) native 가 원격 다운로드로 폴백할 수 있도록 URL 을 제공.
 *
 * 후보 중 처음으로 http(s) 프로토콜인 값을 채택. data:, blob:, 상대경로 등은
 * native 측이 처리 못 하므로 자동 제외된다.
 *
 * @param {Record<string, unknown>} glasses_obj
 * @returns {string}  원격 GLB URL, 없으면 빈 문자열
 */
export function get_virtual_fitting_model_url(glasses_obj) {
  const local_candidate_arr = [
    glasses_obj?.glasses_3d_url,
    glasses_obj?.model_url,
    glasses_obj?.glb_url,
  ]

  for (const local_candidate of local_candidate_arr) {
    const local_value = String(local_candidate ?? '').trim()
    if (local_value.startsWith('http://') || local_value.startsWith('https://')) {
      return local_value
    }
  }

  return ''
}

/**
 * 선택한 안경 정보로 네이티브 AR 피팅 화면을 실행한다.
 *
 * native 가 받는 키는 모두 camelCase 인 반면 Svelte 쪽은 snake_case 컨벤션이라
 * 본 함수가 그 경계에서 키 변환을 담당한다. (`product_id` → `productId` 등)
 *
 * 좌표/크기 인자 (`origin_x_px`, `origin_y_px`, `width_px`, `height_px`):
 *   - 모두 양수일 때 native 가 그 영역에 정확히 매칭되도록 AR 윈도우를 띄운다.
 *     (Svelte 의 placeholder div getBoundingClientRect 결과를 device px 로 환산해 전달)
 *   - 하나라도 0/음수면 native 가 기본 fullscreen 으로 띄우는 폴백을 사용.
 *   - `Math.max(0, Math.round(...))` 로 음수·NaN 입력을 0 으로 정규화.
 *
 * 피팅 데이터 우선순위:
 *   1. asset_path  번들된 GLB → 즉시 로드, 가장 빠름
 *   2. model_url   원격 GLB   → cache_key 기반 캐싱 후 로드
 *   둘 다 비어 있으면 native 측에서 invalid argument 로 reject.
 *
 * 반환값은 native 가 발급한 request_id (예: `vf-1735000000000`) — 후속
 * 이벤트 (`add_virtual_fitting_event_listener` 로 받는 payload) 와 매칭하는 용도.
 *
 * @param {{
 *   product_id: string | number,
 *   product_name: string,
 *   asset_path?: string,
 *   model_url?: string,
 *   cache_key?: string,
 *   origin_x_px?: number,
 *   origin_y_px?: number,
 *   width_px?: number,
 *   height_px?: number,
 * }} fitting_obj
 * @returns {Promise<string>}  native request_id
 */
export async function launch_virtual_fitting(fitting_obj) {
  return /** @type {Promise<string>} */ (
    invoke_flutter_bridge('launch', {
      productId: String(fitting_obj.product_id ?? ''),
      productName: String(fitting_obj.product_name ?? ''),
      assetPath: String(fitting_obj.asset_path ?? ''),
      modelUrl: String(fitting_obj.model_url ?? ''),
      cacheKey: String(fitting_obj.cache_key ?? ''),
      // 음수 / NaN 입력을 0 으로 정규화 → native 측이 단순 검사 (모든 값 > 0 ?) 로 폴백 분기.
      originXPx: Math.max(0, Math.round(Number(fitting_obj.origin_x_px ?? 0))),
      originYPx: Math.max(0, Math.round(Number(fitting_obj.origin_y_px ?? 0))),
      widthPx: Math.max(0, Math.round(Number(fitting_obj.width_px ?? 0))),
      heightPx: Math.max(0, Math.round(Number(fitting_obj.height_px ?? 0))),
    })
  )
}

/**
 * 진행 중인 네이티브 AR 피팅 세션을 취소한다.
 *
 * 사용자가 AR 화면에 들어가기 전에 모달 닫기 / 뒤로가기 / 다른 안경 선택 등으로
 * 세션을 중단해야 할 때 호출. 이미 native 가 fullscreen Activity 로 진입한 상태에서는
 * 시스템 뒤로가기로 닫히므로 이 호출은 주로 "AR 진입 직전" 윈도우에서 효력 있음.
 *
 * native 측이 진행 중 세션이 없으면 no-op 으로 즉시 응답한다.
 *
 * @returns {Promise<void>}
 */
export async function cancel_virtual_fitting() {
  await invoke_flutter_bridge('cancel')
}

/**
 * Flutter native 가 발생시키는 단방향 이벤트를 Svelte 쪽에서 구독한다.
 *
 * 채널 모델:
 *   - native (Kotlin) → MethodChannel 이 아닌 EventChannel 로 stream 발사
 *   - Flutter (Dart) → JavaScript 채널로 `window.dispatchEvent(new CustomEvent(...))` 실행
 *   - 본 함수 → 그 CustomEvent 를 일반 콜백 시그니처로 정규화해 전달
 *
 * 이벤트 종류는 `flutter/BRIDGE_PROTOCOL.md` 참조 — `availability_checked`,
 * `preparing_assets`, `assets_ready`, `started`, `tracking_active`,
 * `tracking_lost`, `captured`, `closed`, `error` 등.
 *
 * 본 함수는 cleanup 함수를 반환한다. Svelte 컴포넌트에서는 `onDestroy` 또는
 * `$effect` 의 cleanup 슬롯에 그대로 넣어 메모리 누수를 방지하는 것이 표준 사용법.
 *
 * window 가 없는 환경 (vitest node env 등) 에서는 no-op cleanup (`() => {}`) 을
 * 반환해 호출자가 분기 없이 동일하게 다룰 수 있게 한다. 본 프로젝트는 CSR 이므로
 * 일반 브라우저 실행에선 항상 정상 등록 경로를 탄다.
 *
 * @param {(event_obj: Record<string, unknown>) => void} on_event_receive
 * @returns {() => void}  unsubscribe 함수
 */
export function add_virtual_fitting_event_listener(on_event_receive) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // WebView 외 환경에서도 같은 인터페이스를 유지하기 위해 DOM CustomEvent 로 표준화한다.
  // `detail` 이 비어 있는 비표준 이벤트가 들어와도 빈 객체로 정규화 — 호출자 콜백이
  // `event_obj.event` 같은 접근에서 즉시 undefined 분기를 만나지 않도록.
  const local_on_window_event = (local_event) => {
    on_event_receive(/** @type {CustomEvent<Record<string, unknown>>} */ (local_event).detail ?? {})
  }

  window.addEventListener(g_flutter_event_name, local_on_window_event)

  return () => {
    window.removeEventListener(g_flutter_event_name, local_on_window_event)
  }
}
