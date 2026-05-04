/**
 * 측면 자세 감지 (6DRepNet360 yaw 기반) 의 순수 로직 모음.
 * 이 모듈은 Svelte runes 미사용 — 단위 테스트 가능 + use_profile_pose.svelte.js 가 호출.
 */

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
