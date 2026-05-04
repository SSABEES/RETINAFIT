/**
 * 비디오 프레임을 Blob 으로 변환하는 헬퍼.
 */

// 모든 캡처를 동일 dimension 으로 정규화하기 위한 고정 사이즈. 카메라 stream 의 실제 resolution
// 이 단계마다 살짝 다르게 보고되는 케이스 (브라우저/디바이스/타이밍 차이) 를 방어하고, 결과 페이지의
// MeasureCanvas 가 모든 단계에서 같은 aspect 로 표시되도록 강제. on_start_camera 의 ideal 요청
// (480×640) 과 일치 — 정상 케이스에선 1:1 복사, 다른 aspect 면 center-crop.
const NORMALIZED_W = 480
const NORMALIZED_H = 640

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
