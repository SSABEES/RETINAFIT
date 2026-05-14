/**
 * 정면 슬롯의 live OH 측정 게이트.
 *
 * CameraView 의 onlandmarks 콜백을 받아 매 ~200ms 마다 OH worker 를 호출하고,
 * 좌·우 OH 가 ring buffer 안정성 + 범위 + confidence 를 모두 통과하면 on_pass 호출.
 *
 * 상수는 본 페이지 starting value — 실측 후 조정 전제.
 *
 * @typedef {{ oh: number, confidence: number }} Frame
 * @typedef {{ mean: number, std: number }} BufferStats
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

/**
 * 최근 RING_SIZE 프레임의 안정성·범위·confidence 를 검증해 통과 시 mean/std 반환.
 *
 * @param {Frame[]} buffer
 * @returns {BufferStats | null}
 */
export function evaluate_ring_buffer(buffer) {
  if (!Array.isArray(buffer) || buffer.length < RING_SIZE) return null
  const last_arr = buffer.slice(-RING_SIZE)
  for (const f of last_arr) {
    if (!Number.isFinite(f.oh) || !Number.isFinite(f.confidence)) return null
    if (f.oh < OH_MIN_MM || f.oh > OH_MAX_MM) return null
    if (f.confidence < MIN_CONFIDENCE) return null
  }
  const mean = last_arr.reduce((sum, f) => sum + f.oh, 0) / RING_SIZE
  const variance =
    last_arr.reduce((sum, f) => sum + (f.oh - mean) ** 2, 0) / RING_SIZE
  const std = Math.sqrt(variance)
  if (std > RING_STD_MAX_MM) return null
  return { mean, std }
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
 *
 * @typedef {object} GateResult
 * @property {number} oh_left_mm
 * @property {number} oh_right_mm
 * @property {'aruco' | 'pd_fallback'} oh_source
 *
 * @typedef {object} GateStatus
 * @property {'measuring' | 'measured'} phase
 * @property {string} hint
 */

/**
 * 정면 슬롯 live OH 측정 게이트.
 * @param {object} args
 * @param {(result: GateResult) => void} args.on_pass
 * @param {(status: GateStatus) => void} args.on_status
 * @returns {{ handle_landmarks: (d: LandmarkDetection) => void, stop: () => void }}
 */
export function start_oh_capture_gate({ on_pass, on_status }) {
  let last_run_at = 0
  let stopped = false
  let pass_fired = false
  let in_flight = false
  /** @type {Frame[]} */
  const buf_right_arr = []
  /** @type {Frame[]} */
  const buf_left_arr = []

  void ensure_opencv_ready().catch((err) => {
    console.warn('[oh_gate] OpenCV init 실패 — OH 게이트 비활성:', err)
  })

  /**
   * CameraView detection 마다 호출되는 게이트 진입점. throttle + in-flight 방어 + OH 산출 + ring buffer 판정 + on_pass/on_status 통보.
   *
   * @param {LandmarkDetection} detection
   */
  async function handle_landmarks(detection) {
    if (stopped || pass_fired) return
    if (!detection?.landmarks) {
      on_status({ phase: 'measuring', hint: '정면을 응시해 주세요' })
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
        on_status({ phase: 'measuring', hint: '정면을 응시해 주세요' })
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
        } catch (err) {
          // ArUco/intrinsics 실패 → PD fallback 으로 진행
          // 개발 시 디버그 필요하면 console.debug('[oh_gate] aruco skip:', err)
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

        if (oh_right_mm === null || oh_left_mm === null) {
          on_status({ phase: 'measuring', hint: '안경을 잘 착용해주세요' })
          return
        }

        buf_right_arr.push({ oh: oh_right_mm, confidence: oh_result.confidence_right })
        buf_left_arr.push({ oh: oh_left_mm, confidence: oh_result.confidence_left })
        if (buf_right_arr.length > RING_SIZE) buf_right_arr.shift()
        if (buf_left_arr.length > RING_SIZE) buf_left_arr.shift()

        const stats_right = evaluate_ring_buffer(buf_right_arr)
        const stats_left = evaluate_ring_buffer(buf_left_arr)
        if (stats_right && stats_left) {
          pass_fired = true
          on_status({ phase: 'measured', hint: '측정 완료' })
          on_pass({
            oh_left_mm: stats_left.mean,
            oh_right_mm: stats_right.mean,
            oh_source,
          })
          return
        }
        on_status({ phase: 'measuring', hint: '잠시 멈춰주세요' })
      } catch (err) {
        console.warn('[oh_gate] frame skipped:', err)
        on_status({ phase: 'measuring', hint: '정면을 응시해 주세요' })
      }
    } finally {
      in_flight = false
    }
  }

  return {
    handle_landmarks,
    stop() {
      stopped = true
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
