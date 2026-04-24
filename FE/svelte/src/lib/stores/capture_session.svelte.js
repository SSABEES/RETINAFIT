/**
 * 6스텝 얼굴 캡쳐 플로우 세션 상태 스토어 (Svelte 5 runes).
 * 모듈 싱글톤 — 여러 컴포넌트가 같은 세션을 공유한다.
 *
 * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
 * @typedef {import('@/lib/capture/step_config.js').GlassesMode} GlassesMode
 * @typedef {import('@/lib/mediapipe/face_types.js').FaceMeasurements} FaceMeasurements
 * @typedef {import('@/lib/mediapipe/face_types.js').FaceShape} FaceShape
 * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
 * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
 * @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle
 *
 * @typedef {object} Capture
 * @property {string} step_id
 * @property {Blob} blob
 * @property {string} object_url
 * @property {number} captured_at
 * @property {number} width
 * @property {number} height
 * @property {FaceMeasurements | null} measurements_obj
 * @property {Record<string, [Point2D, Point2D]> | null} measurement_points_obj
 *
 * @typedef {'select_glasses' | 'capturing' | 'review'} Phase
 *
 * @typedef {object} FaceShapeResult
 * @property {FaceShape} face_shape
 * @property {FaceMeasurements} measurements
 * @property {string} source_step_id
 *
 * @typedef {object} CaptureSessionState
 * @property {Phase} phase
 * @property {GlassesMode | null} glasses_mode
 * @property {number} current_step_index
 * @property {StepConfig[]} steps_arr
 * @property {Record<string, Capture>} captures_obj
 * @property {FaceShapeResult | null} face_shape_result
 * @property {Record<string, MeasurementItem>} measurements_obj
 * @property {string | null} active_item_id
 */

import { get_steps_for_mode } from '@/lib/capture/step_config.js'
import { classify_face_shape } from '@/lib/mediapipe/classify.js'
import { build_initial_measurements, pixel_distance } from '@/lib/measurements/measurement_utils.js'

// 얼굴형 분류용 정면샷 우선순위. 맨얼굴(front_bare)이 안경 왜곡 없이 광대/턱 폭을 가장 정확히 잡아낸다.
const FRONT_STEP_PRIORITY = ['front_bare', 'front_glasses']

/** @type {CaptureSessionState} */
let g_session = $state({
  phase: 'select_glasses',
  glasses_mode: null,
  current_step_index: 0,
  steps_arr: [],
  captures_obj: {},
  face_shape_result: null,
  measurements_obj: {},
  active_item_id: null,
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
  g_session.face_shape_result = null
  g_session.measurements_obj = {}
  g_session.active_item_id = null
  g_session.phase = 'capturing'
}

/**
 * 현재 세션의 정면샷 중 측정값이 유효한 것 하나를 골라 얼굴형을 계산한다.
 * 맨얼굴 정면을 먼저 시도하고, 안경 정면으로 fallback 한다.
 * 어느 쪽도 유효하지 않으면 null.
 * @returns {FaceShapeResult | null}
 */
function compute_face_shape_result() {
  for (const step_id of FRONT_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    if (capture?.measurements_obj) {
      return {
        face_shape: classify_face_shape(capture.measurements_obj),
        measurements: capture.measurements_obj,
        source_step_id: step_id,
      }
    }
  }
  return null
}

/**
 * 현재 스텝에 캡쳐를 기록하고 다음 스텝으로 넘어간다.
 * 마지막 스텝이었으면 얼굴형을 분류하고 phase='review' 로 전환.
 * @param {Capture} capture
 */
export function add_capture(capture) {
  g_session.captures_obj[capture.step_id] = capture
  if (g_session.current_step_index + 1 >= g_session.steps_arr.length) {
    g_session.face_shape_result = compute_face_shape_result()
    g_session.measurements_obj = build_initial_measurements(
      pick_front_auto_points(),
    )
    g_session.phase = 'review'
  } else {
    g_session.current_step_index += 1
  }
}

/**
 * 얼굴형 분류와 같은 정면샷 우선순위(front_bare → front_glasses)로
 * 자동 측정용 랜드마크 쌍을 고른다. 둘 다 없으면 null.
 * @returns {Record<string, [Point2D, Point2D]> | null}
 */
function pick_front_auto_points() {
  for (const step_id of FRONT_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    if (capture?.measurement_points_obj) {
      return capture.measurement_points_obj
    }
  }
  return null
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
 * 현재 세션의 얼굴형 분류 결과를 반환한다.
 * 리뷰 단계 전이나 정면샷 측정 실패 시 null.
 * @returns {FaceShapeResult | null}
 */
export function get_face_shape_result() {
  return g_session.face_shape_result
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
  g_session.face_shape_result = null
  g_session.measurements_obj = {}
  g_session.active_item_id = null
}

/**
 * 주어진 뷰에 속한 측정 항목 배열을 반환한다.
 * 배열 순서는 MEASUREMENT_TEMPLATE 의 원래 순서를 따른다.
 * @param {ViewAngle} view
 * @returns {MeasurementItem[]}
 */
export function get_measurement_items(view) {
  return Object.values(g_session.measurements_obj).filter((m) => m.view === view)
}

/**
 * 현재 armed 된 항목 ID 를 반환한다. 없으면 null.
 * @returns {string | null}
 */
export function get_active_item_id() {
  return g_session.active_item_id
}

/**
 * 항목 armed 상태를 설정/해제한다. 같은 ID 를 다시 전달하면 토글로 해제.
 * @param {string | null} item_id
 */
export function set_active_item_id(item_id) {
  if (item_id === null) {
    g_session.active_item_id = null
    return
  }
  g_session.active_item_id = g_session.active_item_id === item_id ? null : item_id
}

/**
 * 지정 항목에 두 점을 기록하고 value_px 를 재계산한다.
 * 수동으로 찍은 것이므로 source 는 항상 'manual' 로 전환.
 * @param {string} item_id
 * @param {[Point2D, Point2D]} points
 */
export function set_item_points(item_id, points) {
  const item = g_session.measurements_obj[item_id]
  if (!item) return
  item.points = points
  item.value_px = pixel_distance(points[0], points[1])
  item.source = 'manual'
}

/**
 * 지정 항목의 측정값을 지운다. source 는 변경하지 않는다 (원래 auto 였다면 auto 로 남음).
 * @param {string} item_id
 */
export function clear_item_points(item_id) {
  const item = g_session.measurements_obj[item_id]
  if (!item) return
  item.points = null
  item.value_px = null
  item.value_mm = null
}
