/**
 * OH (Optical Height) 추정기 — 메인 스레드 인터페이스.
 *
 * 실제 OpenCV 분석은 worker (public/opencv/oh_worker.js) 에서 수행. 메인 스레드는
 *   1) 워커 생성 + opencv.js url 전달해서 init
 *   2) 매 분석 요청마다 video → createImageBitmap → 워커로 transfer
 *   3) 결과 메시지 수신
 * 만 담당하므로 UI 가 프리징되지 않는다.
 *
 * @typedef {{ x: number, y: number }} Point2D
 * @typedef {{ x1: number, y1: number, x2: number, y2: number }} LineSegment
 * @typedef {'hough' | 'reduce' | 'none'} SelectionMethod
 * @typedef {object} OHResult
 * @property {number | null} oh_px_right
 * @property {number | null} oh_px_left
 * @property {number | null} frame_bottom_y_right
 * @property {number | null} frame_bottom_y_left
 * @property {number | null} search_floor_y_right    아랫눈꺼풀 + buffer — 이 y 아래부터만 edge 검색
 * @property {number | null} search_floor_y_left
 * @property {{ x: number, y: number, w: number, h: number } | null} roi_right
 * @property {{ x: number, y: number, w: number, h: number } | null} roi_left
 * @property {number} confidence_right
 * @property {number} confidence_left
 * @property {LineSegment[]} detected_lines_right   HoughLinesP 가 후보로 통과시킨 수평선들 (캔버스 좌표)
 * @property {LineSegment[]} detected_lines_left
 * @property {SelectionMethod} selection_method_right  'hough' = HoughLinesP 채택, 'reduce' = fallback, 'none' = 검출 실패
 * @property {SelectionMethod} selection_method_left
 */

const WORKER_URL = `${import.meta.env.BASE_URL}opencv/oh_worker.js`
const OPENCV_URL = `${import.meta.env.BASE_URL}opencv/opencv.js`

/** @type {Worker | null} */
let g_worker = null
/** @type {Promise<void> | null} */
let g_init_promise = null
let g_request_seq = 0
/** @type {Map<number, { resolve: (r: OHResult) => void, reject: (e: Error) => void }>} */
const g_pending = new Map()

// 워커가 준비됐는지 (opencv WASM init 완료) 확인. UI 가 "로딩 중…" 표시에 사용.
// 같은 페이지에서 여러 번 호출해도 단일 워커 + 단일 init Promise 를 공유.
export function ensure_opencv_ready() {
  if (g_init_promise) return g_init_promise
  g_init_promise = new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { type: 'classic', name: 'oh-opencv' })
    g_worker = worker

    worker.onmessage = (e) => {
      const data = e.data
      if (data.type === 'init_done') {
        resolve()
        return
      }
      if (data.type === 'analyze_done') {
        const pending = g_pending.get(data.request_id)
        if (pending) {
          g_pending.delete(data.request_id)
          pending.resolve(data.result)
        }
        return
      }
      if (data.type === 'error') {
        if (data.request_id !== undefined && g_pending.has(data.request_id)) {
          const pending = g_pending.get(data.request_id)
          g_pending.delete(data.request_id)
          pending?.reject(new Error(data.message))
        } else {
          reject(new Error(data.message))
        }
        return
      }
    }
    worker.onerror = (e) => {
      reject(new Error(`OH worker error: ${e.message ?? 'unknown'}`))
    }

    worker.postMessage({ type: 'init', opencv_url: OPENCV_URL })
  })
  return g_init_promise
}

/**
 * 비디오 프레임 + 동공 좌표 + 아랫눈꺼풀 y 를 워커로 보내 OH 를 측정한다.
 * createImageBitmap 으로 frame 을 transferable 로 만들어 zero-copy 이전.
 *
 * @param {object} args
 * @param {Point2D} args.pupil_right            우측 동공 픽셀 좌표 (source_el native 픽셀 기준)
 * @param {Point2D} args.pupil_left             좌측 동공 픽셀 좌표
 * @param {number | null} args.lower_lid_y_right MediaPipe 우측 아랫눈꺼풀 contour 의 max y. null 이면 동공 기준 fallback
 * @param {number | null} args.lower_lid_y_left  좌측 동일
 * @param {HTMLVideoElement | HTMLCanvasElement | ImageBitmap} args.source_el
 * @param {number} args.source_width
 * @param {number} args.source_height
 * @returns {Promise<OHResult>}
 */
export async function estimate_oh({
  pupil_right,
  pupil_left,
  lower_lid_y_right = null,
  lower_lid_y_left = null,
  source_el,
  source_width,
  source_height,
}) {
  await ensure_opencv_ready()
  const worker = g_worker
  if (!worker) throw new Error('OH worker 가 초기화되지 않았습니다.')

  const image_bitmap = await createImageBitmap(source_el)
  const request_id = ++g_request_seq

  return new Promise((resolve, reject) => {
    g_pending.set(request_id, { resolve, reject })
    worker.postMessage(
      {
        type: 'analyze',
        request_id,
        pupil_right,
        pupil_left,
        lower_lid_y_right,
        lower_lid_y_left,
        image_bitmap,
        source_width,
        source_height,
      },
      [image_bitmap],
    )
  })
}

/**
 * 워커를 종료하고 모든 pending request 를 정리한다. 페이지 언마운트 시 호출 권장.
 */
export function dispose_oh_worker() {
  if (g_worker) {
    g_worker.terminate()
    g_worker = null
  }
  g_init_promise = null
  for (const pending of g_pending.values()) {
    pending.reject(new Error('OH worker disposed'))
  }
  g_pending.clear()
}
