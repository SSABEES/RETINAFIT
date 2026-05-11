/**
 * ArUco 마커 검출 + POSIT pose 추정 래퍼.
 *
 * js-aruco2 는 `var X = X || {}; this.X = X;` 패턴으로 전역에 export 하는 CJS 라
 * ESM strict 모드에서 그대로 import 하면 깨진다. vite plugin `js_aruco2_global_fix`
 * 가 빌드 시점에 `this.X` → `globalThis.X` 로 치환하므로, 여기서는 dependency 순서대로
 * side-effect import 만 하고 globalThis 에서 받아쓴다.
 *
 * @typedef {import('./camera_intrinsics.js').CameraIntrinsics} CameraIntrinsics
 *
 * @typedef {object} Point2D
 * @property {number} x
 * @property {number} y
 *
 * @typedef {object} DetectedMarker
 * @property {number} id
 * @property {[Point2D, Point2D, Point2D, Point2D]} corners   image-space px (top-left origin), js-aruco2 detect 순서
 * @property {number[][]} rotation                            3x3, marker frame → camera frame
 * @property {[number, number, number]} translation           mm (Posit modelSize 와 동일 단위)
 * @property {number[][]} altRotation                         POSIT 두 번째 해
 * @property {[number, number, number]} altTranslation
 * @property {number} error                                   primary 해 reprojection error
 * @property {number} altError
 * @property {number} sizePx                                  평균 변 길이 (sanity check)
 */

import 'js-aruco2/src/cv.js'
import 'js-aruco2/src/svd.js'
import 'js-aruco2/src/aruco.js'
import 'js-aruco2/src/dictionaries/aruco_mip_36h12.js'
import 'js-aruco2/src/posit2.js'

const AR = /** @type {any} */ (globalThis).AR
const POS = /** @type {any} */ (globalThis).POS

const DICT_NAME = 'ARUCO_MIP_36h12'

/** @type {any} */
let g_detector = null

// detector 는 dictionary 만 의존하므로 모듈 싱글턴으로 재사용해 detect 마다 재할당 비용을 없앤다.
function get_detector() {
  if (!g_detector) g_detector = new AR.Detector({ dictionaryName: DICT_NAME })
  return g_detector
}

/** @type {Map<string, any>} */
const g_posit_cache = new Map()

// scale_intrinsics_to_image 의 부동소수점 반올림이 캐시 키로 새는 걸 막기 위해 focal 을 Math.round.
function get_posit(marker_size_mm, focal_px) {
  const key = `${marker_size_mm}|${Math.round(focal_px)}`
  let p = g_posit_cache.get(key)
  if (!p) {
    p = new POS.Posit(marker_size_mm, focal_px)
    g_posit_cache.set(key, p)
  }
  return p
}

/**
 * ArUco 마커를 검출하고 각각의 6DoF pose 를 산출한다.
 *
 * @param {ImageData} image_data                     캔버스에서 추출한 RGBA pixel data
 * @param {CameraIntrinsics} intrinsics              해당 image 와 같은 해상도로 스케일된 intrinsics
 * @param {number} marker_size_mm                    실측 마커 한 변 길이 (mm) — POSIT 깊이 산출의 기준
 * @returns {DetectedMarker[]}
 */
export function detect_markers(image_data, intrinsics, marker_size_mm) {
  const detector = get_detector()
  const focal = _focal_scalar(intrinsics)
  const posit = get_posit(marker_size_mm, focal)
  const [w, h] = intrinsics.imageSize
  const use_w = image_data.width || w
  const use_h = image_data.height || h

  const detected = detector.detect(image_data)
  if (!detected?.length) return []

  /** @type {DetectedMarker[]} */
  const out = []
  for (const m of detected) {
    /** @type {Point2D[]} */
    const corners = m.corners
    const centered = _to_centered_corners(corners, use_w, use_h)
    const pose = posit.pose(centered)
    const picked = _pick_pose(pose)
    const size_px =
      (Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) +
        Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y) +
        Math.hypot(corners[3].x - corners[2].x, corners[3].y - corners[2].y) +
        Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y)) /
      4
    out.push({
      id: m.id,
      corners: /** @type {[Point2D, Point2D, Point2D, Point2D]} */ (corners),
      rotation: picked.rotation,
      translation: picked.translation,
      altRotation: picked.altRotation,
      altTranslation: picked.altTranslation,
      error: picked.error,
      altError: picked.altError,
      sizePx: size_px,
    })
  }
  return out
}

/**
 * POSIT 은 단일 focal 스칼라만 받으므로 fx/fy 평균을 사용한다.
 * fx 와 fy 가 1% 이상 어긋나면 비대칭 픽셀이거나 캘리브레이션이 잘못된 것 — 경고만.
 * @param {CameraIntrinsics} intrinsics
 * @returns {number}
 */
export function _focal_scalar(intrinsics) {
  const fx = intrinsics.cameraMatrix[0][0]
  const fy = intrinsics.cameraMatrix[1][1]
  const mean = (fx + fy) / 2
  if (Math.abs(fx - fy) / mean > 0.01) {
    const drift_pct = ((Math.abs(fx - fy) / mean) * 100).toFixed(1)
    console.warn(
      `[ArUco] 카메라 초점거리 비대칭 ${drift_pct}% (fx=${fx.toFixed(0)}, fy=${fy.toFixed(0)}) — ` +
        `캘리브레이션 JSON 의 imageSize 와 실제 캡처 해상도 비율이 다릅니다. POSIT 은 평균값 ${mean.toFixed(0)} 사용.`,
    )
  }
  return mean
}

/**
 * 이미지 좌상단 원점을 중앙 원점 (POSIT 입력 컨벤션) 으로 옮기고 y 축 부호를 뒤집는다.
 * @param {Point2D[]} corners
 * @param {number} width
 * @param {number} height
 * @returns {Point2D[]}
 */
export function _to_centered_corners(corners, width, height) {
  const cx = width / 2
  const cy = height / 2
  return corners.map(({ x, y }) => ({ x: x - cx, y: cy - y }))
}

/**
 * POSIT 은 두 후보 해 (best/alternative) 를 반환한다. error 가 작은 쪽을 primary 로,
 * 다른 쪽을 alt 로 정리해 호출자가 모호성 (alt 와 차이가 작은 경우) 을 판단할 수 있게 한다.
 *
 * @typedef {object} RawPose
 * @property {number} bestError
 * @property {number[][]} bestRotation
 * @property {number[]} bestTranslation
 * @property {number} alternativeError
 * @property {number[][]} alternativeRotation
 * @property {number[]} alternativeTranslation
 *
 * @param {RawPose} pose
 */
export function _pick_pose(pose) {
  const primary_is_best = pose.bestError <= pose.alternativeError
  const error = primary_is_best ? pose.bestError : pose.alternativeError
  const alt_error = primary_is_best ? pose.alternativeError : pose.bestError
  const rotation = primary_is_best ? pose.bestRotation : pose.alternativeRotation
  const translation = /** @type {[number, number, number]} */ (
    primary_is_best ? pose.bestTranslation : pose.alternativeTranslation
  )
  const alt_rotation = primary_is_best ? pose.alternativeRotation : pose.bestRotation
  const alt_translation = /** @type {[number, number, number]} */ (
    primary_is_best ? pose.alternativeTranslation : pose.bestTranslation
  )

  if (error > 0 && alt_error / error < 1.2) {
    console.warn(
      `[ArUco] 마커 자세 추정이 모호 — 두 후보 해의 오차 차이가 작음 (primary=${error.toFixed(3)}, alt=${alt_error.toFixed(3)}). ` +
        `검출은 됐지만 마커가 정면을 보고 있어 깊이 판단이 흔들릴 수 있습니다.`,
    )
  }
  return {
    rotation,
    translation,
    altRotation: alt_rotation,
    altTranslation: alt_translation,
    error,
    altError: alt_error,
  }
}

// 테스트 전용 — detector / posit 캐시를 비운다.
export function _reset_aruco_caches_for_tests() {
  g_detector = null
  g_posit_cache.clear()
}
