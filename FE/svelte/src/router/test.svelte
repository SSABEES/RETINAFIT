<script>
  /**
   * OH (Optical Height) 측정 검증 페이지 (/test).
   *
   * 전면 카메라 + MediaPipe FaceLandmarker(동공 478 포인트 모델) 로 얼굴이 카메라 앞에서
   * 충분히 안정화되면 비디오 프레임을 스냅샷으로 캡처해, 그 정지 이미지에 OpenCV.js
   * (Canny + HoughLinesP) 로 안경 림 하단을 한 번 검출해 OH 를 측정한다.
   *
   * 라이브 매-프레임 측정 대신 "안정화 → 캡처 → 단발 측정" 모델이라 결과 흔들림이 없고
   * 동일 입력으로 재현 가능. 사용자는 결과 확인 후 "재측정" 으로 처음부터 다시 시도한다.
   */

  import {
    get_video_landmarker,
    detect_from_video,
    clear_video_cache,
    check_frontal,
    YAW_THR,
    PITCH_THR,
    ROLL_THR,
  } from '@/lib/mediapipe/face_landmarker.js'
  import {
    ensure_opencv_ready,
    estimate_oh,
    dispose_oh_worker,
  } from '@/lib/measurements/oh_estimator.js'
  import { detect_markers } from '@/lib/measurements/aruco_detector.js'
  import { mm_distance } from '@/lib/measurements/aruco_scale.js'
  import { MARKER_SIZE_MM } from '@/lib/measurements/aruco_capture.js'
  import {
    load_intrinsics_for_size,
    scale_intrinsics_to_image,
  } from '@/lib/measurements/camera_intrinsics.js'

  // MediaPipe 478 포인트 모델의 동공 (홍채 중심) 인덱스.
  const RIGHT_PUPIL_IDX = 468
  const LEFT_PUPIL_IDX = 473
  // MediaPipe canonical face mesh 의 아랫눈꺼풀 contour 인덱스. max y 가 눈꺼풀 가장자리.
  const RIGHT_LOWER_LID_INDICES = [145, 153, 154]
  const LEFT_LOWER_LID_INDICES = [374, 380, 381]
  // MediaPipe iris contour (4점). max y 가 동공 가장 아래.
  const RIGHT_IRIS_CONTOUR_INDICES = [469, 470, 471, 472]
  const LEFT_IRIS_CONTOUR_INDICES = [474, 475, 476, 477]

  // OH 가 합리적이지 않으면 (눈꺼풀/속눈썹/노이즈 picked) failed 로 떨군다.
  // 일반 성인 OH 범위 약 15~25mm, 보수적으로 10~30mm 사용.
  const OH_MIN_MM = 10
  const OH_MAX_MM = 30

  // 캡처 후 OpenCV 측정 결과 채택 기준. 한쪽 눈이라도 이 신뢰도 이상이면 result, 모두 미만이면 failed.
  // 기본 0.35: hough 채택 케이스(보통 0.5+) 는 거의 통과, reduce fallback (× 0.5 감쇠) 의 약한
  // 케이스를 걸러내기에 적당. 사용자가 슬라이더로 튜닝 가능.
  const MIN_CONFIDENCE_DEFAULT = 0.35

  // 안정화 판정 — 두 조건 모두 만족해야 캡처.
  // (1) 얼굴 + iris 연속 검출 프레임 수. 약 0.3s @ 30fps.
  const STABLE_FRAMES_REQUIRED = 10
  // (2) 최근 N 프레임의 PD(px) 표준편차. 머리 흔들리면 stdev 가 커져 안정화 안 됨.
  //     STABILITY_WINDOW=10, threshold 1.5px → 30fps 기준 약 0.3s 머리 고정이면 통과.
  //     실측 후 카메라 해상도/거리에 맞게 조정 가능.
  const STABILITY_WINDOW = 10
  const STABILITY_PD_STD_PX = 1.5

  // 상태 머신 — 페이지 UX 단계 (단방향 진행: idle → head_pose_guide → stabilizing → measuring → result/failed).
  //   idle             : 얼굴 / iris 미검출 — 카메라 정렬 대기
  //   head_pose_guide  : 얼굴 검출 됨, 정면 각도(yaw/pitch/roll 임계) 미달 — 자세 가이드 표시
  //   stabilizing      : 정면 진입, 검출 프레임 + PD(px) 안정성 누적 중 (progress bar)
  //                     정면이 다시 깨지면 head_pose_guide 로 되돌아감
  //   measuring        : 안정화 충족 → 캡처 + estimate_oh 워커 처리 (스피너)
  //   result           : 측정 성공, 캡처 이미지 동결 + OH 마커
  //   failed           : 측정 실패 (신뢰도 부족 등), 재측정 안내
  const STATE_IDLE = 'idle'
  const STATE_HEAD_POSE_GUIDE = 'head_pose_guide'
  const STATE_STABILIZING = 'stabilizing'
  const STATE_MEASURING = 'measuring'
  const STATE_RESULT = 'result'
  const STATE_FAILED = 'failed'

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_overlay_canvas_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_capture_canvas_el = $state(null)

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)
  let g_opencv_ready = $state(false)
  let g_opencv_error = $state(/** @type {string | null} */ (null))

  let g_state = $state(STATE_IDLE)
  let g_stabilization_progress = $state(0) // 0~1
  let g_failed_reason = $state(/** @type {string | null} */ (null))

  let g_has_iris_runtime = $state(false) // 마지막 검출에서 iris 가 있었는지 (UX 메시지용)
  /** @type {import('@/lib/mediapipe/face_landmarker.js').FrontalCheck | null} */
  let g_last_frontal = $state(null) // 마지막 프레임의 yaw/pitch/roll + 정면 여부

  // 디버그 토글
  let g_show_landmarks = $state(true)
  let g_show_roi = $state(true)
  let g_show_candidate_lines = $state(true)
  let g_show_aruco_overlay = $state(true)

  // OH 측정 결과 (단발). 측정 성공/실패 모두 set, 단 result 상태에서만 표시.
  let g_oh_px_right = $state(/** @type {number | null} */ (null))
  let g_oh_px_left = $state(/** @type {number | null} */ (null))
  let g_oh_mm_right = $state(/** @type {number | null} */ (null))
  let g_oh_mm_left = $state(/** @type {number | null} */ (null))
  let g_confidence_right = $state(0)
  let g_confidence_left = $state(0)
  let g_pd_px_captured = $state(/** @type {number | null} */ (null))
  /** @type {import('@/lib/measurements/oh_estimator.js').SelectionMethod} */
  let g_selection_method_right = $state('none')
  /** @type {import('@/lib/measurements/oh_estimator.js').SelectionMethod} */
  let g_selection_method_left = $state('none')

  let g_min_confidence = $state(MIN_CONFIDENCE_DEFAULT)
  let g_user_pd_mm = $state(63)

  // 캡처 시점의 raw 데이터 (오버레이용)
  /** @type {import('@/lib/measurements/oh_estimator.js').OHResult | null} */
  let g_last_oh_result = $state(null)
  /** @type {{ right: {x:number,y:number}, left: {x:number,y:number} } | null} */
  let g_last_pupil_px = $state(null)
  /** @type {{ right: number | null, left: number | null } | null} */
  let g_last_lower_lid_y = $state(null)

  // ArUco 캡처 결과 — marker 평면 기반 mm 환산용. 검출 실패 시 null 이면 사용자 PD 입력으로 fallback.
  /** @type {import('@/lib/measurements/aruco_detector.js').DetectedMarker | null} */
  let g_aruco_marker = $state(null)
  // ArUco intrinsics 는 non-reactive — 캡처 직후 set, draw_overlay/계산에서 참조만 함.
  /** @type {import('@/lib/measurements/camera_intrinsics.js').CameraIntrinsics | null} */
  let g_aruco_intrinsics = null
  // 자동 산출 PD(mm) — mm_distance(pupil_R, pupil_L, marker, intr).
  let g_aruco_pd_mm = $state(/** @type {number | null} */ (null))
  // marker → 카메라 거리(mm) — POSIT translation z. 사용자 거리 피드백.
  let g_aruco_distance_mm = $state(/** @type {number | null} */ (null))
  // marker 평면 직접 측정 OH(mm). PD-ratio 환산보다 marker 평면 가까울 때 정확.
  let g_oh_mm_aruco_right = $state(/** @type {number | null} */ (null))
  let g_oh_mm_aruco_left = $state(/** @type {number | null} */ (null))
  // ArUco 사용 토글 (off 시 사용자 PD 만 사용, 비교용).
  let g_use_aruco = $state(true)

  // 비반응형 내부 상태
  let g_start_generation = 0
  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import('@mediapipe/tasks-vision').FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {number | null} */
  let g_raf_id = null

  // 안정화 추적 상태 (비반응형 — rAF 루프 내부에서만 변경)
  let g_consecutive_detect_frames = 0
  /** @type {number[]} */
  const g_pd_px_history_arr = []

  // 마운트 시 카메라 + OpenCV worker 병렬 시작. 언마운트 시 worker 까지 정리.
  $effect(() => {
    void on_start_camera()
    void on_load_opencv()
    return () => {
      on_stop_camera()
      dispose_oh_worker()
    }
  })

  // 캔버스 크기 동기화 — 비디오의 native 해상도와 1:1.
  $effect(() => {
    if (!ref_this_overlay_canvas_el || !ref_this_video_el) return
    sync_overlay_canvas_size()
  })

  // OpenCV.js 를 lazy 로드. WASM 초기화까지 1~3초 정도 걸릴 수 있음.
  async function on_load_opencv() {
    try {
      await ensure_opencv_ready()
      g_opencv_ready = true
    } catch (err) {
      g_opencv_error = err instanceof Error ? err.message : String(err)
      console.error('[OH] OpenCV 로드 실패', err)
    }
  }

  // 카메라 권한 요청 + MediaPipe 비디오 랜드마커 로드 + rAF 루프 시작.
  async function on_start_camera() {
    const my_generation = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false

      const landmarker = await get_video_landmarker(1)
      if (my_generation !== g_start_generation) return
      g_landmarker = landmarker

      // ArUco 검출은 marker 가 ~60px+ 일 때 안정. 1280x720 이 mobile sweet spot.
      // worker latency 가 너무 길어지면 1024x576 정도로 조정.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'user',
        },
        audio: false,
      })
      if (my_generation !== g_start_generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      g_stream = stream

      await new Promise((r) => setTimeout(r, 0))
      if (my_generation !== g_start_generation) return
      if (!ref_this_video_el) throw new Error('video element missing')
      ref_this_video_el.srcObject = g_stream
      ref_this_video_el.onloadedmetadata = () => {
        if (my_generation !== g_start_generation || !ref_this_video_el || !g_stream) return
        void ref_this_video_el.play()
        sync_overlay_canvas_size()
        on_loop_frame()
      }
    } catch (err) {
      on_stop_camera()
      const e = /** @type {DOMException} */ (err)
      if (e.name === 'NotAllowedError') {
        g_permission_denied = true
        g_init_error = '카메라 접근 권한이 거부되었습니다.'
      } else if (e.name === 'NotFoundError') {
        g_init_error = '카메라를 찾을 수 없습니다.'
      } else {
        g_init_error = `카메라 시작 실패: ${e.message ?? String(err)}`
      }
    }
  }

  // rAF 루프와 스트림을 정리한다.
  function on_stop_camera() {
    g_start_generation++
    if (g_raf_id !== null) {
      cancelAnimationFrame(g_raf_id)
      g_raf_id = null
    }
    if (g_stream) {
      g_stream.getTracks().forEach((t) => t.stop())
      g_stream = null
    }
    if (ref_this_video_el) {
      ref_this_video_el.onloadedmetadata = null
      ref_this_video_el.srcObject = null
    }
    clear_video_cache()
  }

  // overlay 캔버스 px 해상도를 비디오 native 해상도와 맞춘다. CSS 는 100%/100% 로 stretch.
  function sync_overlay_canvas_size() {
    if (!ref_this_overlay_canvas_el || !ref_this_video_el) return
    const vw = ref_this_video_el.videoWidth || 640
    const vh = ref_this_video_el.videoHeight || 480
    if (ref_this_overlay_canvas_el.width !== vw) ref_this_overlay_canvas_el.width = vw
    if (ref_this_overlay_canvas_el.height !== vh) ref_this_overlay_canvas_el.height = vh
  }

  // 주어진 인덱스 집합 중 가장 큰 y (이미지 좌표 → 가장 아래쪽) 의 픽셀 값을 반환.
  function compute_max_y_pixel(landmarks, indices, video_height) {
    let max_y = -Infinity
    for (const i of indices) {
      const lm = landmarks[i]
      if (!lm) continue
      const y = lm.y * video_height
      if (y > max_y) max_y = y
    }
    return Number.isFinite(max_y) ? max_y : null
  }

  // 여러 후보 y 중 가장 큰 값 (null / 무효값 무시).
  function max_y_of(values) {
    let max = -Infinity
    let any = false
    for (const v of values) {
      if (v === null || v === undefined || !Number.isFinite(v)) continue
      any = true
      if (v > max) max = v
    }
    return any ? max : null
  }

  // 표본 표준편차 (n>=2). 안정화 판정에서 PD(px) 흔들림 측정에 사용.
  function compute_stdev(values) {
    const n = values.length
    if (n < 2) return Infinity
    const mean = values.reduce((s, v) => s + v, 0) / n
    const sq = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    return Math.sqrt(sq)
  }

  // 안정화 카운터/히스토리 초기화. idle 진입 또는 재측정 시 호출.
  function reset_stabilization() {
    g_consecutive_detect_frames = 0
    g_pd_px_history_arr.length = 0
    g_stabilization_progress = 0
  }

  // rAF 한 틱: MediaPipe 검출 → 안정화 판정 → 충족 시 캡처+측정 트리거 → 오버레이 갱신.
  // measuring / result / failed 상태에서는 안정화 누적을 멈추고 (캡처 프레임이 동결된 상태)
  // raf 만 유지 (재측정 버튼에서 다시 idle 로 전환되면 즉시 루프 재개).
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return

    if (
      g_state === STATE_IDLE ||
      g_state === STATE_HEAD_POSE_GUIDE ||
      g_state === STATE_STABILIZING
    ) {
      step_stabilization()
    }

    draw_overlay()
    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  // 안정화 단계의 한 틱. 얼굴/홍채 검출 + PD(px) 히스토리 갱신 + 두 조건 충족 시 캡처 트리거.
  function step_stabilization() {
    if (!ref_this_video_el || !g_landmarker) return
    const result = detect_from_video(g_landmarker, ref_this_video_el)
    const landmarks_arr = result?.faceLandmarks
    const detected = !!landmarks_arr && landmarks_arr.length > 0

    if (!detected) {
      g_has_iris_runtime = false
      reset_stabilization()
      g_state = STATE_IDLE
      g_last_pupil_px = null
      g_last_lower_lid_y = null
      g_last_frontal = null
      return
    }

    const landmarks = landmarks_arr[0]
    g_has_iris_runtime = landmarks.length >= 478
    if (!g_has_iris_runtime) {
      reset_stabilization()
      g_state = STATE_IDLE
      g_last_pupil_px = null
      g_last_lower_lid_y = null
      g_last_frontal = null
      return
    }

    // 동공 / anchor 좌표 먼저 계산 — head_pose_guide 단계에서도 마커가 보이도록 frontal check 보다 선행.
    // 사용자가 자기 동공 위치를 보면서 머리 자세를 조정할 수 있다.
    const vw = ref_this_video_el.videoWidth
    const vh = ref_this_video_el.videoHeight
    const pr = landmarks[RIGHT_PUPIL_IDX]
    const pl = landmarks[LEFT_PUPIL_IDX]
    const pupil_right_px = { x: pr.x * vw, y: pr.y * vh }
    const pupil_left_px = { x: pl.x * vw, y: pl.y * vh }
    const pd_px = Math.hypot(
      pupil_right_px.x - pupil_left_px.x,
      pupil_right_px.y - pupil_left_px.y,
    )
    g_last_pupil_px = { right: pupil_right_px, left: pupil_left_px }
    const lid_y_right = compute_max_y_pixel(landmarks, RIGHT_LOWER_LID_INDICES, vh)
    const lid_y_left = compute_max_y_pixel(landmarks, LEFT_LOWER_LID_INDICES, vh)
    const iris_bottom_y_right = compute_max_y_pixel(landmarks, RIGHT_IRIS_CONTOUR_INDICES, vh)
    const iris_bottom_y_left = compute_max_y_pixel(landmarks, LEFT_IRIS_CONTOUR_INDICES, vh)
    const anchor_y_right = max_y_of([lid_y_right, iris_bottom_y_right])
    const anchor_y_left = max_y_of([lid_y_left, iris_bottom_y_left])
    g_last_lower_lid_y = { right: anchor_y_right, left: anchor_y_left }

    // Phase 1 (head_pose_guide) — 정면 임계 미달이면 별도 단계로 분리해 사용자 가이드.
    // 안정화 카운터/히스토리는 reset, 단 동공 마커는 그대로 유지해 시각적 피드백 제공.
    // 정면이 회복되면 다음 프레임에 STABILIZING 으로 자연스럽게 전환.
    const frontal = check_frontal(result)
    g_last_frontal = frontal
    if (!frontal || !frontal.is_frontal) {
      reset_stabilization()
      g_state = STATE_HEAD_POSE_GUIDE
      return
    }

    // Phase 2 (stabilizing) — 정면 OK. 검출 프레임 누적 + PD(px) 안정성 측정.
    g_consecutive_detect_frames += 1
    g_pd_px_history_arr.push(pd_px)
    if (g_pd_px_history_arr.length > STABILITY_WINDOW) g_pd_px_history_arr.shift()

    // 두 조건 진행률 계산 — 더 더딘 쪽을 progress 로 노출.
    const frame_progress = Math.min(1, g_consecutive_detect_frames / STABLE_FRAMES_REQUIRED)
    const window_full = g_pd_px_history_arr.length >= STABILITY_WINDOW
    const pd_stdev = window_full ? compute_stdev(g_pd_px_history_arr) : Infinity
    // PD 안정화는 stdev 가 threshold 이하일 때 1, 2배일 때 0 까지 linear.
    const pd_progress = window_full
      ? Math.max(0, Math.min(1, 2 - pd_stdev / STABILITY_PD_STD_PX))
      : g_pd_px_history_arr.length / STABILITY_WINDOW
    g_stabilization_progress = Math.min(frame_progress, pd_progress)
    g_state = STATE_STABILIZING

    const frame_ok = g_consecutive_detect_frames >= STABLE_FRAMES_REQUIRED
    const pd_ok = window_full && pd_stdev < STABILITY_PD_STD_PX
    if (frame_ok && pd_ok && g_opencv_ready) {
      // 안정화 완료 — 캡처 + 단발 측정.
      void on_capture_and_measure({
        landmarks,
        pupil_right_px,
        pupil_left_px,
        anchor_y_right,
        anchor_y_left,
        pd_px,
        vw,
        vh,
      })
    }
  }

  // 안정화 완료 콜백 — 현재 video 프레임을 canvas 로 동결 + estimate_oh 호출.
  // landmark snapshot 도 캡처 시점 값을 그대로 사용 (이후 라이브 갱신과 분리).
  async function on_capture_and_measure({
    landmarks: _landmarks,
    pupil_right_px,
    pupil_left_px,
    anchor_y_right,
    anchor_y_left,
    pd_px,
    vw,
    vh,
  }) {
    if (g_state === STATE_MEASURING || g_state === STATE_RESULT) return
    g_state = STATE_MEASURING
    g_failed_reason = null
    try {
      if (!ref_this_video_el || !ref_this_capture_canvas_el) {
        throw new Error('capture target missing')
      }
      // (1) video frame → capture canvas 로 복사. 이후 화면에는 이 canvas 가 동결 표시된다.
      ref_this_capture_canvas_el.width = vw
      ref_this_capture_canvas_el.height = vh
      const ctx = ref_this_capture_canvas_el.getContext('2d')
      if (!ctx) throw new Error('capture canvas ctx null')
      ctx.drawImage(ref_this_video_el, 0, 0, vw, vh)

      // (2) ArUco 검출 — 정지 캡처 이미지에서 marker 찾고 평면 정보 얻기. 검출 실패해도 OH 측정은 진행.
      //     intrinsics 는 캘리브레이션 placeholder. 실 디바이스 별 정밀 캘리브 시 교체.
      const aruco = await detect_aruco_in_capture(ctx, vw, vh)
      g_aruco_marker = aruco?.marker ?? null
      g_aruco_intrinsics = aruco?.intrinsics ?? null
      g_aruco_distance_mm = aruco?.marker ? aruco.marker.translation[2] : null

      // (3) 동일 canvas 를 OpenCV 측정 입력으로 전달 — video 의 race condition 없는 정지 이미지.
      const oh = await estimate_oh({
        pupil_right: pupil_right_px,
        pupil_left: pupil_left_px,
        lower_lid_y_right: anchor_y_right,
        lower_lid_y_left: anchor_y_left,
        source_el: ref_this_capture_canvas_el,
        source_width: vw,
        source_height: vh,
      })

      // (4) mm 환산 — ArUco 가 있고 토글 ON 이면 marker 평면 PD 우선, 없으면 사용자 PD fallback.
      //     자동 PD(mm) 도 export 해 사이드바에 표시.
      let mm_per_px = null
      let aruco_pd_mm = null
      if (g_use_aruco && aruco?.marker && aruco.intrinsics) {
        const pd_mm = mm_distance(pupil_right_px, pupil_left_px, aruco.marker, aruco.intrinsics)
        if (Number.isFinite(pd_mm) && pd_mm > 0) {
          aruco_pd_mm = pd_mm
          mm_per_px = pd_mm / pd_px
        }
      }
      if (mm_per_px === null) {
        mm_per_px = pd_px > 0 && g_user_pd_mm > 0 ? g_user_pd_mm / pd_px : null
      }
      g_aruco_pd_mm = aruco_pd_mm
      const oh_mm_right_raw =
        oh.oh_px_right !== null && mm_per_px !== null ? oh.oh_px_right * mm_per_px : null
      const oh_mm_left_raw =
        oh.oh_px_left !== null && mm_per_px !== null ? oh.oh_px_left * mm_per_px : null

      // (5) plane-direct OH(mm) — marker 평면 위 pupil ↔ frame_bottom 직선거리. PD-ratio 환산 비교용.
      //     얼굴이 marker 평면에서 떨어져 있으면 1~5% 오차 (aruco_scale.js 주석 참고).
      let oh_mm_aruco_right_raw = null
      let oh_mm_aruco_left_raw = null
      if (aruco?.marker && aruco.intrinsics) {
        if (oh.frame_bottom_y_right !== null) {
          const d = mm_distance(
            pupil_right_px,
            { x: pupil_right_px.x, y: oh.frame_bottom_y_right },
            aruco.marker,
            aruco.intrinsics,
          )
          if (Number.isFinite(d) && d > 0) oh_mm_aruco_right_raw = d
        }
        if (oh.frame_bottom_y_left !== null) {
          const d = mm_distance(
            pupil_left_px,
            { x: pupil_left_px.x, y: oh.frame_bottom_y_left },
            aruco.marker,
            aruco.intrinsics,
          )
          if (Number.isFinite(d) && d > 0) oh_mm_aruco_left_raw = d
        }
      }
      g_oh_mm_aruco_right = oh_mm_aruco_right_raw
      g_oh_mm_aruco_left = oh_mm_aruco_left_raw

      // 검증 — 한쪽 눈 이상이 (a) 측정 성공 (b) 신뢰도 임계 (c) OH 범위 내 일 때 result.
      const right_pass =
        oh.oh_px_right !== null &&
        oh.confidence_right >= g_min_confidence &&
        (oh_mm_right_raw === null ||
          (oh_mm_right_raw >= OH_MIN_MM && oh_mm_right_raw <= OH_MAX_MM))
      const left_pass =
        oh.oh_px_left !== null &&
        oh.confidence_left >= g_min_confidence &&
        (oh_mm_left_raw === null ||
          (oh_mm_left_raw >= OH_MIN_MM && oh_mm_left_raw <= OH_MAX_MM))

      g_oh_px_right = oh.oh_px_right
      g_oh_px_left = oh.oh_px_left
      g_oh_mm_right = oh_mm_right_raw
      g_oh_mm_left = oh_mm_left_raw
      g_confidence_right = oh.confidence_right
      g_confidence_left = oh.confidence_left
      g_selection_method_right = oh.selection_method_right
      g_selection_method_left = oh.selection_method_left
      g_pd_px_captured = pd_px
      g_last_oh_result = oh

      if (right_pass || left_pass) {
        g_state = STATE_RESULT
      } else {
        g_state = STATE_FAILED
        g_failed_reason = build_failed_reason(oh, oh_mm_right_raw, oh_mm_left_raw)
      }
    } catch (err) {
      console.error('[OH] 캡처/측정 실패', err)
      g_state = STATE_FAILED
      g_failed_reason = err instanceof Error ? err.message : String(err)
    }
  }

  // 캡처 캔버스의 ImageData → ArUco 검출. intrinsics 는 placeholder 480x640 을 캡처 해상도로 스케일.
  // intrinsics 캘리브레이션 fetch 실패 또는 detect 예외는 null 반환 (호출자는 사용자 PD fallback).
  async function detect_aruco_in_capture(ctx, width, height) {
    try {
      const image_data = ctx.getImageData(0, 0, width, height)
      const base = await load_intrinsics_for_size(width, height)
      const intrinsics = scale_intrinsics_to_image(base, width, height)
      const markers = detect_markers(image_data, intrinsics, MARKER_SIZE_MM)
      if (!markers.length) return { marker: null, intrinsics }
      return { marker: markers[0], intrinsics }
    } catch (err) {
      console.warn('[ArUco] 캡처 검출 실패 — PD 입력 fallback:', err)
      return null
    }
  }

  // 실패 사유 한 줄 — 어느 단계에서 떨어졌는지 사용자에게 힌트.
  function build_failed_reason(oh, mm_right, mm_left) {
    if (oh.oh_px_right === null && oh.oh_px_left === null) return '림 검출 실패 — 안경 위치/조명 점검'
    if (oh.confidence_right < g_min_confidence && oh.confidence_left < g_min_confidence)
      return '신뢰도 부족 — 안경/카메라 정렬 후 재측정'
    const out_of_range =
      (mm_right !== null && (mm_right < OH_MIN_MM || mm_right > OH_MAX_MM)) ||
      (mm_left !== null && (mm_left < OH_MIN_MM || mm_left > OH_MAX_MM))
    if (out_of_range) return `OH 범위 (${OH_MIN_MM}~${OH_MAX_MM}mm) 이탈 — PD(mm) 입력값 확인`
    return '측정값 부적합 — 재측정 권장'
  }

  // 재측정 — 상태 머신을 idle 로 되돌리고 캡처 프레임/결과 초기화. rAF 는 계속 돌고 있음.
  function on_click_retry() {
    g_state = STATE_IDLE
    g_failed_reason = null
    g_last_oh_result = null
    g_last_pupil_px = null
    g_last_lower_lid_y = null
    g_last_frontal = null
    g_oh_px_right = null
    g_oh_px_left = null
    g_oh_mm_right = null
    g_oh_mm_left = null
    g_confidence_right = 0
    g_confidence_left = 0
    g_selection_method_right = 'none'
    g_selection_method_left = 'none'
    g_pd_px_captured = null
    g_aruco_marker = null
    g_aruco_intrinsics = null
    g_aruco_pd_mm = null
    g_aruco_distance_mm = null
    g_oh_mm_aruco_right = null
    g_oh_mm_aruco_left = null
    reset_stabilization()
  }

  // 오버레이 캔버스 그리기 — 동공/anchor/ROI/후보 line/측정선.
  // stabilizing 단계는 lid/iris 마커만, result/failed 단계는 OpenCV 결과까지 모두 그린다.
  function draw_overlay() {
    const canvas_el = ref_this_overlay_canvas_el
    if (!canvas_el) return
    const ctx = canvas_el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas_el.width, canvas_el.height)

    if (
      !g_show_landmarks &&
      !g_show_roi &&
      !g_show_candidate_lines &&
      !g_show_aruco_overlay
    )
      return

    const pupil = g_last_pupil_px
    const oh = g_last_oh_result

    if (g_show_candidate_lines && oh) {
      ctx.strokeStyle = 'rgba(150, 255, 80, 0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      const draw_lines = (lines) => {
        if (!lines) return
        for (const line of lines) {
          ctx.beginPath()
          ctx.moveTo(line.x1, line.y1)
          ctx.lineTo(line.x2, line.y2)
          ctx.stroke()
        }
      }
      draw_lines(oh.detected_lines_right)
      draw_lines(oh.detected_lines_left)
    }

    // ArUco marker 오버레이 — 검출 시 사각형 + id/거리 라벨.
    const marker = g_aruco_marker
    if (g_show_aruco_overlay && marker) {
      ctx.strokeStyle = 'rgba(80, 220, 255, 0.95)'
      ctx.lineWidth = 2.5
      ctx.setLineDash([])
      ctx.beginPath()
      const [c0, c1, c2, c3] = marker.corners
      ctx.moveTo(c0.x, c0.y)
      ctx.lineTo(c1.x, c1.y)
      ctx.lineTo(c2.x, c2.y)
      ctx.lineTo(c3.x, c3.y)
      ctx.closePath()
      ctx.stroke()
      // 첫 변에 빨강 — 마커 회전 방향 표시 (디버그용).
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(c0.x, c0.y)
      ctx.lineTo(c1.x, c1.y)
      ctx.stroke()
      // 라벨 — id + 거리(cm). canvas 가 scaleX(-1) 이므로 텍스트는 다시 mirror 해야 정방향.
      const label_x = (c0.x + c2.x) / 2
      const label_y = (c0.y + c2.y) / 2
      ctx.save()
      ctx.translate(label_x, label_y)
      ctx.scale(-1, 1)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
      ctx.font = '14px monospace'
      const dist_cm = marker.translation[2] / 10
      const text = `ID ${marker.id} · ${dist_cm.toFixed(1)}cm`
      const text_w = ctx.measureText(text).width
      ctx.fillRect(-text_w / 2 - 4, -10, text_w + 8, 20)
      ctx.fillStyle = 'rgba(160, 240, 255, 1)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }

    if (g_show_roi && oh) {
      ctx.strokeStyle = 'rgba(91, 0, 107, 0.9)'
      ctx.lineWidth = 2
      if (oh.roi_right) {
        ctx.strokeRect(oh.roi_right.x, oh.roi_right.y, oh.roi_right.w, oh.roi_right.h)
      }
      if (oh.roi_left) {
        ctx.strokeRect(oh.roi_left.x, oh.roi_left.y, oh.roi_left.w, oh.roi_left.h)
      }
    }

    if (g_show_landmarks) {
      if (pupil) {
        ctx.fillStyle = 'rgba(255, 64, 192, 0.95)'
        for (const p of [pupil.right, pupil.left]) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const lid = g_last_lower_lid_y
      if (lid && pupil && oh && oh.roi_right && oh.roi_left) {
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.7)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        const draw_lid_line = (lid_y, roi) => {
          if (lid_y === null || lid_y === undefined) return
          ctx.beginPath()
          ctx.moveTo(roi.x, lid_y)
          ctx.lineTo(roi.x + roi.w, lid_y)
          ctx.stroke()
        }
        draw_lid_line(lid.right, oh.roi_right)
        draw_lid_line(lid.left, oh.roi_left)
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)'
        if (oh.search_floor_y_right !== null && oh.search_floor_y_right !== undefined) {
          ctx.beginPath()
          ctx.moveTo(oh.roi_right.x, oh.search_floor_y_right)
          ctx.lineTo(oh.roi_right.x + oh.roi_right.w, oh.search_floor_y_right)
          ctx.stroke()
        }
        if (oh.search_floor_y_left !== null && oh.search_floor_y_left !== undefined) {
          ctx.beginPath()
          ctx.moveTo(oh.roi_left.x, oh.search_floor_y_left)
          ctx.lineTo(oh.roi_left.x + oh.roi_left.w, oh.search_floor_y_left)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      if (oh && pupil) {
        ctx.fillStyle = 'rgba(64, 220, 255, 0.95)'
        ctx.strokeStyle = 'rgba(255, 220, 0, 0.9)'
        ctx.lineWidth = 2
        if (oh.frame_bottom_y_right !== null) {
          ctx.beginPath()
          ctx.arc(pupil.right.x, oh.frame_bottom_y_right, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(pupil.right.x, pupil.right.y)
          ctx.lineTo(pupil.right.x, oh.frame_bottom_y_right)
          ctx.stroke()
        }
        if (oh.frame_bottom_y_left !== null) {
          ctx.beginPath()
          ctx.arc(pupil.left.x, oh.frame_bottom_y_left, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(pupil.left.x, pupil.left.y)
          ctx.lineTo(pupil.left.x, oh.frame_bottom_y_left)
          ctx.stroke()
        }
      }
    }
  }

  // 표시용 — 숫자가 null 이면 dash.
  function format_num(v, digits = 1) {
    return v === null || v === undefined ? '—' : v.toFixed(digits)
  }

  // 상태별 안내 메시지 (비디오 하단 토스트).
  function status_message(state) {
    switch (state) {
      case STATE_IDLE:
        return '얼굴을 화면 안에 비춰 주세요'
      case STATE_HEAD_POSE_GUIDE:
        // 어느 축이 임계를 넘었는지 reason 기반 구체 가이드.
        if (g_last_frontal) {
          const r = g_last_frontal.reason
          if (r === 'yaw') return '좌우로 돌리지 말고 정면을 바라봐 주세요'
          if (r === 'pitch') return '고개를 들거나 숙이지 말아 주세요'
          if (r === 'roll') return '고개를 기울이지 말아 주세요'
        }
        return '정면을 바라봐 주세요'
      case STATE_STABILIZING:
        return '잠시 그대로 유지해 주세요…'
      case STATE_MEASURING:
        return '캡처 + 측정 중…'
      case STATE_RESULT:
        return '측정 완료'
      case STATE_FAILED:
        return g_failed_reason ?? '측정 실패'
      default:
        return ''
    }
  }
</script>

<main
  class="app-frame-page mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:flex-row md:items-start"
>
  <!-- 좌측: 카메라 + 캡처 동결 + 분석 오버레이 -->
  <div class="relative w-full overflow-hidden rounded-lg border border-zinc-700 bg-black md:flex-1">
    <video
      bind:this={ref_this_video_el}
      class="block w-full"
      style="transform: scaleX(-1); transform-origin: center;"
      autoplay
      muted
      playsinline
    ></video>

    <!-- 캡처 canvas — measuring/result/failed 단계에서만 노출. video 위에 동결 표시. -->
    <canvas
      bind:this={ref_this_capture_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full {g_state === STATE_MEASURING ||
      g_state === STATE_RESULT ||
      g_state === STATE_FAILED
        ? 'opacity-100'
        : 'opacity-0'}"
      style="transform: scaleX(-1); transform-origin: center;"
    ></canvas>

    <canvas
      bind:this={ref_this_overlay_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full"
      style="transform: scaleX(-1); transform-origin: center;"
    ></canvas>

    {#if g_init_error}
      <div
        class="absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-red-500/90 px-3 py-1.5 text-xs text-white"
      >
        {g_init_error}
        {#if g_permission_denied}
          <span class="ml-1 text-[10px] opacity-80">
            브라우저 잠금 아이콘에서 카메라 접근을 허용해 주세요.
          </span>
        {/if}
      </div>
    {/if}

    {#if !g_opencv_ready && !g_opencv_error}
      <div
        class="absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-zinc-800/80 px-3 py-1 text-xs text-zinc-100"
      >
        OpenCV.js 로딩 중…
      </div>
    {/if}
    {#if g_opencv_error}
      <div
        class="absolute inset-x-0 top-10 mx-auto w-fit rounded-md bg-red-500/90 px-3 py-1.5 text-xs text-white"
      >
        OpenCV 로드 실패: {g_opencv_error}
      </div>
    {/if}

    <!-- Phase 1: head_pose_guide — 정면 자세 가이드. yaw/pitch/roll 각 축 상태 + 어느 축이 빗나갔는지. -->
    {#if g_state === STATE_HEAD_POSE_GUIDE}
      <div
        class="absolute inset-x-3 top-3 flex flex-col gap-1.5 rounded-md bg-amber-500/90 px-3 py-2 text-xs text-zinc-900"
      >
        <div class="font-bold">{status_message(g_state)}</div>
        {#if g_last_frontal}
          <div class="flex gap-3 tabular-nums text-[11px]">
            <span
              class={Math.abs(g_last_frontal.yaw) >= YAW_THR ? 'font-bold' : 'opacity-70'}
              title="좌우 회전 — 임계 {YAW_THR}°"
            >
              yaw {g_last_frontal.yaw.toFixed(1)}°
            </span>
            <span
              class={Math.abs(g_last_frontal.pitch) >= PITCH_THR ? 'font-bold' : 'opacity-70'}
              title="상하 끄덕임 — 임계 {PITCH_THR}°"
            >
              pitch {g_last_frontal.pitch.toFixed(1)}°
            </span>
            <span
              class={Math.abs(g_last_frontal.roll) >= ROLL_THR ? 'font-bold' : 'opacity-70'}
              title="좌우 기울기 — 임계 {ROLL_THR}°"
            >
              roll {g_last_frontal.roll.toFixed(1)}°
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Phase 2: stabilizing — 정면 OK, 검출 프레임 + PD(px) 안정성 누적. progress bar. -->
    {#if g_state === STATE_STABILIZING}
      <div
        class="absolute inset-x-3 top-3 flex flex-col gap-1 rounded-md bg-black/55 px-3 py-2 text-xs text-zinc-100"
      >
        <div class="flex items-baseline justify-between">
          <span>안정화 중</span>
          <span class="tabular-nums text-zinc-300">{Math.round(g_stabilization_progress * 100)}%</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
          <div
            class="h-full bg-emerald-400 transition-[width] duration-100"
            style="width: {Math.round(g_stabilization_progress * 100)}%;"
          ></div>
        </div>
        {#if g_last_frontal}
          <!-- 각 축 절대값이 임계(YAW=16/PITCH=18/ROLL=14)를 넘으면 빨강 — 어느 축이 비뚤어졌는지 즉시 식별. -->
          <div class="flex gap-3 tabular-nums text-[10px] text-zinc-300">
            <span class={Math.abs(g_last_frontal.yaw) >= YAW_THR ? 'text-red-400' : ''}>
              yaw {g_last_frontal.yaw.toFixed(1)}°
            </span>
            <span class={Math.abs(g_last_frontal.pitch) >= PITCH_THR ? 'text-red-400' : ''}>
              pitch {g_last_frontal.pitch.toFixed(1)}°
            </span>
            <span class={Math.abs(g_last_frontal.roll) >= ROLL_THR ? 'text-red-400' : ''}>
              roll {g_last_frontal.roll.toFixed(1)}°
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- measuring 스피너 -->
    {#if g_state === STATE_MEASURING}
      <div
        class="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-zinc-800/85 px-3 py-1.5 text-xs text-zinc-100"
      >
        측정 중…
      </div>
    {/if}

    <!-- 상태 메시지 토스트 (bottom). head_pose_guide 는 상단 amber 패널이 이미 메시지를 담고 있어 중복 회피. -->
    {#if !g_init_error && g_state !== STATE_HEAD_POSE_GUIDE}
      <div
        class="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md px-3 py-1 text-xs
          {g_state === STATE_RESULT
          ? 'bg-emerald-500/85 text-zinc-900'
          : g_state === STATE_FAILED
            ? 'bg-amber-500/90 text-zinc-900'
            : 'bg-black/60 text-zinc-200'}"
      >
        {status_message(g_state)}
      </div>
    {/if}

    {#if g_state === STATE_IDLE && !g_init_error && g_has_iris_runtime === false}
      <!-- idle 진입 직후 얼굴은 있지만 iris 모델 미로드 케이스 안내 -->
      {#if g_landmarker && ref_this_video_el}
        <!-- 메시지는 상태 토스트로 일원화 — 별도 표시 없음 -->
      {/if}
    {/if}
  </div>

  <!-- 우측: 사이드바 -->
  <div class="flex w-full flex-col gap-3 md:w-80 md:flex-shrink-0">
    <header class="flex items-baseline justify-between">
      <h1 class="text-lg font-bold text-zinc-100">OH 측정 (검증)</h1>
      <span class="text-xs text-zinc-400">/test</span>
    </header>

    <!-- 결과 패널 — result/failed 일 때만 의미 있는 값 표시. 그 외엔 dash. -->
    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="flex items-baseline justify-between">
        <div class="font-bold text-zinc-100">측정 결과</div>
        {#if g_state === STATE_RESULT || g_state === STATE_FAILED}
          <button
            type="button"
            class="rounded-md bg-[var(--retinal-primary-600)] px-2 py-1 text-[11px] font-bold text-white hover:opacity-90"
            onclick={on_click_retry}
          >
            재측정
          </button>
        {/if}
      </div>

      <div class="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <div></div>
        <div class="text-zinc-400">좌(L)</div>
        <div class="text-zinc-400">우(R)</div>

        <div class="text-zinc-400">OH (px)</div>
        <div>{format_num(g_oh_px_left, 1)}</div>
        <div>{format_num(g_oh_px_right, 1)}</div>

        <div class="text-zinc-400">OH (mm)</div>
        <div class="font-bold text-emerald-300">{format_num(g_oh_mm_left, 2)}</div>
        <div class="font-bold text-emerald-300">{format_num(g_oh_mm_right, 2)}</div>

        <div class="text-zinc-400">신뢰도</div>
        <div>{(g_confidence_left * 100).toFixed(0)}%</div>
        <div>{(g_confidence_right * 100).toFixed(0)}%</div>

        <div class="text-zinc-400">검출 방법</div>
        <div class="text-[10px] text-zinc-300">{g_selection_method_left}</div>
        <div class="text-[10px] text-zinc-300">{g_selection_method_right}</div>
      </div>
      <div class="border-t border-zinc-700 pt-2 text-[11px] text-zinc-400">
        캡처 PD(px):
        <span class="tabular-nums text-zinc-200">{format_num(g_pd_px_captured, 1)}</span>
      </div>
      <div class="text-[10px] leading-relaxed text-zinc-500">
        <span class="text-emerald-300">hough</span> = 수평 line segment 채택 (정확) ·
        <span class="text-amber-300">reduce</span> = 행 합계 fallback (덜 확실) ·
        <span class="text-zinc-400">none</span> = 검출 실패
      </div>
    </div>

    <!-- ArUco 마커 패널 — 검출 상태 + 자동 PD(mm) + plane-direct OH(mm). 결과/실패 시 의미 있는 값. -->
    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="flex items-center justify-between">
        <div class="font-bold text-zinc-100">ArUco 스케일</div>
        <label
          class="flex items-center gap-1 text-[11px] text-zinc-300"
          title="마커 검출 시 자동 PD(mm) 로 환산. 끄면 사용자 입력 PD(mm) 만 사용"
        >
          <input type="checkbox" bind:checked={g_use_aruco} class="accent-cyan-400" />
          사용
        </label>
      </div>
      {#if g_aruco_marker}
        <div class="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
          <div class="text-zinc-400">ID</div>
          <div class="col-span-2 text-cyan-300">#{g_aruco_marker.id}</div>

          <div class="text-zinc-400">거리</div>
          <div class="col-span-2 text-zinc-200">
            {format_num(g_aruco_distance_mm !== null ? g_aruco_distance_mm / 10 : null, 1)} cm
          </div>

          <div class="text-zinc-400">크기(px)</div>
          <div class="col-span-2 text-zinc-300">{format_num(g_aruco_marker.sizePx, 0)} px</div>

          <div class="text-zinc-400">PD(mm)</div>
          <div class="col-span-2 font-bold text-cyan-300">
            {format_num(g_aruco_pd_mm, 2)}
          </div>

          <div class="text-zinc-400">OH(mm) L</div>
          <div class="col-span-2 font-bold text-cyan-300">
            {format_num(g_oh_mm_aruco_left, 2)}
          </div>
          <div class="text-zinc-400">OH(mm) R</div>
          <div class="col-span-2 font-bold text-cyan-300">
            {format_num(g_oh_mm_aruco_right, 2)}
          </div>
        </div>
        <div class="text-[10px] leading-relaxed text-zinc-500">
          plane-direct = marker 평면 위 pupil↔frame_bottom 직선 거리. 얼굴이 marker 평면에서 떨어진 만큼 1~5% 오차.
        </div>
      {:else if g_state === STATE_RESULT || g_state === STATE_FAILED}
        <div class="text-[11px] text-amber-300">
          마커 미검출 — 사용자 PD(mm) 입력으로 환산. 마커가 화면에 보이는지, 인쇄 크기 {MARKER_SIZE_MM}mm 인지 확인.
        </div>
      {:else}
        <div class="text-[11px] text-zinc-400">
          캡처 시 ArUco 마커 ({MARKER_SIZE_MM}mm) 가 화면에 함께 보이면 자동 mm 환산.
        </div>
      {/if}
    </div>

    <!-- PD 보정 + 신뢰도 임계 -->
    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="font-bold text-zinc-100">PD 보정 (mm 환산)</div>
      <label
        class="flex items-center gap-2"
        title="실제 측정한 PD(동공 사이 거리, mm). 픽셀→mm 환산 척도"
      >
        <span class="w-12 text-zinc-400">PD mm</span>
        <input
          type="range"
          min="40"
          max="80"
          step="0.5"
          bind:value={g_user_pd_mm}
          class="flex-1"
        />
        <input
          type="number"
          step="0.1"
          bind:value={g_user_pd_mm}
          class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
        />
      </label>
      <label
        class="flex items-center gap-2"
        title="이 신뢰도 미만이면 측정 결과를 failed 로 떨군다. 0=항상 채택, 1=hough 만점만"
      >
        <span class="w-12 text-zinc-400">신뢰 ≥</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          bind:value={g_min_confidence}
          class="flex-1"
        />
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          bind:value={g_min_confidence}
          class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
        />
      </label>
    </div>

    <!-- 디버그 오버레이 토글 -->
    <div
      class="flex flex-col gap-1 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="font-bold text-zinc-100">오버레이</div>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_landmarks} class="accent-emerald-500" />
        동공 / 프레임 하단 마커
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_roi} class="accent-emerald-500" />
        분석 ROI 박스
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_candidate_lines} class="accent-emerald-500" />
        HoughLinesP 후보 line (연두색)
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_aruco_overlay} class="accent-cyan-400" />
        ArUco 마커 박스 (cyan)
      </label>
    </div>

    <p class="text-[11px] leading-relaxed text-zinc-500">
      얼굴 + iris 가 {STABLE_FRAMES_REQUIRED} 프레임 연속 검출되고 PD(px) 표준편차가
      {STABILITY_PD_STD_PX}px 미만, 그리고 머리 각도가 정면 (|yaw|&lt;{YAW_THR}°,
      |pitch|&lt;{PITCH_THR}°, |roll|&lt;{ROLL_THR}°) 이 되면 자동으로 현재 프레임을 캡처해 OH 를
      한 번 측정합니다.
      캡처 이미지에 Canny + HoughLinesP 로 수평 line segment 를 추출 → 길이/각도/OH 범위 필터로
      가장 긴 라인을 안경 림 하단으로 채택. hough 가 실패하면 행 합계 fallback. 결과 확인 후
      "재측정" 으로 처음부터 다시 진행할 수 있어요.
    </p>
  </div>
</main>
