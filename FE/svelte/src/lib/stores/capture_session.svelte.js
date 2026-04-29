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
 * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[] | null} landmarks
 *
 * @typedef {'select_glasses' | 'capturing' | 'review'} Phase
 *
 * @typedef {object} FaceShapeResult
 * @property {FaceShape} face_shape
 * @property {FaceMeasurements} measurements
 * @property {string} source_step_id
 * @property {import('@/lib/mediapipe/face_types.js').AsymmetryResult | null} asymmetry
 * @property {import('@/lib/mediapipe/face_types.js').SkinToneResult | null} skin_tone
 * @property {import('@/lib/mediapipe/face_types.js').EarOffsets | null} ear_offsets_obj
 *
 * @typedef {object} ScaleInfo
 * @property {number} mm_per_px              환산 비율: value_mm = value_px * mm_per_px
 * @property {'pd_assumption_63mm'} source   환산 비율을 어떻게 구했는지 (현재는 PD 63mm 가정만 지원)
 * @property {number} pd_pixels_used         계산에 사용된 PD 픽셀값 (추적용)
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
 * @property {ScaleInfo | null} scale
 */

import { untrack } from 'svelte'
import { get_steps_for_mode } from '@/lib/capture/step_config.js'
import { classify_face_shape } from '@/lib/mediapipe/classify.js'
import { compute_ear_offsets } from '@/lib/mediapipe/measurements.js'
import { detect_keypoints_from_image } from '@/lib/mediapipe/face_detector.js'
import { compute_asymmetry_score } from '@/lib/mediapipe/asymmetry.js'
import { compute_skin_tone } from '@/lib/mediapipe/skin_tone.js'
import { build_initial_measurements, pixel_distance } from '@/lib/measurements/measurement_utils.js'
import { write_mirror, read_mirror, clear_mirror } from '@/lib/utils/session_storage_mirror.js'

// 얼굴형 분류용 정면샷 우선순위. 맨얼굴(front_no_glasses)이 안경 왜곡 없이 광대/턱 폭을 가장 정확히 잡아낸다.
const FRONT_STEP_PRIORITY = ['front_no_glasses', 'front_glasses']

// PD 가정값 (성인 평균 동공간 거리). ArUco 마커 도입 전까지 임시 환산 기준.
const ASSUMED_PD_MM = 63

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
  scale: null,
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
  g_session.scale = null
  g_session.phase = 'capturing'
}

/**
 * 현재 세션의 정면샷 중 측정값이 유효한 것 하나를 골라 얼굴형 + 비대칭/피부톤/귀 높이를 계산한다.
 * 맨얼굴 정면을 먼저 시도하고, 안경 정면으로 fallback 한다.
 * 어느 쪽도 유효하지 않으면 null.
 * 비대칭/피부톤/귀 높이는 산출 실패 시 해당 필드만 null 로 남기고 나머지 결과는 유지.
 *
 * @returns {Promise<FaceShapeResult | null>}
 */
async function compute_face_shape_result() {
  for (const step_id of FRONT_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    if (!capture?.measurements_obj) continue

    // 비대칭/피부톤은 capture 시점에 보관한 landmarks 와 blob 픽셀 데이터가 모두 필요.
    let bitmap = null
    if (capture.blob) {
      try {
        bitmap = await createImageBitmap(capture.blob)
      } catch (err) {
        console.warn('[capture_session] createImageBitmap failed', err)
      }
    }

    let ear_offsets_obj = null
    if (bitmap) {
      const kp = await detect_keypoints_from_image(bitmap)
      if (kp) {
        const offsets_px = compute_ear_offsets(kp, capture.height)
        ear_offsets_obj = {
          right_y_offset_px: offsets_px.right_y_offset_px,
          left_y_offset_px: offsets_px.left_y_offset_px,
          right_y_offset_mm: null,
          left_y_offset_mm: null,
        }
      }
    }

    const asymmetry = capture.landmarks
      ? compute_asymmetry_score(capture.landmarks)
      : null

    const skin_tone = (bitmap && capture.landmarks)
      ? compute_skin_tone(bitmap, capture.landmarks, capture.width, capture.height)
      : null

    return {
      face_shape: classify_face_shape(capture.measurements_obj),
      measurements: capture.measurements_obj,
      source_step_id: step_id,
      asymmetry,
      skin_tone,
      ear_offsets_obj,
    }
  }
  return null
}

/**
 * scale 이 결정된 직후 ear_offsets_obj 의 mm 필드를 채운다.
 * px 만 가지고 있던 ear_offsets 를 mm_per_px 로 환산.
 */
function apply_scale_to_ear_offsets() {
  const eo = g_session.face_shape_result?.ear_offsets_obj
  const mm_per_px = g_session.scale?.mm_per_px
  if (!eo || !mm_per_px) return
  if (eo.right_y_offset_px !== null) eo.right_y_offset_mm = eo.right_y_offset_px * mm_per_px
  if (eo.left_y_offset_px !== null) eo.left_y_offset_mm = eo.left_y_offset_px * mm_per_px
}

/**
 * 현재 스텝에 캡쳐를 기록하고 다음 스텝으로 넘어간다.
 * 마지막 스텝이었으면 얼굴형/비대칭/피부톤/귀 높이를 계산하고 phase='review' 로 전환.
 * @param {Capture} capture
 */
export async function add_capture(capture) {
  g_session.captures_obj[capture.step_id] = capture
  if (g_session.current_step_index + 1 >= g_session.steps_arr.length) {
    g_session.face_shape_result = await compute_face_shape_result()
    g_session.scale = compute_scale()
    apply_scale_to_ear_offsets()
    g_session.measurements_obj = build_initial_measurements(
      pick_front_auto_points(),
      g_session.scale?.mm_per_px ?? null,
    )
    g_session.phase = 'review'
    mirror_now()
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
 * 정면 캡쳐의 PD(동공간 거리) 픽셀값을 기준으로 px↔mm 환산 비율을 계산한다.
 * 성인 평균 PD 63mm 가정. 정면 캡쳐가 없거나 측정값이 없으면 null.
 * @returns {ScaleInfo | null}
 */
function compute_scale() {
  for (const step_id of FRONT_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    const pd_pixels = capture?.measurements_obj?.pd_pixels
    if (pd_pixels && pd_pixels > 0) {
      return {
        mm_per_px: ASSUMED_PD_MM / pd_pixels,
        source: 'pd_assumption_63mm',
        pd_pixels_used: pd_pixels,
      }
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
  g_session.scale = null
  clear_mirror()
}

/**
 * 현재 측정 관련 세션 일부를 sessionStorage 에 미러링한다.
 * 측정 변경/지움 등 mutator 마지막에 호출.
 *
 * 주의: $effect/$derived 안에서 set_* 호출이 발생하면 mirror_now 의 g_session 읽기가
 * 호출자의 reactive deps 로 등록되어 의도치 않은 재실행 루프를 만든다.
 * untrack 으로 감싸 reactive 추적을 명시적으로 끊는다.
 */
function mirror_now() {
  untrack(() => {
    write_mirror({
      measurements_obj: g_session.measurements_obj,
      scale: g_session.scale,
      face_shape_result: g_session.face_shape_result,
      active_item_id: g_session.active_item_id,
      mirrored_at: Date.now(),
    })
  })
}

/**
 * sessionStorage 에 저장된 미러가 있으면 measurements/scale/face_shape_result 을 복원한다.
 * 새로고침/이탈 후 face_measurement 또는 report 마운트 시 호출.
 * 캡쳐가 비어있으면 (다른 세션 잔여물 가능성) 복원하지 않고 미러 제거.
 * @returns {boolean} 복원이 실제로 일어났으면 true
 */
export function hydrate_from_mirror() {
  if (Object.keys(g_session.captures_obj).length === 0) {
    clear_mirror()
    return false
  }
  const mirror = read_mirror()
  if (!mirror) return false
  if (mirror.measurements_obj) g_session.measurements_obj = mirror.measurements_obj
  if (mirror.scale !== undefined) g_session.scale = mirror.scale
  if (mirror.face_shape_result !== undefined) g_session.face_shape_result = mirror.face_shape_result
  if (mirror.active_item_id !== undefined) g_session.active_item_id = mirror.active_item_id
  return true
}

/**
 * 현재 환산 비율 정보를 반환한다. 정면샷 PD 측정 전이면 null.
 * @returns {ScaleInfo | null}
 */
export function get_scale() {
  return g_session.scale
}

/**
 * 픽셀 값을 mm 로 변환한다. scale 이 없으면 null 반환 (호출 측에서 px 표기로 fallback).
 * @param {number | null} value_px
 * @returns {number | null}
 */
export function px_to_mm(value_px) {
  if (value_px === null || g_session.scale === null) return null
  return value_px * g_session.scale.mm_per_px
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
 * 뷰 키에 해당하는 캡쳐를 반환한다. view 와 step_id 가 동일한 키 체계를 쓰므로
 * 직접 lookup 가능. 캡쳐 없으면 null.
 * @param {ViewAngle} view
 * @returns {Capture | null}
 */
export function pick_capture_for_view(view) {
  return g_session.captures_obj[view] ?? null
}

/**
 * 모든 측정값을 초기 상태로 되돌린다 (캡쳐는 유지).
 * 자동 항목은 현재 정면샷 랜드마크 기반으로 다시 채워진다.
 * face_measurement 의 "측정값 모두 지우기" 버튼이 호출.
 */
export function clear_all_measurements() {
  g_session.measurements_obj = build_initial_measurements(
    pick_front_auto_points(),
    g_session.scale?.mm_per_px ?? null,
  )
  g_session.active_item_id = null
  mirror_now()
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
  } else {
    g_session.active_item_id = g_session.active_item_id === item_id ? null : item_id
  }
  mirror_now()
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
  const value_px = pixel_distance(points[0], points[1])
  item.points = points
  item.value_px = value_px
  item.value_mm = g_session.scale ? value_px * g_session.scale.mm_per_px : null
  item.source = 'manual'
  mirror_now()
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
  mirror_now()
}
