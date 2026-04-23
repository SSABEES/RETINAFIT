/**
 * 안경 피팅에 필요한 6가지 픽셀 측정값 계산.
 * Flutter 프로젝트 src/lib/measurements.ts 에서 포팅.
 *
 * @typedef {import("./face_types.js").FaceMeasurements} FaceMeasurements
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 */

/**
 * 478포인트 정규화 랜드마크 배열에서 6가지 픽셀 측정값을 계산한다.
 * 측정값 중 하나라도 0 이하이면 측정 실패로 null 을 반환한다.
 *
 * 랜드마크 인덱스:
 *  - 454/234: 광대(zygomatic) → face_width
 *  - 152/10: 턱끝/이마 → face_height
 *  - 263/33: 안내측각 → eye_distance
 *  - 358/129: 콧날 → nose_width
 *  - 397/172: 턱 외곽 → jaw_width
 *
 * PD ≈ eye_distance × 0.8 (원본 프로젝트 경험 규칙)
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} width
 * @param {number} height
 * @returns {FaceMeasurements | null}
 */
export function compute_measurements(landmarks, width, height) {
  if (!landmarks || landmarks.length < 468) return null

  const face_width = Math.abs(landmarks[454].x - landmarks[234].x) * width
  const face_height = Math.abs(landmarks[152].y - landmarks[10].y) * height
  const eye_distance = Math.abs(landmarks[263].x - landmarks[33].x) * width
  const nose_width = Math.abs(landmarks[358].x - landmarks[129].x) * width
  const jaw_width = Math.abs(landmarks[397].x - landmarks[172].x) * width
  const pd_pixels = eye_distance * 0.8

  if (face_width <= 0 || face_height <= 0 || eye_distance <= 0) return null

  return {
    face_width: Math.round(face_width),
    face_height: Math.round(face_height),
    eye_distance: Math.round(eye_distance),
    pd_pixels: Math.round(pd_pixels),
    nose_width: Math.round(nose_width),
    jaw_width: Math.round(jaw_width),
  }
}
