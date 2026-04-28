import { get_flutter_asset_path } from '@/lib/flutter/asset_map'

const g_bridge_request_timeout_ms = 15000
const g_flutter_event_name = 'retinal:flutter_event'

/**
 * window 에 주입된 Flutter 브리지 객체를 반환한다.
 * @returns {null | {
 *   is_ready?: boolean,
 *   invoke?: (method_name: string, params_obj?: Record<string, unknown>) => Promise<unknown>
 * }}
 */
function get_flutter_bridge_obj() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.__retinal_flutter_bridge__ ?? null
}

/**
 * Flutter WebView 브리지가 현재 사용 가능한지 확인한다.
 * @returns {boolean}
 */
export function is_flutter_bridge_ready() {
  const local_bridge_obj = get_flutter_bridge_obj()

  return Boolean(local_bridge_obj?.is_ready && typeof local_bridge_obj?.invoke === 'function')
}

/**
 * WebView 가 브리지를 늦게 주입하는 경우를 대비해 준비 완료까지 짧게 대기한다.
 * @param {number} [timeout_ms=3000]
 * @param {number} [interval_ms=120]
 * @returns {Promise<boolean>}
 */
export async function wait_for_flutter_bridge(timeout_ms = 3000, interval_ms = 120) {
  const local_started_at = Date.now()

  while (Date.now() - local_started_at < timeout_ms) {
    if (is_flutter_bridge_ready()) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, interval_ms))
  }

  return is_flutter_bridge_ready()
}

/**
 * Flutter 브리지 메서드를 공통 형식으로 호출한다.
 * @param {string} method_name
 * @param {Record<string, unknown>} [params_obj]
 * @returns {Promise<unknown>}
 */
export async function invoke_flutter_bridge(method_name, params_obj = {}) {
  const local_bridge_obj = get_flutter_bridge_obj()

  if (!local_bridge_obj || typeof local_bridge_obj.invoke !== 'function') {
    throw new Error('Flutter bridge is not ready.')
  }

  const local_timeout_promise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Flutter bridge request timed out.')), g_bridge_request_timeout_ms)
  })

  return Promise.race([local_bridge_obj.invoke(method_name, params_obj), local_timeout_promise])
}

/**
 * 네이티브 가상 피팅 가능 여부를 조회한다.
 * @returns {Promise<string>}
 */
export async function check_virtual_fitting_availability() {
  const local_result = await invoke_flutter_bridge('checkAvailability')

  return String(local_result ?? 'UNKNOWN')
}

/**
 * 안경 정보에서 네이티브 asset 경로를 우선순위에 따라 결정한다.
 * @param {Record<string, unknown>} glasses_obj
 * @returns {string}
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
 * 선택한 안경 정보로 네이티브 AR 피팅 화면을 실행한다.
 * @param {{
 *   product_id: string | number,
 *   product_name: string,
 *   asset_path: string,
 * }} fitting_obj
 * @returns {Promise<string>}
 */
export async function launch_virtual_fitting(fitting_obj) {
  return /** @type {Promise<string>} */ (
    invoke_flutter_bridge('launch', {
      productId: String(fitting_obj.product_id ?? ''),
      productName: String(fitting_obj.product_name ?? ''),
      assetPath: String(fitting_obj.asset_path ?? ''),
    })
  )
}

/**
 * 진행 중인 네이티브 AR 피팅 세션을 취소한다.
 * @returns {Promise<void>}
 */
export async function cancel_virtual_fitting() {
  await invoke_flutter_bridge('cancel')
}

/**
 * Flutter native 이벤트를 Svelte 쪽으로 구독 연결한다.
 * @param {(event_obj: Record<string, unknown>) => void} on_event_receive
 * @returns {() => void}
 */
export function add_virtual_fitting_event_listener(on_event_receive) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // WebView 외 환경에서도 같은 인터페이스를 유지하기 위해 DOM CustomEvent 로 표준화한다.
  const local_on_window_event = (local_event) => {
    on_event_receive(
      /** @type {CustomEvent<Record<string, unknown>>} */ (local_event).detail ?? {},
    )
  }

  window.addEventListener(g_flutter_event_name, local_on_window_event)

  return () => {
    window.removeEventListener(g_flutter_event_name, local_on_window_event)
  }
}
