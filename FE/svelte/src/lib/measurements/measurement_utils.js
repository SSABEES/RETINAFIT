/**
 * 점 측정 관련 순수 유틸리티.
 * 스토어/컴포넌트 어디서든 공유할 계산 로직만 둔다.
 *
 * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
 * @typedef {import('./template.js').MeasurementTemplateEntry} MeasurementTemplateEntry
 * @typedef {import('./template.js').ViewAngle} ViewAngle
 * @typedef {import('./template.js').MeasurementSource} MeasurementSource
 * @typedef {import('./template.js').MeasurementKind} MeasurementKind
 *
 * @typedef {object} MeasurementItem
 * @property {string} item_id
 * @property {string} label
 * @property {MeasurementKind} kind                                 'distance' | 'angle'
 * @property {ViewAngle[]} view                                     이 항목이 속한 뷰들 (배열 — 단일 항목 다중 뷰 공유 가능)
 * @property {MeasurementSource} source
 * @property {[Point2D, Point2D] | null} points
 * @property {number | null} value_px                               (distance 전용)
 * @property {number | null} [value_mm]                             (distance 전용)
 * @property {number | null} [value_deg_raw]                        (angle 전용) 보정 전
 * @property {number | null} [value_deg_corrected]                  (angle 전용) head image_tilt 로 보정 후 — UI 표시값
 * @property {number | null} [head_image_tilt_deg_used]             (angle 전용) 보정에 사용된 image_tilt 값. null 이면 보정 없음
 */

import { MEASUREMENT_TEMPLATE } from './template.js'

/**
 * 두 점의 픽셀 공간 직선거리를 계산한다.
 * @param {Point2D} p1
 * @param {Point2D} p2
 * @returns {number}
 */
export function pixel_distance(p1, p2) {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.hypot(dx, dy)
}

/**
 * 두 점이 이루는 선분이 화면 수직선과 이루는 부호 있는 각도(도) 를 반환한다.
 *
 * 부호 컨벤션 (광학 표준 전경각):
 *   - 림 상단이 뒤로 기울면 양수, 앞으로 기울면 음수.
 *   - 좌·우 측면은 카메라 방향이 반대라 같은 림 기하가 이미지에서 반대 부호로 나타남 — 좌측면 뷰
 *     (`left_glasses` / `left_no_glasses`) 에서 부호 반전해 광학 부호 일관성 유지.
 *
 * 알고리즘:
 *   1. 두 점 중 y 값이 작은 쪽을 림 상단으로 가정해 (p_top, p_bottom) 정렬. 이미지 좌표는 y 가 아래로 증가.
 *   2. dx = p_bottom.x - p_top.x, dy = p_bottom.y - p_top.y. atan2(dx, dy) → 이미지 좌표 시계방향 양수 각도.
 *   3. view 가 'left_' 로 시작하면 부호 반전.
 *
 * @param {Point2D} p1
 * @param {Point2D} p2
 * @param {ViewAngle} view
 * @returns {number} -180 ~ 180. 정확히 수직이면 0°.
 */
export function vertical_signed_angle_deg(p1, p2, view) {
  const [top, bottom] = p1.y <= p2.y ? [p1, p2] : [p2, p1]
  const dx = bottom.x - top.x
  const dy = bottom.y - top.y
  const theta = Math.atan2(dx, dy) * (180 / Math.PI)
  return view.startsWith('left_') ? -theta : theta
}

/**
 * 측정 각도에서 캡처 시점 머리 기울기(image_tilt)를 빼서 보정값을 산출한다.
 * 별도 함수로 분리한 이유: 의미가 명시적이고 단위 테스트가 쉬움.
 *
 * 측면 자세에서 image_tilt 는 사용자 머리 pitch 와 수학적으로 동등하므로 빼주면 안경 자체의 기울기만 남는다.
 *
 * @param {number} angle_deg                   사용자가 클릭한 림 두 점의 raw 각도
 * @param {number} image_tilt_deg              캡처 시점 동결된 머리 기울기
 * @returns {number}                           보정 후 안경 자체 각도
 */
export function apply_image_tilt_correction(angle_deg, image_tilt_deg) {
  return angle_deg - image_tilt_deg
}

/**
 * 템플릿을 기반으로 초기 measurements_obj 를 만든다.
 * auto_points_obj 가 주어지면 해당 item_id 에 해당하는 auto 항목의 points/value_px 를 사전 채운다.
 * scale_mm_per_px 가 주어지면 자동 항목의 value_mm 도 함께 채운다.
 * angle 항목은 사용자 입력 전에는 모든 value 가 null.
 *
 * @param {Record<string, [Point2D, Point2D]> | null} [auto_points_obj]
 * @param {number | null} [scale_mm_per_px]
 * @returns {Record<string, MeasurementItem>}
 */
export function build_initial_measurements(auto_points_obj = null, scale_mm_per_px = null) {
  /** @type {Record<string, MeasurementItem>} */
  const result = {}
  for (const entry of MEASUREMENT_TEMPLATE) {
    if (entry.kind === 'angle') {
      result[entry.item_id] = {
        item_id: entry.item_id,
        label: entry.label,
        kind: 'angle',
        view: entry.view,
        source: entry.source,
        points: null,
        value_px: null,
        value_mm: null,
        value_deg_raw: null,
        value_deg_corrected: null,
        head_image_tilt_deg_used: null,
      }
      continue
    }

    const pair = auto_points_obj?.[entry.item_id] ?? null
    const points = entry.source === 'auto' && pair ? pair : null
    const value_px = points ? pixel_distance(points[0], points[1]) : null
    result[entry.item_id] = {
      item_id: entry.item_id,
      label: entry.label,
      kind: 'distance',
      view: entry.view,
      source: entry.source,
      points,
      value_px,
      value_mm: value_px !== null && scale_mm_per_px !== null ? value_px * scale_mm_per_px : null,
    }
  }
  return result
}
