import { describe, it, expect } from 'vitest'
import { yaw_std } from './profile_pose_logic.js'

describe('yaw_std', () => {
  it('빈 배열은 Infinity 반환 (holding 검사 자동 실패)', () => {
    expect(yaw_std([])).toBe(Infinity)
  })

  it('단일 요소는 0', () => {
    expect(yaw_std([90])).toBe(0)
  })

  it('동일 값 반복은 0', () => {
    expect(yaw_std([90, 90, 90, 90])).toBe(0)
  })

  it('일반 케이스 — 알려진 표준편차', () => {
    // [88, 89, 90, 91, 92] → 평균 90, 분산 ((4+1+0+1+4)/5)=2, std=sqrt(2)
    const result = yaw_std([88, 89, 90, 91, 92])
    expect(result).toBeCloseTo(Math.sqrt(2), 6)
  })
})
