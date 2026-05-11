/**
 * 카메라 내부 파라미터(intrinsics) 로딩 + 이미지 해상도 매칭 유틸리티.
 *
 * @typedef {object} CameraIntrinsics
 * @property {string} device                   캘리브레이션 식별자 (디버그/로깅용)
 * @property {[number, number]} imageSize      [width, height] — 캘리브레이션 시점 이미지 해상도
 * @property {number[][]} cameraMatrix         3x3 row-major (fx, 0, cx / 0, fy, cy / 0, 0, 1)
 * @property {number[]} distCoeffs             [k1, k2, p1, p2, k3, ...]
 */

/** @type {CameraIntrinsics | null} */
let g_cached = null

// 기본 캘리브레이션 자산 경로. capture_utils.video_to_blob 가 모든 캡처를 480x640 으로 정규화하므로
// placeholder 도 동일 해상도로 두면 scale_intrinsics_to_image 가 no-op 이 되어 fx/fy 비대칭 경고가
// 발생하지 않는다. 실 디바이스 별 정밀 캘리브레이션이 필요하면 동일 형식으로 새 JSON 추가 후 교체.
const DEFAULT_INTRINSICS_URL = '/camera/default-480x640-placeholder.json'

/**
 * 기본 카메라 캘리브레이션을 로드한다 (프로세스 캐시).
 * 첫 호출 시 fetch, 이후 재호출은 캐시된 값을 반환.
 * @returns {Promise<CameraIntrinsics>}
 */
export async function load_default_intrinsics() {
  if (g_cached) return g_cached
  const res = await fetch(DEFAULT_INTRINSICS_URL)
  if (!res.ok) {
    throw new Error(`Failed to load camera intrinsics: ${res.status}`)
  }
  g_cached = /** @type {CameraIntrinsics} */ (await res.json())
  return g_cached
}

/**
 * 캘리브레이션 해상도와 실제 캡처 해상도가 다를 때 fx/fy/cx/cy 를 비례 스케일한다.
 * 동일 해상도면 cameraMatrix 만 deep clone 해 반환 (호출자가 mutate 해도 캐시 안전).
 *
 * 주의: orientation swap (가로 캘리브레이션 vs 세로 캡처) 은 단순 스케일이 아니라 fx↔fy/cx↔cy
 * 회전 변환이 필요하다. naive 스케일은 PD 가 2배로 잡히는 등 심각한 결과를 낳으므로 aspect ratio
 * 가 1.5 이상 어긋나면 throw 해 호출자가 캘리브레이션 JSON 을 캡처 orientation 에 맞추게 한다.
 *
 * @param {CameraIntrinsics} base
 * @param {number} width
 * @param {number} height
 * @returns {CameraIntrinsics}
 */
export function scale_intrinsics_to_image(base, width, height) {
  const [bw, bh] = base.imageSize
  const sx = width / bw
  const sy = height / bh
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) {
    return { ...base, cameraMatrix: base.cameraMatrix.map((r) => [...r]) }
  }
  const aspect_ratio = Math.max(sx / sy, sy / sx)
  if (aspect_ratio > 1.5) {
    throw new Error(
      `[ArUco] 캘리브레이션 해상도와 캡처 해상도의 가로/세로 비율이 너무 다릅니다 ` +
        `(차이 ${aspect_ratio.toFixed(2)}배). 캘리브레이션 ${bw}x${bh} ↔ 캡처 ${width}x${height}. ` +
        `세로/가로 모드가 바뀌었을 가능성 — 캡처 방향에 맞는 캘리브레이션 JSON 으로 교체하세요.`,
    )
  }
  if (aspect_ratio > 1.1) {
    console.warn(
      `[ArUco] 캘리브레이션 해상도(${bw}x${bh}) 와 캡처 해상도(${width}x${height}) 의 가로/세로 비율이 어긋남 ` +
        `— 측정값에 ${((aspect_ratio - 1) * 100).toFixed(1)}% 정도 오차 가능. 정확도가 필요하면 캡처 포맷에 맞는 캘리브레이션 JSON 사용.`,
    )
  }
  const m = base.cameraMatrix
  return {
    ...base,
    imageSize: [width, height],
    cameraMatrix: [
      [m[0][0] * sx, 0, m[0][2] * sx],
      [0, m[1][1] * sy, m[1][2] * sy],
      [0, 0, 1],
    ],
  }
}

// 테스트 전용 — 모듈 캐시를 초기화한다.
export function _reset_intrinsics_cache_for_tests() {
  g_cached = null
}
