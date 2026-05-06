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
 * @typedef {import('@/lib/measurements/aruco_detector.js').DetectedMarker} DetectedMarker
 * @typedef {import('@/lib/measurements/camera_intrinsics.js').CameraIntrinsics} CameraIntrinsics
 *
 * @typedef {object} HeadPoseSnapshot
 * @property {number} image_tilt_deg                       보정에 직접 쓰는 값. atan2(R[1], R[4]) buffer 평균 후 동결.
 * @property {number | null} pitch_deg                     참조용 (측면 자세에서 gimbal lock 영향, 디버깅·로깅 목적).
 * @property {number | null} yaw_deg
 * @property {number | null} roll_deg
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
 * @property {HeadPoseSnapshot | null} [head_pose]         측면 캡처에서만 채워짐. 정면은 null/undefined
 * @property {DetectedMarker | null} [marker]              ArUco 마커 검출 결과. add_capture 가 모든 단계에서 시도, 실패 시 null
 * @property {CameraIntrinsics | null} [intrinsics]        marker 검출 성공 시 같이 보관 — mm_distance / 디버그 오버레이가 사용
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
 * @typedef {'aruco_marker' | 'pd_assumption_63mm'} ScaleSource
 *
 * @typedef {object} ScaleInfo
 * @property {number} mm_per_px              환산 비율: value_mm = value_px * mm_per_px
 * @property {ScaleSource} source            환산 비율을 어떻게 구했는지 — 'aruco_marker' 우선, 실패 시 'pd_assumption_63mm' fallback
 * @property {number | null} pd_pixels_used  PD 기반일 때 사용한 PD 픽셀값. ArUco 일 때 null
 * @property {string | null} aruco_step_id   ArUco 기반일 때 어느 캡처(step_id) 의 마커가 채택됐는지. PD 일 때 null
 * @property {number | null} aruco_size_px   ArUco 기반일 때 마커의 평균 변 픽셀값 (디버그용). PD 일 때 null
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
import {
  build_initial_measurements,
  pixel_distance,
  vertical_signed_angle_deg,
  apply_image_tilt_correction,
} from '@/lib/measurements/measurement_utils.js'
import { detect_marker_for_capture, MARKER_SIZE_MM } from '@/lib/measurements/aruco_capture.js'
import { write_mirror, read_mirror, clear_mirror } from '@/lib/utils/session_storage_mirror.js'

// 얼굴형 분류용 정면샷 우선순위. 맨얼굴(front_no_glasses)이 안경 왜곡 없이 광대/턱 폭을 가장 정확히 잡아낸다.
const FRONT_STEP_PRIORITY = ['front_no_glasses', 'front_glasses']

// 마커 우선 채택 순서 — 정면을 먼저, 그 다음 측면. ArUco 기반 mm_per_px 산출 시 첫 번째 매칭 사용.
const ARUCO_STEP_PRIORITY = [
  'front_no_glasses',
  'front_glasses',
  'left_no_glasses',
  'left_glasses',
  'right_no_glasses',
  'right_glasses',
]

// PD 가정값 (성인 평균 동공간 거리). ArUco 마커 검출 실패 시 fallback 환산 기준.
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

    // 귀 높이 산출 — 일단 비활성화 (사용자 요청). FaceDetector 추가 호출 비용 절감.
    // 화면 표시는 ear_offsets_obj null-check 로 자동 비표시되고, 미러/test_json 도 자연스레 제외.
    // 재활성화 시 아래 블록 주석을 풀면 됨 (compute_ear_offsets, EarOffsets 타입, 화면 코드 모두 유지).
    const ear_offsets_obj = null
    // if (bitmap) {
    //   const kp = await detect_keypoints_from_image(bitmap)
    //   if (kp) {
    //     const offsets_px = compute_ear_offsets(kp, capture.height)
    //     ear_offsets_obj = {
    //       right_y_offset_px: offsets_px.right_y_offset_px,
    //       left_y_offset_px: offsets_px.left_y_offset_px,
    //       right_y_offset_mm: null,
    //       left_y_offset_mm: null,
    //     }
    //   }
    // }

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
 *
 * ArUco 마커는 모든 단계에서 검출 시도. 결과는 capture.marker / capture.intrinsics 에 저장.
 * 실패해도 캡처는 그대로 진행 — compute_scale 이 PD fallback 으로 처리.
 *
 * @param {Capture} capture
 */
export async function add_capture(capture) {
  // 검출은 await — 마지막 스텝의 compute_scale 이 정면 마커를 즉시 참조할 수 있어야 한다.
  // 정상 경로 ~50-100ms, 실패해도 이 함수는 throw 하지 않으므로 캡처 흐름이 막히지 않는다.
  const aruco_result = await detect_marker_for_capture(capture)
  capture.marker = aruco_result?.marker ?? null
  capture.intrinsics = aruco_result?.intrinsics ?? null
  log_marker_detection(capture)

  g_session.captures_obj[capture.step_id] = capture
  if (g_session.current_step_index + 1 >= g_session.steps_arr.length) {
    g_session.face_shape_result = await compute_face_shape_result()
    g_session.scale = compute_scale()
    log_scale_decision(g_session.scale)
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
 * ArUco 검출 결과를 사람이 읽기 좋은 한 줄 로그로 출력한다. 운영자가 디버깅 시 즉시 파악 가능.
 * @param {Capture} capture
 */
function log_marker_detection(capture) {
  const step = capture.step_id
  if (capture.marker) {
    const m = capture.marker
    console.log(
      `[ArUco] 마커 검출 성공 — 단계=${step}, ID=${m.id}, 카메라거리=${m.translation[2].toFixed(0)}mm, 픽셀크기=${m.sizePx.toFixed(0)}px`,
    )
  } else {
    console.log(`[ArUco] 마커 미검출 — 단계=${step} (사진에 마커가 없거나 인식 불가)`)
  }
}

/**
 * compute_scale 결과(어느 출처가 채택됐는지) 를 사람이 읽기 좋게 로그.
 * @param {ScaleInfo | null} scale
 */
function log_scale_decision(scale) {
  if (!scale) {
    console.warn('[ArUco] mm 환산 비율 산출 실패 — 마커도 PD 측정값도 없음. 모든 측정이 px 로만 표시됩니다.')
    return
  }
  if (scale.source === 'aruco_marker') {
    console.log(
      `[ArUco] mm 환산: ArUco 마커 사용 — 단계=${scale.aruco_step_id}, 마커 픽셀크기=${scale.aruco_size_px?.toFixed(0)}px, 1px=${scale.mm_per_px.toFixed(4)}mm`,
    )
  } else {
    console.warn(
      `[ArUco] mm 환산: PD 63mm 추정값으로 fallback — 어느 단계에서도 마커 미검출. PD 픽셀=${scale.pd_pixels_used}, 1px=${scale.mm_per_px.toFixed(4)}mm. 정확도 ↓ — UI 에 추정치 안내 노출.`,
    )
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
 * px↔mm 환산 비율을 계산한다.
 *
 * 우선순위:
 *   1. ArUco 마커 — ARUCO_STEP_PRIORITY 순으로 첫 검출 성공한 캡처 사용. mm_per_px = MARKER_SIZE_MM / sizePx.
 *      (평면 근사 — mm_distance 가 더 정확하지만 단일 ratio API 와 호환 위해 sizePx 기반 단순 환산.)
 *   2. PD 63mm 가정 — 정면 캡처의 pd_pixels 로 산출. 마커 미검출 시 fallback.
 *
 * 둘 다 실패하면 null.
 * @returns {ScaleInfo | null}
 */
function compute_scale() {
  for (const step_id of ARUCO_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    const marker = capture?.marker
    if (marker && marker.sizePx > 0) {
      return {
        mm_per_px: MARKER_SIZE_MM / marker.sizePx,
        source: 'aruco_marker',
        pd_pixels_used: null,
        aruco_step_id: step_id,
        aruco_size_px: marker.sizePx,
      }
    }
  }
  for (const step_id of FRONT_STEP_PRIORITY) {
    const capture = g_session.captures_obj[step_id]
    const pd_pixels = capture?.measurements_obj?.pd_pixels
    if (pd_pixels && pd_pixels > 0) {
      return {
        mm_per_px: ASSUMED_PD_MM / pd_pixels,
        source: 'pd_assumption_63mm',
        pd_pixels_used: pd_pixels,
        aruco_step_id: null,
        aruco_size_px: null,
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
  if (mirror.measurements_obj) {
    // view 필드 string → string[] 마이그레이션 호환 — 구 mirror 가 단일 문자열로 저장된 경우 배열로 감싼다.
    for (const m of Object.values(mirror.measurements_obj)) {
      if (typeof m.view === 'string') m.view = [m.view]
      if (m.kind === undefined) m.kind = 'distance'
    }
    g_session.measurements_obj = mirror.measurements_obj
  }
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
 * view 필드는 배열이라 한 항목이 여러 뷰에 노출될 수 있다 (예: 전경각이 좌·우 측면 둘 다).
 * @param {ViewAngle} view
 * @returns {MeasurementItem[]}
 */
export function get_measurement_items(view) {
  return Object.values(g_session.measurements_obj).filter((m) => m.view.includes(view))
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
 * 지정 항목에 두 점을 기록하고 측정값을 재계산한다. 수동으로 찍은 것이므로 source 는 'manual' 로 전환.
 *
 * kind 별 분기:
 *   - distance: pixel_distance → value_px / value_mm
 *   - angle: vertical_signed_angle_deg → value_deg_raw, source_view 의 capture.head_pose.image_tilt_deg
 *     로 보정해 value_deg_corrected 산출. head_pose 가 없으면 보정 없이 raw 값을 corrected 에 동일 저장
 *     하고 head_image_tilt_deg_used = null 로 표시.
 *
 * @param {string} item_id
 * @param {[Point2D, Point2D]} points
 * @param {ViewAngle} source_view                 측정한 뷰 — angle 항목 보정 시 capture 조회 키
 */
export function set_item_points(item_id, points, source_view) {
  const item = g_session.measurements_obj[item_id]
  if (!item) return

  if (item.kind === 'angle') {
    const raw = vertical_signed_angle_deg(points[0], points[1], source_view)
    const head_pose = g_session.captures_obj[source_view]?.head_pose ?? null
    // image_plane_tilt_deg 는 raw 카메라 좌표계 부호라 좌·우 측면에서 같은 머리 자세도 반대 부호로
    // 나옴. vertical_signed_angle_deg 는 이미 좌측면 부호를 반전해 광학 표준 컨벤션(좌·우 일치)으로
    // 맞추므로, 보정 입력값도 같은 컨벤션이 되도록 좌측면일 때 image_tilt 부호 반전.
    const raw_image_tilt = head_pose?.image_tilt_deg ?? null
    const image_tilt = raw_image_tilt !== null && source_view.startsWith('left_')
      ? -raw_image_tilt
      : raw_image_tilt
    item.points = points
    item.value_px = null
    item.value_mm = null
    item.value_deg_raw = raw
    item.value_deg_corrected = image_tilt !== null ? apply_image_tilt_correction(raw, image_tilt) : raw
    item.head_image_tilt_deg_used = image_tilt
    item.source = 'manual'
    mirror_now()
    return
  }

  // distance
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
  if (item.kind === 'angle') {
    item.value_deg_raw = null
    item.value_deg_corrected = null
    item.head_image_tilt_deg_used = null
  }
  mirror_now()
}
