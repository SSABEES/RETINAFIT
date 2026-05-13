<script>
  /**
   * OH (Optical Height) 측정 검증 페이지 (/test).
   *
   * 전면 카메라 + MediaPipe FaceLandmarker(동공 인덱스 468/473) + OpenCV.js(Canny edge) 로
   * 사용자가 착용한 안경의 렌즈 하단 가장자리를 검출해 OH (동공 → 렌즈 하단까지의 픽셀/mm) 를
   * 실시간 추정한다. AR GLB 안경 렌더링은 이 페이지에서 제거되었다.
   *
   * UX: 진입 즉시 카메라 시작 + OpenCV.js lazy 로드. 사용자가 PD(mm) 를 입력하면 픽셀 → mm 환산.
   *     디버그 토글로 face landmark · ROI 박스 · Canny edge · 동공/프레임 하단 마커 노출.
   */

  import {
    get_video_landmarker,
    detect_from_video,
    clear_video_cache,
  } from '@/lib/mediapipe/face_landmarker.js'
  import {
    ensure_opencv_ready,
    estimate_oh,
    dispose_oh_worker,
  } from '@/lib/measurements/oh_estimator.js'

  // MediaPipe 478 포인트 모델의 동공 (홍채 중심) 인덱스. measurements.js 와 동일.
  const RIGHT_PUPIL_IDX = 468
  const LEFT_PUPIL_IDX = 473
  // MediaPipe canonical face mesh 의 아랫눈꺼풀 contour 인덱스. max y (이미지 좌표에서 가장 아래)
  // 가 눈꺼풀 가장자리. OH 검색 시작점을 이 값 + buffer 로 잡아 눈꺼풀 그림자·속눈썹·눈 소켓
  // 음영을 안경 림으로 오인하는 것을 막는다.
  //   468 (오른눈, MediaPipe RIGHT iris) ↔ 145/153/154
  //   473 (왼눈, MediaPipe LEFT iris)    ↔ 374/380/381
  const RIGHT_LOWER_LID_INDICES = [145, 153, 154]
  const LEFT_LOWER_LID_INDICES = [374, 380, 381]

  // MediaPipe iris contour 인덱스 (홍채 외곽 4점). 468/473 (iris 중심) 주변 0/90/180/270° 위치.
  // max y 가 카메라에서 보이는 동공 가장 아래 점. 이걸 lid contour 와 max 로 합쳐 anchor 로 쓰면
  // "lid landmark 가 iris 보다 위에 있는" 비정상 케이스 (렌즈 굴절, 시선 아래로, 반쯤 감긴 눈) 에도
  // 동공 끝이 림으로 오인되는 걸 막을 수 있다.
  const RIGHT_IRIS_CONTOUR_INDICES = [469, 470, 471, 472]
  const LEFT_IRIS_CONTOUR_INDICES = [474, 475, 476, 477]
  // OH 가 합리적이지 않으면 (눈꺼풀/속눈썹/노이즈 picked) confidence 0 으로 떨군다.
  // 일반 성인 OH 범위 약 15~25mm, 보수적으로 10~30mm 사용.
  const OH_MIN_MM = 10
  const OH_MAX_MM = 30
  // 임계치 미달 프레임은 스킵 (= 마지막 통과 값 유지). 0 ~ 1 범위.
  // 기본 0.35: hough 채택 케이스(보통 0.5+)는 거의 통과, reduce fallback (× 0.5 감쇠) 의 약한
  // 케이스를 걸러내기에 적당. 사용자가 슬라이더로 튜닝 가능.
  const MIN_CONFIDENCE_DEFAULT = 0.35
  // 연속 스킵이 이 수를 넘으면 표시 값을 stale 로 마킹 (UI 가 흐려진다). 마지막 통과 측정값이
  // 카메라 / 조명 변화로 무효해진 경우 사용자에게 신호.
  const STALE_SKIP_THRESHOLD = 8

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_overlay_canvas_el = $state(null)

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)
  let g_opencv_ready = $state(false)
  let g_opencv_error = $state(/** @type {string | null} */ (null))

  let g_face_detected = $state(false)
  let g_has_iris = $state(false)

  // 디버그 토글
  let g_show_landmarks = $state(true) // 동공 + 추정한 프레임 하단 점 오버레이
  let g_show_roi = $state(true) // 분석에 사용한 ROI 박스 표시
  let g_show_candidate_lines = $state(true) // HoughLinesP 가 후보로 검출한 수평선들 (연두색)

  // OH 측정 결과 (마지막 성공 분석)
  let g_oh_px_right = $state(/** @type {number | null} */ (null))
  let g_oh_px_left = $state(/** @type {number | null} */ (null))
  let g_oh_mm_right = $state(/** @type {number | null} */ (null))
  let g_oh_mm_left = $state(/** @type {number | null} */ (null))
  let g_confidence_right = $state(0)
  let g_confidence_left = $state(0)
  let g_pd_px_current = $state(/** @type {number | null} */ (null))
  /** @type {import('@/lib/measurements/oh_estimator.js').SelectionMethod} */
  let g_selection_method_right = $state('none')
  /** @type {import('@/lib/measurements/oh_estimator.js').SelectionMethod} */
  let g_selection_method_left = $state('none')

  // 신뢰도 임계치 — 이 값 미만이면 표시 값 갱신을 스킵하고 마지막 통과 값을 유지.
  let g_min_confidence = $state(MIN_CONFIDENCE_DEFAULT)
  // 마지막 통과 이후 연속으로 스킵된 프레임 수 (눈별). 0 = 방금 통과.
  let g_skip_count_right = $state(0)
  let g_skip_count_left = $state(0)

  // 분석 주기 (ms). OH 분석은 매 프레임 돌릴 필요 없음 — Canny + getImageData 비용이 크다.
  let g_analyze_interval_ms = $state(250)

  // 사용자가 입력하는 실제 PD (mm). 픽셀 → mm 환산에 사용. 일반 성인 평균 63mm.
  let g_user_pd_mm = $state(63)

  // 마지막 분석 결과의 raw 데이터 (오버레이 그릴 때 사용).
  /** @type {import('@/lib/measurements/oh_estimator.js').OHResult | null} */
  let g_last_oh_result = $state(null)
  /** @type {{ right: {x:number,y:number}, left: {x:number,y:number} } | null} */
  let g_last_pupil_px = $state(null)
  /** @type {{ right: number | null, left: number | null } | null} */
  let g_last_lower_lid_y = $state(null)

  // 비반응형 내부 상태
  let g_start_generation = 0
  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import('@mediapipe/tasks-vision').FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {number | null} */
  let g_raf_id = null
  let g_analyzing = false
  let g_last_analyze_ts = 0

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
      g_face_detected = false

      const landmarker = await get_video_landmarker(1)
      if (my_generation !== g_start_generation) return
      g_landmarker = landmarker

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
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
  // MediaPipe 아랫눈꺼풀 contour 인덱스로 호출해 눈꺼풀 가장자리 y 를 얻는다.
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

  // 여러 후보 y 중 가장 큰 값 (null / 무효값 무시). 한 눈의 search anchor 는 lid bottom 과
  // iris bottom 중 더 아래쪽을 채택해 양쪽 anatomical landmark 의 합집합 아래만 검색.
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

  // rAF 한 틱: MediaPipe 검출 → 동공 좌표 추출 → analyze_interval 마다 OpenCV OH 추정 → 오버레이 그리기.
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return

    const result = detect_from_video(g_landmarker, ref_this_video_el)
    const landmarks_arr = result?.faceLandmarks
    const detected = !!landmarks_arr && landmarks_arr.length > 0
    g_face_detected = detected

    if (detected) {
      const landmarks = landmarks_arr[0]
      g_has_iris = landmarks.length >= 478
      const vw = ref_this_video_el.videoWidth
      const vh = ref_this_video_el.videoHeight

      // 동공 (홍채 중심) 픽셀 좌표
      if (g_has_iris) {
        const pr = landmarks[RIGHT_PUPIL_IDX]
        const pl = landmarks[LEFT_PUPIL_IDX]
        const pupil_right_px = { x: pr.x * vw, y: pr.y * vh }
        const pupil_left_px = { x: pl.x * vw, y: pl.y * vh }
        g_last_pupil_px = { right: pupil_right_px, left: pupil_left_px }
        g_pd_px_current = Math.hypot(
          pupil_right_px.x - pupil_left_px.x,
          pupil_right_px.y - pupil_left_px.y,
        )

        // search anchor — lid bottom 과 iris bottom 중 더 아래 (=합집합).
        //   lid bottom  : 눈꺼풀 그림자·속눈썹 차단
        //   iris bottom : 동공 끝 (홍채 곡선 아래 가장자리) 차단
        // 둘 중 큰 값 사용으로 어느 시나리오에서도 동공/눈꺼풀이 검색 영역에 들어오지 않게 보장.
        const lid_y_right = compute_max_y_pixel(landmarks, RIGHT_LOWER_LID_INDICES, vh)
        const lid_y_left = compute_max_y_pixel(landmarks, LEFT_LOWER_LID_INDICES, vh)
        const iris_bottom_y_right = compute_max_y_pixel(landmarks, RIGHT_IRIS_CONTOUR_INDICES, vh)
        const iris_bottom_y_left = compute_max_y_pixel(landmarks, LEFT_IRIS_CONTOUR_INDICES, vh)
        const anchor_y_right = max_y_of([lid_y_right, iris_bottom_y_right])
        const anchor_y_left = max_y_of([lid_y_left, iris_bottom_y_left])
        g_last_lower_lid_y = { right: anchor_y_right, left: anchor_y_left }

        // analyze_interval 마다 OH 추정 (Canny 비용 큼). 중복 호출 방지 — g_analyzing 가드.
        const now = performance.now()
        if (
          g_opencv_ready &&
          !g_analyzing &&
          now - g_last_analyze_ts >= g_analyze_interval_ms
        ) {
          g_analyzing = true
          g_last_analyze_ts = now
          void run_oh_analysis(
            pupil_right_px,
            pupil_left_px,
            anchor_y_right,
            anchor_y_left,
            vw,
            vh,
          )
        }
      } else {
        g_last_pupil_px = null
        g_last_lower_lid_y = null
      }
    } else {
      g_last_pupil_px = null
      g_last_lower_lid_y = null
      g_pd_px_current = null
    }

    draw_overlay()
    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  // 한 번의 OH 분석. estimate_oh 는 worker 호출이라 메인 스레드 비점유 — Promise 로 yield 만 함.
  async function run_oh_analysis(
    pupil_right_px,
    pupil_left_px,
    lower_lid_y_right,
    lower_lid_y_left,
    vw,
    vh,
  ) {
    try {
      if (!ref_this_video_el) return
      const oh = await estimate_oh({
        pupil_right: pupil_right_px,
        pupil_left: pupil_left_px,
        lower_lid_y_right,
        lower_lid_y_left,
        source_el: ref_this_video_el,
        source_width: vw,
        source_height: vh,
      })

      // mm 환산 — 현재 PD(px) 와 사용자 입력 PD(mm) 비율 사용.
      // OH(mm) = OH(px) * (PD_mm / PD_px). 사용자가 카메라 거리 바뀌면 PD_px 도 바뀌어 일관 환산.
      const pd_px = g_pd_px_current ?? 0
      const mm_per_px = pd_px > 0 && g_user_pd_mm > 0 ? g_user_pd_mm / pd_px : null
      const oh_mm_right_raw = oh.oh_px_right !== null && mm_per_px !== null ? oh.oh_px_right * mm_per_px : null
      const oh_mm_left_raw = oh.oh_px_left !== null && mm_per_px !== null ? oh.oh_px_left * mm_per_px : null

      // 1단계 — OH 범위 sanity check (10~30mm 밖이면 양성 거짓으로 간주)
      const right_in_range =
        oh_mm_right_raw === null || (oh_mm_right_raw >= OH_MIN_MM && oh_mm_right_raw <= OH_MAX_MM)
      const left_in_range =
        oh_mm_left_raw === null || (oh_mm_left_raw >= OH_MIN_MM && oh_mm_left_raw <= OH_MAX_MM)

      // 2단계 — 통과 판정. (a) 범위 OK + (b) 검출된 OH px 존재 + (c) confidence ≥ 임계치
      // 셋 중 하나라도 실패하면 그 눈은 *스킵* — 마지막 통과 값 유지, 카운터 +1.
      const right_passed =
        right_in_range && oh.oh_px_right !== null && oh.confidence_right >= g_min_confidence
      const left_passed =
        left_in_range && oh.oh_px_left !== null && oh.confidence_left >= g_min_confidence

      // 오버레이용 raw 데이터는 *항상* 갱신해 사용자가 현재 분석 상태를 시각적으로 추적 가능.
      g_last_oh_result = oh

      // 표시 값은 통과한 눈만 갱신. 미통과 눈은 이전 값 유지 + 스킵 카운터 증가.
      if (right_passed) {
        g_oh_px_right = oh.oh_px_right
        g_oh_mm_right = oh_mm_right_raw
        g_confidence_right = oh.confidence_right
        g_selection_method_right = oh.selection_method_right
        g_skip_count_right = 0
      } else {
        g_skip_count_right += 1
      }
      if (left_passed) {
        g_oh_px_left = oh.oh_px_left
        g_oh_mm_left = oh_mm_left_raw
        g_confidence_left = oh.confidence_left
        g_selection_method_left = oh.selection_method_left
        g_skip_count_left = 0
      } else {
        g_skip_count_left += 1
      }
    } catch (err) {
      console.error('[OH] 분석 실패', err)
    } finally {
      g_analyzing = false
    }
  }

  // 오버레이 캔버스 그리기 — 동공 점 + 프레임 하단 점 + OH 선 + ROI 박스.
  function draw_overlay() {
    const canvas_el = ref_this_overlay_canvas_el
    if (!canvas_el) return
    const ctx = canvas_el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas_el.width, canvas_el.height)

    if (!g_show_landmarks && !g_show_roi && !g_show_candidate_lines) return

    const pupil = g_last_pupil_px
    const oh = g_last_oh_result

    // HoughLinesP 후보 line 들 (연두색, 가는 실선). 선택된 line 은 별도로 위에 더 진하게 그림.
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

    if (g_show_roi && oh) {
      ctx.strokeStyle = 'rgba(91, 0, 107, 0.9)' // retinal-primary-600
      ctx.lineWidth = 2
      if (oh.roi_right) {
        ctx.strokeRect(oh.roi_right.x, oh.roi_right.y, oh.roi_right.w, oh.roi_right.h)
      }
      if (oh.roi_left) {
        ctx.strokeRect(oh.roi_left.x, oh.roi_left.y, oh.roi_left.w, oh.roi_left.h)
      }
    }

    if (g_show_landmarks) {
      // 동공 (마젠타)
      if (pupil) {
        ctx.fillStyle = 'rgba(255, 64, 192, 0.95)'
        for (const p of [pupil.right, pupil.left]) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 아랫눈꺼풀 + search floor (주황색 — 이 선 아래부터만 안경 림 검색)
      const lid = g_last_lower_lid_y
      if (lid && pupil && oh && oh.roi_right && oh.roi_left) {
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.7)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        const draw_lid_line = (cx, lid_y, roi) => {
          if (lid_y === null || lid_y === undefined) return
          ctx.beginPath()
          ctx.moveTo(roi.x, lid_y)
          ctx.lineTo(roi.x + roi.w, lid_y)
          ctx.stroke()
        }
        draw_lid_line(pupil.right.x, lid.right, oh.roi_right)
        draw_lid_line(pupil.left.x, lid.left, oh.roi_left)
        // search floor 도 같은 색 점선 (lid + buffer 위치)
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

      // 프레임 하단 (시안) + OH 선 (노랑)
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
</script>

<main
  class="app-frame-page mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:flex-row md:items-start"
>
  <!-- 좌측: 카메라 + 분석 오버레이 -->
  <div class="relative w-full overflow-hidden rounded-lg border border-zinc-700 bg-black md:flex-1">
    <video
      bind:this={ref_this_video_el}
      class="block w-full"
      style="transform: scaleX(-1); transform-origin: center;"
      autoplay
      muted
      playsinline
    ></video>
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
    {#if !g_face_detected && !g_init_error}
      <div
        class="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-black/60 px-3 py-1 text-xs text-zinc-200"
      >
        얼굴을 화면 안에 비춰주세요
      </div>
    {/if}
    {#if g_face_detected && !g_has_iris}
      <div
        class="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-yellow-500/80 px-3 py-1 text-xs text-zinc-900"
      >
        홍채 (iris) 검출 불가 — 478 포인트 모델 필요
      </div>
    {/if}
    {#if g_face_detected && g_has_iris && g_opencv_ready && g_skip_count_right >= STALE_SKIP_THRESHOLD && g_skip_count_left >= STALE_SKIP_THRESHOLD}
      <div
        class="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-amber-500/85 px-3 py-1 text-xs text-zinc-900"
      >
        림 검출 불안정 — 카메라 / 조명 / 안경 위치 점검
      </div>
    {/if}
  </div>

  <!-- 우측: 사이드바 -->
  <div class="flex w-full flex-col gap-3 md:w-80 md:flex-shrink-0">
    <header class="flex items-baseline justify-between">
      <h1 class="text-lg font-bold text-zinc-100">OH 측정 (검증)</h1>
      <span class="text-xs text-zinc-400">/test</span>
    </header>

    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="font-bold text-zinc-100">측정 결과</div>
      <div class="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <div></div>
        <div class="text-zinc-400">좌(L)</div>
        <div class="text-zinc-400">우(R)</div>

        <!-- stale (연속 스킵 ≥ 임계) 면 텍스트 흐리게 — 마지막 통과 값이 오래됐음을 표시 -->
        <div class="text-zinc-400">OH (px)</div>
        <div class={g_skip_count_left >= STALE_SKIP_THRESHOLD ? 'text-zinc-500' : ''}>
          {format_num(g_oh_px_left, 1)}
        </div>
        <div class={g_skip_count_right >= STALE_SKIP_THRESHOLD ? 'text-zinc-500' : ''}>
          {format_num(g_oh_px_right, 1)}
        </div>

        <div class="text-zinc-400">OH (mm)</div>
        <div
          class="font-bold {g_skip_count_left >= STALE_SKIP_THRESHOLD
            ? 'text-zinc-500'
            : 'text-emerald-300'}"
        >
          {format_num(g_oh_mm_left, 2)}
        </div>
        <div
          class="font-bold {g_skip_count_right >= STALE_SKIP_THRESHOLD
            ? 'text-zinc-500'
            : 'text-emerald-300'}"
        >
          {format_num(g_oh_mm_right, 2)}
        </div>

        <div class="text-zinc-400">신뢰도</div>
        <div>{(g_confidence_left * 100).toFixed(0)}%</div>
        <div>{(g_confidence_right * 100).toFixed(0)}%</div>

        <div class="text-zinc-400">검출 방법</div>
        <div class="text-[10px] text-zinc-300">{g_selection_method_left}</div>
        <div class="text-[10px] text-zinc-300">{g_selection_method_right}</div>

        <div class="text-zinc-400" title="마지막 통과 이후 연속 스킵된 프레임 수">스킵</div>
        <div class={g_skip_count_left >= STALE_SKIP_THRESHOLD ? 'text-amber-400' : 'text-zinc-300'}>
          {g_skip_count_left}
        </div>
        <div class={g_skip_count_right >= STALE_SKIP_THRESHOLD ? 'text-amber-400' : 'text-zinc-300'}>
          {g_skip_count_right}
        </div>
      </div>
      <div class="border-t border-zinc-700 pt-2 text-[11px] text-zinc-400">
        현재 PD(px): <span class="tabular-nums text-zinc-200">{format_num(g_pd_px_current, 1)}</span>
      </div>
      <div class="text-[10px] leading-relaxed text-zinc-500">
        <span class="text-emerald-300">hough</span> = 수평 line segment 채택 (정확) ·
        <span class="text-amber-300">reduce</span> = 행 합계 fallback (덜 확실) ·
        <span class="text-zinc-400">none</span> = 검출 실패
      </div>
      <div class="text-[10px] leading-relaxed text-zinc-500">
        연속 스킵 ≥ {STALE_SKIP_THRESHOLD} 이면 표시값이 회색 = 오래된 측정. 카메라/조명 점검 권장.
      </div>
    </div>

    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <div class="font-bold text-zinc-100">PD 보정 (mm 환산)</div>
      <label class="flex items-center gap-2" title="실제 측정한 PD(동공 사이 거리, mm). 픽셀→mm 환산 척도">
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
      <label class="flex items-center gap-2" title="OH 분석 주기 (ms). 작을수록 빠른 갱신, 큰 CPU 비용">
        <span class="w-12 text-zinc-400">주기 ms</span>
        <input
          type="range"
          min="100"
          max="1000"
          step="50"
          bind:value={g_analyze_interval_ms}
          class="flex-1"
        />
        <input
          type="number"
          step="50"
          bind:value={g_analyze_interval_ms}
          class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
        />
      </label>
      <label
        class="flex items-center gap-2"
        title="이 신뢰도 미만이면 결과를 스킵하고 마지막 통과 값을 유지. 0=항상 갱신, 1=hough 만점만 허용"
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
    </div>

    <p class="text-[11px] leading-relaxed text-zinc-500">
      MediaPipe 동공(468/473) 주변 ROI 에서 Canny → 가로 morphological closing → HoughLinesP 로
      수평 line segment 를 추출한 뒤 길이 / 각도 / OH 비례 범위로 필터해 가장 긴 line 을 렌즈 하단
      림으로 채택합니다. Hough 가 못 찾으면 행 합계 fallback. 반사·눈썹·소켓 음영 같은 짧은
      edge 는 morphology + 길이 필터로 자연스럽게 탈락.
    </p>
  </div>
</main>
