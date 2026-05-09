/**
 * 정면 사진 픽셀에서 피부 톤(WARM/NEUTRAL/COOL) 자동 분류.
 *
 * 알고리즘:
 *  1. 광대 좌(116) / 광대 우(345) / 이마(10 from y -40px) 3패치 (각 30×30) 추출.
 *  2. 각 패치 픽셀 V (max(R,G,B)/255) 로 정렬, 양 끝 25% 트리밍 후 RGB 평균.
 *  3. 3패치 RGB 평균을 다시 평균 → 대표 RGB → HSV 변환.
 *  4. hue 임계값(thresholds.js)으로 분류:
 *     - [0, COOL_MAX] ∪ [360-COOL_MAX, 360) : COOL
 *     - (COOL_MAX, WARM_MIN)                : NEUTRAL
 *     - [WARM_MIN, WARM_MAX]                : WARM
 *     - 그 외                               : NEUTRAL fallback
 *  5. frame 밖 패치는 skip. 0 패치면 null 반환.
 *
 * @typedef {import('./face_types.js').SkinTone} SkinTone
 * @typedef {import('./face_types.js').SkinToneResult} SkinToneResult
 * @typedef {import('@mediapipe/tasks-vision').NormalizedLandmark} NormalizedLandmark
 */

import {
  SKIN_PATCH_SIZE,
  SKIN_FOREHEAD_Y_OFFSET_PX,
  SKIN_TRIM_FRACTION,
  SKIN_HUE_COOL_MAX,
  SKIN_HUE_WARM_MIN,
  SKIN_HUE_WARM_MAX,
  THRESHOLD_SOURCE,
} from '@/lib/measurements/thresholds.js'

/**
 * 패치 중심 좌표(canvas 픽셀 기준) 와 패치 크기를 받아 ImageData 에서 픽셀을 추출한다.
 * 패치가 frame 밖이면 null.
 *
 * @param {ImageData} image_data
 * @param {number} cx
 * @param {number} cy
 * @returns {Uint8ClampedArray | null}
 */
function extract_patch_pixels(image_data, cx, cy) {
  const half = SKIN_PATCH_SIZE / 2
  const x0 = Math.round(cx - half)
  const y0 = Math.round(cy - half)
  const x1 = x0 + SKIN_PATCH_SIZE
  const y1 = y0 + SKIN_PATCH_SIZE
  if (x0 < 0 || y0 < 0 || x1 > image_data.width || y1 > image_data.height) return null

  const out = new Uint8ClampedArray(SKIN_PATCH_SIZE * SKIN_PATCH_SIZE * 4)
  let dst = 0
  for (let y = y0; y < y1; y++) {
    let src = (y * image_data.width + x0) * 4
    for (let x = x0; x < x1; x++) {
      out[dst++] = image_data.data[src++]
      out[dst++] = image_data.data[src++]
      out[dst++] = image_data.data[src++]
      out[dst++] = image_data.data[src++]
    }
  }
  return out
}

/**
 * 픽셀들을 V (max(R,G,B)) 로 정렬해 양 끝 trim_fraction 씩 잘라내고 남은 RGB 를 평균한다.
 * 그늘/하이라이트/홍조 outlier 를 제거하는 단순 통계 기법.
 *
 * @param {Uint8ClampedArray} patch
 * @returns {{ r: number, g: number, b: number }}
 */
function trimmed_mean_rgb(patch) {
  const n = patch.length / 4
  /** @type {Array<{ r: number, g: number, b: number, v: number }>} */
  const arr = new Array(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = patch[j],
      g = patch[j + 1],
      b = patch[j + 2]
    arr[i] = { r, g, b, v: Math.max(r, g, b) }
  }
  arr.sort((p, q) => p.v - q.v)
  const trim_n = Math.floor(n * SKIN_TRIM_FRACTION)
  const lo = trim_n
  const hi = n - trim_n
  let r_sum = 0,
    g_sum = 0,
    b_sum = 0
  for (let i = lo; i < hi; i++) {
    r_sum += arr[i].r
    g_sum += arr[i].g
    b_sum += arr[i].b
  }
  const cnt = hi - lo
  return { r: r_sum / cnt, g: g_sum / cnt, b: b_sum / cnt }
}

/**
 * RGB (0-255) → HSV (h: 0-360, s: 0-1, v: 0-1) 변환.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, v: number }}
 */
function rgb_to_hsv(r, g, b) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : delta / max
  return { h, s, v: max }
}

/**
 * hue 값을 SkinTone 라벨로 분류한다.
 *
 * @param {number} h
 * @returns {SkinTone}
 */
function classify_hue(h) {
  if (h <= SKIN_HUE_COOL_MAX || h >= 360 - SKIN_HUE_COOL_MAX) return 'COOL'
  if (h >= SKIN_HUE_WARM_MIN && h <= SKIN_HUE_WARM_MAX) return 'WARM'
  if (h > SKIN_HUE_COOL_MAX && h < SKIN_HUE_WARM_MIN) return 'NEUTRAL'
  return 'NEUTRAL'
}

/**
 * ImageBitmap (또는 그릴 수 있는 source) + 478 랜드마크 + 이미지 크기로 피부톤을 분류한다.
 * 실패(canvas 미지원 / 모든 패치 frame 밖) 시 null.
 *
 * 호출 측 책임: image_source 의 width/height 가 이미지 원본 크기와 일치해야 한다.
 *
 * @param {ImageBitmap | HTMLCanvasElement | HTMLImageElement} image_source
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} image_width
 * @param {number} image_height
 * @returns {SkinToneResult | null}
 */
export function compute_skin_tone(image_source, landmarks, image_width, image_height) {
  if (!landmarks || landmarks.length < 468) return null

  let canvas
  try {
    canvas = new OffscreenCanvas(image_width, image_height)
  } catch {
    return null
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(image_source, 0, 0, image_width, image_height)
  const image_data = ctx.getImageData(0, 0, image_width, image_height)

  // 패치 중심 좌표 (이미지 픽셀).
  const left_cheek = {
    cx: landmarks[116].x * image_width,
    cy: landmarks[116].y * image_height,
  }
  const right_cheek = {
    cx: landmarks[345].x * image_width,
    cy: landmarks[345].y * image_height,
  }
  const forehead = {
    cx: landmarks[10].x * image_width,
    cy: landmarks[10].y * image_height + SKIN_FOREHEAD_Y_OFFSET_PX,
  }

  /** @type {Array<{ r: number, g: number, b: number }>} */
  const patch_means_arr = []
  for (const center of [left_cheek, right_cheek, forehead]) {
    const pixels = extract_patch_pixels(image_data, center.cx, center.cy)
    if (!pixels) continue
    patch_means_arr.push(trimmed_mean_rgb(pixels))
  }
  if (patch_means_arr.length === 0) return null

  const r = patch_means_arr.reduce((s, p) => s + p.r, 0) / patch_means_arr.length
  const g = patch_means_arr.reduce((s, p) => s + p.g, 0) / patch_means_arr.length
  const b = patch_means_arr.reduce((s, p) => s + p.b, 0) / patch_means_arr.length

  const { h } = rgb_to_hsv(r, g, b)
  const tone = classify_hue(h)
  return {
    tone,
    hue_deg: h,
    sample_count: patch_means_arr.length,
    threshold_source: THRESHOLD_SOURCE.MOCK,
  }
}
