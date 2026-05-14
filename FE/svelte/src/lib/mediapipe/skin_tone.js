/**
 * 정면 사진 픽셀에서 피부 톤(WARM/NEUTRAL/COOL) 자동 분류.
 *
 * 알고리즘 (v2 — CIELAB):
 *  1. 광대 좌(116) / 광대 우(345) / 이마(10, y -40px) 3패치 (각 30×30) 추출.
 *  2. 각 패치 픽셀을 V 로 정렬 후 양 끝 25% 트리밍 → RGB 평균.
 *  3. 평균 RGB 의 HSV 환산값으로 패치 신뢰도 게이트 — 너무 어둡거나 채도 낮은 패치 제외.
 *  4. 통과 패치들의 RGB 를 다시 평균 → CIELAB(D65) 로 변환 → h*ab = atan2(b*, a*).
 *  5. h*ab 임계값으로 분류 (thresholds.js):
 *     - h*ab >= SKIN_LAB_HAB_WARM_MIN → WARM
 *     - h*ab <= SKIN_LAB_HAB_COOL_MAX → COOL
 *     - 그 외                         → NEUTRAL
 *
 * 출력의 hue_deg 는 평균 RGB 의 HSV hue (AI 서버 호환용). 분류 자체는 LAB h*ab 기반.
 *
 * @typedef {import('./face_types.js').SkinTone} SkinTone
 * @typedef {import('./face_types.js').SkinToneResult} SkinToneResult
 * @typedef {import('@mediapipe/tasks-vision').NormalizedLandmark} NormalizedLandmark
 */

import {
  SKIN_PATCH_SIZE,
  SKIN_FOREHEAD_Y_OFFSET_PX,
  SKIN_TRIM_FRACTION,
  SKIN_MIN_SAT_FOR_CLASSIFY,
  SKIN_MIN_VAL_FOR_CLASSIFY,
  SKIN_LAB_HAB_COOL_MAX,
  SKIN_LAB_HAB_WARM_MIN,
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
  const local_half = SKIN_PATCH_SIZE / 2
  const local_x0 = Math.round(cx - local_half)
  const local_y0 = Math.round(cy - local_half)
  const local_x1 = local_x0 + SKIN_PATCH_SIZE
  const local_y1 = local_y0 + SKIN_PATCH_SIZE
  if (
    local_x0 < 0 ||
    local_y0 < 0 ||
    local_x1 > image_data.width ||
    local_y1 > image_data.height
  )
    return null

  const local_out = new Uint8ClampedArray(SKIN_PATCH_SIZE * SKIN_PATCH_SIZE * 4)
  let local_dst = 0
  for (let local_y = local_y0; local_y < local_y1; local_y++) {
    let local_src = (local_y * image_data.width + local_x0) * 4
    for (let local_x = local_x0; local_x < local_x1; local_x++) {
      local_out[local_dst++] = image_data.data[local_src++]
      local_out[local_dst++] = image_data.data[local_src++]
      local_out[local_dst++] = image_data.data[local_src++]
      local_out[local_dst++] = image_data.data[local_src++]
    }
  }
  return local_out
}

/**
 * 픽셀들을 V (max(R,G,B)) 로 정렬해 양 끝 trim_fraction 씩 잘라내고 남은 RGB 를 평균한다.
 * 그늘/하이라이트/홍조 outlier 를 제거하는 단순 통계 기법.
 *
 * @param {Uint8ClampedArray} patch
 * @returns {{ r: number, g: number, b: number }}
 */
function trimmed_mean_rgb(patch) {
  const local_n = patch.length / 4
  /** @type {Array<{ r: number, g: number, b: number, v: number }>} */
  const local_arr = new Array(local_n)
  for (let local_i = 0, local_j = 0; local_i < local_n; local_i++, local_j += 4) {
    const local_r = patch[local_j]
    const local_g = patch[local_j + 1]
    const local_b = patch[local_j + 2]
    local_arr[local_i] = {
      r: local_r,
      g: local_g,
      b: local_b,
      v: Math.max(local_r, local_g, local_b),
    }
  }
  local_arr.sort((p, q) => p.v - q.v)
  const local_trim_n = Math.floor(local_n * SKIN_TRIM_FRACTION)
  const local_lo = local_trim_n
  const local_hi = local_n - local_trim_n
  let local_r_sum = 0
  let local_g_sum = 0
  let local_b_sum = 0
  for (let local_i = local_lo; local_i < local_hi; local_i++) {
    local_r_sum += local_arr[local_i].r
    local_g_sum += local_arr[local_i].g
    local_b_sum += local_arr[local_i].b
  }
  const local_cnt = local_hi - local_lo
  return { r: local_r_sum / local_cnt, g: local_g_sum / local_cnt, b: local_b_sum / local_cnt }
}

/**
 * RGB (0-255) → HSV (h: 0-360, s: 0-1, v: 0-1) 변환. 패치 신뢰도 게이트와 호환용 hue_deg 산출에 사용.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, v: number }}
 */
function rgb_to_hsv(r, g, b) {
  const local_rn = r / 255
  const local_gn = g / 255
  const local_bn = b / 255
  const local_max = Math.max(local_rn, local_gn, local_bn)
  const local_min = Math.min(local_rn, local_gn, local_bn)
  const local_delta = local_max - local_min
  let local_h = 0
  if (local_delta > 0) {
    if (local_max === local_rn) local_h = ((local_gn - local_bn) / local_delta) % 6
    else if (local_max === local_gn) local_h = (local_bn - local_rn) / local_delta + 2
    else local_h = (local_rn - local_gn) / local_delta + 4
    local_h *= 60
    if (local_h < 0) local_h += 360
  }
  const local_s = local_max === 0 ? 0 : local_delta / local_max
  return { h: local_h, s: local_s, v: local_max }
}

/**
 * sRGB 채널값(0-255) → 선형 RGB (0-1). gamma 보정 역함수.
 * @param {number} c
 */
function srgb_to_linear(c) {
  const local_n = c / 255
  return local_n <= 0.04045 ? local_n / 12.92 : Math.pow((local_n + 0.055) / 1.055, 2.4)
}

/**
 * sRGB(0-255) → CIELAB (D65 reference white).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ L: number, a: number, b: number }}
 */
function rgb_to_lab(r, g, b) {
  const local_rl = srgb_to_linear(r)
  const local_gl = srgb_to_linear(g)
  const local_bl = srgb_to_linear(b)
  // sRGB → XYZ (D65 illuminant)
  let local_x = local_rl * 0.4124564 + local_gl * 0.3575761 + local_bl * 0.1804375
  let local_y = local_rl * 0.2126729 + local_gl * 0.7151522 + local_bl * 0.072175
  let local_z = local_rl * 0.0193339 + local_gl * 0.119192 + local_bl * 0.9503041
  // D65 white normalize
  local_x /= 0.95047
  local_y /= 1.0
  local_z /= 1.08883
  // XYZ → LAB (CIE76)
  /** @param {number} t */
  const local_f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116)
  const local_fx = local_f(local_x)
  const local_fy = local_f(local_y)
  const local_fz = local_f(local_z)
  return {
    L: 116 * local_fy - 16,
    a: 500 * (local_fx - local_fy),
    b: 200 * (local_fy - local_fz),
  }
}

/**
 * CIELAB h*ab (도, 0-360) 를 SkinTone 라벨로 분류.
 *
 * @param {number} h_ab
 * @returns {SkinTone}
 */
function classify_lab_hue(h_ab) {
  if (h_ab >= SKIN_LAB_HAB_WARM_MIN) return 'WARM'
  if (h_ab <= SKIN_LAB_HAB_COOL_MAX) return 'COOL'
  return 'NEUTRAL'
}

/**
 * ImageBitmap (또는 그릴 수 있는 source) + 478 랜드마크 + 이미지 크기로 피부톤을 분류한다.
 * 실패(canvas 미지원 / 모든 패치 frame 밖 / 모든 패치 신뢰도 게이트 탈락) 시 null.
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

  let local_canvas
  try {
    local_canvas = new OffscreenCanvas(image_width, image_height)
  } catch {
    return null
  }
  const local_ctx = local_canvas.getContext('2d')
  if (!local_ctx) return null

  local_ctx.drawImage(image_source, 0, 0, image_width, image_height)
  const local_image_data = local_ctx.getImageData(0, 0, image_width, image_height)

  // 피부 패치 좌표 (이미지 픽셀).
  const local_skin_centers_arr = [
    { cx: landmarks[116].x * image_width, cy: landmarks[116].y * image_height },
    { cx: landmarks[345].x * image_width, cy: landmarks[345].y * image_height },
    {
      cx: landmarks[10].x * image_width,
      cy: landmarks[10].y * image_height + SKIN_FOREHEAD_Y_OFFSET_PX,
    },
  ]

  // 각 패치의 트리밍 평균 RGB → 신뢰도 게이트 통과한 것만 보관.
  // 게이트 탈락이 너무 많아 모두 떨어지는 케이스를 막기 위해 fallback (게이트 무시) 도 함께 보관.
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const local_patch_arr = []
  /** @type {Array<{ r: number, g: number, b: number }>} */
  const local_fallback_patch_arr = []
  for (const local_center of local_skin_centers_arr) {
    const local_pixels = extract_patch_pixels(local_image_data, local_center.cx, local_center.cy)
    if (!local_pixels) continue
    const local_mean = trimmed_mean_rgb(local_pixels)
    local_fallback_patch_arr.push(local_mean)
    const { s: local_s, v: local_v } = rgb_to_hsv(local_mean.r, local_mean.g, local_mean.b)
    if (local_s >= SKIN_MIN_SAT_FOR_CLASSIFY && local_v >= SKIN_MIN_VAL_FOR_CLASSIFY) {
      local_patch_arr.push(local_mean)
    }
  }
  const local_chosen_arr = local_patch_arr.length > 0 ? local_patch_arr : local_fallback_patch_arr
  if (local_chosen_arr.length === 0) return null

  // 통과 패치들의 RGB 를 다시 평균.
  const local_avg_r = local_chosen_arr.reduce((s, p) => s + p.r, 0) / local_chosen_arr.length
  const local_avg_g = local_chosen_arr.reduce((s, p) => s + p.g, 0) / local_chosen_arr.length
  const local_avg_b = local_chosen_arr.reduce((s, p) => s + p.b, 0) / local_chosen_arr.length

  // 분류 기준: LAB h*ab. 피부는 a*,b* > 0 영역이라 0-90° 범위가 정상.
  const local_lab = rgb_to_lab(local_avg_r, local_avg_g, local_avg_b)
  const local_h_ab_rad = Math.atan2(local_lab.b, local_lab.a)
  const local_h_ab_deg = ((local_h_ab_rad * 180) / Math.PI + 360) % 360
  const local_tone = classify_lab_hue(local_h_ab_deg)

  // 호환용 HSV hue 도 함께 산출.
  const { h: local_hsv_h } = rgb_to_hsv(local_avg_r, local_avg_g, local_avg_b)

  return {
    tone: local_tone,
    hue_deg: local_hsv_h,
    sample_count: local_chosen_arr.length,
    threshold_source: THRESHOLD_SOURCE.MOCK,
  }
}
