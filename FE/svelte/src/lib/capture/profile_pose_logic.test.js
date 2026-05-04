import { describe, it, expect } from 'vitest'
import { yaw_std, update_stability_step, PROFILE_CONSTANTS } from './profile_pose_logic.js'

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

describe('update_stability_step', () => {
  // 헬퍼 — 동일 yaw 를 N번 입력해 누적 결과 만들기
  function feed(initial, yaws, target_deg = +90) {
    let state = initial
    for (const y of yaws) {
      state = update_stability_step({ ...state, yaw: y, target_deg })
    }
    return state
  }

  const ZERO = { stable_count: 0, yaw_buffer: [] }

  it('영역 밖 (yaw 0, target 90) → stable_count 0 유지', () => {
    const result = feed(ZERO, [0, 0, 0, 0, 0], +90)
    expect(result.stable_count).toBe(0)
  })

  it('버퍼 채워지기 전 (10개 미만) → stable_count 0', () => {
    const result = feed(ZERO, [89, 89, 89, 89, 89], +90)
    expect(result.stable_count).toBe(0)
  })

  it('영역 안 + 안정 → 점진적 증가', () => {
    // 10개 채우면 holding=true 가능, 그 후 점차 증가
    const yaws = Array(15).fill(89)
    const result = feed(ZERO, yaws, +90)
    expect(result.stable_count).toBeGreaterThan(0)
  })

  it('영역 안 충분히 유지 → STABILITY_FRAMES 도달', () => {
    const yaws = Array(50).fill(89)  // 충분히 길게
    const result = feed(ZERO, yaws, +90)
    expect(result.stable_count).toBe(PROFILE_CONSTANTS.STABILITY_FRAMES)
  })

  it('영역 진입 후 이탈 → -5 보수적 감소', () => {
    const initial = { stable_count: 20, yaw_buffer: Array(10).fill(89) }
    const result = update_stability_step({ ...initial, yaw: 0, target_deg: +90 })
    expect(result.stable_count).toBe(15)
  })

  it('영역 안이지만 yaw 흔들림 큼 → -5 감소 (holding=false)', () => {
    const initial = { stable_count: 20, yaw_buffer: [80, 100, 80, 100, 80, 100, 80, 100, 80, 100] }
    const result = update_stability_step({ ...initial, yaw: 90, target_deg: +90 })
    // 새 buffer = [100,80,100,80,100,80,100,80,100,90] — std≈9.43 → threshold(5) 초과
    expect(result.stable_count).toBe(15)
  })

  it('yaw_buffer 가 슬라이딩 — YAW_BUFFER_SIZE 초과해도 마지막 N개만 유지', () => {
    const yaws = Array(20).fill(89)
    const result = feed(ZERO, yaws, +90)
    expect(result.yaw_buffer.length).toBe(PROFILE_CONSTANTS.YAW_BUFFER_SIZE)
  })

  it('left_profile (target -90) 도 좌측 영역에서 정상 동작', () => {
    const yaws = Array(15).fill(-89)
    const result = feed(ZERO, yaws, -90)
    expect(result.stable_count).toBeGreaterThan(0)
  })
})
