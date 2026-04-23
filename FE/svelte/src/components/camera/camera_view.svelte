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
  import { compute_measurements } from '@/lib/mediapipe/measurements.js'

  /**
   * @typedef {import("@/lib/mediapipe/face_types.js").FaceMeasurements} FaceMeasurements
   * @typedef {import("@/lib/mediapipe/face_types.js").FrontalCheck} FrontalCheck
   * @typedef {import("@/lib/mediapipe/face_types.js").CompletenessCheck} CompletenessCheck
   */

  /** @type {{
   *   active?: boolean,
   *   onmeasure?: ((m: FaceMeasurements) => void) | undefined,
   * }}
   */
  let { active = false, onmeasure = undefined } = $props()

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
  let g_buffer_arr = $state([])
  let g_stable_count = $state(0)

  const g_is_stable = $derived(g_stable_count >= STABILITY_FRAMES)
  const g_stability_progress = $derived(
    Math.min(100, Math.round((g_stable_count / STABILITY_FRAMES) * 100)),
  )

  // 가이드 타원 색상을 상태에 따라 결정한다.
  const g_guide_color = $derived.by(() => {
    if (!g_face_detected) return 'rgba(200,200,200,0.5)'
    if (!g_complete_obj.is_complete) return 'rgba(244,67,54,0.85)'
    if (!g_frontal_obj?.is_frontal) return 'rgba(255,193,7,0.85)'
    if (g_is_stable) return 'rgba(0,230,118,0.9)'
    return 'rgba(255,193,7,0.85)'
  })

  // 사용자에게 보여줄 힌트 문자열을 상태에 따라 결정한다.
  const g_hint_text = $derived.by(() => {
    if (!g_face_detected) return '얼굴을 가이드 안에 맞춰주세요'
    if (!g_complete_obj.is_complete) return '얼굴 전체가 화면에 나오도록 해주세요'
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
    if (g_is_stable) {
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

  // 사용자 카메라 권한을 요청하고 MediaPipe 모델을 로드해 rAF 루프를 시작한다.
  async function on_start_camera() {
    try {
      g_init_error = null
      g_permission_denied = false
      g_already_dispatched = false
      g_buffer_arr = []
      g_stable_count = 0
      g_face_detected = false
      g_measurements_obj = null

      g_landmarker = await get_video_landmarker()

      // 640x480: 페이스 메시 정확도와 추론 비용의 타협점.
      g_stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })

      // active 전환 직후 <video> 가 아직 마운트되지 않았을 수 있어 한 틱 대기.
      await new Promise((r) => setTimeout(r, 0))
      if (!ref_this_video_el) throw new Error('video element missing')
      ref_this_video_el.srcObject = g_stream
      ref_this_video_el.onloadedmetadata = () => {
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

  // rAF 루프를 중지하고 스트림을 해제한다.
  function on_stop_camera() {
    if (g_raf_id !== null) {
      cancelAnimationFrame(g_raf_id)
      g_raf_id = null
    }
    if (g_stream) {
      g_stream.getTracks().forEach((t) => t.stop())
      g_stream = null
    }
    if (ref_this_video_el) ref_this_video_el.srcObject = null
    clear_video_cache()
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
    const avg = (k) => Math.round(recent.reduce((s, m) => s + m[k], 0) / recent.length)
    return {
      face_width: avg('face_width'),
      face_height: avg('face_height'),
      eye_distance: avg('eye_distance'),
      pd_pixels: avg('pd_pixels'),
      nose_width: avg('nose_width'),
      jaw_width: avg('jaw_width'),
    }
  }

  // rAF 루프 한 틱. FRAME_SKIP 프레임마다 추론을 수행하고 매 틱 canvas 를 다시 그린다.
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return
    g_frame_counter++

    if (g_frame_counter % FRAME_SKIP === 0) {
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
        if (m && g_complete_obj.is_complete && g_frontal_obj?.is_frontal) {
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
    }

    sync_canvas_size()
    if (ref_this_canvas_el) {
      draw_face_mesh(ref_this_canvas_el, g_last_detection)
      draw_guide_ellipse()
    }

    if (g_is_stable && !g_already_dispatched) {
      const avg = get_average()
      if (avg) {
        g_already_dispatched = true
        onmeasure?.(avg)
      }
    }

    g_raf_id = requestAnimationFrame(on_loop_frame)
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

  // 상태색이 적용된 가이드 타원을 canvas 위에 그린다.
  function draw_guide_ellipse() {
    if (!ref_this_canvas_el || ref_this_canvas_el.width === 0) return
    const ctx = ref_this_canvas_el.getContext('2d')
    if (!ctx) return
    const cx = ref_this_canvas_el.width * 0.5
    const cy = ref_this_canvas_el.height * 0.45
    const rx = ref_this_canvas_el.width * 0.18
    const ry = ref_this_canvas_el.height * 0.4
    ctx.save()
    ctx.strokeStyle = g_guide_color
    ctx.lineWidth = 3
    ctx.setLineDash(g_is_stable ? [] : [14, 7])
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * 재측정을 위해 안정화 상태를 초기화한다.
   * 외부에서 `bind:this` 로 참조해 호출하면 `onmeasure` 가 다시 한 번 발사될 수 있게 준비한다.
   */
  export function reset() {
    g_already_dispatched = false
    g_buffer_arr = []
    g_stable_count = 0
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
  {#if g_init_error}
    <div class="rounded-lg border border-red-500 bg-zinc-900 p-3 text-sm font-semibold text-red-400">
      <p>{g_init_error}</p>
      {#if g_permission_denied}
        <p class="mt-1 text-xs font-normal text-zinc-400">
          브라우저 주소창의 잠금 아이콘에서 카메라 접근을 허용해 주세요.
        </p>
      {/if}
    </div>
  {/if}

  <div class="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
    <!-- svelte-ignore a11y_media_has_caption -->
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
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
    ></canvas>

    {#if active && g_face_detected && g_measurements_obj}
      <div
        class="pointer-events-none absolute left-2.5 top-2.5 z-10 grid grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] tabular-nums text-zinc-200 backdrop-blur-sm"
        aria-live="polite"
      >
        <span class="text-white/65">너비</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.face_width}</b>
        <span class="text-white/65">높이</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.face_height}</b>
        <span class="text-white/65">눈간</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.eye_distance}</b>
        <span class="text-white/65">PD</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.pd_pixels}</b>
        <span class="text-white/65">코</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.nose_width}</b>
        <span class="text-white/65">턱</span><b class="text-right font-bold text-emerald-300">{g_measurements_obj.jaw_width}</b>
      </div>
    {/if}

    {#if active && g_face_detected && g_frontal_obj && !g_frontal_obj.is_frontal}
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

    {#if active}
      <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <span
          class="inline-block rounded-full border-[1.5px] px-4 py-2 text-sm font-bold backdrop-blur-sm"
          style={g_badge_style}
        >
          {g_hint_text}
        </span>
      </div>
    {/if}
  </div>

  {#if active && g_face_detected && g_frontal_obj}
    <div class="flex flex-col gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div class="flex items-center gap-2">
        <span class="w-11 text-xs font-semibold text-zinc-400">좌우</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-sm" style="background: {g_yaw_style.track_bg};">
          <div class="h-full transition-[width]" style="width: {g_yaw_style.width_pct}%; background: {g_yaw_style.fill_bg};"></div>
        </div>
        <span class="w-11 text-right text-xs font-bold" style="color: {g_yaw_style.text_color};">{g_frontal_obj.yaw.toFixed(1)}°</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-11 text-xs font-semibold text-zinc-400">상하</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-sm" style="background: {g_pitch_style.track_bg};">
          <div class="h-full transition-[width]" style="width: {g_pitch_style.width_pct}%; background: {g_pitch_style.fill_bg};"></div>
        </div>
        <span class="w-11 text-right text-xs font-bold" style="color: {g_pitch_style.text_color};">{g_frontal_obj.pitch.toFixed(1)}°</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-11 text-xs font-semibold text-zinc-400">기울기</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-sm" style="background: {g_roll_style.track_bg};">
          <div class="h-full transition-[width]" style="width: {g_roll_style.width_pct}%; background: {g_roll_style.fill_bg};"></div>
        </div>
        <span class="w-11 text-right text-xs font-bold" style="color: {g_roll_style.text_color};">{g_frontal_obj.roll.toFixed(1)}°</span>
      </div>
    </div>
  {/if}
</div>
