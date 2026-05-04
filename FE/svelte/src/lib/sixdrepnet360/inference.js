/**
 * 6DRepNet360 ONNX 모델을 onnxruntime-web 으로 추론하는 래퍼.
 *
 * 모델 자산은 PyTorch 체크포인트를 AI/scripts/export_6drepnet360_onnx.py 로 1회 변환해 만든
 * public/models/sixdrepnet360/*.onnx 를 same-origin 으로 호스팅.
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
 * # 모델 variant
 * AI/scripts/quantize_6drepnet360_onnx.py 가 산출한 INT8 양자화 결과 두 종 + 원본 FP32 를 토글로
 * 비교 가능. set_active_variant() 로 활성 variant 변경 → 다음 get_session()/predict_pose() 부터
 * 새 variant 사용. variant 별 세션은 lazy 로드 + 캐시 (재토글 시 재다운로드 없음).
 * 자세한 비교는 docs/sixdrepnet360_quantization.md 참조.
 *
 * @typedef {import("onnxruntime-web").InferenceSession} InferenceSession
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 *
 * @typedef {'fp32' | 'dynamic' | 'static'} ModelVariant
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
 * @property {ModelVariant} variant  추론에 사용된 모델 variant
 */

import * as ort from 'onnxruntime-web'

// wasmPaths 를 명시 설정하지 않으면 onnxruntime-web 은 자신을 import 한 모듈의 import.meta.url
// 기준으로 워커/.wasm 을 자동 해석한다. Vite 는 이 dynamic import 를 `?url` 자산으로 처리해
// dist/assets/ 에 올바르게 emit 한다 — public/ 에서 직접 서빙하면 dev 모드에서 Vite 가 `?import`
// 쿼리를 붙여 module 트랜스폼을 시도하다 깨지는 문제를 피할 수 있다.
//
// 핵심 전제: vite.config.js 의 optimizeDeps.exclude 에 'onnxruntime-web' 가 포함되어 있어
// esbuild pre-bundle 단계에서 onnxruntime-web 의 dynamic import 가 변형되지 않는다.

// proxy 워커 활성화: 모든 세션 작업 (다운로드 / WASM 컴파일 / 추론) 을 전용 Web Worker 에서 실행해
// 메인 스레드 freeze 를 제거한다. 카메라 video, MediaPipe 검출, canvas rAF 가 추론 중에도 안 끊김.
// 호출자 (predict_pose / get_session / warm_session_from_bytes) 코드는 그대로 — ort 가 내부에서 메시지 패싱.
ort.env.wasm.proxy = true

// multi-threaded WASM 활성화 조건: SharedArrayBuffer 가 가용해야 하며, 그러려면 페이지가
// crossOriginIsolated 상태여야 한다 — vite.config.js 의 server.headers (COOP same-origin +
// COEP credentialless) 가 dev 에서 이 조건을 만든다. 프로덕션은 정적 호스트에서 동일 헤더를
// 직접 설정해야 함. 헤더가 없으면 crossOriginIsolated === false → 자동 단일 스레드 폴백.
//
// 스레드 수 cap = 4: 모바일 디바이스의 효율 코어까지 풀로 돌리면 thread coordination 비용 +
// thermal throttling 으로 오히려 latency 가 늘기 쉽다. 6DRepNet360 정도 모델은 4 스레드가
// 보편적 sweet spot — 더 키워야 할 이유가 생기면 측정 후 조정.
if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
  ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency ?? 4, 4)
}

// variant → 파일명. AI/scripts/quantize_6drepnet360_onnx.py 의 산출 파일명과 일치.
const VARIANT_FILES_OBJ = {
  fp32: '6drepnet360.onnx',
  dynamic: '6drepnet360.int8.dynamic.onnx',
  static: '6drepnet360.int8.static.onnx',
}

/** @type {ModelVariant[]} */
export const MODEL_VARIANT_ARR = ['fp32', 'dynamic', 'static']

// variant 별 사이즈 — UI 표시용 (자가 메타: 양자화 결과는 ~24MB, FP32 는 94MB).
export const VARIANT_LABEL_OBJ = {
  fp32: 'FP32 · 94MB',
  dynamic: 'INT8 dynamic · 24MB',
  static: 'INT8 static · 24MB',
}

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

// variant 별 세션 promise 캐시. 한 번 로드된 variant 는 dispose_session 전까지 재사용.
// 토글로 variant 를 왔다갔다해도 모델을 다시 다운로드하지 않는다.
/** @type {Map<ModelVariant, Promise<InferenceSession>>} */
const g_session_promises_obj = new Map()

/** @type {ModelVariant} */
let g_active_variant = 'fp32'

/** @type {OffscreenCanvas | HTMLCanvasElement | null} */
let g_crop_canvas = null

// variant 별 모델 파일 URL 빌드. base URL 은 vite 의 BASE_URL 을 따라가므로 sub-path 배포 호환.
function model_url_for(variant) {
  return `${import.meta.env.BASE_URL}models/sixdrepnet360/${VARIANT_FILES_OBJ[variant]}`
}

// ONNX 세션 생성 옵션. WASM 백엔드 우선 — WebGPU 는 가용 디바이스가 제한적이라 후순위.
const SESSION_OPTIONS_OBJ = {
  executionProviders: ['wasm'],
  graphOptimizationLevel: 'all',
}

// URL 경로로 세션 생성 — ort 내부에서 fetch 후 컴파일. lazy fallback 용 (스플래시 미경유 / skip 시).
async function load_session(variant) {
  return ort.InferenceSession.create(model_url_for(variant), SESSION_OPTIONS_OBJ)
}

// 외부에서 받아둔 바이트로 직접 세션 생성 — fetch 단계 생략.
async function load_session_from_bytes(bytes) {
  return ort.InferenceSession.create(bytes, SESSION_OPTIONS_OBJ)
}

/**
 * 활성 variant 변경. 다음 get_session()/predict_pose() 호출부터 새 variant 사용. 동기 호출이라
 * 세션 로드는 트리거하지 않음 — 호출자가 get_session() 으로 명시 preload 권장.
 * @param {ModelVariant} variant
 */
export function set_active_variant(variant) {
  if (!(variant in VARIANT_FILES_OBJ)) {
    throw new Error(`unknown variant: ${variant}`)
  }
  g_active_variant = variant
}

/** @returns {ModelVariant} */
export function get_active_variant() {
  return g_active_variant
}

/**
 * 활성 variant 의 ONNX InferenceSession 을 lazy 로딩해 반환. 첫 호출이 모델 다운로드 + WASM
 * 컴파일을 트리거. 같은 variant 재호출 시 캐시 반환.
 * @returns {Promise<InferenceSession>}
 */
export function get_session() {
  const variant = g_active_variant
  let p = g_session_promises_obj.get(variant)
  if (!p) {
    p = load_session(variant)
    g_session_promises_obj.set(variant, p)
  }
  return p
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
 * 매 호출 새 Float32Array 를 할당해 반환한다 — proxy 워커 모드의 ort 가 입력 텐서 ArrayBuffer 를
 * postMessage transferable 로 보낼 가능성이 있어, 모듈 레벨 버퍼 재사용 시 detach 위험. 600KB ×
 * 실효 ~3Hz = ~1.8MB/s GC 압박은 무시 가능 수준이라 안전 우선.
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
  const out = new Float32Array(3 * plane)

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
 * (compute_center_square_bbox 또는 compute_bbox_from_landmarks 결과 등). 활성 variant 의
 * 세션을 사용 — variant 별 latency 비교를 위해 결과에 variant 도 포함해 반환.
 * @param {HTMLVideoElement} video
 * @param {BBoxNorm} bbox
 * @returns {Promise<PosePrediction>}
 */
export async function predict_pose(video, bbox) {
  // 추론 시작 시점의 variant 를 고정 — 추론 도중 변경되어도 결과는 시작 variant 로 라벨.
  const variant_at_call = g_active_variant
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
    variant: variant_at_call,
  }
}

/**
 * 외부에서 미리 다운로드한 .onnx 바이트로 InferenceSession 을 만들어 캐시에 등록한다. get_session()
 * 의 URL fetch 경로와 달리 ort 가 다시 다운로드하지 않으므로 같은 모델을 두 번 받지 않는다.
 *
 * 호출 지점: SplashScreen — preload_sixdrepnet_model() 로 받은 bytes 를 그대로 전달. 컴파일과
 * 텐서 메모리 할당까지 끝낸 뒤 onready 를 쏘므로 첫 추론에서 컴파일 대기 0초.
 *
 * 같은 variant 캐시가 이미 있으면 그것을 반환 (재컴파일 없음). 컴파일 실패 시 캐시 엔트리를 제거해
 * 다음 get_session() 이 URL 경로로 재시도 가능.
 *
 * Trade-off: WASM 세션은 모델 + 작업 메모리로 ~150–200MB 를 즉시 점유 (fp32 기준).
 *
 * @param {ModelVariant} variant
 * @param {Uint8Array} bytes
 * @returns {Promise<InferenceSession>}
 */
export function warm_session_from_bytes(variant, bytes) {
  let p = g_session_promises_obj.get(variant)
  if (!p) {
    p = load_session_from_bytes(bytes).catch((err) => {
      g_session_promises_obj.delete(variant)
      throw err
    })
    g_session_promises_obj.set(variant, p)
  }
  return p
}

/**
 * 모든 variant 의 세션과 캐시 버퍼를 정리한다. 통상은 호출하지 않으며(모델 재다운로드 비용),
 * 페이지를 완전히 떠나거나 메모리 압박이 클 때만 사용.
 * @returns {Promise<void>}
 */
export async function dispose_session() {
  for (const p of g_session_promises_obj.values()) {
    try {
      const s = await p
      await s.release()
    } catch {
      // release 실패는 이미 깨진 세션 — 다음 단계로 진행
    }
  }
  g_session_promises_obj.clear()
  g_crop_canvas = null
}
