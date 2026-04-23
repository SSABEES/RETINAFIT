/**
 * 6스텝 얼굴 캡쳐 플로우 세션 상태 스토어 (Svelte 5 runes).
 * 모듈 싱글톤 — 여러 컴포넌트가 같은 세션을 공유한다.
 *
 * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
 * @typedef {import('@/lib/capture/step_config.js').GlassesMode} GlassesMode
 * @typedef {import('@/lib/mediapipe/face_types.js').FaceMeasurements} FaceMeasurements
 *
 * @typedef {object} Capture
 * @property {string} step_id
 * @property {Blob} blob
 * @property {string} object_url
 * @property {number} captured_at
 * @property {number} width
 * @property {number} height
 * @property {FaceMeasurements | null} measurements_obj
 *
 * @typedef {'select_glasses' | 'capturing' | 'review'} Phase
 *
 * @typedef {object} CaptureSessionState
 * @property {Phase} phase
 * @property {GlassesMode | null} glasses_mode
 * @property {number} current_step_index
 * @property {StepConfig[]} steps_arr
 * @property {Record<string, Capture>} captures_obj
 */

import { get_steps_for_mode } from '@/lib/capture/step_config.js'

/** @type {CaptureSessionState} */
let g_session = $state({
  phase: 'select_glasses',
  glasses_mode: null,
  current_step_index: 0,
  steps_arr: [],
  captures_obj: {},
})

/**
 * 현재 세션 상태를 반환한다. 반환 객체는 반응형이므로 직접 읽기 가능.
 * @returns {CaptureSessionState}
 */
export function get_session() {
  return g_session
}

/**
 * 안경 착용 모드를 설정하고 캡쳐 단계로 진입한다.
 * 기존 captures_obj 와 인덱스는 초기화된다.
 * @param {GlassesMode} mode
 */
export function set_glasses_mode(mode) {
  g_session.glasses_mode = mode
  g_session.steps_arr = get_steps_for_mode(mode)
  g_session.current_step_index = 0
  g_session.captures_obj = {}
  g_session.phase = 'capturing'
}

/**
 * 현재 스텝에 캡쳐를 기록하고 다음 스텝으로 넘어간다.
 * 마지막 스텝이었으면 phase='review' 로 전환.
 * @param {Capture} capture
 */
export function add_capture(capture) {
  g_session.captures_obj[capture.step_id] = capture
  if (g_session.current_step_index + 1 >= g_session.steps_arr.length) {
    g_session.phase = 'review'
  } else {
    g_session.current_step_index += 1
  }
}

/**
 * 현재 진행 중인 스텝 설정을 반환한다. 범위를 벗어나면 null.
 * @returns {StepConfig | null}
 */
export function get_current_step() {
  return g_session.steps_arr[g_session.current_step_index] ?? null
}

/**
 * 스텝 순서대로 캡쳐 배열을 만든다. 누락된 슬롯은 null.
 * @returns {(Capture | null)[]}
 */
export function get_captures_ordered() {
  return g_session.steps_arr.map((s) => g_session.captures_obj[s.step_id] ?? null)
}

/**
 * 세션을 초기 상태로 되돌린다. 모든 ObjectURL 을 revoke 해 메모리 누수 방지.
 */
export function reset() {
  for (const capture of Object.values(g_session.captures_obj)) {
    if (capture?.object_url) URL.revokeObjectURL(capture.object_url)
  }
  g_session.phase = 'select_glasses'
  g_session.glasses_mode = null
  g_session.current_step_index = 0
  g_session.steps_arr = []
  g_session.captures_obj = {}
}
