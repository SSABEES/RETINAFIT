/**
 * 비디오 프레임을 Blob 으로 변환하는 헬퍼.
 */

/**
 * 현재 재생 중인 <video> 의 프레임을 offscreen canvas 로 복사해 JPEG Blob 으로 변환한다.
 * 품질 기본 0.92 (Blob 크기와 화질의 일반적 타협점).
 * @param {HTMLVideoElement} video
 * @param {number} [quality=0.92]
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function video_to_blob(video, quality = 0.92) {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) {
    throw new Error('video has no frame data yet')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('failed to get 2d context')
  }
  ctx.drawImage(video, 0, 0, width, height)
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
  return { blob, width, height }
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
