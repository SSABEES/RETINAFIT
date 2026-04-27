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
