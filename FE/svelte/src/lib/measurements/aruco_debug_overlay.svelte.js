/**
 * ArUco 마커 오버레이 디버그 토글.
 *
 * 운영 UI 에선 기본 OFF. 개발자가 콘솔에서 다음과 같이 ON/OFF 가능:
 *
 *   window.aruco_overlay(true)   // 켜기 — measure_canvas 에 초록 박스 + ID/거리 표시
 *   window.aruco_overlay(false)  // 끄기
 *   window.aruco_overlay()       // 현재 상태 반환
 *
 * 상태는 localStorage 에 저장되어 새로고침 후에도 유지. Svelte 5 runes ($state) 로 관리해
 * measure_canvas 가 자동 reactive 갱신.
 */

const STORAGE_KEY = 'debug_aruco_overlay'

// localStorage 초기값 — SSR/test 환경에서 window 가 없을 수 있으므로 try/catch.
function read_initial() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let g_show = $state(read_initial())

/**
 * 현재 오버레이 표시 여부를 반환한다 ($state 라 호출 측에서 reactive 추적됨).
 * @returns {boolean}
 */
export function is_aruco_overlay_enabled() {
  return g_show
}

/**
 * 토글 함수. 인자 없으면 현재 값 반환, 인자 있으면 set + localStorage 영속.
 * @param {boolean} [on]
 * @returns {boolean}
 */
export function set_aruco_overlay_enabled(on) {
  if (on === undefined) return g_show
  g_show = !!on
  try {
    if (g_show) globalThis.localStorage?.setItem(STORAGE_KEY, '1')
    else globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // localStorage 비활성 환경 (예: 시크릿 모드 차단) — 메모리 토글만 유지.
  }
  return g_show
}

// 콘솔에서 바로 호출할 수 있도록 window 에 헬퍼 노출. 모듈 import 시 1회만.
if (typeof window !== 'undefined') {
  /** @type {any} */ ;(window).aruco_overlay = set_aruco_overlay_enabled
}
