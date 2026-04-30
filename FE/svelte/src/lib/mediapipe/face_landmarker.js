/**
 * MediaPipe Face Landmarker 래퍼.
 * Flutter 프로젝트 src/lib/faceLandmarker.ts 에서 포팅.
 *
 * IMAGE / VIDEO 두 가지 러닝 모드를 lazy 로 로드하며,
 * 16ms 윈도우 캐시로 같은 rAF 틱의 중복 호출을 막는다.
 *
 * @typedef {import("@mediapipe/tasks-vision").FaceLandmarker} FaceLandmarker
 * @typedef {import("@mediapipe/tasks-vision").FaceLandmarkerResult} FaceLandmarkerResult
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 * @typedef {import("./face_types.js").DetectResult} DetectResult
 * @typedef {import("./face_types.js").FrontalCheck} FrontalCheck
 * @typedef {import("./face_types.js").CompletenessCheck} CompletenessCheck
 */

import { FaceLandmarker as MpFaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// 모델·WASM 모두 same-origin 자체 호스팅. CDN/CSP/버전 불일치 회피 + Flutter WebView 호환.
// WASM: vite-plugin-static-copy 가 node_modules → dist/mediapipe/wasm 으로 복사 (vite.config.js 참조)
// 모델: public/mediapipe/models/ 에 커밋된 정적 자산
const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/models/face_landmarker.task`
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`
const CACHE_TTL_MS = 16 // 16ms ≈ 60fps 한 프레임 — 같은 rAF 틱의 중복 호출 방지
const FRAME_MARGIN = 0.03

export const YAW_THR = 16
export const PITCH_THR = 18
export const ROLL_THR = 14

// 얼굴이 프레임 경계 안에 있는지 확인할 때 검사하는 핵심 포인트 인덱스.
const KEY_INDICES = [10, 152, 234, 454, 33, 263, 133, 362, 1, 61, 291, 172, 397]

// 페이스 메시 드로잉 색상 (가이드 타원 색상과는 분리되어 있음)
const MESH_COLOR_TESSELATION = 'rgba(200,200,200,0.22)'
const MESH_COLOR_OVAL = 'rgba(255,255,255,0.85)'
const MESH_COLOR_EYE = '#00e676'
const MESH_COLOR_EYEBROW = '#40c4ff'
const MESH_COLOR_LIP = '#f48fb1'
const MESH_COLOR_IRIS = '#ffeb3b'

/** @type {Promise<FaceLandmarker> | null} */
let g_image_promise = null
/** @type {Promise<FaceLandmarker> | null} */
let g_video_promise = null
/** @type {FaceLandmarkerResult | null} */
let g_cached_result = null
let g_cached_timestamp = -1

/** @type {ReturnType<typeof FilesetResolver.forVisionTasks> | null} */
let g_fileset_promise = null

// MediaPipe Vision Fileset 을 로드한다. WASM 번들 네트워크 페치 비용이 크므로 모듈 레벨에서 메모이즈.
// image/video 랜드마커 모두 활성화될 때 같은 Fileset 프로미스를 공유해 중복 페치를 막는다.
function load_fileset() {
  if (!g_fileset_promise) g_fileset_promise = FilesetResolver.forVisionTasks(WASM_BASE)
  return g_fileset_promise
}

// IMAGE 러닝 모드의 FaceLandmarker 를 생성한다.
async function load_image_landmarker() {
  const fileset = await load_fileset()
  return MpFaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'IMAGE',
    numFaces: 1,
  })
}

// VIDEO 러닝 모드의 FaceLandmarker 를 생성한다.
async function load_video_landmarker() {
  const fileset = await load_fileset()
  return MpFaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
  })
}

/**
 * IMAGE 모드 FaceLandmarker 를 lazy 로딩해 반환한다.
 * @returns {Promise<FaceLandmarker>}
 */
export function get_image_landmarker() {
  if (!g_image_promise) g_image_promise = load_image_landmarker()
  return g_image_promise
}

/**
 * VIDEO 모드 FaceLandmarker 를 lazy 로딩해 반환한다.
 * @returns {Promise<FaceLandmarker>}
 */
export function get_video_landmarker() {
  if (!g_video_promise) g_video_promise = load_video_landmarker()
  return g_video_promise
}

/**
 * 단일 이미지에서 얼굴을 검출해 DetectResult 로 반환한다.
 * @param {HTMLImageElement} img
 * @returns {Promise<DetectResult | null>}
 */
export async function detect_from_image(img) {
  const landmarker = await get_image_landmarker()
  const result = landmarker.detect(img)
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null
  return {
    landmarks: result.faceLandmarks[0],
    image_width: img.naturalWidth,
    image_height: img.naturalHeight,
  }
}

/**
 * 비디오 프레임에서 얼굴을 검출한다. 16ms 윈도우 내 중복 호출은 캐시된 결과를 반환.
 * @param {FaceLandmarker} landmarker
 * @param {HTMLVideoElement} video
 * @returns {FaceLandmarkerResult | null}
 */
export function detect_from_video(landmarker, video) {
  if (!video || video.readyState < 2) return null
  const now = performance.now()
  if (g_cached_result !== null && now - g_cached_timestamp < CACHE_TTL_MS) return g_cached_result
  g_cached_result = landmarker.detectForVideo(video, now)
  g_cached_timestamp = now
  return g_cached_result
}

/**
 * 비디오 검출 결과 캐시를 비운다. 카메라 정지/재시작 시 호출.
 */
export function clear_video_cache() {
  g_cached_result = null
  g_cached_timestamp = -1
}

/**
 * MediaPipe 4x4 column-major 얼굴 변환 행렬을 yaw/pitch/roll(도)로 분해해 정면 여부를 반환한다.
 * @param {FaceLandmarkerResult | null} result
 * @returns {FrontalCheck | null}
 */
export function check_frontal(result) {
  if (!result?.facialTransformationMatrixes || result.facialTransformationMatrixes.length === 0) {
    return null
  }
  const d = result.facialTransformationMatrixes[0].data
  const RAD = 180 / Math.PI
  const yaw = Math.asin(Math.max(-1, Math.min(1, d[8]))) * RAD
  const pitch = Math.atan2(-d[9], d[10]) * RAD
  const roll = Math.atan2(-d[4], d[0]) * RAD
  const yaw_ok = Math.abs(yaw) < YAW_THR
  const pitch_ok = Math.abs(pitch) < PITCH_THR
  const roll_ok = Math.abs(roll) < ROLL_THR
  const is_frontal = yaw_ok && pitch_ok && roll_ok
  const reason = is_frontal ? null : !yaw_ok ? 'yaw' : !pitch_ok ? 'pitch' : 'roll'
  return { is_frontal, reason, yaw, pitch, roll }
}

/**
 * 주요 랜드마크가 프레임 경계 안에 모두 들어있는지 확인한다.
 * @param {FaceLandmarkerResult | null} result
 * @returns {CompletenessCheck}
 */
export function check_face_completeness(result) {
  if (!result?.faceLandmarks || result.faceLandmarks.length === 0) {
    return { is_complete: false, reason: null }
  }
  const landmarks = result.faceLandmarks[0]
  for (const idx of KEY_INDICES) {
    const lm = landmarks[idx]
    if (!lm) continue
    if (
      lm.x < FRAME_MARGIN ||
      lm.x > 1 - FRAME_MARGIN ||
      lm.y < FRAME_MARGIN ||
      lm.y > 1 - FRAME_MARGIN
    ) {
      return { is_complete: false, reason: 'out-of-frame' }
    }
  }
  return { is_complete: true, reason: null }
}

/**
 * 랜드마크 연결선을 canvas 에 그린다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {NormalizedLandmark[]} landmarks
 * @param {ReadonlyArray<{ start: number, end: number }>} connections
 * @param {number} w
 * @param {number} h
 * @param {string} color
 * @param {number} line_width
 */
function draw_connections(ctx, landmarks, connections, w, h, color, line_width) {
  ctx.strokeStyle = color
  ctx.lineWidth = line_width
  ctx.beginPath()
  for (const c of connections) {
    const a = landmarks[c.start]
    const b = landmarks[c.end]
    if (!a || !b) continue
    ctx.moveTo(a.x * w, a.y * h)
    ctx.lineTo(b.x * w, b.y * h)
  }
  ctx.stroke()
}

/**
 * 페이스 메시(테셀레이션, 윤곽, 눈, 눈썹, 입술, 홍채)를 canvas 에 그린다.
 * 비디오 프레임은 그리지 않는다 — 이 canvas 는 <video> 위에 투명 오버레이로 겹쳐 그리는 용도이므로
 * 비디오 프레임을 복제해 그리면 불투명해져 카메라 영상을 가리게 된다.
 * @param {HTMLCanvasElement} canvas
 * @param {FaceLandmarkerResult | null} result
 */
export function draw_face_mesh(canvas, result) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!result?.faceLandmarks?.length) return

  const landmarks = result.faceLandmarks[0]
  const w = canvas.width
  const h = canvas.height

  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_TESSELATION,
    w,
    h,
    MESH_COLOR_TESSELATION,
    1,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    w,
    h,
    MESH_COLOR_OVAL,
    2,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    w,
    h,
    MESH_COLOR_EYE,
    2,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    w,
    h,
    MESH_COLOR_EYE,
    2,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    w,
    h,
    MESH_COLOR_EYEBROW,
    2,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    w,
    h,
    MESH_COLOR_EYEBROW,
    2,
  )
  draw_connections(ctx, landmarks, MpFaceLandmarker.FACE_LANDMARKS_LIPS, w, h, MESH_COLOR_LIP, 2)
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
    w,
    h,
    MESH_COLOR_IRIS,
    2,
  )
  draw_connections(
    ctx,
    landmarks,
    MpFaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    w,
    h,
    MESH_COLOR_IRIS,
    2,
  )
}

/**
 * 로드된 FaceLandmarker 인스턴스를 정리하고 캐시를 비운다.
 *
 * NOTE: 이 함수는 `camera_view.svelte` 의 `on_stop_camera` 에서 호출하지 않는다.
 * 카메라를 껐다 켤 때마다 MediaPipe 모델(~9MB)을 다시 로드하면 UX/네트워크 비용이 크므로,
 * 모듈 레벨 lazy 싱글톤을 유지하는 편이 일반적으로 이득. 앱 전체를 떠나거나 GPU 컨텍스트가
 * 손실되는 등 전역 정리가 필요한 경우에만 수동으로 호출한다.
 *
 * @returns {Promise<void>}
 */
export async function dispose_landmarker() {
  if (g_image_promise) {
    const l = await g_image_promise
    l.close()
    g_image_promise = null
  }
  if (g_video_promise) {
    const l = await g_video_promise
    l.close()
    g_video_promise = null
  }
  g_fileset_promise = null
  clear_video_cache()
}
