/**
 * 정면 슬롯의 live OH 측정 게이트.
 *
 * CameraView 의 onlandmarks 콜백을 받아 매 ~200ms 마다 OH worker 를 호출하고,
 * 좌·우 OH 가 ring buffer 안정성 + 범위 + confidence 를 모두 통과하면 on_pass 호출.
 *
 * 상수는 본 페이지 starting value — 실측 후 조정 전제.
 *
 * 진단 — 매 프레임마다 어느 검사에서 막혔는지 `reason` 코드가 on_status 콜백에 포함되어 노출된다.
 * 가능한 reason 코드:
 *   `no_landmarks`        — CameraView 가 landmarks 자체를 전달 안 함
 *   `missing_landmarks`   — 동공/아랫눈꺼풀 4점 중 일부가 비어있음
 *   `pose_not_ready`     — CameraView 의 정면/안정화 게이트 미통과 — frame_state.frontal_ok && stable_ok 아님.
 *                          이 상태에서는 OH worker 호출 자체를 스킵 (자세 어긋난 프레임의 측정은 의미 없음).
 *   `oh_compute_failed`   — worker 가 OH px 산출 실패 (림 edge 미검출 등)
 *   `buffer_underfull`    — ring buffer 가 아직 RING_SIZE 미만 (정상 warmup)
 *   `nan_value`           — 버퍼 어느 프레임의 oh/confidence 가 NaN
 *   `out_of_range`        — OH 가 [OH_MIN_MM, OH_MAX_MM] 밖
 *   `low_confidence`      — confidence < MIN_CONFIDENCE
 *   `high_std`            — 3프레임 std 가 RING_STD_MAX_MM 초과 (사용자 움직임)
 *   `exception`           — estimate_oh 예외 등 기타 예외
 *   `pass`                — 모든 검사 통과, on_pass 발사
 *
 * DEV 빌드에서는 1Hz throttle 로 console 에 현재 OH/confidence/buffer/std/reason 한 줄 요약을 출력 —
 * 어느 단계에서 막히는지 현장 디버깅용. PROD 빌드에서는 dead-code elimination.
 *
 * @typedef {{ oh: number, confidence: number }} Frame
 * @typedef {{ frontal_ok: boolean, stable_ok: boolean }} FrameState
 * @typedef {'buffer_underfull' | 'nan_value' | 'out_of_range' | 'low_confidence' | 'high_std'} RingFailReason
 * @typedef {RingFailReason | 'no_landmarks' | 'missing_landmarks' | 'pose_not_ready' | 'oh_compute_failed' | 'exception' | 'pass'} GateReason
 * @typedef {{ ok: boolean, mean: number | null, std: number | null, reason: RingFailReason | null, details: object }} RingBufferResult
 */

import { detect_markers } from './aruco_detector.js'
import { mm_distance } from './aruco_scale.js'
import { MARKER_SIZE_MM } from './aruco_capture.js'
import {
  load_intrinsics_for_size,
  scale_intrinsics_to_image,
} from './camera_intrinsics.js'
import { estimate_oh, ensure_opencv_ready } from './oh_estimator.js'

export const OH_MIN_MM = 10
export const OH_MAX_MM = 30
export const MIN_CONFIDENCE = 0.35
export const RING_SIZE = 3
export const RING_STD_MAX_MM = 1.0
export const ASSUMED_PD_MM = 63

// MediaPipe FaceLandmarker 478-point 인덱스
const RIGHT_PUPIL_IDX = 468
const LEFT_PUPIL_IDX = 473
// 아랫눈꺼풀 — 우측 145, 좌측 374 (사용자 기준, mirror view 라 right=화면 왼쪽)
const RIGHT_LOWER_LID_IDX = 145
const LEFT_LOWER_LID_IDX = 374

// estimate_oh worker 가 ~150ms 걸리므로 5fps 목표 throttle
const THROTTLE_MS = 200

// DEV 콘솔 로그 throttle — 매 프레임 출력하면 콘솔이 마비되므로 1Hz 로 제한.
const LOG_INTERVAL_MS = 1000

/**
 * 최근 RING_SIZE 프레임의 안정성·범위·confidence 를 검증해 통과 여부와 진단 정보를 반환.
 * 실패 시 어느 검사에서 떨어졌는지 `reason` 코드 + `details` (해당 프레임 idx, 값) 노출.
 *
 * @param {Frame[]} buffer
 * @returns {RingBufferResult}
 */
export function evaluate_ring_buffer(buffer) {
  if (!Array.isArray(buffer) || buffer.length < RING_SIZE) {
    return {
      ok: false,
      mean: null,
      std: null,
      reason: 'buffer_underfull',
      details: {
        size: Array.isArray(buffer) ? buffer.length : 0,
        required: RING_SIZE,
      },
    }
  }
  const last_arr = buffer.slice(-RING_SIZE)
  for (let idx = 0; idx < last_arr.length; idx++) {
    const f = last_arr[idx]
    if (!Number.isFinite(f.oh) || !Number.isFinite(f.confidence)) {
      return {
        ok: false,
        mean: null,
        std: null,
        reason: 'nan_value',
        details: { idx, oh: f.oh, confidence: f.confidence },
      }
    }
    if (f.oh < OH_MIN_MM || f.oh > OH_MAX_MM) {
      return {
        ok: false,
        mean: null,
        std: null,
        reason: 'out_of_range',
        details: { idx, oh: f.oh, min: OH_MIN_MM, max: OH_MAX_MM },
      }
    }
    if (f.confidence < MIN_CONFIDENCE) {
      return {
        ok: false,
        mean: null,
        std: null,
        reason: 'low_confidence',
        details: { idx, confidence: f.confidence, min: MIN_CONFIDENCE },
      }
    }
  }
  const mean = last_arr.reduce((sum, f) => sum + f.oh, 0) / RING_SIZE
  const variance =
    last_arr.reduce((sum, f) => sum + (f.oh - mean) ** 2, 0) / RING_SIZE
  const std = Math.sqrt(variance)
  if (std > RING_STD_MAX_MM) {
    return {
      ok: false,
      mean,
      std,
      reason: 'high_std',
      details: { std, max: RING_STD_MAX_MM },
    }
  }
  return { ok: true, mean, std, reason: null, details: {} }
}

/**
 * ArUco 없는 캡처에서 정면 동공거리(px) 와 ASSUMED_PD_MM 으로 mm/px 비율을 산출.
 *
 * @param {{ x: number, y: number } | null} pupil_right
 * @param {{ x: number, y: number } | null} pupil_left
 * @returns {number | null}
 */
export function compute_mm_per_px_fallback(pupil_right, pupil_left) {
  if (!pupil_right || !pupil_left) return null
  const dx = pupil_left.x - pupil_right.x
  const dy = pupil_left.y - pupil_right.y
  const dist_px = Math.hypot(dx, dy)
  if (!Number.isFinite(dist_px) || dist_px <= 0) return null
  return ASSUMED_PD_MM / dist_px
}

/**
 * @typedef {object} LandmarkDetection
 * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[] | null} landmarks
 * @property {HTMLVideoElement | HTMLCanvasElement | ImageBitmap} source_el
 * @property {number} source_width
 * @property {number} source_height
 * @property {FrameState} [frame_state]  CameraView 의 정면(완전성+frontal) + 안정화(face dim std) 게이트 상태.
 *                                       미전달 (legacy 컨슈머) 이면 게이트가 통과로 간주 — 책임을 콜러에 위임.
 *
 * @typedef {object} GateResult
 * @property {number} oh_left_mm
 * @property {number} oh_right_mm
 * @property {'aruco' | 'pd_fallback'} oh_source
 *
 * @typedef {object} GateStatus
 * @property {'measuring' | 'measured'} phase
 * @property {string} hint
 * @property {GateReason} reason
 * @property {object} [details]
 *
 * @typedef {{ x: number, y: number, w: number, h: number }} RoiBox
 * @typedef {object} OhOverlayState
 * @property {RoiBox | null} roi_right                  worker 가 우측 눈 림 검색에 사용한 ROI (캔버스 좌표)
 * @property {RoiBox | null} roi_left
 * @property {number | null} frame_bottom_y_right       채택된 우측 림 하단 y (캔버스 좌표). null = 검출 실패
 * @property {number | null} frame_bottom_y_left
 */

/**
 * 정면 슬롯 live OH 측정 게이트.
 * @param {object} args
 * @param {(result: GateResult) => void} args.on_pass
 * @param {(status: GateStatus) => void} args.on_status
 * @param {((overlay: OhOverlayState | null) => void) | undefined} [args.on_overlay_update]  worker 결과 ROI/림 위치를 외부 그리기용으로 노출. null = 그리지 말 것 (자세 미준비/언마운트 등).
 * @returns {{ handle_landmarks: (d: LandmarkDetection) => void, stop: () => void }}
 */
export function start_oh_capture_gate({ on_pass, on_status, on_overlay_update }) {
  let last_run_at = 0
  let stopped = false
  let pass_fired = false
  let in_flight = false
  /** @type {Frame[]} */
  const buf_right_arr = []
  /** @type {Frame[]} */
  const buf_left_arr = []

  // DEV 빌드 토글 — Vite 의 import.meta.env.DEV 가 PROD 빌드에서 false 로 트리쉐이킹 됨.
  const dev_mode = Boolean(import.meta.env?.DEV)
  let last_log_at = 0
  // 매 프레임 cycle 마다 갱신되는 진단용 스냅샷. console 로그 + on_status details 보강에 사용.
  const frame_diag = {
    /** @type {number | null} */ oh_right_mm: null,
    /** @type {number | null} */ oh_left_mm: null,
    /** @type {number | null} */ conf_right: null,
    /** @type {number | null} */ conf_left: null,
    buf_right_size: 0,
    buf_left_size: 0,
    /** @type {number | null} */ std_right: null,
    /** @type {number | null} */ std_left: null,
    /** @type {FrameState | null} */ frame_state: null,
  }

  void ensure_opencv_ready().catch((err) => {
    console.warn('[oh_gate] OpenCV init 실패 — OH 게이트 비활성:', err)
  })

  // DEV 모드 1Hz throttled console 출력 — 현재 frame_diag + reason 한 줄 요약.
  function maybe_log(status) {
    if (!dev_mode) return
    const now = performance.now()
    if (now - last_log_at < LOG_INTERVAL_MS) return
    last_log_at = now
    const fmt = (n) =>
      typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '-'
    const side = status?.details?.side ? `@${status.details.side}` : ''
    // pose=F1S1 = frontal_ok & stable_ok / F0S1 = frontal 미달 / F-S- = frame_state 미전달
    const fs = frame_diag.frame_state
    const pose = fs ? `F${fs.frontal_ok ? 1 : 0}S${fs.stable_ok ? 1 : 0}` : 'F-S-'
    // eslint-disable-next-line no-console
    console.log(
      `[oh_gate] pose=${pose}`,
      `R=${fmt(frame_diag.oh_right_mm)}(c=${fmt(frame_diag.conf_right)})`,
      `L=${fmt(frame_diag.oh_left_mm)}(c=${fmt(frame_diag.conf_left)})`,
      `buf=R${frame_diag.buf_right_size}/L${frame_diag.buf_left_size}`,
      `std=R${fmt(frame_diag.std_right)}/L${fmt(frame_diag.std_left)}`,
      `→ ${status?.reason ?? '-'}${side}`,
    )
  }

  // 상태 통보 + dev throttled 로그를 한 번에 처리. on_status 호출하는 자리는 모두 이 함수로 통일.
  function emit_status(status) {
    on_status(status)
    maybe_log(status)
  }

  // 림 시각화용 ROI/선택 위치를 외부에 노출. 콜백 없으면 no-op — 책임 분리.
  function emit_overlay(overlay) {
    if (on_overlay_update) on_overlay_update(overlay)
  }

  /**
   * CameraView detection 마다 호출되는 게이트 진입점. throttle + in-flight 방어 + OH 산출 + ring buffer 판정 + on_pass/on_status 통보.
   *
   * @param {LandmarkDetection} detection
   */
  async function handle_landmarks(detection) {
    if (stopped || pass_fired) return
    if (!detection?.landmarks) {
      emit_overlay(null)
      emit_status({
        phase: 'measuring',
        hint: '정면을 응시해 주세요',
        reason: 'no_landmarks',
        details: {},
      })
      return
    }
    // CameraView 가 정면(완전성 + frontal) + 안정화 모두 OK 라고 알린 프레임에서만 실제 측정 수행.
    // 자세 흔들리는 동안의 OH 측정은 ring buffer 의 의미를 흐리고 worker CPU 만 낭비하므로 일찍 차단.
    // frame_state 미전달이면 (legacy 컨슈머) 가드 통과 — 기존 동작 유지.
    frame_diag.frame_state = detection.frame_state ?? null
    if (detection.frame_state && !(detection.frame_state.frontal_ok && detection.frame_state.stable_ok)) {
      emit_overlay(null)
      emit_status({
        phase: 'measuring',
        hint: '정면을 바라보고 잠시 멈춰주세요',
        reason: 'pose_not_ready',
        details: {
          frontal_ok: detection.frame_state.frontal_ok,
          stable_ok: detection.frame_state.stable_ok,
        },
      })
      return
    }
    const now = performance.now()
    if (now - last_run_at < THROTTLE_MS) return
    if (in_flight) return
    last_run_at = now
    in_flight = true
    try {
      const { landmarks, source_el, source_width, source_height } = detection
      const pupil_right_norm = landmarks[RIGHT_PUPIL_IDX]
      const pupil_left_norm = landmarks[LEFT_PUPIL_IDX]
      const lower_right_norm = landmarks[RIGHT_LOWER_LID_IDX]
      const lower_left_norm = landmarks[LEFT_LOWER_LID_IDX]
      if (!pupil_right_norm || !pupil_left_norm || !lower_right_norm || !lower_left_norm) {
        emit_overlay(null)
        emit_status({
          phase: 'measuring',
          hint: '정면을 응시해 주세요',
          reason: 'missing_landmarks',
          details: {
            pupil_right: !!pupil_right_norm,
            pupil_left: !!pupil_left_norm,
            lower_right: !!lower_right_norm,
            lower_left: !!lower_left_norm,
          },
        })
        return
      }

      const pupil_right = {
        x: pupil_right_norm.x * source_width,
        y: pupil_right_norm.y * source_height,
      }
      const pupil_left = {
        x: pupil_left_norm.x * source_width,
        y: pupil_left_norm.y * source_height,
      }
      const lower_lid_y_right = lower_right_norm.y * source_height
      const lower_lid_y_left = lower_left_norm.y * source_height

      try {
        /** @type {import('./aruco_detector.js').DetectedMarker | null} */
        let marker = null
        /** @type {import('./camera_intrinsics.js').CameraIntrinsics | null} */
        let intrinsics = null
        try {
          const base = await load_intrinsics_for_size(source_width, source_height)
          intrinsics = scale_intrinsics_to_image(base, source_width, source_height)
          const image_data = await extract_image_data(source_el, source_width, source_height)
          if (image_data) {
            const markers_arr = detect_markers(image_data, intrinsics, MARKER_SIZE_MM)
            marker = markers_arr[0] ?? null
          }
        } catch (_err) {
          // ArUco/intrinsics 실패 → PD fallback 으로 진행
          // 개발 시 디버그 필요하면 (_err) 를 (err) 로 바꾸고 console.debug('[oh_gate] aruco skip:', err)
        }

        const oh_result = await estimate_oh({
          pupil_right,
          pupil_left,
          lower_lid_y_right,
          lower_lid_y_left,
          source_el,
          source_width,
          source_height,
        })

        // 림 시각화 — worker 의 ROI + 선택된 frame_bottom_y 만 외부에 노출. detected_lines 무더기는 라이브에서 어수선해 제외.
        emit_overlay({
          roi_right: oh_result.roi_right,
          roi_left: oh_result.roi_left,
          frame_bottom_y_right: oh_result.frame_bottom_y_right,
          frame_bottom_y_left: oh_result.frame_bottom_y_left,
        })

        frame_diag.conf_right = oh_result.confidence_right
        frame_diag.conf_left = oh_result.confidence_left

        const oh_source = marker && intrinsics ? 'aruco' : 'pd_fallback'
        const oh_right_mm = compute_oh_mm({
          oh_px: oh_result.oh_px_right,
          pupil_px: pupil_right,
          frame_bottom_y: oh_result.frame_bottom_y_right,
          marker,
          intrinsics,
          pupil_right_px: pupil_right,
          pupil_left_px: pupil_left,
        })
        const oh_left_mm = compute_oh_mm({
          oh_px: oh_result.oh_px_left,
          pupil_px: pupil_left,
          frame_bottom_y: oh_result.frame_bottom_y_left,
          marker,
          intrinsics,
          pupil_right_px: pupil_right,
          pupil_left_px: pupil_left,
        })

        frame_diag.oh_right_mm = oh_right_mm
        frame_diag.oh_left_mm = oh_left_mm

        if (oh_right_mm === null || oh_left_mm === null) {
          emit_status({
            phase: 'measuring',
            hint: '안경을 잘 착용해주세요',
            reason: 'oh_compute_failed',
            details: {
              oh_right_mm,
              oh_left_mm,
              oh_source,
              has_marker: !!marker,
            },
          })
          return
        }

        buf_right_arr.push({ oh: oh_right_mm, confidence: oh_result.confidence_right })
        buf_left_arr.push({ oh: oh_left_mm, confidence: oh_result.confidence_left })
        if (buf_right_arr.length > RING_SIZE) buf_right_arr.shift()
        if (buf_left_arr.length > RING_SIZE) buf_left_arr.shift()

        frame_diag.buf_right_size = buf_right_arr.length
        frame_diag.buf_left_size = buf_left_arr.length

        const stats_right = evaluate_ring_buffer(buf_right_arr)
        const stats_left = evaluate_ring_buffer(buf_left_arr)
        frame_diag.std_right = stats_right.std
        frame_diag.std_left = stats_left.std

        if (stats_right.ok && stats_left.ok) {
          pass_fired = true
          emit_status({
            phase: 'measured',
            hint: '측정 완료',
            reason: 'pass',
            details: {
              mean_right: stats_right.mean,
              mean_left: stats_left.mean,
              oh_source,
            },
          })
          on_pass({
            oh_left_mm: stats_left.mean,
            oh_right_mm: stats_right.mean,
            oh_source,
          })
          return
        }

        // 우측 우선 보고. 양쪽 모두 실패면 다음 frame 에 좌측 reason 노출 가능.
        const failing = !stats_right.ok
          ? { side: 'right', stats: stats_right }
          : { side: 'left', stats: stats_left }
        emit_status({
          phase: 'measuring',
          hint: '잠시 멈춰주세요',
          reason: failing.stats.reason,
          details: { side: failing.side, ...failing.stats.details },
        })
      } catch (err) {
        console.warn('[oh_gate] frame skipped:', err)
        emit_status({
          phase: 'measuring',
          hint: '정면을 응시해 주세요',
          reason: 'exception',
          details: { message: err?.message ?? String(err) },
        })
      }
    } finally {
      in_flight = false
    }
  }

  return {
    handle_landmarks,
    stop() {
      stopped = true
      // 슬롯 전환/언마운트 시 overlay 가 화면에 남지 않도록 명시 정리.
      emit_overlay(null)
    },
  }
}

/**
 * 한쪽 OH(mm) 산출. ArUco 있으면 plane-direct mm_distance, 없으면 oh_px × mm_per_px_fallback.
 *
 * @param {object} args
 * @param {number | null} args.oh_px
 * @param {{ x: number, y: number }} args.pupil_px
 * @param {number | null} args.frame_bottom_y
 * @param {import('./aruco_detector.js').DetectedMarker | null} args.marker
 * @param {import('./camera_intrinsics.js').CameraIntrinsics | null} args.intrinsics
 * @param {{ x: number, y: number }} args.pupil_right_px
 * @param {{ x: number, y: number }} args.pupil_left_px
 * @returns {number | null}
 */
function compute_oh_mm({
  oh_px,
  pupil_px,
  frame_bottom_y,
  marker,
  intrinsics,
  pupil_right_px,
  pupil_left_px,
}) {
  if (oh_px === null || frame_bottom_y === null) return null
  if (marker && intrinsics) {
    const p_top = pupil_px
    const p_bottom = { x: pupil_px.x, y: frame_bottom_y }
    try {
      const mm = mm_distance(p_top, p_bottom, marker, intrinsics)
      return Number.isFinite(mm) && mm > 0 ? mm : null
    } catch {
      // fall through
    }
  }
  const mm_per_px = compute_mm_per_px_fallback(pupil_right_px, pupil_left_px)
  if (mm_per_px === null) return null
  return oh_px * mm_per_px
}

/**
 * source_el 을 canvas 에 그려 ImageData 로 추출 (ArUco 검출 입력용).
 *
 * @param {HTMLVideoElement | HTMLCanvasElement | ImageBitmap} source_el
 * @param {number} width
 * @param {number} height
 * @returns {Promise<ImageData | null>}
 */
async function extract_image_data(source_el, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source_el, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}
