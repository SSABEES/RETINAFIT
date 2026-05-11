import { describe, it, expect } from 'vitest'
import { rotation_matrix_to_euler, image_plane_tilt_deg } from './pose.js'

// 회전행렬 헬퍼들 — 표준 right-handed 컨벤션 (x=right, y=down, z=out-of-screen).
// row-major 9-요소.

function R_identity() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1]
}

function R_y(deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}

function R_x(deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}

function R_z(deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

function multiply(A, B) {
  const out = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        out[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]
      }
    }
  }
  return out
}

describe('rotation_matrix_to_euler', () => {
  it('단위행렬 → 0,0,0', () => {
    const { yaw, pitch, roll } = rotation_matrix_to_euler(R_identity())
    expect(yaw).toBeCloseTo(0, 6)
    expect(pitch).toBeCloseTo(0, 6)
    expect(roll).toBeCloseTo(0, 6)
  })

  it('순수 X 회전 → pitch 만 추출', () => {
    const { yaw, pitch, roll } = rotation_matrix_to_euler(R_x(15))
    expect(pitch).toBeCloseTo(15, 4)
    expect(yaw).toBeCloseTo(0, 4)
    expect(roll).toBeCloseTo(0, 4)
  })
})

describe('image_plane_tilt_deg', () => {
  it('단위행렬 → 0° (정자세)', () => {
    expect(image_plane_tilt_deg(R_identity())).toBeCloseTo(0, 6)
  })

  it('R_y(90) · R_x(p) → 정확히 p (측면 + pitch 동등성)', () => {
    const p = 10
    const R = multiply(R_y(90), R_x(p))
    expect(image_plane_tilt_deg(R)).toBeCloseTo(p, 4)
  })

  it('R_y(-90) · R_x(p) → -p (좌측면 부호 반전)', () => {
    const p = 10
    const R = multiply(R_y(-90), R_x(p))
    expect(image_plane_tilt_deg(R)).toBeCloseTo(-p, 4)
  })

  it('순수 yaw 회전(±90°) → 0° (정자세 측면)', () => {
    expect(image_plane_tilt_deg(R_y(90))).toBeCloseTo(0, 6)
    expect(image_plane_tilt_deg(R_y(-90))).toBeCloseTo(0, 6)
  })

  it('측면 자세에서 ZYX Euler pitch 와 달리 깨끗 (gimbal lock 무관)', () => {
    // yaw=89° 부근에서 ZYX pitch 는 부정확해질 수 있지만 image_plane_tilt 는 안정.
    const p = 5
    const R = multiply(R_y(89), R_x(p))
    expect(image_plane_tilt_deg(R)).toBeCloseTo(p * Math.sin((89 * Math.PI) / 180), 2)
  })
})
