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

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite'
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'

/** @type {Promise<FaceDetector> | null} */
let g_image_detector_promise = null

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

/**
 * IMAGE 모드 FaceDetector 를 lazy 로딩해 반환한다.
 * @returns {Promise<FaceDetector>}
 */
export function get_image_detector() {
  if (!g_image_detector_promise) g_image_detector_promise = load_image_detector()
  return g_image_detector_promise
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
