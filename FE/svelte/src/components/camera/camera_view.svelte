<script>
  import {
    get_video_landmarker,
    detect_from_video,
    check_frontal,
    check_face_completeness,
    clear_video_cache,
    draw_face_mesh,
    YAW_THR,
    PITCH_THR,
    ROLL_THR,
  } from '@/lib/mediapipe/face_landmarker.js'
  import { compute_measurements, compute_measurement_points } from '@/lib/mediapipe/measurements.js'
  import { video_to_blob } from '@/lib/capture/capture_utils.js'
  import { compute_center_square_bbox } from '@/lib/sixdrepnet360/inference.js'
  // 측면(left_profile/right_profile) 자세 감지 composable. pose_target 에 따라 tick() 이
  // no-op 이거나 6D 추론 발사. 정면 단계엔 무관 — 인스턴스만 만들어두고 사용 안 함.
  import { create_profile_pose_detector } from '@/lib/capture/use_profile_pose.svelte.js'

  /**
   * @typedef {import("@/lib/mediapipe/face_types.js").FaceMeasurements} FaceMeasurements
   * @typedef {import("@/lib/mediapipe/face_types.js").FrontalCheck} FrontalCheck
   * @typedef {import("@/lib/mediapipe/face_types.js").CompletenessCheck} CompletenessCheck
   * @typedef {import("@/lib/mediapipe/face_types.js").Point2D} Point2D
   * @typedef {'head_left' | 'head_right' | 'head_center' | 'count_three' | 'count_two' | 'count_one' | 'count_click'} AudioPromptKey
   *
   * @typedef {object} CaptureResult
   * @property {Blob} blob
   * @property {string} object_url
   * @property {number} captured_at
   * @property {number} width
   * @property {number} height
   * @property {FaceMeasurements | null} measurements_obj
   * @property {Record<string, [Point2D, Point2D]> | null} measurement_points_obj
   * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[] | null} landmarks
   */

  /** @type {{
   *   active?: boolean,
   *   pose_target?: 'front' | 'left_profile' | 'right_profile',
   *   capture_mode?: 'auto' | 'manual',
   *   show_overlay?: boolean,
   *   is_landmark_visible?: boolean,
   *   oncapture?: ((c: CaptureResult) => void) | undefined,
   *   oncapture_error?: ((err: unknown) => void) | undefined,
   * }}
   */
  let {
    active = false,
    pose_target = 'front',
    capture_mode = 'auto',
    show_overlay = true,
    is_landmark_visible = true,
    oncapture = undefined,
    oncapture_error = undefined,
  } = $props()

  // FRAME_SKIP: 60fps / 5 = 12Hz 추론 (성능과 반응성의 타협점)
  // STABILITY_FRAMES: 12Hz × 30 ≈ 2.5초 유지되어야 최종 확정
  // STABILITY_THRESHOLD: 최근 10프레임 face_width/height 표준편차 상한 (640x480 기준 경험값)
  const FRAME_SKIP = 5
  const STABILITY_FRAMES = 30
  const STABILITY_THRESHOLD = 5

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_canvas_el = $state(null)

  // 비동기 카메라 시작 도중 cleanup 이 끼어들 때 stale rAF/이벤트 핸들러 등록을 막기 위한 세대 토큰.
  // on_stop_camera 가 증가시키고, on_start_camera 는 각 await 뒤에 자신의 세대가 아직 유효한지 확인한다.
  let g_start_generation = 0

  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {number | null} */
  let g_raf_id = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarkerResult | null} */
  let g_last_detection = null
  let g_frame_counter = 0
  let g_already_dispatched = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let g_capture_timeout = null
  /** @type {HTMLAudioElement | null} */
  let g_active_prompt_audio = null
  /** @type {'idle' | 'started' | 'final'} */
  let g_stability_audio_stage = 'idle'
  /** @type {AudioPromptKey | null} */
  let g_last_audio_key = null
  let g_last_audio_at = 0
  let g_capture_sequence_token = 0

  // 측면 자세 감지 — pose_target 이 'front' 면 tick() 이 즉시 return 하므로 항상 생성해도 안전.
  const profile_pose = create_profile_pose_detector({
    get_pose_target: () => pose_target,
    get_video_el: () => ref_this_video_el,
  })

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)
  let g_face_detected = $state(false)
  /** @type {FaceMeasurements | null} */
  let g_measurements_obj = $state(null)
  /** @type {FrontalCheck | null} */
  let g_frontal_obj = $state(null)
  /** @type {CompletenessCheck} */
  let g_complete_obj = $state({ is_complete: true, reason: null })
  /** @type {FaceMeasurements[]} */
  let g_buffer_arr = []
  let g_stable_count = $state(0)

  const g_is_stable = $derived(g_stable_count >= STABILITY_FRAMES)
  const g_stability_progress = $derived(
    Math.min(100, Math.round((g_stable_count / STABILITY_FRAMES) * 100)),
  )

  // 정면 / 측면 모두 capture_mode==='auto' 일 때 자동 발사 활성화. pose_target 별 stable 계산은
  // 각 파이프라인이 담당하고, 통합 게이트(g_can_auto_fire) 가 분기.
  const g_is_auto_capture = $derived(capture_mode === 'auto')

  // 자동 발사 단일 게이트. 정면은 안정화 기반(face dimension std), 측면은 yaw 기반(composable).
  const g_can_auto_fire = $derived.by(() => {
    if (!active || !g_is_auto_capture || g_already_dispatched) return false
    if (pose_target === 'front') {
      return (
        g_face_detected &&
        g_complete_obj.is_complete &&
        !!g_frontal_obj?.is_frontal &&
        g_is_stable
      )
    }
    return profile_pose.is_stable
  })
  // 정면 포즈일 때만 check_frontal 결과를 UI/판정에 반영한다.
  const g_should_check_frontal = $derived(pose_target === 'front')

  // 가이드 타원 색상을 pose_target 과 상태에 따라 결정한다.
  const g_guide_color = $derived.by(() => {
    // 측면: composable 의 stable/progress 기반 색
    if (pose_target !== 'front') {
      if (profile_pose.is_stable) return 'rgba(0,230,118,0.9)'    // 초록 — 발사 직전
      if (profile_pose.progress > 0) return 'rgba(255,193,7,0.85)' // 노랑 — 진행 중
      return 'rgba(255,255,255,0.7)'                              // 흰색 — 대기/이탈
    }

    // 정면 — 기존 로직 그대로
    if (!g_face_detected) return 'rgba(200,200,200,0.5)'
    if (!g_complete_obj.is_complete) return 'rgba(244,67,54,0.85)'
    if (!g_frontal_obj?.is_frontal) return 'rgba(255,193,7,0.85)'
    if (g_is_stable) return 'rgba(0,230,118,0.9)'
    return 'rgba(255,193,7,0.85)'
  })

  // 사용자에게 보여줄 힌트 문자열을 pose_target 과 상태에 따라 결정한다.
  const g_hint_text = $derived.by(() => {
    // 측면: composable 이 자체 hint 계산. null 이면 기본 가이드로 폴백.
    if (pose_target !== 'front') {
      return profile_pose.hint_text ?? '카메라 앞에 자세를 잡아주세요'
    }

    // 정면 — 기존 로직 그대로
    if (!g_face_detected) return '얼굴을 가이드 안에 맞춰주세요'
    if (!g_complete_obj.is_complete) return '얼굴 전체가 화면에 나오도록 해주세요'
    if (pose_target === 'left_profile') return '고개를 왼쪽으로 돌려주세요'
    if (pose_target === 'right_profile') return '고개를 오른쪽으로 돌려주세요'
    // 정면 포즈 기존 로직
    if (!g_frontal_obj) return '정면을 바라봐 주세요'
    if (g_frontal_obj.is_frontal) {
      return g_is_stable ? '✓ 측정 중...' : `안정화 중 ${g_stability_progress}%`
    }
    if (g_frontal_obj.reason === 'yaw') {
      return g_frontal_obj.yaw > 0 ? '고개를 오른쪽으로 돌려주세요' : '고개를 왼쪽으로 돌려주세요'
    }
    if (g_frontal_obj.reason === 'pitch') {
      return g_frontal_obj.pitch > 0 ? '턱을 올려주세요' : '턱을 내려주세요'
    }
    if (g_frontal_obj.reason === 'roll') {
      return g_frontal_obj.roll > 0 ? '오른쪽으로 기울었어요' : '왼쪽으로 기울었어요'
    }
    return '정면을 바라봐 주세요'
  })

  // 상태별 힌트 배지 색상 (inline style 로 적용할 문자열).
  const g_badge_style = $derived.by(() => {
    const base = 'background: rgba(0,0,0,0.55);'
    // 측면: stable=초록, 진행 중=주황, 대기=흰
    if (pose_target !== 'front') {
      if (profile_pose.is_stable) return base + ' border-color: rgba(0,230,118,0.7); color: #69f0ae;'
      if (profile_pose.progress > 0) return base + ' border-color: rgba(255,152,0,0.6); color: #ffb74d;'
      return base + ' border-color: rgba(255,255,255,0.25); color: #eeeeee;'
    }

    // 정면 — 기존 로직 그대로
    if (pose_target === 'front' && g_is_stable) {
      return base + ' border-color: rgba(0,230,118,0.7); color: #69f0ae;'
    }
    if (g_face_detected) {
      return base + ' border-color: rgba(255,152,0,0.6); color: #ffb74d;'
    }
    return base + ' border-color: rgba(255,255,255,0.25); color: #eeeeee;'
  })

  // active prop 이 true 로 바뀌면 카메라를 시작하고, false 로 돌아가거나 언마운트되면 정리한다.
  $effect(() => {
    if (active) {
      void on_start_camera()
      return () => on_stop_camera()
    }
  })

  // 자동 발사 통합 — 정면/측면 분기는 g_can_auto_fire 안에서 끝남.
  $effect(() => {
    if (!g_can_auto_fire) {
      if (g_capture_timeout !== null) {
        clearTimeout(g_capture_timeout)
        g_capture_timeout = null
      }
      g_stability_audio_stage = 'idle'
      return
    }

    if (g_stability_audio_stage !== 'final') {
      g_stability_audio_stage = 'final'
      void run_auto_capture_sequence()
    }
  })

  $effect(() => {
    // 측면 단계의 방향 안내는 텍스트만 — 음성은 정면 단계에서만 head_*.
    if (pose_target !== 'front') return
    if (!active || !g_is_auto_capture || g_already_dispatched || g_stability_audio_stage !== 'idle') {
      return
    }

    /** @type {'head_left' | 'head_right' | 'head_center' | null} */
    let next_audio_key = null

    if (g_face_detected) {
      if (!g_complete_obj.is_complete) {
        next_audio_key = 'head_center'
      } else if (g_frontal_obj && !g_frontal_obj.is_frontal && g_frontal_obj.reason === 'yaw') {
        next_audio_key = g_frontal_obj.yaw > 0 ? 'head_right' : 'head_left'
      }
    }

    if (!next_audio_key) return
    void play_prompt_audio(next_audio_key)
  })

  // 사용자 카메라 권한을 요청하고 MediaPipe 모델을 로드해 rAF 루프를 시작한다.
  // 각 await 지점 뒤에 세대 토큰을 검사해, 중간에 on_stop_camera 가 끼어들면 조용히 빠져나간다.
  async function on_start_camera() {
    const my_generation = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false
      g_already_dispatched = false
      g_stability_audio_stage = 'idle'
      g_last_audio_key = null
      g_capture_sequence_token += 1
      g_buffer_arr = []
      g_stable_count = 0
      profile_pose.reset()
      g_face_detected = false
      g_measurements_obj = null

      const landmarker = await get_video_landmarker()
      if (my_generation !== g_start_generation) return
      g_landmarker = landmarker

      // 480x640 (3:4 세로 비율): 얼굴 분석 UX 에 맞춰 인물 비율로 요청.
      // 페이스 메시 정확도와 추론 비용의 타협점은 장변 640 기준에서 동일.
      // 가로 전용 장치인 경우 가장 가까운 해상도로 대체 반환 → object-cover 로 자동 크롭.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      })
      if (my_generation !== g_start_generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      g_stream = stream

      // active 전환 직후 <video> 가 아직 마운트되지 않았을 수 있어 한 틱 대기.
      await new Promise((r) => setTimeout(r, 0))
      if (my_generation !== g_start_generation) return
      if (!ref_this_video_el) throw new Error('video element missing')
      ref_this_video_el.srcObject = g_stream
      ref_this_video_el.onloadedmetadata = () => {
        // metadata 콜백이 불릴 시점에 이미 정지되었으면 재생하지 않는다.
        if (my_generation !== g_start_generation || !ref_this_video_el || !g_stream) return
        void ref_this_video_el.play()
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

  // rAF 루프를 중지하고 스트림을 해제한다. 진행 중인 on_start_camera 의 async tail 이 남은 작업을
  // 이어가지 못하도록 세대 토큰을 증가시킨다.
  function on_stop_camera() {
    g_start_generation++
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_capture_sequence_token += 1
    profile_pose.reset()
    stop_prompt_audio()
    g_stability_audio_stage = 'idle'
    g_last_audio_key = null
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

  async function run_auto_capture_sequence() {
    const my_token = ++g_capture_sequence_token
    /** @type {AudioPromptKey[]} */
    const sequence = ['count_three', 'count_two', 'count_one', 'count_click']

    for (const file_key of sequence) {
      if (
        my_token !== g_capture_sequence_token ||
        !active ||
        !g_is_auto_capture ||
        g_already_dispatched
      ) {
        return
      }

      await play_prompt_audio(file_key)
    }

    if (
      my_token !== g_capture_sequence_token ||
      !active ||
      !g_is_auto_capture ||
      g_already_dispatched
    ) {
      return
    }

    // 측면은 MediaPipe 측정값 없음 → measurements_obj=null. capture_shell.on_capture 가 이미 null
    // 허용 (현행 manual 측면 캡처도 동일 경로).
    const meas = pose_target === 'front' ? get_average() : null
    await trigger_capture_internal(meas)
  }

  /**
   * @param {AudioPromptKey} file_key
   */
  async function play_prompt_audio(file_key) {
    if (typeof window === 'undefined') return

    const now = Date.now()
    if (g_last_audio_key === file_key && now - g_last_audio_at < 1200) return
    if (g_active_prompt_audio && !g_active_prompt_audio.paused && !g_active_prompt_audio.ended) return

    const audio = new Audio(`/tts/${file_key}.mp3`)
    audio.preload = 'auto'
    g_active_prompt_audio = audio
    g_last_audio_key = file_key
    g_last_audio_at = now

    const clear_active_audio = () => {
      if (g_active_prompt_audio === audio) {
        g_active_prompt_audio = null
      }
    }

    audio.addEventListener('ended', clear_active_audio, { once: true })
    audio.addEventListener('pause', clear_active_audio, { once: true })

    try {
      await audio.play()
      await new Promise((resolve) => {
        audio.addEventListener('ended', resolve, { once: true })
        audio.addEventListener('pause', resolve, { once: true })
        audio.addEventListener('error', resolve, { once: true })
      })
    } catch {
      clear_active_audio()
    }
  }

  function stop_prompt_audio() {
    if (!g_active_prompt_audio) return
    g_active_prompt_audio.pause()
    g_active_prompt_audio.currentTime = 0
    g_active_prompt_audio = null
  }

  /**
   * 안정화 버퍼를 갱신하고 stable_count 를 조정한다.
   * 최근 10프레임 face_width/height 표준편차가 임계치 미만이면 안정.
   * 불안정 프레임은 1회당 5회분 되감아 조기 확정을 방지한다.
   * @param {FaceMeasurements} m
   */
  function update_stability(m) {
    g_buffer_arr = [...g_buffer_arr.slice(-29), m]
    if (g_buffer_arr.length < 10) {
      g_stable_count = 0
      return
    }
    const recent = g_buffer_arr.slice(-10)
    const std = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length
      return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
    }
    const w_std = std(recent.map((r) => r.face_width))
    const h_std = std(recent.map((r) => r.face_height))
    if (w_std < STABILITY_THRESHOLD && h_std < STABILITY_THRESHOLD) {
      g_stable_count = Math.min(g_stable_count + 1, STABILITY_FRAMES)
    } else {
      g_stable_count = Math.max(0, g_stable_count - 5)
    }
  }

  /**
   * 최근 10프레임 측정값의 평균을 반환한다.
   * @returns {FaceMeasurements | null}
   */
  function get_average() {
    const recent = g_buffer_arr.slice(-10)
    if (recent.length === 0) return null
    /** @param {keyof FaceMeasurements} k */
    const avg = (k) => Math.round(recent.reduce((s, m) => s + m[k], 0) / recent.length)
    return {
      face_width: avg('face_width'),
      face_height: avg('face_height'),
      eye_distance: avg('eye_distance'),
      pd_pixels: avg('pd_pixels'),
      nose_width: avg('nose_width'),
      jaw_width: avg('jaw_width'),
      forehead_width: avg('forehead_width'),
      cheekbone_width: avg('cheekbone_width'),
      right_pd_pixels: avg('right_pd_pixels'),
      left_pd_pixels: avg('left_pd_pixels'),
    }
  }

  // rAF 루프 한 틱. FRAME_SKIP 프레임마다 추론을 수행하고 매 틱 canvas 를 다시 그린다.
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return
    g_frame_counter++

    if (g_frame_counter % FRAME_SKIP === 0) {
      if (pose_target === 'front') {
        // ───── 정면: MediaPipe 검출 + frontal/completeness/안정성 ─────
        const result = detect_from_video(g_landmarker, ref_this_video_el)
        g_last_detection = result
        if (result?.faceLandmarks?.length) {
          g_face_detected = true
          g_complete_obj = check_face_completeness(result)
          g_frontal_obj = check_frontal(result)
          const m = compute_measurements(
            result.faceLandmarks[0],
            ref_this_video_el.videoWidth,
            ref_this_video_el.videoHeight,
          )
          if (m) g_measurements_obj = m
          if (
            g_should_check_frontal &&
            m &&
            g_complete_obj.is_complete &&
            g_frontal_obj?.is_frontal
          ) {
            update_stability(m)
          } else {
            g_buffer_arr = []
            g_stable_count = 0
          }
        } else {
          g_face_detected = false
          g_frontal_obj = null
          g_complete_obj = { is_complete: true, reason: null }
          g_measurements_obj = null
          g_buffer_arr = []
          g_stable_count = 0
        }
      } else {
        // ───── 측면: MediaPipe 미가동. 정면 전용 상태 비움 ─────
        g_last_detection = null
        g_face_detected = false
        g_frontal_obj = null
        g_complete_obj = { is_complete: true, reason: null }
        g_measurements_obj = null
        g_buffer_arr = []
        g_stable_count = 0
      }
    }

    // 측면 단계의 6D 추론 — 매 rAF 호출, 내부 throttle (ORT_FRAME_SKIP) 로 ~2.4Hz 자동 제한
    if (pose_target !== 'front') {
      void profile_pose.tick()
    }

    sync_canvas_size()
    if (show_overlay && ref_this_canvas_el) {
      const ctx = ref_this_canvas_el.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, ref_this_canvas_el.width, ref_this_canvas_el.height)
      }
      if (is_landmark_visible) {
        if (pose_target === 'front') {
          draw_face_mesh(ref_this_canvas_el, g_last_detection)
        } else {
          draw_profile_bbox()
        }
      }
      draw_guide_ellipse()
    }

    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  /**
   * 현재 비디오 프레임을 Blob 으로 캡쳐하고 oncapture 콜백으로 전달한다.
   * g_already_dispatched 로 동일 세션에 중복 호출이 되지 않도록 가드.
   * @param {FaceMeasurements | null} measurements_obj
   */
  async function trigger_capture_internal(measurements_obj) {
    if (g_already_dispatched) return
    if (!ref_this_video_el || !g_stream) return
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_already_dispatched = true
    try {
      const { blob, width, height } = await video_to_blob(ref_this_video_el)
      const object_url = URL.createObjectURL(blob)
      // 캡쳐 시점의 랜드마크 쌍을 픽셀 공간 좌표로 변환. 랜드마크가 없으면 null.
      const landmarks = g_last_detection?.faceLandmarks?.[0] ?? null
      const measurement_points_obj = landmarks
        ? compute_measurement_points(landmarks, width, height)
        : null
      oncapture?.({
        blob,
        object_url,
        width,
        height,
        captured_at: Date.now(),
        measurements_obj: measurements_obj ?? null,
        measurement_points_obj,
        landmarks,
      })
    } catch (err) {
      // 촬영 실패 시 재시도 가능하도록 dispatched 플래그 해제 + 소비자에게 에러 알림.
      g_already_dispatched = false

      console.error('[camera_view] capture failed:', err)
      oncapture_error?.(err)
    }
  }

  /**
   * 외부에서 (수동 캡쳐용으로) 호출하는 촬영 트리거.
   * capture_mode='manual' 에서만 쓰는 것이 정상 — auto 모드에서는 이미 안정화 후 자동 발사되므로
   * 호출할 필요 없음(중복 호출은 g_already_dispatched 로 무시됨).
   *
   * 얼굴 검출 가드는 **정면 포즈에서만** 적용한다. 프로필 포즈(left/right)에서는 MediaPipe 가
   * 강한 측면 각도에서 검출에 실패해 g_face_detected=false 가 지속될 수 있기 때문에, 이 상태에서도
   * 비디오 프레임 자체는 유효하므로 촬영은 계속 가능해야 한다.
   * 비디오 프레임이 아직 준비되지 않은 경우(videoWidth=0)만 false 로 취소한다.
   *
   * @returns {Promise<boolean>} true = 촬영 트리거됨, false = 비디오 미준비 또는 정면에서 얼굴 미검출로 취소됨
   */
  export async function trigger_capture() {
    if (capture_mode === 'auto') {
      console.warn('[camera_view] trigger_capture: auto 모드에서는 외부 호출이 불필요합니다')
    }
    if (!ref_this_video_el || ref_this_video_el.videoWidth === 0) {
      console.warn('[camera_view] trigger_capture: 비디오 프레임이 준비되지 않음')
      return false
    }
    if (pose_target === 'front' && !g_face_detected) {
      console.warn('[camera_view] trigger_capture: 정면 포즈에서 얼굴이 감지되지 않음')
      return false
    }
    await trigger_capture_internal(g_measurements_obj)
    return true
  }

  // canvas 내부 해상도를 비디오 해상도에 맞춘다.
  function sync_canvas_size() {
    if (!ref_this_canvas_el || !ref_this_video_el || ref_this_video_el.videoWidth === 0) return
    if (ref_this_canvas_el.width !== ref_this_video_el.videoWidth) {
      ref_this_canvas_el.width = ref_this_video_el.videoWidth
    }
    if (ref_this_canvas_el.height !== ref_this_video_el.videoHeight) {
      ref_this_canvas_el.height = ref_this_video_el.videoHeight
    }
  }

  /**
   * 상태색이 적용된 얼굴형 가이드를 canvas 위에 그린다.
   * 단순 타원 대신 계란형(이마는 둥글게, 턱은 좁게) 베지어 곡선으로 현실적 얼굴 실루엣을 근사한다.
   * 해부학적 비율 근사: 얼굴 세로/가로 ≈ 1.32, 광대뼈 라인이 세로 중앙 살짝 아래, 하반부가 상반부보다 길다.
   */
  function draw_guide_ellipse() {
    if (!ref_this_canvas_el || ref_this_canvas_el.width === 0) return
    const ctx = ref_this_canvas_el.getContext('2d')
    if (!ctx) return

    const w = ref_this_canvas_el.width
    const h = ref_this_canvas_el.height
    const cx = w * 0.5
    const cy = h * 0.47

    // 얼굴 전체 세로(이마 위~턱 끝). 카메라 프레임 세로의 60% 를 얼굴 영역으로 가정.
    const face_h = h * 0.6
    // 광대뼈 너비(최대 가로) — 얼굴 세로의 약 76% 가 일반적 해부학 평균.
    const face_w = face_h * 0.76

    // 4개 앵커: top(이마), right(광대), bottom(턱), left(광대 대칭)
    const top_y = cy - face_h * 0.46 // 상반부 46% (이마 위쪽이 하반부보다 살짝 짧음)
    const bottom_y = cy + face_h * 0.54 // 하반부 54% (턱이 아래로 더 돌출)
    const cheek_y = cy + face_h * 0.04 // 광대 라인은 중심 살짝 아래
    const cheek_x = face_w * 0.5

    // 베지어 제어점: 상단은 수평으로 넓게 벌려 둥근 이마, 하단은 좁게 모아 뾰족한 턱.
    const k_upper_out = cheek_x * 1.05
    const k_upper_vert = (cheek_y - top_y) * 0.55
    const k_lower_in = cheek_x * 0.45
    const k_lower_vert = (bottom_y - cheek_y) * 0.55

    ctx.save()
    // 배경 영상에 관계없이 선이 잘 보이도록 약한 드롭섀도.
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 4
    ctx.strokeStyle = g_guide_color
    ctx.lineWidth = 3
    ctx.setLineDash([14, 7])

    ctx.beginPath()
    ctx.moveTo(cx, top_y)
    // 이마 → 오른 광대 (둥글게 벌어짐)
    ctx.bezierCurveTo(
      cx + k_upper_out,
      top_y,
      cx + cheek_x,
      cheek_y - k_upper_vert,
      cx + cheek_x,
      cheek_y,
    )
    // 오른 광대 → 턱 (안쪽으로 좁아짐)
    ctx.bezierCurveTo(cx + cheek_x, cheek_y + k_lower_vert, cx + k_lower_in, bottom_y, cx, bottom_y)
    // 턱 → 왼 광대 (대칭)
    ctx.bezierCurveTo(
      cx - k_lower_in,
      bottom_y,
      cx - cheek_x,
      cheek_y + k_lower_vert,
      cx - cheek_x,
      cheek_y,
    )
    // 왼 광대 → 이마 (대칭)
    ctx.bezierCurveTo(cx - cheek_x, cheek_y - k_upper_vert, cx - k_upper_out, top_y, cx, top_y)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  // 측면 단계의 분석 영역(중앙 정사각형 crop) 을 점선 사각으로 그린다. is_landmark_visible 토글로
  // 켜고 끔. 정면의 face_mesh 와 같은 "가이드 시각화" 역할.
  function draw_profile_bbox() {
    if (!ref_this_canvas_el || !ref_this_video_el) return
    if (ref_this_video_el.videoWidth === 0) return
    const ctx = ref_this_canvas_el.getContext('2d')
    if (!ctx) return

    const bbox = compute_center_square_bbox(ref_this_video_el)
    const w = ref_this_canvas_el.width
    const h = ref_this_canvas_el.height

    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(bbox.x * w, bbox.y * h, bbox.w * w, bbox.h * h)
    ctx.restore()
  }

  /**
   * 재측정을 위해 안정화 상태를 초기화한다.
   * 외부에서 `bind:this` 로 참조해 호출하면 자동 스텝에서 `oncapture` 가 다시 발사되거나,
   * 수동 스텝에서 `trigger_capture()` 호출이 다시 수락되도록 재장전된다.
   */
  export function reset() {
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_capture_sequence_token += 1
    stop_prompt_audio()
    g_already_dispatched = false
    g_buffer_arr = []
    g_stable_count = 0
    g_stability_audio_stage = 'idle'
    g_last_audio_key = null
    profile_pose.reset()
  }

  /**
   * yaw/pitch/roll 각도 진행 바의 색상과 너비를 계산한다.
   * @param {number} value
   * @param {number} threshold
   */
  function angle_style(value, threshold) {
    const ok = Math.abs(value) < threshold
    const width_pct = Math.min(100, (Math.abs(value) / threshold) * 100)
    const track_bg = ok ? 'rgba(0,200,83,0.15)' : 'rgba(220,53,69,0.15)'
    const fill_bg = ok ? '#00c853' : '#dc3545'
    const text_color = ok ? '#34d399' : '#f87171'
    return { ok, width_pct, track_bg, fill_bg, text_color }
  }

  const g_yaw_style = $derived(angle_style(g_frontal_obj?.yaw ?? 0, YAW_THR))
  const g_pitch_style = $derived(angle_style(g_frontal_obj?.pitch ?? 0, PITCH_THR))
  const g_roll_style = $derived(angle_style(g_frontal_obj?.roll ?? 0, ROLL_THR))
</script>

<div class="flex flex-col gap-3">
  <div class="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black shadow-md shadow-slate-300/60">
    <video
      bind:this={ref_this_video_el}
      class="absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
      playsinline
      autoplay
      muted
    ></video>
    <canvas
      bind:this={ref_this_canvas_el}
      class:hidden={!show_overlay}
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
    ></canvas>

    {#if g_init_error}
      <div
        class="absolute left-2.5 right-2.5 top-2.5 z-20 rounded-lg border border-red-500 bg-zinc-900/90 p-3 text-sm font-semibold text-red-400 backdrop-blur-sm"
      >
        <p>{g_init_error}</p>
        {#if g_permission_denied}
          <p class="mt-1 text-xs font-normal text-zinc-400">
            브라우저 주소창의 잠금 아이콘에서 카메라 접근을 허용해 주세요.
          </p>
        {/if}
      </div>
    {/if}

    {#if show_overlay && active && g_face_detected && g_measurements_obj}
      <div
        class="pointer-events-none absolute left-2.5 top-2.5 z-10 grid grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] tabular-nums text-zinc-200 backdrop-blur-sm"
        aria-live="polite"
      >
        <span class="text-white/65">너비</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.face_width}</b
        >
        <span class="text-white/65">높이</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.face_height}</b
        >
        <span class="text-white/65">눈간</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.eye_distance}</b
        >
        <span class="text-white/65">PD</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.pd_pixels}</b
        >
        <span class="text-white/65">코</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.nose_width}</b
        >
        <span class="text-white/65">턱</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.jaw_width}</b
        >
      </div>
    {/if}

    {#if show_overlay && active && pose_target === 'front' && g_face_detected && g_frontal_obj && !g_frontal_obj.is_frontal}
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse text-[7rem] leading-none text-orange-400 drop-shadow-[0_2px_16px_rgba(0,0,0,0.65)]"
        aria-hidden="true"
      >
        {#if g_frontal_obj.reason === 'yaw'}
          {g_frontal_obj.yaw > 0 ? '→' : '←'}
        {:else if g_frontal_obj.reason === 'pitch'}
          {g_frontal_obj.pitch > 0 ? '↑' : '↓'}
        {:else if g_frontal_obj.reason === 'roll'}
          {g_frontal_obj.roll > 0 ? '↺' : '↻'}
        {/if}
      </div>
    {/if}

    {#if show_overlay && active && pose_target === 'front' && g_face_detected && g_frontal_obj}
      <div
        class="pointer-events-none absolute right-2.5 top-2.5 z-10 flex w-44 flex-col gap-1.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">좌우</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_yaw_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_yaw_style.width_pct}%; background: {g_yaw_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_yaw_style.text_color};"
          >
            {g_frontal_obj.yaw.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">상하</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_pitch_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_pitch_style.width_pct}%; background: {g_pitch_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_pitch_style.text_color};"
          >
            {g_frontal_obj.pitch.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">기울기</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_roll_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_roll_style.width_pct}%; background: {g_roll_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_roll_style.text_color};"
          >
            {g_frontal_obj.roll.toFixed(1)}°
          </span>
        </div>
      </div>
    {/if}

    <!--
      측면 단계 한정 진행률 게이지. composable 이 yaw 영역 진입을 감지해 진행률 누적.
      test.svelte 의 g_capture_progress 게이지와 동일 디자인 — 시각 일관성.
      g_already_dispatched 면 캡처 완료 후라 노출 불필요.
    -->
    {#if pose_target !== 'front' && profile_pose.progress > 0 && !g_already_dispatched}
      <div
        class="pointer-events-none absolute left-2.5 top-2.5 z-10 flex w-44 flex-col gap-1
               rounded-lg border border-emerald-400/50 bg-black/65 px-3 py-2 text-[11px] backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="flex items-baseline justify-between text-emerald-300">
          <span class="font-bold">측면 자세 유지 중</span>
          <span class="tabular-nums">{Math.round(profile_pose.progress)}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-sm bg-emerald-900/50">
          <div
            class="h-full bg-emerald-400 transition-[width] duration-100"
            style="width: {profile_pose.progress}%;"
          ></div>
        </div>
      </div>
    {/if}

    {#if show_overlay && active}
      <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <span
          class="inline-block whitespace-nowrap rounded-full border-[1.5px] px-4 py-2 text-sm font-bold backdrop-blur-sm"
          style={g_badge_style}
        >
          {g_hint_text}
        </span>
      </div>
    {/if}
  </div>
</div>
