import { describe, it, expect } from 'vitest'
import { mm_distance } from './aruco_scale.js'

/** @type {import('./camera_intrinsics.js').CameraIntrinsics} */
const intrinsics = {
  device: 'test',
  imageSize: [640, 480],
  cameraMatrix: [[500, 0, 320], [0, 500, 240], [0, 0, 1]],
  distCoeffs: [0, 0, 0, 0, 0],
}

// 마커가 카메라에서 z=500mm 정면, 회전 0, 30mm × 30mm.
// 핀홀: x_img = fx * X/Z + cx. f=500, Z=500 → 1mm = 1px.
/** @type {import('./aruco_detector.js').DetectedMarker} */
const marker_frontal = {
  id: 0,
  corners: [
    { x: 305, y: 225 },
    { x: 335, y: 225 },
    { x: 335, y: 255 },
    { x: 305, y: 255 },
  ],
  rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  translation: [0, 0, 500],
  altRotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  altTranslation: [0, 0, 500],
  error: 0,
  altError: 0,
  sizePx: 30,
}

describe('mm_distance — frontal marker (1px = 1mm)', () => {
  it('returns 100mm for two image points 100px apart, on marker plane', () => {
    const p1 = { x: 220, y: 240 }
    const p2 = { x: 320, y: 240 }
    const d = mm_distance(p1, p2, marker_frontal, intrinsics)
    expect(d).toBeCloseTo(100, 1)
  })

  it('returns 0 for identical points', () => {
    const p = { x: 320, y: 240 }
    expect(mm_distance(p, p, marker_frontal, intrinsics)).toBeCloseTo(0, 5)
  })

  it('is symmetric', () => {
    const p1 = { x: 100, y: 100 }
    const p2 = { x: 300, y: 200 }
    const a = mm_distance(p1, p2, marker_frontal, intrinsics)
    const b = mm_distance(p2, p1, marker_frontal, intrinsics)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('mm_distance — tilted marker', () => {
  // 마커가 y축 기준 30° 회전 (왼쪽 가장자리가 카메라 쪽으로 기움).
  const tilt30 = Math.PI / 6
  const c30 = Math.cos(tilt30)
  const s30 = Math.sin(tilt30)
  /** @type {import('./aruco_detector.js').DetectedMarker} */
  const marker_tilted = {
    ...marker_frontal,
    rotation: [[c30, 0, s30], [0, 1, 0], [-s30, 0, c30]],
  }

  it('compensates cosine error: 100mm on tilted plane is still 100mm', () => {
    // 마커 평면 위 X=-50, X=+50 두 점을 카메라에 투영해 입력 픽셀을 만든다.
    // 마커 local X (1,0,0) → camera frame R·[1,0,0] = (cos, 0, -sin).
    // → world point = X_local * (cos, 0, -sin) + translation = (X·cos, 0, 500 - X·sin).
    const fx = 500
    const fy = 500
    const cx = 320
    const cy = 240
    const project = (X, Y, Z) => ({ x: (fx * X) / Z + cx, y: (fy * Y) / Z + cy })
    const X1 = -50
    const X2 = 50
    const Y = 0
    const Z1 = 500 - X1 * Math.sin(tilt30)
    const Z2 = 500 - X2 * Math.sin(tilt30)
    const p1 = project(X1 * Math.cos(tilt30), Y, Z1)
    const p2 = project(X2 * Math.cos(tilt30), Y, Z2)
    const d = mm_distance(p1, p2, marker_tilted, intrinsics)
    expect(d).toBeCloseTo(100, 0)
  })
})
