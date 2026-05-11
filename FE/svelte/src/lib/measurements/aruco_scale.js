/**
 * ArUco 마커 평면을 기준으로 두 픽셀 점 사이 실측 거리(mm) 를 계산한다.
 *
 * 알고리즘:
 *   - 각 픽셀을 정규화 카메라 좌표계로 unproject 해 ray direction 을 만든다.
 *   - ray 와 마커 평면 (normal = R · ẑ, point on plane = translation) 교점을 구한다.
 *   - 두 교점의 3D 직선 거리가 실측 mm.
 *
 * 가정: 측정 대상 점이 마커 평면 위 (또는 매우 가까이) 에 있을 때 정확.
 *       얼굴처럼 입체 곡면 위 점은 깊이 차이만큼 오차가 누적된다 (상황에 따라 1~5%).
 *
 * @typedef {import('./camera_intrinsics.js').CameraIntrinsics} CameraIntrinsics
 * @typedef {import('./aruco_detector.js').DetectedMarker} DetectedMarker
 * @typedef {import('./aruco_detector.js').Point2D} Point2D
 *
 * @typedef {[number, number, number]} Vec3
 */

/**
 * K^-1 * [x, y, 1]^T. distortion 보정은 안 함 — 이미 undistorted 거나 왜곡이 작다고 가정.
 * @param {Point2D} p
 * @param {number[][]} K
 * @returns {Vec3}
 */
function unproject_ray(p, K) {
  const fx = K[0][0]
  const fy = K[1][1]
  const cx = K[0][2]
  const cy = K[1][2]
  return [(p.x - cx) / fx, (p.y - cy) / fy, 1]
}

/**
 * camera-space ray 가 marker 평면과 만나는 3D 교점을 구한다.
 * 마커 좌표계에서 마커는 z=0 평면 위 → camera frame normal = R · [0,0,1] = R 의 3열,
 * point on plane = translation. ray 는 origin 0 에서 direction d 로 뻗으므로
 * P = s · d, plane: normal · (P - t) = 0 → s = (normal · t) / (normal · d).
 *
 * ray 가 평면과 평행하거나 카메라 뒤쪽에서 만나면 null.
 *
 * @param {Vec3} ray_dir
 * @param {number[][]} R
 * @param {Vec3} t
 * @returns {Vec3 | null}
 */
export function intersect_marker_plane(ray_dir, R, t) {
  /** @type {Vec3} */
  const normal = [R[0][2], R[1][2], R[2][2]]
  const denom = normal[0] * ray_dir[0] + normal[1] * ray_dir[1] + normal[2] * ray_dir[2]
  if (Math.abs(denom) < 1e-9) return null
  const num = normal[0] * t[0] + normal[1] * t[1] + normal[2] * t[2]
  const s = num / denom
  if (s <= 0) return null
  return [s * ray_dir[0], s * ray_dir[1], s * ray_dir[2]]
}

/**
 * 두 픽셀 점이 마커 평면 위에 있다고 가정하고 실측 거리(mm) 를 반환한다.
 * 평면 교차에 실패한 점이 있으면 NaN.
 *
 * @param {Point2D} p1
 * @param {Point2D} p2
 * @param {DetectedMarker} marker
 * @param {CameraIntrinsics} intrinsics
 * @returns {number}
 */
export function mm_distance(p1, p2, marker, intrinsics) {
  const r1 = unproject_ray(p1, intrinsics.cameraMatrix)
  const r2 = unproject_ray(p2, intrinsics.cameraMatrix)
  const P1 = intersect_marker_plane(r1, marker.rotation, marker.translation)
  const P2 = intersect_marker_plane(r2, marker.rotation, marker.translation)
  if (!P1 || !P2) return NaN
  return Math.hypot(P1[0] - P2[0], P1[1] - P2[1], P1[2] - P2[2])
}
