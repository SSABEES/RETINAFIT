/**
 * 비디오 프레임을 Blob 으로 변환하는 헬퍼.
 */

// 모든 캡처를 동일 dimension 으로 정규화하기 위한 고정 사이즈. 카메라 stream 의 실제 resolution
// 이 단계마다 살짝 다르게 보고되는 케이스 (브라우저/디바이스/타이밍 차이) 를 방어하고, 결과 페이지의
// MeasureCanvas 가 모든 단계에서 같은 aspect 로 표시되도록 강제.
// 카메라 stream 은 화면 fill 을 위해 가로형(예: 1280×720) 으로 받지만, 캡처는 항상 가운데 3:4
// 영역만 잘라 480×640 으로 정규화. 분석/측정/저장 좌표계는 모두 이 480×640 을 기준으로 통일.
const NORMALIZED_W = 480
const NORMALIZED_H = 640
const NORMALIZED_ASPECT = NORMALIZED_W / NORMALIZED_H

/**
 * 비디오 프레임에서 가운데 3:4 영역의 픽셀 좌표를 반환한다. video_to_blob 의 center-crop 와 동일.
 * @param {number} video_w
 * @param {number} video_h
 */
export function get_center_crop_box(video_w, video_h) {
  const src_aspect = video_w / video_h
  let crop_x = 0
  let crop_y = 0
  let crop_w = video_w
  let crop_h = video_h
  if (src_aspect > NORMALIZED_ASPECT) {
    crop_w = video_h * NORMALIZED_ASPECT
    crop_x = (video_w - crop_w) / 2
  } else if (src_aspect < NORMALIZED_ASPECT) {
    crop_h = video_w / NORMALIZED_ASPECT
    crop_y = (video_h - crop_h) / 2
  }
  return { crop_x, crop_y, crop_w, crop_h, video_w, video_h }
}

/**
 * MediaPipe NormalizedLandmark 배열을 비디오 전체 프레임 좌표계 → 가운데 3:4 crop 좌표계로 변환.
 * remap 후 좌표 [0,1] 범위는 crop 영역 기준 — NORMALIZED_W/H 와 곱하면 캡처 픽셀과 일치.
 * @param {ReadonlyArray<{ x: number, y: number, z?: number, visibility?: number }>} landmarks
 * @param {ReturnType<typeof get_center_crop_box>} crop
 */
export function remap_landmarks_to_crop(landmarks, crop) {
  const { crop_x, crop_y, crop_w, crop_h, video_w, video_h } = crop
  if (crop_w === video_w && crop_h === video_h) return landmarks
  return landmarks.map((lm) => ({
    ...lm,
    x: (lm.x * video_w - crop_x) / crop_w,
    y: (lm.y * video_h - crop_y) / crop_h,
  }))
}

/**
 * 현재 재생 중인 <video> 의 프레임을 480×640 JPEG Blob 으로 변환한다. 단계별 캡처 dimension
 * 일관성 보장을 위해 항상 고정 사이즈 출력. src aspect 가 다르면 center-crop 으로 3:4 영역을
 * 잘라낸 뒤 리사이즈. 품질 기본 0.92.
 * @param {HTMLVideoElement} video
 * @param {number} [quality=0.92]
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function video_to_blob(video, quality = 0.92) {
  const sw = video.videoWidth
  const sh = video.videoHeight
  if (!sw || !sh) {
    throw new Error('video has no frame data yet')
  }

  const target_aspect = NORMALIZED_W / NORMALIZED_H
  const src_aspect = sw / sh
  let crop_x = 0
  let crop_y = 0
  let crop_w = sw
  let crop_h = sh
  if (src_aspect > target_aspect) {
    // src 가 더 넓음 (가로형) — 좌우 자름
    crop_w = sh * target_aspect
    crop_x = (sw - crop_w) / 2
  } else if (src_aspect < target_aspect) {
    // src 가 더 좁음 (세로형) — 상하 자름
    crop_h = sw / target_aspect
    crop_y = (sh - crop_h) / 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = NORMALIZED_W
  canvas.height = NORMALIZED_H
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('failed to get 2d context')
  }
  ctx.drawImage(video, crop_x, crop_y, crop_w, crop_h, 0, 0, NORMALIZED_W, NORMALIZED_H)
  /** @type {Blob} */
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('canvas.toBlob returned null'))
      },
      'image/jpeg',
      quality,
    )
  })
  return { blob, width: NORMALIZED_W, height: NORMALIZED_H }
}

/**
 * Blob 을 좌우 반전(미러) 한 새 Blob 으로 변환한다.
 * 카메라 프리뷰는 transform: scaleX(-1) 로 미러 표시되지만 원본 캡쳐는 비반전 상태이므로,
 * S3 업로드 같은 "최종 산출" 단계에서만 호출해 사용자에게 보이던 모습 그대로 저장한다.
 * (캡쳐 시점 분석이 이미 비반전 좌표계에 의존하므로, 분석용 원본 blob 은 바꾸지 않는다.)
 *
 * @param {Blob} blob
 * @param {number} [quality=0.92]
 * @returns {Promise<Blob>}
 */
export async function flip_blob_horizontally(blob, quality = 0.92) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('failed to get 2d context')
  }
  ctx.translate(bitmap.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close?.()
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('canvas.toBlob returned null'))
      },
      blob.type || 'image/jpeg',
      quality,
    )
  })
}
