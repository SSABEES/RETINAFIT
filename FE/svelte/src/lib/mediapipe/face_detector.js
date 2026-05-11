/**
 * MediaPipe Face Detector 래퍼.
 *
 * BlazeFace 모델로 얼굴 bbox + 6 keypoint(우안, 좌안, 코끝, 입, 우 이주점, 좌 이주점) 추출.
 * 정적 이미지(IMAGE 모드) 만 사용 — 캡쳐 완료 후 분석에만 호출.
 *
 * lazy 싱글톤 패턴은 face_landmarker.js 의 image landmarker 와 동일.
 *
 * @typedef {import("@mediapipe/tasks-vision").FaceDetector} FaceDetector
 * @typedef {import("@mediapipe/tasks-vision").FaceDetectorResult} FaceDetectorResult
 * @typedef {import("./face_types.js").FaceDetectorKeypoints} FaceDetectorKeypoints
 */

import { FaceDetector as MpFaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { BBOX_PADDING } from '@/lib/sixdrepnet360/inference.js'

// face_landmarker.js 와 동일하게 same-origin 자체 호스팅. 자세한 배경은 그쪽 주석 참조.
const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/models/blaze_face_short_range.tflite`
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`

// VIDEO 모드 detect 결과 캐싱 (16ms 윈도우) — 같은 frame 안에서 중복 호출 시 재계산 방지.
const VIDEO_CACHE_TTL_MS = 16
/** @type {FaceDetectorResult | null} */
let g_video_cache = null
let g_video_cache_ts = -1

/** @type {Promise<FaceDetector> | null} */
let g_image_detector_promise = null
/** @type {Promise<FaceDetector> | null} */
let g_video_detector_promise = null

// MediaPipe Vision Fileset 로더 — face_landmarker.js 와 별개로 메모이즈.
// (FilesetResolver.forVisionTasks 는 내부 캐싱이 있어 같은 base URL 두 번 호출해도 부담 없음)
async function load_image_detector() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return MpFaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5,
  })
}

async function load_video_detector() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return MpFaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  })
}

/**
 * IMAGE 모드 FaceDetector 를 lazy 로딩해 반환한다.
 * @returns {Promise<FaceDetector>}
 */
export function get_image_detector() {
  if (!g_image_detector_promise) g_image_detector_promise = load_image_detector()
  return g_image_detector_promise
}

/**
 * VIDEO 모드 FaceDetector 를 lazy 로딩해 반환한다. 측면 각도에 강한 BlazeFace 백본 — 정면용
 * FaceLandmarker 가 검출 못 하는 yaw 60° 이상에서도 face bbox 를 잡아 6DRepNet360 의 face crop
 * 입력으로 사용한다.
 * @returns {Promise<FaceDetector>}
 */
export function get_video_detector() {
  if (!g_video_detector_promise) g_video_detector_promise = load_video_detector()
  return g_video_detector_promise
}

/**
 * VIDEO 모드 FaceDetector 로 실시간 frame 검출. 16ms 윈도우 내 중복 호출은 캐시 반환 — 같은
 * rAF tick 안에서 여러 호출자가 안전하게 공유.
 * @param {FaceDetector} detector
 * @param {HTMLVideoElement} video
 * @returns {FaceDetectorResult | null}
 */
export function detect_face_from_video(detector, video) {
  if (!video || video.readyState < 2) return null
  const now = performance.now()
  if (g_video_cache !== null && now - g_video_cache_ts < VIDEO_CACHE_TTL_MS) return g_video_cache
  g_video_cache = detector.detectForVideo(video, now)
  g_video_cache_ts = now
  return g_video_cache
}

/**
 * VIDEO 모드 검출 결과 캐시를 비운다. 카메라 정지/재시작 시 호출.
 */
export function clear_video_detector_cache() {
  g_video_cache = null
  g_video_cache_ts = -1
}

/**
 * BlazeFace 검출 결과의 boundingBox(픽셀) 를 6DRepNet360 입력용 정사각형 정규화 bbox 로 변환.
 * 이마/턱 손실 방지용 BBOX_PADDING 적용 — compute_bbox_from_landmarks 와 같은 알고리즘.
 * @param {FaceDetectorResult} result
 * @param {number} video_w
 * @param {number} video_h
 * @returns {import('@/lib/sixdrepnet360/inference.js').BBoxNorm | null}
 */
export function compute_bbox_from_detection(result, video_w, video_h) {
  if (!result?.detections?.length) return null
  const bb = result.detections[0].boundingBox
  if (!bb || !video_w || !video_h) return null
  const min_x = bb.originX / video_w
  const min_y = bb.originY / video_h
  const max_x = (bb.originX + bb.width) / video_w
  const max_y = (bb.originY + bb.height) / video_h
  const cx = (min_x + max_x) / 2
  const cy = (min_y + max_y) / 2
  const raw_size = Math.max(max_x - min_x, max_y - min_y)
  const size = Math.min(1, raw_size * (1 + BBOX_PADDING * 2))
  const half = size / 2
  const x = Math.max(0, Math.min(1 - size, cx - half))
  const y = Math.max(0, Math.min(1 - size, cy - half))
  return { x, y, w: size, h: size }
}

/**
 * 단일 이미지에서 얼굴 6 keypoint 를 추출한다. 검출 실패 시 null.
 *
 * BlazeFace keypoint 인덱스 순서 (모델 표준):
 *   [0] right_eye, [1] left_eye, [2] nose_tip, [3] mouth,
 *   [4] right_ear_tragion, [5] left_ear_tragion
 *
 * @param {HTMLImageElement | ImageBitmap | HTMLCanvasElement} img
 * @returns {Promise<FaceDetectorKeypoints | null>}
 */
export async function detect_keypoints_from_image(img) {
  try {
    const detector = await get_image_detector()
    const result = detector.detect(img)
    if (!result.detections || result.detections.length === 0) {
      console.warn('[face_detector] no faces detected in image')
      return null
    }
    const kp = result.detections[0].keypoints
    if (!kp || kp.length < 6) {
      console.warn('[face_detector] insufficient keypoints', kp?.length)
      return null
    }
    return {
      right_eye: { x: kp[0].x, y: kp[0].y },
      left_eye: { x: kp[1].x, y: kp[1].y },
      nose_tip: { x: kp[2].x, y: kp[2].y },
      mouth: { x: kp[3].x, y: kp[3].y },
      right_ear_tragion: { x: kp[4].x, y: kp[4].y },
      left_ear_tragion: { x: kp[5].x, y: kp[5].y },
    }
  } catch (err) {
    console.warn('[face_detector] detect failed', err)
    return null
  }
}

/**
 * 로드된 FaceDetector 인스턴스를 정리한다.
 * face_landmarker.js 의 dispose_landmarker 와 마찬가지로 통상은 호출하지 않는다.
 *
 * @returns {Promise<void>}
 */
export async function dispose_detector() {
  if (g_image_detector_promise) {
    const d = await g_image_detector_promise
    d.close()
    g_image_detector_promise = null
  }
}
