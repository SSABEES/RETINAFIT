/**
 * 측면 자세 감지 composable. 6DRepNet360 yaw 추론 + 안정성 게이팅 + 텍스트 힌트.
 *
 * 순수 로직은 profile_pose_logic.js 에 분리되어 단위 테스트됨. 이 파일은 Svelte 5 runes 로
 * 상태를 plumb 하고 외부에 reactive getter 형태로 노출. tick() 은 camera_view 의 rAF 안에서
 * 호출되며 내부적으로 ORT_FRAME_SKIP throttle + 단일 비행 가드.
 *
 * 정면 단계는 이 composable 무관 — get_pose_target() === 'front' 시 tick() 즉시 return.
 */

import { get_session, predict_pose, compute_center_square_bbox } from '@/lib/sixdrepnet360/inference.js'
import { rotation_matrix_to_euler } from '@/lib/sixdrepnet360/pose.js'
import { update_stability_step, compute_hint_text, PROFILE_CONSTANTS } from './profile_pose_logic.js'

/**
 * @typedef {'front' | 'left_profile' | 'right_profile'} PoseTarget
 *
 * @typedef {object} ProfilePoseDetector
 * @property {() => Promise<void>} tick
 * @property {() => void} reset
 * @property {boolean} is_stable
 * @property {number} progress
 * @property {string | null} hint_text
 * @property {boolean} session_ready
 * @property {number | null} last_yaw
 */

/**
 * @param {{
 *   get_pose_target: () => PoseTarget,
 *   get_video_el: () => HTMLVideoElement | null,
 *   on_stable_reached?: () => void,
 * }} cfg
 * @returns {ProfilePoseDetector}
 */
export function create_profile_pose_detector({ get_pose_target, get_video_el, on_stable_reached }) {
  // reactive 상태 — UI 가 읽음
  let _stable_count  = $state(0)
  let _last_yaw      = $state(/** @type {number | null} */ (null))
  let _session_ready = $state(false)

  // non-reactive — 내부용
  /** @type {number[]} */
  let _yaw_buffer    = []
  let _ort_inflight  = false
  let _frame_counter = 0
  let _reset_id      = 0

  async function tick() {
    if (get_pose_target() === 'front') return
    if (_ort_inflight) return
    _frame_counter += 1
    if (_frame_counter % PROFILE_CONSTANTS.ORT_FRAME_SKIP !== 0) return

    const video = get_video_el()
    if (!video || video.videoWidth === 0) return

    _ort_inflight = true
    const snapshot_id = _reset_id

    try {
      // get_session() 은 prefetch 캐시 hit 면 즉시 반환. 첫 호출이면 다운로드 + WASM 컴파일 대기.
      await get_session()
      if (snapshot_id !== _reset_id) return

      const bbox = compute_center_square_bbox(video)
      const result = await predict_pose(video, bbox)
      if (snapshot_id !== _reset_id) return       // 카메라 재시작 후 stale 결과 폐기

      const { yaw } = rotation_matrix_to_euler(result.rotation_matrix)
      const was_session_ready = _session_ready
      const prev_count = _stable_count

      _session_ready = true
      _last_yaw = yaw

      const target_deg = get_pose_target() === 'right_profile'
        ? +PROFILE_CONSTANTS.TARGET_DEG : -PROFILE_CONSTANTS.TARGET_DEG
      const next = update_stability_step({
        stable_count: _stable_count,
        yaw_buffer: _yaw_buffer,
        yaw,
        target_deg,
      })
      _stable_count = next.stable_count
      _yaw_buffer = next.yaw_buffer

      // 진단 로그: 첫 추론 + 안정성 카운트 변화 추적. (매 tick 로그하면 ~2.4Hz 라 노이즈 큼.)
      if (!was_session_ready) {
        console.log('[profile_pose] first inference ready', { yaw: yaw.toFixed(1), target_deg })
      }
      if (next.stable_count !== prev_count) {
        console.log('[profile_pose] count change', {
          yaw: yaw.toFixed(1),
          target: target_deg,
          stable: next.stable_count,
          max: PROFILE_CONSTANTS.STABILITY_FRAMES,
        })
      }

      // max 도달 transition (prev<max → next==max) 시 콜백 즉시 호출. Svelte 5 cross-module
      // getter reactivity 가 가끔 propagation 누락하는 이슈 회피 — rAF 안에서 직접 호출.
      // test.svelte 의 update_target_zone → capture_now() 패턴과 동일.
      if (
        prev_count < PROFILE_CONSTANTS.STABILITY_FRAMES &&
        next.stable_count >= PROFILE_CONSTANTS.STABILITY_FRAMES
      ) {
        console.log('[profile_pose] stable reached — invoking on_stable_reached')
        on_stable_reached?.()
      }
    } catch (err) {
      console.error('[profile_pose] tick failed', err)
      // silent — 다음 tick 자연 재시도. stable_count 변경 없음 → 자동 회복.
    } finally {
      _ort_inflight = false
    }
  }

  function reset() {
    _stable_count = 0
    _last_yaw = null
    _yaw_buffer = []
    _frame_counter = 0
    _reset_id += 1
    // _session_ready 유지 — 세션은 앱 전역 캐시 (inference.js 의 g_session_promises_obj)
    // _ort_inflight 유지 — 결과 저장 시 _reset_id 비교로 폐기
  }

  return {
    tick,
    reset,
    get is_stable()      { return _stable_count >= PROFILE_CONSTANTS.STABILITY_FRAMES },
    get progress()       {
      return Math.min(100, Math.round((_stable_count / PROFILE_CONSTANTS.STABILITY_FRAMES) * 100))
    },
    get hint_text()      {
      const target_deg = get_pose_target() === 'right_profile'
        ? +PROFILE_CONSTANTS.TARGET_DEG : -PROFILE_CONSTANTS.TARGET_DEG
      return compute_hint_text({
        session_ready: _session_ready,
        last_yaw: _last_yaw,
        target_deg,
        is_stable: _stable_count >= PROFILE_CONSTANTS.STABILITY_FRAMES,
        progress: Math.min(100, Math.round((_stable_count / PROFILE_CONSTANTS.STABILITY_FRAMES) * 100)),
      })
    },
    get session_ready()  { return _session_ready },
    get last_yaw()       { return _last_yaw },
  }
}
