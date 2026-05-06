import { describe, it, expect } from 'vitest'
import {
  yaw_std,
  update_stability_step,
  compute_hint_text,
  PROFILE_CONSTANTS,
} from './profile_pose_logic.js'

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
    const yaws = Array(50).fill(89) // 충분히 길게
    const result = feed(ZERO, yaws, +90)
    expect(result.stable_count).toBe(PROFILE_CONSTANTS.STABILITY_FRAMES)
  })

  it('영역 진입 후 이탈 (pre-stable) → -5 보수적 감소', () => {
    // initial 10 < STABILITY_FRAMES(12) — 히스테리시스 lock 미발동, 정상 감소.
    const initial = { stable_count: 10, yaw_buffer: Array(10).fill(89) }
    const result = update_stability_step({ ...initial, yaw: 0, target_deg: +90 })
    expect(result.stable_count).toBe(5)
  })

  it('영역 안이지만 yaw 흔들림 큼 (pre-stable) → -5 감소 (holding=false)', () => {
    // initial 10 < STABILITY_FRAMES(12) — 히스테리시스 lock 미발동.
    const initial = { stable_count: 10, yaw_buffer: [80, 100, 80, 100, 80, 100, 80, 100, 80, 100] }
    const result = update_stability_step({ ...initial, yaw: 90, target_deg: +90 })
    // 새 buffer = [100,80,100,80,100,80,100,80,100,90] — std≈9.43 → threshold(5) 초과
    expect(result.stable_count).toBe(5)
  })

  it('히스테리시스 — max 도달 후 영역 이탈해도 stable_count 유지', () => {
    // STABILITY_FRAMES 도달한 상태 = 사용자가 자세 잡기 성공. 이후 추론 노이즈 한두 프레임으로
    // 떨어뜨리지 않음 — 자동 발사 effect 가 안정적으로 trigger 되도록 보장.
    const initial = {
      stable_count: PROFILE_CONSTANTS.STABILITY_FRAMES,
      yaw_buffer: Array(10).fill(89),
    }
    const result = update_stability_step({ ...initial, yaw: 0, target_deg: +90 })
    expect(result.stable_count).toBe(PROFILE_CONSTANTS.STABILITY_FRAMES)
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

describe('compute_hint_text', () => {
  it('세션 미준비 → 준비 중 메시지', () => {
    const text = compute_hint_text({
      session_ready: false,
      last_yaw: null,
      target_deg: +90,
      is_stable: false,
      progress: 0,
    })
    expect(text).toBe('측정 모델 준비 중…')
  })

  it('세션 준비됨 + 첫 추론 전 → null (기본 힌트로 폴백)', () => {
    const text = compute_hint_text({
      session_ready: true,
      last_yaw: null,
      target_deg: +90,
      is_stable: false,
      progress: 0,
    })
    expect(text).toBeNull()
  })

  it('right_profile + yaw 0 → 오른쪽 안내', () => {
    const text = compute_hint_text({
      session_ready: true,
      last_yaw: 0,
      target_deg: +90,
      is_stable: false,
      progress: 0,
    })
    expect(text).toBe('고개를 오른쪽으로 더 돌려주세요')
  })

  it('left_profile + yaw 0 → 왼쪽 안내', () => {
    const text = compute_hint_text({
      session_ready: true,
      last_yaw: 0,
      target_deg: -90,
      is_stable: false,
      progress: 0,
    })
    expect(text).toBe('고개를 왼쪽으로 더 돌려주세요')
  })

  it('영역 안 + 진행 중 → 진행률 표시', () => {
    const text = compute_hint_text({
      session_ready: true,
      last_yaw: 89,
      target_deg: +90,
      is_stable: false,
      progress: 50,
    })
    expect(text).toBe('자세 유지 중 50%')
  })

  it('영역 안 + stable → 측정 중', () => {
    const text = compute_hint_text({
      session_ready: true,
      last_yaw: 89,
      target_deg: +90,
      is_stable: true,
      progress: 100,
    })
    expect(text).toBe('✓ 측정 중…')
  })
})
