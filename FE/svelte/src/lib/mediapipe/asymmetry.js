/**
 * 좌/우 얼굴 윤곽 거울 대칭 IoU 점수 산출 모듈.
 *
 * 알고리즘 (C-2 래스터화 symmetric diff):
 *  1. FACE_OVAL 36 랜드마크를 200×250 binary mask 로 fill.
 *  2. 동일 polygon 을 코 중심선 기준 horizontal mirror flip 후 재 fill → mask_b.
 *  3. mask_a 와 mask_b 의 union / intersection 픽셀 카운트로 IoU 산출.
 *  4. (IoU - FLOOR) / (CEIL - FLOOR) × 100 으로 0-100 점수 매핑.
 *
 * @typedef {import('./face_types.js').AsymmetryResult} AsymmetryResult
 * @typedef {import('@mediapipe/tasks-vision').NormalizedLandmark} NormalizedLandmark
 */

import { FaceLandmarker as MpFaceLandmarker } from '@mediapipe/tasks-vision'
import {
  ASYMMETRY_CANVAS_W,
  ASYMMETRY_CANVAS_H,
  ASYMMETRY_IOU_FLOOR,
  ASYMMETRY_IOU_CEIL,
  THRESHOLD_SOURCE,
} from '@/lib/measurements/thresholds.js'

// FACE_LANDMARKS_FACE_OVAL connection 들에서 unique 랜드마크 인덱스 36개 추출 — 모듈 로드 시 한 번 계산.
function extract_oval_indices() {
  const set = new Set()
  for (const c of MpFaceLandmarker.FACE_LANDMARKS_FACE_OVAL) {
    set.add(c.start)
    set.add(c.end)
  }
  return Array.from(set)
}

/** @type {readonly number[]} */
const FACE_OVAL_INDICES = Object.freeze(extract_oval_indices())

/**
 * Face oval landmark 의 x 좌표를 코 중심선(168) 기준 캔버스 x 로 정규화한다.
 * face_oval 의 x 범위가 캔버스 너비를 가득 채우도록 fit.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {{ points_arr: Array<{ x: number, y: number }>, midline_canvas_x: number } | null}
 */
function project_oval_to_canvas(landmarks) {
  if (!landmarks || landmarks.length < 468) return null

  // 정규화 좌표 (0-1) 그대로 face_oval x/y bbox 계산.
  let x_min = Infinity, x_max = -Infinity, y_min = Infinity, y_max = -Infinity
  for (const idx of FACE_OVAL_INDICES) {
    const lm = landmarks[idx]
    if (!lm) continue
    if (lm.x < x_min) x_min = lm.x
    if (lm.x > x_max) x_max = lm.x
    if (lm.y < y_min) y_min = lm.y
    if (lm.y > y_max) y_max = lm.y
  }
  const x_range = x_max - x_min
  const y_range = y_max - y_min
  if (x_range <= 0 || y_range <= 0) return null

  // bbox 를 캔버스 전체로 fit. midline(168) 도 같은 변환.
  const points_arr = FACE_OVAL_INDICES.map((idx) => {
    const lm = landmarks[idx]
    return {
      x: ((lm.x - x_min) / x_range) * ASYMMETRY_CANVAS_W,
      y: ((lm.y - y_min) / y_range) * ASYMMETRY_CANVAS_H,
    }
  })

  const midline = landmarks[168]
  if (!midline) return null
  const midline_canvas_x = ((midline.x - x_min) / x_range) * ASYMMETRY_CANVAS_W

  return { points_arr, midline_canvas_x }
}

/**
 * polygon 을 캔버스에 fill 하고 alpha 채널 기반 binary mask (0/1 Uint8Array) 를 반환한다.
 *
 * @param {Array<{ x: number, y: number }>} points_arr
 * @param {boolean} mirror_about_midline   true 면 코 중심선 기준 좌우 반전
 * @param {number} midline_x               mirror 기준 x (반전 안 할 때 무시)
 * @returns {Uint8Array}
 */
function fill_polygon_mask(points_arr, mirror_about_midline, midline_x) {
  const canvas = new OffscreenCanvas(ASYMMETRY_CANVAS_W, ASYMMETRY_CANVAS_H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2d context 미지원')

  ctx.clearRect(0, 0, ASYMMETRY_CANVAS_W, ASYMMETRY_CANVAS_H)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let i = 0; i < points_arr.length; i++) {
    let x = points_arr[i].x
    if (mirror_about_midline) x = 2 * midline_x - x
    const y = points_arr[i].y
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()

  // alpha 채널 → 0/1 Uint8Array.
  const data = ctx.getImageData(0, 0, ASYMMETRY_CANVAS_W, ASYMMETRY_CANVAS_H).data
  const mask = new Uint8Array(ASYMMETRY_CANVAS_W * ASYMMETRY_CANVAS_H)
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) {
    mask[i] = data[j] > 0 ? 1 : 0
  }
  return mask
}

/**
 * 두 binary mask 의 union/intersection 픽셀 카운트로 IoU 를 계산한다.
 *
 * @param {Uint8Array} mask_a
 * @param {Uint8Array} mask_b
 * @returns {{ iou: number, union: number, intersection: number }}
 */
function compute_iou(mask_a, mask_b) {
  let union = 0
  let intersection = 0
  for (let i = 0; i < mask_a.length; i++) {
    const a = mask_a[i]
    const b = mask_b[i]
    if (a || b) union++
    if (a && b) intersection++
  }
  return {
    iou: union === 0 ? 0 : intersection / union,
    union,
    intersection,
  }
}

/**
 * IoU 값을 0-100 점수로 매핑한다 (FLOOR ↓ → 0, CEIL ↑ → 100).
 *
 * @param {number} iou
 * @returns {number}
 */
function map_iou_to_score(iou) {
  const t = (iou - ASYMMETRY_IOU_FLOOR) / (ASYMMETRY_IOU_CEIL - ASYMMETRY_IOU_FLOOR)
  if (t <= 0) return 0
  if (t >= 1) return 100
  return Math.round(t * 100)
}

/**
 * 478 랜드마크에서 좌우 얼굴 윤곽 비대칭 점수를 계산한다.
 * 실패(랜드마크 부족 / 캔버스 미지원) 시 null.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {AsymmetryResult | null}
 */
export function compute_asymmetry_score(landmarks) {
  try {
    const projected = project_oval_to_canvas(landmarks)
    if (!projected) return null

    const mask_a = fill_polygon_mask(projected.points_arr, false, 0)
    const mask_b = fill_polygon_mask(projected.points_arr, true, projected.midline_canvas_x)
    const { iou } = compute_iou(mask_a, mask_b)
    const score = map_iou_to_score(iou)

    return {
      score,
      iou,
      threshold_source: THRESHOLD_SOURCE.MOCK,
    }
  } catch (err) {
    console.warn('[asymmetry] compute failed', err)
    return null
  }
}
