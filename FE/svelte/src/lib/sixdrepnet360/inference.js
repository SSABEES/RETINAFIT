/**
 * 6DRepNet360 ONNX 모델을 onnxruntime-web 으로 추론하는 래퍼.
 *
 * 모델 자산은 PyTorch 체크포인트를 AI/scripts/export_6drepnet360_onnx.py 로 1회 변환해 만든
 * public/models/sixdrepnet360/6drepnet360.onnx (~94MB) 를 same-origin 으로 호스팅.
 * onnxruntime-web 의 워커/.wasm 은 vite 의 import.meta.url 자동 해석에 맡긴다 (vite.config.js
 * 의 optimizeDeps.exclude 참조).
 *
 * 추론 입력: 224×224 RGB face crop, ImageNet 정규화 후 CHW 배치 → Float32 [1, 3, 224, 224]
 * 추론 출력: 3×3 회전행렬 → Float32 [1, 3, 3] (row-major)
 *
 * face crop 소스는 두 가지를 지원:
 *   - compute_bbox_from_landmarks: MediaPipe 478 랜드마크로부터 정확한 face bbox
 *   - compute_center_square_bbox:  카메라 프레임 중앙 정사각형 (얼굴 검출 없이 사용)
 *
 * @typedef {import("onnxruntime-web").InferenceSession} InferenceSession
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 *
 * @typedef {object} BBoxNorm
 * @property {number} x  left, 0-1 normalized
 * @property {number} y  top, 0-1 normalized
 * @property {number} w  width, 0-1 normalized
 * @property {number} h  height, 0-1 normalized
 *
 * @typedef {object} PosePrediction
 * @property {Float32Array} rotation_matrix  3×3 row-major (length 9)
 * @property {number} latency_ms  session.run 만의 순수 추론 시간(ms)
 */

import * as ort from 'onnxruntime-web'

// wasmPaths 를 명시 설정하지 않으면 onnxruntime-web 은 자신을 import 한 모듈의 import.meta.url
// 기준으로 워커/.wasm 을 자동 해석한다. Vite 는 이 dynamic import 를 `?url` 자산으로 처리해
// dist/assets/ 에 올바르게 emit 한다 — public/ 에서 직접 서빙하면 dev 모드에서 Vite 가 `?import`
// 쿼리를 붙여 module 트랜스폼을 시도하다 깨지는 문제를 피할 수 있다.
//
// 핵심 전제: vite.config.js 의 optimizeDeps.exclude 에 'onnxruntime-web' 가 포함되어 있어
// esbuild pre-bundle 단계에서 onnxruntime-web 의 dynamic import 가 변형되지 않는다.

const MODEL_URL = `${import.meta.env.BASE_URL}models/sixdrepnet360/6drepnet360.onnx`
const INPUT_NAME = 'pixel_values'
const OUTPUT_NAME = 'rotation_matrix'
const INPUT_SIZE = 224

// ImageNet 정규화 상수. 학습 시 원본 코드의 transforms.Normalize 와 동일해야 한다.
const MEAN_R = 0.485
const MEAN_G = 0.456
const MEAN_B = 0.406
const STD_R = 0.229
const STD_G = 0.224
const STD_B = 0.225

// face bbox 패딩(좌우/상하 각각). 6DRepNet 류 모델은 이마/턱까지 보아야 yaw 가 안정.
const BBOX_PADDING = 0.25

/** @type {Promise<InferenceSession> | null} */
let g_session_promise = null

/** @type {OffscreenCanvas | HTMLCanvasElement | null} */
let g_crop_canvas = null
/** @type {Float32Array | null} */
let g_input_buffer = null

// ONNX 세션을 한 번만 생성하는 lazy 싱글톤. WASM 백엔드 우선 — WebGPU 는 가용 디바이스가 제한적.
async function load_session() {
  return ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
}

/**
 * ONNX InferenceSession 을 lazy 로딩해 반환한다. 첫 호출이 모델 다운로드(~94MB) + 컴파일을
 * 트리거하므로 페이지 진입 직후 미리 한 번 호출해 두는 것을 권장.
 * @returns {Promise<InferenceSession>}
 */
export function get_session() {
  if (!g_session_promise) g_session_promise = load_session()
  return g_session_promise
}

/**
 * 카메라 프레임 중앙의 정사각형 영역을 face crop bbox 로 사용한다.
 * 얼굴 검출 없이 동작하므로 사용자가 얼굴을 화면 중앙에 맞추는 UX 를 전제로 함.
 * @param {HTMLVideoElement} video
 * @returns {BBoxNorm}
 */
export function compute_center_square_bbox(video) {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return { x: 0, y: 0, w: 1, h: 1 }
  // 짧은 변 기준 정사각형. 너비 480 / 높이 640 카메라라면 정사각형 480px 가 세로 중앙에 위치.
  const short = Math.min(w, h)
  const size_norm_w = short / w
  const size_norm_h = short / h
  return {
    x: (1 - size_norm_w) / 2,
    y: (1 - size_norm_h) / 2,
    w: size_norm_w,
    h: size_norm_h,
  }
}

/**
 * 478개 정규화 랜드마크(0-1)에서 정사각형 face bbox 를 계산한다.
 * 이마/턱 손실을 막기 위해 양옆/위아래로 BBOX_PADDING 만큼 확장.
 * @param {NormalizedLandmark[]} landmarks
 * @returns {BBoxNorm}
 */
export function compute_bbox_from_landmarks(landmarks) {
  let min_x = 1
  let min_y = 1
  let max_x = 0
  let max_y = 0
  for (const lm of landmarks) {
    if (lm.x < min_x) min_x = lm.x
    if (lm.y < min_y) min_y = lm.y
    if (lm.x > max_x) max_x = lm.x
    if (lm.y > max_y) max_y = lm.y
  }
  const cx = (min_x + max_x) / 2
  const cy = (min_y + max_y) / 2
  const raw_size = Math.max(max_x - min_x, max_y - min_y)
  const size = Math.min(1, raw_size * (1 + BBOX_PADDING * 2))
  const half = size / 2
  // 화면 경계 안으로 클램프 (drawImage 의 source 가 음수면 일부 브라우저에서 이상 동작).
  const x = Math.max(0, Math.min(1 - size, cx - half))
  const y = Math.max(0, Math.min(1 - size, cy - half))
  return { x, y, w: size, h: size }
}

// 224×224 크롭 캔버스를 lazy 로 만들어 매 프레임 재사용한다. OffscreenCanvas 미지원 환경 대비 폴백.
function get_crop_canvas() {
  if (g_crop_canvas) return g_crop_canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    g_crop_canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  } else {
    const c = document.createElement('canvas')
    c.width = INPUT_SIZE
    c.height = INPUT_SIZE
    g_crop_canvas = c
  }
  return g_crop_canvas
}

/**
 * 비디오 프레임의 bbox 영역을 224×224 로 크롭/리사이즈하고 ImageNet 정규화 후 CHW 배치한다.
 * 결과 Float32Array 는 모듈 레벨 버퍼를 재사용하므로 호출자 측에서 보관/복제하지 말 것.
 * @param {HTMLVideoElement} video
 * @param {BBoxNorm} bbox
 * @returns {Float32Array}  length 3*224*224
 */
export function preprocess(video, bbox) {
  const canvas = get_crop_canvas()
  const ctx = /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
    canvas.getContext('2d', { willReadFrequently: true })
  )
  const sx = bbox.x * video.videoWidth
  const sy = bbox.y * video.videoHeight
  const sw = bbox.w * video.videoWidth
  const sh = bbox.h * video.videoHeight
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const img = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data

  const plane = INPUT_SIZE * INPUT_SIZE
  if (!g_input_buffer) g_input_buffer = new Float32Array(3 * plane)
  const out = g_input_buffer

  // RGBA(HWC) → RGB(CHW) + ImageNet 정규화. 알파 채널은 무시.
  for (let i = 0; i < plane; i++) {
    const r = img[i * 4] / 255
    const g = img[i * 4 + 1] / 255
    const b = img[i * 4 + 2] / 255
    out[i] = (r - MEAN_R) / STD_R
    out[plane + i] = (g - MEAN_G) / STD_G
    out[plane * 2 + i] = (b - MEAN_B) / STD_B
  }
  return out
}

/**
 * 비디오 프레임의 bbox 영역에 대해 head pose 를 추론한다. bbox 는 호출자가 직접 전달
 * (compute_center_square_bbox 또는 compute_bbox_from_landmarks 결과 등).
 * @param {HTMLVideoElement} video
 * @param {BBoxNorm} bbox
 * @returns {Promise<PosePrediction>}
 */
export async function predict_pose(video, bbox) {
  const session = await get_session()
  const input_data = preprocess(video, bbox)
  const tensor = new ort.Tensor('float32', input_data, [1, 3, INPUT_SIZE, INPUT_SIZE])

  const t0 = performance.now()
  const output = await session.run({ [INPUT_NAME]: tensor })
  const latency_ms = performance.now() - t0

  // output[OUTPUT_NAME].data 는 length 9 Float32Array (batch=1). 호출 간 재사용되지 않으므로 그대로 반환.
  return {
    rotation_matrix: /** @type {Float32Array} */ (output[OUTPUT_NAME].data),
    latency_ms,
  }
}

/**
 * 세션과 캐시 버퍼를 정리한다. 통상은 호출하지 않으며(모델 ~94MB 재다운로드 비용),
 * 페이지를 완전히 떠나거나 메모리 압박이 클 때만 사용.
 * @returns {Promise<void>}
 */
export async function dispose_session() {
  if (g_session_promise) {
    const s = await g_session_promise
    await s.release()
    g_session_promise = null
  }
  g_crop_canvas = null
  g_input_buffer = null
}
