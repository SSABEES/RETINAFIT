/* eslint-disable no-undef */
// OH 측정용 OpenCV.js classic Web Worker.
//
// 왜 worker 인가:
//   opencv.js 는 약 10MB 의 JS + WASM 번들. 메인 스레드에서 <script> 로 로드하면 파싱·컴파일·
//   WASM 인스턴스화 동안 UI 가 1~3초 프리징됨. 워커 스레드로 분리하면 메인 스레드는 자유롭게
//   카메라 프레임을 그리고, 워커는 자기 스레드에서 importScripts(opencv.js) → 분석을 수행.
//
// 왜 classic worker 인가:
//   opencv.js 는 ESM 이 아니라 self.cv 를 전역에 노출하는 UMD 스타일 스크립트.
//   classic worker 에서만 사용 가능한 importScripts() 동기 로더가 정석 경로.
//
// 메인 ↔ 워커 프로토콜:
//   메인 → 워커: { type:'init', opencv_url }   → 워커: { type:'init_done' }
//   메인 → 워커: { type:'analyze', request_id, pupil_right, pupil_left,
//                  lower_lid_y_right, lower_lid_y_left,
//                  image_bitmap, source_width, source_height }
//     image_bitmap 은 transferable 로 zero-copy 이전됨.
//     lower_lid_y_* : MediaPipe 아랫눈꺼풀 contour 의 max y (캔버스 좌표). 이 값 + buffer 아래부터
//                     edge 검색해 눈꺼풀 그림자 / 속눈썹 / 눈 소켓 음영을 안경 림으로 오인 방지.
//   워커 → 메인: { type:'analyze_done', request_id, result }  // result 는 OHResult 형태
//   워커 → 메인: { type:'error', request_id?, message }       // 모든 에러는 이 형태

const MIN_EDGE_INTENSITY = 200
const CANNY_LOW = 50
const CANNY_HIGH = 150
const BLUR_KSIZE = 3
const ROI_WIDTH_FACTOR = 0.55
// 0.85 × 1.3 = 1.105. 큰 안경테 / 낮게 걸침 케이스에서 림 하단이 ROI 세로 밖으로
// 빠지는 것을 막는다. ROI 천장(잡을 수 있는 OH/PD 비율) = HEIGHT_FACTOR × (1 - PUPIL_TOP_FACTOR)
// = 1.105 × 0.65 ≈ 0.72. 단 OH_PD_RATIO_MAX = 0.55 sanity 가 별도로 천장 역할.
const ROI_HEIGHT_FACTOR = 1.105
const ROI_PUPIL_TOP_FACTOR = 0.35
// search anchor (lid + iris contour 중 max y) 아래로 추가로 비워둘 여유 (PD 비례).
// 속눈썹·근접 림 그림자 잔여물을 한 번 더 skip. 0.10*PD ≈ 6~8mm.
const LID_BUFFER_FACTOR = 0.1

// 가로 morphological closing 커널 폭 (px). 림의 미세하게 끊긴 edge 를 가로로 이어붙이고,
// 짧고 사선인 reflection / iris-arc / texture edge 의 행 합계 기여를 약화시킨다. 값이 클수록
// 짧은 edge 가 더 적극적으로 사라지지만, 너무 크면 가까운 두 edge (림 inner / outer) 가 한
// 덩어리로 뭉친다. iris diameter 가 ROI 폭의 ~30% 라 13 px 까지 키워야 iris arc 가 잘 부서짐.
const MORPH_CLOSE_KERNEL_WIDTH = 13

// HoughLinesP 파라미터.
//   THRESHOLD_FACTOR : ROI.w 의 이 비율만큼 누적 vote 가 모여야 line 채택 (수평 길이 비례)
//   MIN_LINE_FACTOR  : ROI.w 의 이 비율 이상 길이만 line 으로 인정.
//                      iris diameter / ROI_W ≈ 0.31. 림은 렌즈 폭만큼 길어 ROI_W 의 0.8~0.95.
//                      0.50 으로 두면 iris arc 는 절대 통과 불가, 림은 항상 통과.
//   MAX_LINE_GAP     : 한 line 안에서 허용되는 끊김 간격 (px)
//   MAX_ANGLE_DEG    : 0° (수평) 으로부터 허용 기울기. 림은 거의 정확한 수평.
const HOUGH_THRESHOLD_FACTOR = 0.25
const HOUGH_MIN_LINE_FACTOR = 0.5
const HOUGH_MAX_LINE_GAP = 8
const HOUGH_MAX_ANGLE_DEG = 15

// 안경 림 위치 사전 (PD 비례). 일반 성인 OH 약 15~25mm, PD 약 63mm 기준 OH/PD 비율 0.24~0.40.
// 보수적으로 0.10~0.55 (≈ 6mm ~ 35mm) 범위로 두고 이 밖 후보 line 은 모두 제외 → 광대뼈/이마뼈
// 그림자, 머리카락 끝 같은 멀리 떨어진 거짓 양성 차단.
const OH_PD_RATIO_MIN = 0.1
const OH_PD_RATIO_MAX = 0.55

let g_cv_ready_promise = null

self.onmessage = async (e) => {
  const data = e.data
  try {
    if (data.type === 'init') {
      if (!g_cv_ready_promise) g_cv_ready_promise = init_opencv(data.opencv_url)
      await g_cv_ready_promise
      self.postMessage({ type: 'init_done' })
      return
    }
    if (data.type === 'analyze') {
      if (!g_cv_ready_promise) throw new Error('opencv 가 init 되기 전에 analyze 요청')
      await g_cv_ready_promise
      const result = run_analyze(data)
      self.postMessage({ type: 'analyze_done', request_id: data.request_id, result })
      // imageBitmap 은 zero-copy 로 받았으므로 close() 로 백킹스토어 해제.
      if (data.image_bitmap && data.image_bitmap.close) data.image_bitmap.close()
      return
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      request_id: data?.request_id,
      message: err && err.message ? err.message : String(err),
    })
  }
}

// importScripts 로 opencv.js 를 워커 컨텍스트에 로드 + WASM 초기화 대기.
// onRuntimeInitialized 가 이미 발화된 후 콜백을 붙이면 호출이 안 오므로 cv.Mat 존재 여부로 분기.
function init_opencv(opencv_url) {
  importScripts(opencv_url)
  return new Promise((resolve, reject) => {
    const cv = self.cv
    if (!cv) {
      reject(new Error('opencv.js 로드 후 self.cv 가 없습니다.'))
      return
    }
    if (cv.Mat) {
      resolve()
      return
    }
    cv.onRuntimeInitialized = () => resolve()
  })
}

// 메인에서 전달된 ImageBitmap + 동공/아랫눈꺼풀 좌표로 좌/우 OH 추정.
function run_analyze({
  pupil_right,
  pupil_left,
  lower_lid_y_right,
  lower_lid_y_left,
  image_bitmap,
  source_width,
  source_height,
}) {
  const pd_px = Math.hypot(pupil_right.x - pupil_left.x, pupil_right.y - pupil_left.y)
  const work_canvas = new OffscreenCanvas(source_width, source_height)
  const work_ctx = work_canvas.getContext('2d', { willReadFrequently: true })
  work_ctx.drawImage(image_bitmap, 0, 0, source_width, source_height)

  const right_result = analyze_single_eye(self.cv, work_canvas, pupil_right, pd_px, lower_lid_y_right)
  const left_result = analyze_single_eye(self.cv, work_canvas, pupil_left, pd_px, lower_lid_y_left)

  return {
    oh_px_right: right_result.oh_px,
    oh_px_left: left_result.oh_px,
    frame_bottom_y_right: right_result.frame_bottom_y,
    frame_bottom_y_left: left_result.frame_bottom_y,
    search_floor_y_right: right_result.search_floor_y,
    search_floor_y_left: left_result.search_floor_y,
    roi_right: right_result.roi,
    roi_left: left_result.roi,
    confidence_right: right_result.confidence,
    confidence_left: left_result.confidence,
    detected_lines_right: right_result.detected_lines,
    detected_lines_left: left_result.detected_lines,
    selection_method_right: right_result.selection_method,
    selection_method_left: left_result.selection_method,
  }
}

// 한쪽 눈 ROI 를 잘라 안경 림 하단 y 를 추정한다.
//
// 파이프라인:
//   1) ROI grayscale → GaussianBlur → Canny (얇은 edge map)
//   2) 가로 MORPH_CLOSE — 림 끊김 연결 + 짧은 reflection edge 약화
//   3) HoughLinesP — 실제 수평 line segment 추출 (이게 핵심 — reduce 와 달리 line 의
//      "길이 / 각도 / 위치" 를 직접 다룬다)
//   4) 후보 line 필터: ±MAX_ANGLE_DEG 수평, search floor 아래, OH 비례 범위 내
//   5) 통과한 line 중 가장 긴 것을 림으로 채택 (반사는 짧고 림은 렌즈 폭만큼 길다)
//   6) 한 개도 못 찾으면 (Hough 가 너무 보수적) reduce 방식으로 fallback
//
// lower_lid_y: MediaPipe 아랫눈꺼풀 contour 의 max y (캔버스 좌표). 이 + LID_BUFFER 아래부터만
// 검색해 눈꺼풀 그림자·속눈썹·눈 소켓 음영을 림으로 오인하지 않게 한다.
function analyze_single_eye(cv, work_canvas, pupil, pd_px, lower_lid_y) {
  const empty_result = {
    oh_px: null,
    frame_bottom_y: null,
    search_floor_y: null,
    roi: null,
    confidence: 0,
    detected_lines: [],
    selection_method: 'none',
  }

  const roi_w = Math.round(pd_px * ROI_WIDTH_FACTOR)
  const roi_h = Math.round(pd_px * ROI_HEIGHT_FACTOR)
  if (roi_w < 10 || roi_h < 10) return empty_result

  const cw = work_canvas.width
  const ch = work_canvas.height
  let roi_x = Math.round(pupil.x - roi_w / 2)
  let roi_y = Math.round(pupil.y - roi_h * ROI_PUPIL_TOP_FACTOR)
  roi_x = Math.max(0, Math.min(cw - 1, roi_x))
  roi_y = Math.max(0, Math.min(ch - 1, roi_y))
  const clamped_w = Math.min(roi_w, cw - roi_x)
  const clamped_h = Math.min(roi_h, ch - roi_y)
  if (clamped_w < 10 || clamped_h < 10) return empty_result
  const roi = { x: roi_x, y: roi_y, w: clamped_w, h: clamped_h }

  // search floor — 아랫눈꺼풀 + buffer 와 동공 + 작은 buffer 중 큰 값.
  const lid_buffer_px = pd_px * LID_BUFFER_FACTOR
  const search_floor_y_canvas =
    typeof lower_lid_y === 'number'
      ? Math.max(lower_lid_y + lid_buffer_px, pupil.y + pd_px * 0.05)
      : pupil.y + pd_px * 0.05
  const search_start_in_roi = Math.max(0, Math.ceil(search_floor_y_canvas - roi.y))
  if (search_start_in_roi >= clamped_h - 2) {
    return { ...empty_result, roi, search_floor_y: search_floor_y_canvas }
  }

  // OH 비례 범위 → ROI 좌표 변환
  const min_oh_px = pd_px * OH_PD_RATIO_MIN
  const max_oh_px = pd_px * OH_PD_RATIO_MAX

  const work_ctx = work_canvas.getContext('2d')
  const image_data = work_ctx.getImageData(roi.x, roi.y, roi.w, roi.h)
  const src_mat = cv.matFromImageData(image_data)
  const gray_mat = new cv.Mat()
  const blur_mat = new cv.Mat()
  const edge_mat = new cv.Mat()
  const morph_kernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(MORPH_CLOSE_KERNEL_WIDTH, 1),
  )
  const lines_mat = new cv.Mat()
  const row_sum_mat = new cv.Mat()

  let oh_px = null
  let frame_bottom_y = null
  let confidence = 0
  /** @type {Array<{x1:number,y1:number,x2:number,y2:number}>} */
  const detected_lines = []
  let selection_method = 'none'

  try {
    cv.cvtColor(src_mat, gray_mat, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray_mat, blur_mat, new cv.Size(BLUR_KSIZE, BLUR_KSIZE), 0)
    cv.Canny(blur_mat, edge_mat, CANNY_LOW, CANNY_HIGH)
    // 가로 closing — 림 끊긴 부분 연결 + 짧고 사선인 reflection edge 약화
    cv.morphologyEx(edge_mat, edge_mat, cv.MORPH_CLOSE, morph_kernel)

    // HoughLinesP — 실제 수평 line segment 추출 (반사 vs 림 기하학적 구분의 핵심 단계)
    const hough_threshold = Math.max(15, Math.floor(roi.w * HOUGH_THRESHOLD_FACTOR))
    const min_line_length = Math.max(15, Math.floor(roi.w * HOUGH_MIN_LINE_FACTOR))
    cv.HoughLinesP(
      edge_mat,
      lines_mat,
      1,
      Math.PI / 180,
      hough_threshold,
      min_line_length,
      HOUGH_MAX_LINE_GAP,
    )

    let best_length = 0
    let best_mid_y_in_roi = -1
    for (let i = 0; i < lines_mat.rows; i++) {
      const off = i * 4
      const x1 = lines_mat.data32S[off]
      const y1 = lines_mat.data32S[off + 1]
      const x2 = lines_mat.data32S[off + 2]
      const y2 = lines_mat.data32S[off + 3]
      const dx = x2 - x1
      const dy = y2 - y1
      const length = Math.hypot(dx, dy)
      // 0°(수평) 으로부터 절댓값 기울기 — 180° 도 수평이므로 둘 중 작은 쪽 사용
      let angle_abs = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI)
      if (angle_abs > 90) angle_abs = 180 - angle_abs
      if (angle_abs > HOUGH_MAX_ANGLE_DEG) continue

      const mid_y_in_roi = (y1 + y2) / 2
      if (mid_y_in_roi < search_start_in_roi) continue

      // OH 비례 범위 — 너무 가깝거나 멀면 림 아닐 가능성 높음
      const candidate_oh = roi.y + mid_y_in_roi - pupil.y
      if (candidate_oh < min_oh_px || candidate_oh > max_oh_px) continue

      // overlay 용 — 캔버스 좌표로 저장
      detected_lines.push({
        x1: roi.x + x1,
        y1: roi.y + y1,
        x2: roi.x + x2,
        y2: roi.y + y2,
      })

      if (length > best_length) {
        best_length = length
        best_mid_y_in_roi = mid_y_in_roi
      }
    }

    if (best_mid_y_in_roi >= 0) {
      frame_bottom_y = roi.y + best_mid_y_in_roi
      oh_px = frame_bottom_y - pupil.y
      // 신뢰도 — 선택된 line 의 길이를 ROI 폭에 정규화. ROI 폭의 50% 이상이면 1.0.
      confidence = Math.min(1, best_length / (roi.w * 0.5))
      selection_method = 'hough'
    } else {
      // Fallback — Hough 가 아무것도 못 찾으면 reduce 방식으로 한 번 더 시도.
      // morphology 이미 적용된 edge_mat 을 사용하므로 reduce 도 reflection / iris arc 영향 덜 받음.
      // reduce 행 합계는 *edge 픽셀 수 × 255*. iris arc 가 ROI 폭의 ~30% 라 약 0.3*roi.w*255
      // 만큼이 fallback 채택 임계. 림은 0.8+*roi.w*255 라 정상 케이스엔 도달 못 함.
      const reduce_min_threshold = Math.max(MIN_EDGE_INTENSITY, Math.floor(roi.w * 255 * 0.45))
      cv.reduce(edge_mat, row_sum_mat, 1, cv.REDUCE_SUM, cv.CV_32S)
      let best_y = -1
      let best_val = 0
      for (let y = search_start_in_roi; y < row_sum_mat.rows; y++) {
        const v = row_sum_mat.data32S[y]
        if (v <= best_val) continue
        const candidate_oh = roi.y + y - pupil.y
        if (candidate_oh < min_oh_px || candidate_oh > max_oh_px) continue
        best_val = v
        best_y = y
      }
      if (best_y >= 0 && best_val >= reduce_min_threshold) {
        frame_bottom_y = roi.y + best_y
        oh_px = frame_bottom_y - pupil.y
        // 신뢰도 — reduce_min_threshold 를 기준으로 정규화. 정확히 임계면 0, 두 배면 1.
        confidence = Math.min(
          1,
          Math.max(0, (best_val - reduce_min_threshold) / reduce_min_threshold),
        )
        // fallback 채택 시 confidence 절반 — Hough 가 채택한 것보다 덜 확실하다는 신호
        confidence *= 0.5
        selection_method = 'reduce'
      }
    }
  } finally {
    src_mat.delete()
    gray_mat.delete()
    blur_mat.delete()
    edge_mat.delete()
    morph_kernel.delete()
    lines_mat.delete()
    row_sum_mat.delete()
  }

  return {
    oh_px,
    frame_bottom_y,
    search_floor_y: search_floor_y_canvas,
    roi,
    confidence,
    detected_lines,
    selection_method,
  }
}
