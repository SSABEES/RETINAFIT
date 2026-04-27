/**
 * 측정 좌표/오버레이 표시용 유틸.
 * report.svelte 의 사진 위에 측정선을 % 기준 좌표로 그릴 때 사용.
 *
 * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
 *
 * @typedef {object} OverlayLine
 * @property {'line'} type
 * @property {number} x1   % 단위 (0~100)
 * @property {number} y1
 * @property {number} x2
 * @property {number} y2
 */

/**
 * 픽셀 좌표 두 점을 이미지 크기 기준 % 좌표로 변환해 line 오버레이 객체로 반환한다.
 * 이미지 크기가 0 이거나 좌표가 없으면 null.
 *
 * @param {[Point2D, Point2D] | null} points_px
 * @param {number} image_width
 * @param {number} image_height
 * @returns {OverlayLine | null}
 */
export function points_to_overlay_line(points_px, image_width, image_height) {
  if (!points_px || image_width <= 0 || image_height <= 0) return null
  const [p1, p2] = points_px
  return {
    type: 'line',
    x1: (p1.x / image_width) * 100,
    y1: (p1.y / image_height) * 100,
    x2: (p2.x / image_width) * 100,
    y2: (p2.y / image_height) * 100,
  }
}
