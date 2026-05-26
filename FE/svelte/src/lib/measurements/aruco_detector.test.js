import { describe, it, expect, vi } from 'vitest'
import { _pick_pose, _to_centered_corners, _focal_scalar } from './aruco_detector.js'

/** @type {import('./camera_intrinsics.js').CameraIntrinsics} */
const intrinsics = {
  device: 'test',
  imageSize: [640, 480],
  cameraMatrix: [
    [500, 0, 320],
    [0, 510, 240],
    [0, 0, 1],
  ],
  distCoeffs: [0, 0, 0, 0, 0],
}

describe('_focal_scalar', () => {
  it('returns mean of fx and fy', () => {
    expect(_focal_scalar(intrinsics)).toBe(505)
  })

  it('warns when |fx - fy| / mean > 0.01', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    _focal_scalar({
      ...intrinsics,
      cameraMatrix: [
        [500, 0, 320],
        [0, 540, 240],
        [0, 0, 1],
      ],
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('비대칭'))
    warn.mockRestore()
  })
})

describe('_to_centered_corners', () => {
  it('shifts to image center origin and flips y', () => {
    const corners = [
      { x: 320, y: 240 }, // image center → (0, 0)
      { x: 420, y: 240 }, // right of center → (100, 0)
      { x: 320, y: 140 }, // above center (smaller y) → (0, 100)
      { x: 320, y: 340 }, // below center (larger y) → (0, -100)
    ]
    const out = _to_centered_corners(corners, 640, 480)
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 0, y: -100 },
    ])
  })
})

describe('_pick_pose', () => {
  const baseRot = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  const altRot = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ]

  it('picks the lower-error solution as primary', () => {
    const pose = {
      bestError: 0.5,
      bestRotation: baseRot,
      bestTranslation: [1, 2, 500],
      alternativeError: 2.0,
      alternativeRotation: altRot,
      alternativeTranslation: [3, 4, 500],
    }
    const out = _pick_pose(pose)
    expect(out.rotation).toBe(baseRot)
    expect(out.translation).toEqual([1, 2, 500])
    expect(out.error).toBe(0.5)
    expect(out.altError).toBe(2.0)
  })

  it('flips when alternative has lower error', () => {
    const pose = {
      bestError: 5.0,
      bestRotation: baseRot,
      bestTranslation: [1, 2, 500],
      alternativeError: 1.0,
      alternativeRotation: altRot,
      alternativeTranslation: [3, 4, 500],
    }
    const out = _pick_pose(pose)
    expect(out.rotation).toBe(altRot)
    expect(out.translation).toEqual([3, 4, 500])
    expect(out.error).toBe(1.0)
    expect(out.altError).toBe(5.0)
  })

  it('warns when error ratio < 1.2 (ambiguous)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    _pick_pose({
      bestError: 1.0,
      bestRotation: baseRot,
      bestTranslation: [0, 0, 500],
      alternativeError: 1.1,
      alternativeRotation: altRot,
      alternativeTranslation: [0, 0, 500],
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('모호'))
    warn.mockRestore()
  })
})
