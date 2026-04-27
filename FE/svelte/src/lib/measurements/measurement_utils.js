/**
 * 점 측정 관련 순수 유틸리티.
 * 스토어/컴포넌트 어디서든 공유할 계산 로직만 둔다.
 *
 * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
 * @typedef {import('./template.js').MeasurementTemplateEntry} MeasurementTemplateEntry
 * @typedef {import('./template.js').ViewAngle} ViewAngle
 * @typedef {import('./template.js').MeasurementSource} MeasurementSource
 *
 * @typedef {object} MeasurementItem
 * @property {string} item_id
 * @property {string} label
 * @property {ViewAngle} view
 * @property {MeasurementSource} source
 * @property {[Point2D, Point2D] | null} points
 * @property {number | null} value_px
 * @property {number | null} [value_mm]
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
 * 템플릿을 기반으로 초기 measurements_obj 를 만든다.
 * auto_points_obj 가 주어지면 해당 item_id 에 해당하는 auto 항목의 points/value_px 를 사전 채운다.
 * scale_mm_per_px 가 주어지면 자동 항목의 value_mm 도 함께 채운다.
 * 그 외 항목은 points/value_px/value_mm 가 null 로 남는다.
 *
 * @param {Record<string, [Point2D, Point2D]> | null} [auto_points_obj]
 * @param {number | null} [scale_mm_per_px]
 * @returns {Record<string, MeasurementItem>}
 */
export function build_initial_measurements(auto_points_obj = null, scale_mm_per_px = null) {
  /** @type {Record<string, MeasurementItem>} */
  const result = {}
  for (const entry of MEASUREMENT_TEMPLATE) {
    const pair = auto_points_obj?.[entry.item_id] ?? null
    const points = entry.source === 'auto' && pair ? pair : null
    const value_px = points ? pixel_distance(points[0], points[1]) : null
    result[entry.item_id] = {
      item_id: entry.item_id,
      label: entry.label,
      view: entry.view,
      source: entry.source,
      points,
      value_px,
      value_mm: value_px !== null && scale_mm_per_px !== null ? value_px * scale_mm_per_px : null,
    }
  }
  return result
}
