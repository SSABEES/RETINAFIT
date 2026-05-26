/**
 * /test 디버그 오버레이. 별도 2D canvas 에 face landmark + bbox 를 그린다.
 * three.js 안경 axes 시각화는 three_scene 의 AxesHelper.visible 토글로 처리.
 */

const POINT_COLOR = 'rgba(0, 230, 118, 0.85)'
const BBOX_COLOR = 'rgba(255, 210, 80, 0.9)'

// 비디오 해상도와 디버그 캔버스의 backing buffer 를 일치시킨다.
/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLVideoElement} video
 */
export function sync_canvas_size(canvas, video) {
  if (video.videoWidth === 0) return
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
}

// 얼굴 landmarks 와 bbox 를 디버그 캔버스에 그린다 — sync_canvas_size 후에 호출.
/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{x:number,y:number}> | null | undefined} landmarks
 * @param {{x:number,y:number,w:number,h:number} | null} bbox
 */
export function draw_debug(canvas, landmarks, bbox) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  if (bbox) {
    ctx.strokeStyle = BBOX_COLOR
    ctx.lineWidth = 2
    ctx.strokeRect(bbox.x * w, bbox.y * h, bbox.w * w, bbox.h * h)
  }

  if (landmarks?.length) {
    ctx.fillStyle = POINT_COLOR
    for (const p of landmarks) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// 디버그 토글 OFF 시 잔상 제거용 캔버스 클리어.
/**
 * @param {HTMLCanvasElement} canvas
 */
export function clear_debug(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}
