/**
 * 랜드마크 유틸리티 - MediaPipe 478포인트 face mesh 를 픽셀 좌표로 변환하고 거리/각도 계산.
 * Flutter 프로젝트 src/lib/landmarks.ts 에서 포팅.
 *
 * @typedef {import("./face_types.js").Point2D} Point2D
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 */

/**
 * 얼굴 실루엣/외곽선 계산에 사용하는 주요 랜드마크 인덱스.
 * 카메라를 바라보는 사람 기준 좌/우.
 */
export const LANDMARK_IDX = {
  topForehead: 10,
  chin: 152,
  leftForehead: 54,
  rightForehead: 284,
  leftCheek: 234,
  rightCheek: 454,
  leftJaw: 172,
  rightJaw: 397,
}

/**
 * 정규화된 랜드마크를 픽셀 좌표로 변환한다.
 * @param {NormalizedLandmark} p
 * @param {number} w
 * @param {number} h
 * @returns {Point2D}
 */
export function to_pixel(p, w, h) {
  return { x: p.x * w, y: p.y * h }
}

/**
 * 두 점 사이의 유클리드 거리를 반환한다.
 * @param {Point2D} a
 * @param {Point2D} b
 * @returns {number}
 */
export function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 꼭짓점 v 에서 v→a, v→b 두 선분이 이루는 각도(도 단위, 0~180)를 반환한다.
 * @param {Point2D} v
 * @param {Point2D} a
 * @param {Point2D} b
 * @returns {number}
 */
export function angle_at(v, a, b) {
  const va = { x: a.x - v.x, y: a.y - v.y }
  const vb = { x: b.x - v.x, y: b.y - v.y }
  const dot = va.x * vb.x + va.y * vb.y
  const mag_a = Math.sqrt(va.x * va.x + va.y * va.y)
  const mag_b = Math.sqrt(vb.x * vb.x + vb.y * vb.y)
  const cos = Math.min(1, Math.max(-1, dot / (mag_a * mag_b)))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * LANDMARK_IDX 의 모든 키를 픽셀 좌표로 변환해 반환한다.
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} image_width
 * @param {number} image_height
 * @returns {Record<keyof typeof LANDMARK_IDX, Point2D>}
 */
export function extract_key_points(landmarks, image_width, image_height) {
  const result = {}
  for (const [name, idx] of Object.entries(LANDMARK_IDX)) {
    result[name] = to_pixel(landmarks[idx], image_width, image_height)
  }
  return result
}
