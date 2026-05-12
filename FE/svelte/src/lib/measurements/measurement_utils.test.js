import { describe, it, expect } from 'vitest'
import {
  pixel_distance,
  vertical_signed_angle_deg,
  apply_image_tilt_correction,
} from './measurement_utils.js'

describe('pixel_distance', () => {
  it('동일 점은 0', () => {
    expect(pixel_distance({ x: 5, y: 7 }, { x: 5, y: 7 })).toBe(0)
  })

  it('3-4-5 삼각형', () => {
    expect(pixel_distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('vertical_signed_angle_deg', () => {
  // 부호 컨벤션 검증 — view 별로 의미가 일관되어야 한다.
  it('완전 수직 두 점 → 0° (right_glasses)', () => {
    const p1 = { x: 100, y: 50 }
    const p2 = { x: 100, y: 200 }
    expect(vertical_signed_angle_deg(p1, p2, 'right_glasses')).toBeCloseTo(0, 6)
  })

  it('완전 수직 두 점 → 0° (left_glasses, 부호 반전 후에도 0)', () => {
    const p1 = { x: 100, y: 50 }
    const p2 = { x: 100, y: 200 }
    expect(vertical_signed_angle_deg(p1, p2, 'left_glasses')).toBeCloseTo(0, 6)
  })

  it('우측면, 림 상단이 화면 좌측으로 기울어짐 → atan2(dx, dy) 음수 (top.x > bottom.x)', () => {
    // top: (110, 50), bottom: (90, 200) → dx = -20 → atan2(-20, 150) ≈ -7.6°
    const top = { x: 110, y: 50 }
    const bottom = { x: 90, y: 200 }
    const angle = vertical_signed_angle_deg(top, bottom, 'right_glasses')
    expect(angle).toBeLessThan(0)
    expect(Math.abs(angle)).toBeGreaterThan(5)
  })

  it('좌측면 같은 기하 → 부호 반전 (광학 표준 일관)', () => {
    const top = { x: 110, y: 50 }
    const bottom = { x: 90, y: 200 }
    const right = vertical_signed_angle_deg(top, bottom, 'right_glasses')
    const left = vertical_signed_angle_deg(top, bottom, 'left_glasses')
    expect(left).toBeCloseTo(-right, 6)
  })

  it('left_no_glasses 도 좌측면이라 부호 반전 적용', () => {
    const top = { x: 110, y: 50 }
    const bottom = { x: 90, y: 200 }
    const left_glasses = vertical_signed_angle_deg(top, bottom, 'left_glasses')
    const left_no_glasses = vertical_signed_angle_deg(top, bottom, 'left_no_glasses')
    expect(left_no_glasses).toBeCloseTo(left_glasses, 6)
  })

  it('right_no_glasses 는 right_glasses 와 같음 (부호 반전 없음)', () => {
    const top = { x: 110, y: 50 }
    const bottom = { x: 90, y: 200 }
    const right_glasses = vertical_signed_angle_deg(top, bottom, 'right_glasses')
    const right_no_glasses = vertical_signed_angle_deg(top, bottom, 'right_no_glasses')
    expect(right_no_glasses).toBeCloseTo(right_glasses, 6)
  })

  it('p1, p2 입력 순서가 바뀌어도 결과 동일 (내부 정렬)', () => {
    const a = { x: 110, y: 50 }
    const b = { x: 90, y: 200 }
    const order1 = vertical_signed_angle_deg(a, b, 'right_glasses')
    const order2 = vertical_signed_angle_deg(b, a, 'right_glasses')
    expect(order1).toBeCloseTo(order2, 6)
  })

  it('정확히 45° 기울기 (대각선)', () => {
    // top: (100, 100), bottom: (200, 200). dx=100, dy=100. atan2(100, 100) = 45°.
    const top = { x: 100, y: 100 }
    const bottom = { x: 200, y: 200 }
    expect(vertical_signed_angle_deg(top, bottom, 'right_glasses')).toBeCloseTo(45, 6)
  })
})

describe('apply_image_tilt_correction', () => {
  it('image_tilt 0 이면 그대로', () => {
    expect(apply_image_tilt_correction(9.3, 0)).toBe(9.3)
  })

  it('머리가 뒤로 젖혀짐(+) — 측정 각도에서 빼서 작아짐', () => {
    expect(apply_image_tilt_correction(12, 3)).toBe(9)
  })

  it('머리가 앞으로 숙임(-) — 측정 각도에서 빼서 커짐', () => {
    expect(apply_image_tilt_correction(7, -2)).toBe(9)
  })

  // 좌·우 일치성 검증 — 같은 안경 + 같은 머리 자세에서 측정 view 만 다를 때 같은 결과가 나와야 한다.
  // raw R 의 image_tilt 는 좌·우 부호 반대로 나오므로 좌측면 입력에는 부호 반전을 미리 거친 값을 넣는다.
  it('좌·우 측면에서 같은 안경 자세 → 보정값 일치', () => {
    const ANGLE_GLASSES = 10 // 안경 자체 전경각
    const PITCH = 5 // 사용자 머리 pitch (턱 들기)

    // 측정 raw 는 두 view 모두 광학 표준 부호(angle + pitch) 로 정렬됨.
    const raw_right = ANGLE_GLASSES + PITCH // +15
    const raw_left = ANGLE_GLASSES + PITCH // +15 (vertical_signed_angle_deg 가 좌측 부호 반전 적용)

    // image_plane_tilt_deg 은 카메라 좌표계라 좌·우 부호 반대. 호출측이 좌측이면 부호 반전 후 사용.
    const image_tilt_right = +PITCH // +5
    const image_tilt_left_raw = -PITCH // -5 (raw 그대로)
    const image_tilt_left = -image_tilt_left_raw // +5 (좌측면 부호 보정 후)

    expect(apply_image_tilt_correction(raw_right, image_tilt_right)).toBe(ANGLE_GLASSES)
    expect(apply_image_tilt_correction(raw_left, image_tilt_left)).toBe(ANGLE_GLASSES)
  })
})
