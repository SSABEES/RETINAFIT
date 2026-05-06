/**
 * 측면 자세 감지 (6DRepNet360 yaw 기반) 의 순수 로직 모음.
 * 이 모듈은 Svelte runes 미사용 — 단위 테스트 가능 + use_profile_pose.svelte.js 가 호출.
 */

// 측면 자세 감지 임계값. test.svelte 에서 검증된 값 그대로 채택.
// 실제 튜닝은 prod 실측 후. 변경 시 테스트도 함께 갱신.
export const PROFILE_CONSTANTS = Object.freeze({
  ORT_FRAME_SKIP: 5,           // tick() 호출 5번마다 1번 추론 → 12Hz rAF 에서 ~2.4Hz
  TARGET_DEG: 90,              // ±90° 가 측면 정자세
  TOLERANCE: 15,               // 영역 폭 ±15° — 사용자 자세 흔들림 허용 (10° 는 너무 빡빡)
  YAW_STD_THR: 5,              // 안정성 표준편차 임계 (도)
  STABILITY_FRAMES: 12,        // 12 frames @ 12Hz ≈ 1초 hold
  YAW_BUFFER_SIZE: 10,         // 표준편차 계산용 슬라이딩 윈도우
  IMAGE_TILT_BUFFER_SIZE: 5,   // 이미지 평면 기울기 평균화용 — ~0.4초 윈도우, 모델 jitter 완화
})

/**
 * 배열의 표준편차. 빈 배열은 Infinity 반환 — holding 검사가 자동 실패하도록.
 * @param {number[]} arr
 * @returns {number}
 */
export function yaw_std(arr) {
  if (arr.length === 0) return Infinity
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

/**
 * 매 프레임 안정성 step. 영역 안(타깃 ±TOLERANCE) + 안정(yaw_buffer std < YAW_STD_THR) 이면
 * stable_count 1 증가, 아니면 5 감소 (정면 update_stability 와 동일한 보수적 감소).
 *
 * 히스테리시스: 한 번 STABILITY_FRAMES 에 도달하면 lock — 이후 yaw 추론 노이즈로 stable_count 가
 * 다시 떨어지지 않음. reset() (단계 전환 / 카메라 재시작) 으로만 0 으로 복귀. 도달 직후 자동 발사
 * effect 가 안정적으로 trigger 되도록 보장.
 *
 * 순수 함수 — 새 state 객체 반환, 입력 mutate 안 함.
 *
 * @param {{ stable_count: number, yaw_buffer: number[], yaw: number, target_deg: number }} input
 * @returns {{ stable_count: number, yaw_buffer: number[] }}
 */
export function update_stability_step({ stable_count, yaw_buffer, yaw, target_deg }) {
  const next_buffer = [...yaw_buffer.slice(-(PROFILE_CONSTANTS.YAW_BUFFER_SIZE - 1)), yaw]

  // 이미 max 도달 — lock. 추가 yaw 입력에 영향 받지 않음.
  if (stable_count >= PROFILE_CONSTANTS.STABILITY_FRAMES) {
    return { stable_count, yaw_buffer: next_buffer }
  }

  const in_zone = Math.abs(yaw - target_deg) < PROFILE_CONSTANTS.TOLERANCE
  const buffer_full = next_buffer.length >= PROFILE_CONSTANTS.YAW_BUFFER_SIZE
  const holding = buffer_full && yaw_std(next_buffer) < PROFILE_CONSTANTS.YAW_STD_THR

  let next_count
  if (in_zone && holding) {
    next_count = Math.min(stable_count + 1, PROFILE_CONSTANTS.STABILITY_FRAMES)
  } else {
    next_count = Math.max(0, stable_count - 5)
  }

  return { stable_count: next_count, yaw_buffer: next_buffer }
}

/**
 * 이미지 평면 머리 기울기 슬라이딩 윈도우에 새 값을 추가한 새 배열을 반환한다. 모델 출력 jitter 가
 * 매 프레임 ±몇 도씩 흔들려 raw 값을 화면/보정에 그대로 쓰면 사용자 체감 불안정. 캡처 시점 단일값에도
 * 영향을 주므로 단순 산술 평균으로 완화. yaw_buffer 와 달리 std 게이팅 없음 — 평균값만 쓴다.
 *
 * @param {number[]} buffer
 * @param {number} value
 * @returns {number[]}
 */
export function next_image_tilt_buffer(buffer, value) {
  return [...buffer.slice(-(PROFILE_CONSTANTS.IMAGE_TILT_BUFFER_SIZE - 1)), value]
}

/**
 * 배열의 산술 평균. 빈 배열은 null 반환.
 * @param {number[]} arr
 * @returns {number | null}
 */
export function average_or_null(arr) {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * 사용자에게 보일 측면 단계 힌트 텍스트. null 반환 시 호출자가 기본 힌트로 폴백.
 *
 * 분기 순서:
 *   1) 세션 미준비 → "측정 모델 준비 중…"
 *   2) 추론 전 → null (호출자 기본 힌트)
 *   3) 영역 미도달 → "고개를 [방향]으로 더 돌려주세요"
 *   4) 영역 안 + stable → "✓ 측정 중…"
 *   5) 영역 안 + 진행 중 → "자세 유지 중 N%"
 *
 * @param {{ session_ready: boolean, last_yaw: number | null, target_deg: number,
 *           is_stable: boolean, progress: number }} input
 * @returns {string | null}
 */
export function compute_hint_text({ session_ready, last_yaw, target_deg, is_stable, progress }) {
  if (!session_ready) return '측정 모델 준비 중…'
  if (last_yaw === null) return null

  const distance = Math.abs(last_yaw - target_deg)
  if (distance >= PROFILE_CONSTANTS.TOLERANCE) {
    const direction = target_deg > 0 ? '오른쪽' : '왼쪽'
    return `고개를 ${direction}으로 더 돌려주세요`
  }
  if (is_stable) return '✓ 측정 중…'
  return `자세 유지 중 ${progress}%`
}
