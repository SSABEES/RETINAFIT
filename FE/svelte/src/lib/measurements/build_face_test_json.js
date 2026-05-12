/**
 * 캡쳐 세션 상태 + 얼굴 분석 결과 → BE schema_version 3 의 test_json payload 빌드.
 * report.svelte (정상 review 플로우) / index.svelte (정면만 후 생활패턴 직행 플로우) 양쪽에서 공통 사용.
 */
import {
  get_frame_styles_for_face_shape,
  get_skin_tone_recommendation,
} from '@/lib/recommendations/frame_recommendations.js'

/**
 * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
 * @typedef {import('@/lib/stores/capture_session.svelte.js').FaceShapeResult} FaceShapeResult
 * @typedef {import('@/lib/stores/capture_session.svelte.js').ScaleInfo} ScaleInfo
 * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
 */

/**
 * measurements_obj 의 한 항목을 schema_version 3 의 { value_mm, value_px, source } 형태로 변환.
 * @param {{ value_mm?: number | null, value_px?: number | null, source?: string } | null | undefined} item_obj
 */
function pick_measurement_value(item_obj) {
  if (!item_obj) return null
  return {
    value_mm: item_obj.value_mm ?? null,
    value_px: item_obj.value_px ?? null,
    source: item_obj.source ?? 'auto',
  }
}

/**
 * @param {{
 *   measurements_obj: Record<string, MeasurementItem> | null | undefined,
 *   scale: ScaleInfo | null | undefined,
 *   captures_obj: Record<string, Capture> | null | undefined,
 *   face_shape_result: FaceShapeResult | null | undefined,
 * }} param_obj
 */
export function build_face_test_json({ measurements_obj, scale, captures_obj, face_shape_result }) {
  const local_skin_tone_obj = face_shape_result?.skin_tone ?? null
  const local_skin_tone_rec = local_skin_tone_obj
    ? get_skin_tone_recommendation(local_skin_tone_obj.tone)
    : null
  const local_face_shape_value = face_shape_result?.face_shape ?? null
  const local_face_shape_rec_arr = get_frame_styles_for_face_shape(local_face_shape_value)
  const local_skin_tone_rec_arr = local_skin_tone_rec
    ? local_skin_tone_rec.chip_arr.map((local_chip_obj) => ({ label: local_chip_obj.label }))
    : []

  const local_measurements_obj = measurements_obj ?? {}
  const local_face_width_obj = pick_measurement_value(local_measurements_obj.face_width)
  const local_face_height_obj = pick_measurement_value(local_measurements_obj.face_height)
  const local_face_ratio_value =
    local_face_height_obj?.value_mm && local_face_width_obj?.value_mm
      ? Number((local_face_height_obj.value_mm / local_face_width_obj.value_mm).toFixed(3))
      : null

  // 측정 항목별 두 점의 픽셀 좌표 (unmirrored 원본 캡쳐 좌표계).
  /** @type {Record<string, [{x: number, y: number}, {x: number, y: number}]>} */
  const local_points_obj = {}
  for (const [local_id, local_item] of Object.entries(local_measurements_obj)) {
    const local_points = local_item?.points ?? null
    if (Array.isArray(local_points) && local_points.length === 2) {
      local_points_obj[local_id] = [
        { x: local_points[0].x, y: local_points[0].y },
        { x: local_points[1].x, y: local_points[1].y },
      ]
    }
  }

  const local_front_capture = captures_obj?.front_no_glasses ?? null
  const local_image_dims_obj = local_front_capture
    ? { width: local_front_capture.width, height: local_front_capture.height }
    : null

  return {
    schema_version: 3,
    face_shape: local_face_shape_value,
    face_shape_recommendations: local_face_shape_rec_arr,
    skin_tone: local_skin_tone_obj,
    skin_tone_recommendations: local_skin_tone_rec_arr,
    asymmetry_score: face_shape_result?.asymmetry?.score ?? null,
    measurements: {
      face_width: local_face_width_obj,
      face_height: local_face_height_obj,
      pd: pick_measurement_value(local_measurements_obj.pd),
      right_pd: pick_measurement_value(local_measurements_obj.right_pd),
      left_pd: pick_measurement_value(local_measurements_obj.left_pd),
    },
    measurement_points_obj: local_points_obj,
    image_dims_obj: local_image_dims_obj,
    face_ratio: local_face_ratio_value,
    scale: scale ?? null,
  }
}
