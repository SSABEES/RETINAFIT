/**
 * 캡처 blob 으로부터 ArUco 마커를 검출해 (marker, intrinsics) 쌍을 만든다.
 * capture_session 의 add_capture 가 모든 단계에서 호출 — 검출 실패 시 marker=null.
 *
 * @typedef {import('./aruco_detector.js').DetectedMarker} DetectedMarker
 * @typedef {import('./camera_intrinsics.js').CameraIntrinsics} CameraIntrinsics
 */

import { detect_markers } from './aruco_detector.js'
import { load_default_intrinsics, scale_intrinsics_to_image } from './camera_intrinsics.js'

// 사용자가 인쇄하는 ArUco 마커 한 변 길이 (mm). POSIT 깊이 산출의 기준값이라 실측과 정확히 일치해야
// 한다. 인쇄 사이즈를 바꾼다면 이 상수도 함께 바꿀 것.
export const MARKER_SIZE_MM = 30

/**
 * blob → ImageData 변환. createImageBitmap 의 결과를 같은 사이즈 캔버스에 그리고 RGBA 픽셀을 추출.
 * iOS WebView 메모리 절약을 위해 끝나면 bitmap close + 캔버스 0×0 으로 축소.
 *
 * @param {Blob} blob
 * @param {number} width
 * @param {number} height
 * @returns {Promise<ImageData>}
 */
async function blob_to_image_data(blob, width, height) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('failed to get 2d context')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height)
  bitmap.close?.()
  canvas.width = 0
  canvas.height = 0
  return data
}

/**
 * 캡처 한 장에서 첫 번째 ArUco 마커를 검출해 반환한다.
 * 실패 (마커 없음/intrinsics 로드 실패/픽셀 추출 실패) 시 null — 호출자가 PD fallback 으로 넘기도록.
 *
 * @param {{ blob: Blob, width: number, height: number }} capture
 * @returns {Promise<{ marker: DetectedMarker, intrinsics: CameraIntrinsics } | null>}
 */
export async function detect_marker_for_capture(capture) {
  let intrinsics
  try {
    const base = await load_default_intrinsics()
    intrinsics = scale_intrinsics_to_image(base, capture.width, capture.height)
  } catch (err) {
    console.warn(
      '[ArUco] 카메라 캘리브레이션 파일 로드 실패 — public/camera/*.json 경로 확인 필요. 이 캡처는 마커 검출 skip:',
      err,
    )
    return null
  }

  let image_data
  try {
    image_data = await blob_to_image_data(capture.blob, capture.width, capture.height)
  } catch (err) {
    console.warn(
      '[ArUco] 사진 데이터를 픽셀로 변환하는 데 실패 — 캔버스 컨텍스트 또는 이미지 디코딩 오류. 이 캡처는 마커 검출 skip:',
      err,
    )
    return null
  }

  let markers_arr
  try {
    markers_arr = detect_markers(image_data, intrinsics, MARKER_SIZE_MM)
  } catch (err) {
    console.warn(
      '[ArUco] 검출 라이브러리(js-aruco2) 가 예외 발생. 이 캡처는 마커 검출 skip:',
      err,
    )
    return null
  }

  const marker = markers_arr[0]
  if (!marker) return null
  return { marker, intrinsics }
}
