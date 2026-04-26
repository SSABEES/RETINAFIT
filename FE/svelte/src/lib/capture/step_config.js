/**
 * 6스텝 얼굴 캡쳐 플로우의 스텝 구성과 진행도 유틸.
 *
 * @typedef {'front' | 'left_profile' | 'right_profile'} PoseType
 * @typedef {'auto' | 'manual'} CaptureMode
 * @typedef {'with_glasses' | 'no_glasses'} GlassesMode
 *
 * @typedef {object} StepConfig
 * @property {string} step_id
 * @property {string} label
 * @property {string} hint
 * @property {PoseType} pose_type
 * @property {boolean} wears_glasses
 * @property {CaptureMode} capture_mode
 */

/** @type {StepConfig[]} */
export const ALL_STEPS = [
  {
    step_id: 'front_glasses',
    label: '정면 (안경 착용)',
    hint: '안경을 쓰고 정면을 바라봐 주세요',
    pose_type: 'front',
    wears_glasses: true,
    capture_mode: 'auto',
  },
  {
    step_id: 'left_glasses',
    label: '좌측 (안경 착용)',
    hint: '안경을 쓴 상태로 고개를 왼쪽으로 돌려 주세요',
    pose_type: 'left_profile',
    wears_glasses: true,
    capture_mode: 'manual',
  },
  {
    step_id: 'right_glasses',
    label: '우측 (안경 착용)',
    hint: '안경을 쓴 상태로 고개를 오른쪽으로 돌려 주세요',
    pose_type: 'right_profile',
    wears_glasses: true,
    capture_mode: 'manual',
  },
  {
    step_id: 'front_no_glasses',
    label: '정면 (안경 미착용)',
    hint: '안경을 벗고 정면을 바라봐 주세요',
    pose_type: 'front',
    wears_glasses: false,
    capture_mode: 'auto',
  },
  {
    step_id: 'left_no_glasses',
    label: '좌측 (안경 미착용)',
    hint: '안경을 벗은 상태로 고개를 왼쪽으로 돌려 주세요',
    pose_type: 'left_profile',
    wears_glasses: false,
    capture_mode: 'manual',
  },
  {
    step_id: 'right_no_glasses',
    label: '우측 (안경 미착용)',
    hint: '안경을 벗은 상태로 고개를 오른쪽으로 돌려 주세요',
    pose_type: 'right_profile',
    wears_glasses: false,
    capture_mode: 'manual',
  },
]

/**
 * 안경 착용 모드에 따른 스텝 목록을 반환한다.
 * with_glasses: 전체 6스텝. no_glasses: 미착용 3스텝만.
 * @param {GlassesMode} glasses_mode
 * @returns {StepConfig[]}
 */
export function get_steps_for_mode(glasses_mode) {
  if (glasses_mode === 'with_glasses') return ALL_STEPS
  return ALL_STEPS.filter((s) => !s.wears_glasses)
}

/**
 * 진행도 라벨 "N / M" 을 만든다 (현재 인덱스는 0-base, 화면에는 1-base 로 표기).
 * @param {number} current_step_index
 * @param {number} total
 * @returns {string}
 */
export function progress_label(current_step_index, total) {
  return `${current_step_index + 1} / ${total}`
}

/**
 * 진행도 비율(0~1)을 반환한다. 마지막 스텝 시작 시점에 1 이 아닌 (total-1)/total 을 반환.
 * @param {number} current_step_index
 * @param {number} total
 * @returns {number}
 */
export function progress_ratio(current_step_index, total) {
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, current_step_index / total))
}
