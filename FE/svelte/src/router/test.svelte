<script>
  /**
   * 6DRepNet360 브라우저 추론 기술 검증 페이지 (/test).
   *
   * MediaPipe FaceLandmarker 는 face bbox 추적 용도로만 사용 (yaw/pitch/roll 비교는 표시하지 않음).
   * 6DRepNet360 ONNX 모델이 브라우저에서 정상 동작하는지 + 모바일에서의 latency 검증이 목적.
   *
   * UX: 사용자가 카메라 앞에 서면 face-tracking bbox 가 따라다니고, 그 bbox 영역으로 6D 추론한 결과를
   *     실시간 표시. 얼굴 검출 안 되면 화면 중앙 정사각형으로 폴백.
   */

  import {
    get_video_landmarker,
    detect_from_video,
    clear_video_cache,
  } from '@/lib/mediapipe/face_landmarker.js'
  import {
    get_session,
    predict_pose,
    compute_bbox_from_landmarks,
    compute_center_square_bbox,
    set_active_variant,
    MODEL_VARIANT_ARR,
    VARIANT_LABEL_OBJ,
  } from '@/lib/sixdrepnet360/inference.js'
  import { rotation_matrix_to_euler } from '@/lib/sixdrepnet360/pose.js'

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_canvas_el = $state(null)

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)

  // 모델 상태: 'pending' = 시작 전, 'loading' = 다운로드/컴파일 중, 'ready' = 추론 가능, 'error' = 실패
  let g_model_status = $state(/** @type {'pending' | 'loading' | 'ready' | 'error'} */ ('pending'))
  let g_model_error = $state(/** @type {string | null} */ (null))

  // 활성 양자화 variant. 토글로 fp32 / dynamic / static 비교. 변경 시 새 variant 의 세션이
  // lazy 로드 — 한 번 로드된 variant 는 메모리에 캐시되어 재토글 시 재다운로드 없음.
  let g_variant = $state(/** @type {import('@/lib/sixdrepnet360/inference.js').ModelVariant} */ ('fp32'))

  // variant 별 최근 latency — 같은 자세에서 토글 즉시 비교용. 새 추론이 들어오면 해당 variant
  // 칸을 갱신. variant 변경 직후 첫 추론 전까지는 이전 값 유지(stale 으로 보일 수 있으나 비교에 유용).
  let g_latency_per_variant_obj = $state(/** @type {Record<string, number | null>} */ ({
    fp32: null,
    dynamic: null,
    static: null,
  }))

  // 얼굴 검출 여부 + 추적 bbox (정규화 0-1).
  let g_face_detected = $state(false)
  /** @type {{ x: number, y: number, w: number, h: number } | null} */
  let g_face_bbox = $state(null)

  // MediaPipe 사용 여부 토글. OFF 시 face-tracking bbox 대신 중앙 정사각형 사용.
  // 같은 자세에서 두 모드의 yaw 차이를 비교해 face crop 품질이 모델 출력에 미치는 영향을 직접 확인하기 위함.
  // MediaPipe 모델 자체는 on_start_camera 에서 한 번 로드 — 토글은 런타임 사용 여부만 제어
  // (콜드 스타트 비용은 매번 지불, 그러나 본 토글의 주된 가치는 yaw 정확도 비교이므로 충분).
  let g_use_mediapipe = $state(true)

  // 6축 포즈 큐브 렌더링 토글. OFF 시 큐브를 그리지 않아 카메라 화면이 깨끗해진다 — 큐브 시각화
  // 없이 yaw/pitch/roll 수치만으로 검수하고 싶을 때 사용. 기본 ON 으로 기존 동작 유지.
  let g_show_cube = $state(true)

  // 6DRepNet360 yaw/pitch/roll
  let g_yaw = $state(/** @type {number | null} */ (null))
  let g_pitch = $state(/** @type {number | null} */ (null))
  let g_roll = $state(/** @type {number | null} */ (null))
  let g_latency_ms = $state(/** @type {number | null} */ (null))
  // 가장 최근 추론의 3×3 회전행렬 (row-major Float32Array, length 9). 큐브 시각화 전용 — rAF 동기 read 라
  // $state 가 아니어도 충분하고, 매 추론마다 새 Float32Array 라 변경 추적 자체가 안전.
  /** @type {Float32Array | null} */
  let g_last_rotation = null

  let g_start_generation = 0

  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {number | null} */
  let g_raf_id = null
  let g_frame_counter = 0
  let g_ort_inflight = false

  // MediaPipe 검출 빈도 (60fps / 5 ≈ 12Hz). bbox 가 매 12분의 1 초마다 갱신.
  const FRAME_SKIP = 5
  // 6DRepNet360 추론 빈도. 단일 비행 가드가 있어 실제 빈도는 모델 latency 에 의해 자동 throttling.
  const ORT_FRAME_SKIP = 5

  // 자동 캡처 트리거 — |yaw| 가 90° 근처에서 HOLD_DURATION_MS 동안 유지되면 발사.
  // TARGET_TOLERANCE 가 너무 빡빡하면 모델 노이즈 + 사용자 떨림으로 진입 자체가 어렵고,
  // 너무 느슨하면 정확한 측면이 아닌 자세에서도 트리거. 10° 는 두 효과의 합리적 타협.
  const TARGET_DEG = 90
  const TARGET_TOLERANCE = 10
  const HOLD_DURATION_MS = 2000

  // 타깃 영역 진입 시각 (performance.now ms). 영역 밖으로 나가면 null 로 리셋.
  /** @type {number | null} */
  let g_target_entered_at = null
  // 0-100, 2초 홀드의 진행률 (UI 진행바용).
  let g_capture_progress = $state(0)
  // 캡처된 결과. 한 번 캡처되면 reset_capture 호출 전엔 새 캡처를 막는 가드 역할.
  /** @type {{ image_url: string, yaw: number, pitch: number, roll: number, side: 'left' | 'right' } | null} */
  let g_captured = $state(null)

  const g_status_label = $derived.by(() => {
    if (g_model_status === 'pending') return '대기'
    if (g_model_status === 'loading') {
      const size = g_variant === 'fp32' ? '~94MB' : '~24MB'
      return `${VARIANT_LABEL_OBJ[g_variant]} 로딩 중 (${size})`
    }
    if (g_model_status === 'ready') return `${VARIANT_LABEL_OBJ[g_variant]} 준비`
    return '오류'
  })

  const g_status_color = $derived.by(() => {
    if (g_model_status === 'ready') return 'text-emerald-400'
    if (g_model_status === 'error') return 'text-red-400'
    if (g_model_status === 'loading') return 'text-amber-400'
    return 'text-zinc-400'
  })

  // 마운트 즉시 모델 프리로드와 카메라 시작을 병렬 실행. 직렬이면 첫 인상이 나쁨.
  $effect(() => {
    void preload_ort_session()
    void on_start_camera()
    return () => on_stop_camera()
  })

  // ONNX 세션을 백그라운드에서 미리 만든다. 첫 호출이 모델 페치 + WASM 컴파일을 트리거.
  async function preload_ort_session() {
    g_model_status = 'loading'
    try {
      await get_session()
      g_model_status = 'ready'
    } catch (err) {
      g_model_status = 'error'
      g_model_error = err instanceof Error ? err.message : String(err)
      console.error('[test] ort session load failed', err)
    }
  }

  // 카메라 권한 요청 + MediaPipe 비디오 랜드마커 로드 + rAF 루프 시작.
  async function on_start_camera() {
    const my_generation = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false
      g_face_detected = false
      g_face_bbox = null

      const landmarker = await get_video_landmarker()
      if (my_generation !== g_start_generation) return
      g_landmarker = landmarker

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      })
      if (my_generation !== g_start_generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      g_stream = stream

      // <video> 가 아직 마운트되지 않을 수 있어 한 틱 대기.
      await new Promise((r) => setTimeout(r, 0))
      if (my_generation !== g_start_generation) return
      if (!ref_this_video_el) throw new Error('video element missing')
      ref_this_video_el.srcObject = g_stream
      ref_this_video_el.onloadedmetadata = () => {
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

  // rAF 한 틱:
  //   - FRAME_SKIP 프레임마다 MediaPipe 검출로 bbox 갱신
  //   - 매 프레임 캔버스 다시 그리기 (보간 없이 최신 bbox 그대로 그림)
  //   - ORT_FRAME_SKIP 프레임마다 6DRepNet360 추론 (단일 비행 가드)
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return
    g_frame_counter++

    if (g_use_mediapipe && g_frame_counter % FRAME_SKIP === 0) {
      const result = detect_from_video(g_landmarker, ref_this_video_el)
      if (result?.faceLandmarks?.length) {
        g_face_detected = true
        g_face_bbox = compute_bbox_from_landmarks(result.faceLandmarks[0])
      } else {
        g_face_detected = false
        g_face_bbox = null
      }
    } else if (!g_use_mediapipe) {
      // 토글 OFF — MediaPipe 검출 결과를 들고 있지 않도록 매 프레임 정리.
      // (이전 ON 상태에서 남은 g_face_bbox 가 fallback 로직과 충돌하지 않게.)
      if (g_face_detected) g_face_detected = false
      if (g_face_bbox !== null) g_face_bbox = null
    }

    sync_canvas_size()
    if (ref_this_canvas_el && ref_this_video_el.videoWidth > 0) draw_bbox()

    if (
      g_model_status === 'ready' &&
      !g_ort_inflight &&
      g_frame_counter % ORT_FRAME_SKIP === 0 &&
      ref_this_video_el.videoWidth > 0
    ) {
      void run_ort_inference()
    }

    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  // 단일 비행 보장: 이전 추론이 끝나야 다음을 시작. 모바일 WASM 추론이 느려도 큐 폭주 방지.
  // 얼굴 검출 결과가 있으면 그 bbox 로, 없으면 중앙 정사각형으로 폴백 (검출 실패 중에도 latency 측정은 유지).
  async function run_ort_inference() {
    if (!ref_this_video_el || g_ort_inflight) return
    g_ort_inflight = true
    try {
      const bbox = g_face_bbox ?? compute_center_square_bbox(ref_this_video_el)
      const result = await predict_pose(ref_this_video_el, bbox)
      const euler = rotation_matrix_to_euler(result.rotation_matrix)
      g_yaw = euler.yaw
      g_pitch = euler.pitch
      g_roll = euler.roll
      g_latency_ms = result.latency_ms
      g_last_rotation = result.rotation_matrix
      // result.variant 는 추론 시작 시점 variant — 토글 후 inflight 였던 추론은 이전 variant
      // 로 라벨되므로 비교 표가 어긋나지 않는다.
      g_latency_per_variant_obj = {
        ...g_latency_per_variant_obj,
        [result.variant]: result.latency_ms,
      }
      update_target_zone()
    } catch (err) {
      console.error('[test] ort inference failed', err)
      g_model_error = err instanceof Error ? err.message : String(err)
    } finally {
      g_ort_inflight = false
    }
  }

  // variant 토글 핸들러 — 같은 variant 면 no-op. 새 variant 면 active 변경 + 세션 preload
  // (이미 캐시되어 있으면 즉시 ready 로 복귀).
  async function on_change_variant(new_variant) {
    if (new_variant === g_variant) return
    g_variant = new_variant
    set_active_variant(new_variant)
    g_model_error = null
    g_model_status = 'loading'
    try {
      await get_session()
      g_model_status = 'ready'
    } catch (err) {
      g_model_status = 'error'
      g_model_error = err instanceof Error ? err.message : String(err)
      console.error('[test] variant load failed', err)
    }
  }

  // 매 추론 직후 호출. 90°±TARGET_TOLERANCE 영역에 들어오면 진입 시각을 찍고, 유지되면 진행률 갱신.
  // HOLD_DURATION_MS 도달 시 capture_now 발사. 영역을 벗어나면 진입 시각/진행률 모두 리셋.
  function update_target_zone() {
    if (g_yaw === null || g_captured) return
    const distance = Math.abs(Math.abs(g_yaw) - TARGET_DEG)
    if (distance < TARGET_TOLERANCE) {
      if (g_target_entered_at === null) g_target_entered_at = performance.now()
      const elapsed = performance.now() - g_target_entered_at
      g_capture_progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
      if (elapsed >= HOLD_DURATION_MS) capture_now()
    } else {
      g_target_entered_at = null
      g_capture_progress = 0
    }
  }

  // 비디오 프레임을 좌우 반전(셀피 화면 그대로) 해서 PNG dataURL 로 캡처하고 결과 객체에 저장.
  // 한 번 g_captured 가 채워지면 update_target_zone 가드로 인해 reset 전까진 재캡처되지 않는다.
  function capture_now() {
    if (!ref_this_video_el || g_captured) return
    if (g_yaw === null || g_pitch === null || g_roll === null) return

    const c = document.createElement('canvas')
    c.width = ref_this_video_el.videoWidth
    c.height = ref_this_video_el.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    // 라이브 뷰가 scaleX(-1) 로 미러링이라 사용자가 본 그대로 저장하려면 동일하게 좌우 반전.
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(ref_this_video_el, 0, 0)

    g_captured = {
      image_url: c.toDataURL('image/png'),
      yaw: g_yaw,
      pitch: g_pitch,
      roll: g_roll,
      side: g_yaw > 0 ? 'right' : 'left',
    }
    g_target_entered_at = null
    g_capture_progress = 0
  }

  // 캡처 결과를 비우고 자동 트리거를 다시 활성화.
  function on_click_retry() {
    g_captured = null
    g_target_entered_at = null
    g_capture_progress = 0
    g_last_rotation = null // 다음 추론 결과로 새로 채워짐 — 캡처 잔상 큐브 회피
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

  // 3D 포즈 큐브 — 머리 좌표계의 정육면체를 회전행렬로 회전시켜 2D 캔버스에 투영.
  // 6DRepNet360 forward 출력이 (1, 3, 3) 회전행렬이므로 추가 변환 없이 정점에 직접 곱하면 됨.
  // 좌표계: x=right, y=down (이미지 컨벤션), z=out-of-screen. 캔버스가 video 와 함께 scaleX(-1)
  // 미러링되므로 별도 부호 보정 없이 그리면 사용자 perception 과 일치.
  const CUBE_VERTICES = [
    [-1, -1, -1], [+1, -1, -1], [+1, +1, -1], [-1, +1, -1], // 뒤 면 (z=-1, 머리 뒤쪽)
    [-1, -1, +1], [+1, -1, +1], [+1, +1, +1], [-1, +1, +1], // 앞 면 (z=+1, 얼굴 쪽)
  ]

  // 회전행렬 R 을 정점에 곱하고 perspective 로 투영해 2D 좌표 8 개 반환.
  // PERSPECTIVE = 4 는 viewer 거리(큐브 단위) — 너무 작으면 왜곡 심함, 너무 크면 평면처럼 보임.
  //
  // x 부호 반전 이유: 모델은 unmirrored 프레임을 입력받아 그 좌표계로 R 을 출력하지만,
  // 캔버스는 셀피 UX 를 위해 CSS scaleX(-1) 로 미러링되어 표시된다. R 을 그대로 적용하면
  // 큐브가 머리 회전과 반대 방향으로 도는 것처럼 보이므로, 그리기 시점에 x 를 한 번 더 반전해
  // 미러 변환과 상쇄시켜야 사용자 perception 과 일치한다.
  function project_cube(R, cx, cy, half) {
    const PERSPECTIVE = 4
    const out = []
    for (const v of CUBE_VERTICES) {
      const vx = R[0] * v[0] + R[1] * v[1] + R[2] * v[2]
      const vy = R[3] * v[0] + R[4] * v[1] + R[5] * v[2]
      const vz = R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
      const scale = PERSPECTIVE / (PERSPECTIVE - vz)
      out.push({ x: cx - vx * half * scale, y: cy + vy * half * scale })
    }
    return out
  }

  function stroke_quad(ctx, a, b, c, d) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.stroke()
  }

  function stroke_segment(ctx, a, b) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // 큐브를 그린다: 뒤 면(파랑·약간 흐림) → 연결 모서리(노랑) → 앞 면(빨강·강조).
  // 앞 면이 빨강인 이유: 얼굴이 향하는 방향을 한눈에 알 수 있게 — 사용자가 정면을 보면
  // 빨간 사각형이 카메라를 향하고, 옆을 보면 빨간 면이 옆으로 돈다.
  function draw_pose_cube(ctx, R, cx, cy, half) {
    const v = project_cube(R, cx, cy, half)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.strokeStyle = 'rgba(80,140,255,0.7)'
    ctx.lineWidth = 2.5
    stroke_quad(ctx, v[0], v[1], v[2], v[3])

    ctx.strokeStyle = 'rgba(255,210,80,0.85)'
    ctx.lineWidth = 2
    stroke_segment(ctx, v[0], v[4])
    stroke_segment(ctx, v[1], v[5])
    stroke_segment(ctx, v[2], v[6])
    stroke_segment(ctx, v[3], v[7])

    ctx.strokeStyle = 'rgba(255,80,100,0.95)'
    ctx.lineWidth = 3
    stroke_quad(ctx, v[4], v[5], v[6], v[7])
    ctx.restore()
  }

  // 캔버스를 클리어하고, g_show_cube 가 ON 이며 추론된 회전행렬이 있으면 face bbox 중앙에 3D
  // 포즈 큐브를 그린다. (face bbox 는 6D 추론 입력 crop 영역으로는 항상 사용됨, 단지 화면에
  // 그리지만 않을 뿐.)
  function draw_bbox() {
    if (!ref_this_canvas_el || !ref_this_video_el) return
    const ctx = ref_this_canvas_el.getContext('2d')
    if (!ctx) return

    const w = ref_this_canvas_el.width
    const h = ref_this_canvas_el.height
    ctx.clearRect(0, 0, w, h)

    if (!g_show_cube || g_last_rotation === null) return

    const bbox = g_face_bbox ?? compute_center_square_bbox(ref_this_video_el)
    const cx = (bbox.x + bbox.w / 2) * w
    const cy = (bbox.y + bbox.h / 2) * h
    // 큐브 크기는 bbox 소스별로 다르게 잡는다 — MediaPipe face bbox 는 얼굴 크기에 비례해
    // 큰 비율 (0.3) 이 face 와 비슷한 크기를 만들지만, 중앙 정사각형 폴백은 카메라 프레임 짧은
    // 변 전체이므로 같은 비율을 쓰면 cube 가 화면을 압도. 폴백 모드에선 작은 비율 (0.15) 로 보정.
    const cube_fraction = g_face_bbox !== null ? 0.3 : 0.15
    const half = Math.min(bbox.w * w, bbox.h * h) * cube_fraction
    draw_pose_cube(ctx, g_last_rotation, cx, cy, half)
  }

  // 각도 값 표시용 포맷 — null 이면 대시.
  function fmt_deg(v) {
    return v === null || v === undefined ? '—' : `${v.toFixed(1)}°`
  }
</script>

<main class="app-frame-page mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:flex-row md:items-start">
  <!-- 좌측 사이드바: 제어 + 정보. mobile 에선 위쪽 column 으로 자연 흐름. -->
  <div class="flex w-full flex-col gap-4 md:w-96 md:flex-shrink-0">
    <header class="flex items-baseline justify-between">
      <h1 class="text-lg font-bold text-zinc-100">6DRepNet360 브라우저 추론 검증</h1>
      <span class="text-xs text-zinc-400">/test · S14P31S107-137</span>
    </header>

    <div
      class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs"
    >
      <span class="text-zinc-400">모델</span>
      <span class="font-bold {g_status_color}">{g_status_label}</span>
      {#if g_latency_ms !== null}
        <span class="ml-auto text-zinc-400">
          세션 추론 <b class="font-bold tabular-nums text-zinc-100">{g_latency_ms.toFixed(0)}ms</b>
        </span>
      {/if}
    </div>

    <!--
      Variant 토글: FP32 / INT8 dynamic / INT8 static 즉시 전환.
      같은 자세에서 토글하면서 하단 latency 칸 비교가 핵심 use case.
      docs/sixdrepnet360_quantization.md 의 CPU EP 실측 결과 (FP32 635ms / dynamic 799ms / static 44ms)
      가 브라우저 WASM 에서 어떻게 나오는지 본인 디바이스로 직접 확인.
    -->
    <div
      class="flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs"
    >
      <div class="flex items-center gap-1.5" role="radiogroup" aria-label="양자화 variant 선택">
        <span class="mr-auto text-zinc-400">양자화</span>
        {#each MODEL_VARIANT_ARR as variant}
          <button
            type="button"
            role="radio"
            aria-checked={g_variant === variant}
            disabled={g_variant === variant && g_model_status === 'loading'}
            onclick={() => on_change_variant(variant)}
            class="rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60 {g_variant ===
            variant
              ? 'border-fuchsia-500/60 bg-fuchsia-950/30 text-fuchsia-300'
              : 'border-zinc-600 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}"
          >
            {variant}
          </button>
        {/each}
      </div>

      <!-- variant 별 최근 latency 비교 — 토글 후 같은 자세에서 한 사이클 추론 들어오면 채워짐. -->
      <div class="grid grid-cols-3 gap-1 text-[10px] tabular-nums">
        {#each MODEL_VARIANT_ARR as variant}
          <div
            class="flex flex-col gap-0.5 rounded-sm border px-1.5 py-1 {g_variant === variant
              ? 'border-fuchsia-500/30 bg-fuchsia-950/15'
              : 'border-zinc-700/60 bg-zinc-950/40'}"
          >
            <span class="text-[9px] font-bold uppercase text-zinc-500">{variant}</span>
            <span class="text-[10px] text-zinc-300">{VARIANT_LABEL_OBJ[variant]}</span>
            <span class="font-bold text-zinc-100">
              {g_latency_per_variant_obj[variant] === null
                ? '— ms'
                : `${g_latency_per_variant_obj[variant].toFixed(0)} ms`}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div
      class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs"
    >
      <span class="text-zinc-400">Face crop</span>
      <button
        type="button"
        onclick={() => (g_use_mediapipe = !g_use_mediapipe)}
        class="ml-auto rounded-md border px-2 py-1 text-[10px] font-bold transition-colors {g_use_mediapipe
          ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300'
          : 'border-zinc-600 bg-zinc-900 text-zinc-400'}"
        aria-pressed={g_use_mediapipe}
      >
        MediaPipe {g_use_mediapipe ? 'ON · 얼굴 추적' : 'OFF · 중앙 정사각형'}
      </button>
    </div>

    <!--
      포즈 큐브 토글 — 6축(yaw/pitch/roll) 시각화를 위해 얼굴 위에 그려지는 3D 큐브의 표시 여부.
      OFF 면 카메라 화면이 깨끗해져 yaw/pitch/roll 수치 패널만으로 검수 가능. 기본 ON 으로
      기존 동작 유지.
    -->
    <div
      class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs"
    >
      <span class="text-zinc-400">포즈 큐브</span>
      <button
        type="button"
        onclick={() => (g_show_cube = !g_show_cube)}
        class="ml-auto rounded-md border px-2 py-1 text-[10px] font-bold transition-colors {g_show_cube
          ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300'
          : 'border-zinc-600 bg-zinc-900 text-zinc-400'}"
        aria-pressed={g_show_cube}
      >
        {g_show_cube ? 'ON · 6축 시각화' : 'OFF'}
      </button>
    </div>

    {#if g_model_error}
      <div class="rounded-md border border-red-500 bg-red-950/40 px-3 py-2 text-xs text-red-300">
        <p class="font-bold">ONNX 추론 오류</p>
        <p class="mt-0.5 break-all font-mono">{g_model_error}</p>
      </div>
    {/if}

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

    <section class="flex flex-col gap-1 text-xs leading-relaxed text-zinc-400">
      <p>
        <b class="text-zinc-200">자동 캡처.</b>
        yaw 가 ±{TARGET_DEG}°(허용 오차 ±{TARGET_TOLERANCE}°) 영역에서 {HOLD_DURATION_MS / 1000}초 동안 유지되면 자동으로 캡처됩니다.
        좌우 어느 쪽이든 인식하며, 캡처 후엔 "다시 시도" 버튼으로 재트리거.
      </p>
      <p>
        <b class="text-zinc-200">측정 빈도.</b>
        추론은 단일 비행 가드로 throttling — 모델 latency 가 곧 실효 빈도입니다 (300ms 면 ≈3Hz).
        모바일에서 어느 정도 따라오는지 latency 표시로 확인하세요.
      </p>
    </section>
  </div>

  <!-- 우측: 카메라 프리뷰 (3:4). md 이상에선 sidebar 옆에 배치, mobile 에선 sidebar 아래로. -->
  <div class="flex w-full flex-col items-center gap-4 md:flex-1">
    <!--
      max-h-[calc(100vh-220px)] — viewport 가 짧은 디바이스 (저해상도 노트북 등) 에서 카메라가
      화면을 다 차지해 다시 시도 버튼이 밀려나는 문제 방지.
      aspect-[3/4] 는 width 결정 시 height 자동인데, max-h 가 발동하면 거꾸로 height cap →
      비율 유지를 위해 width 가 줄어든다. 220px 는 헤더 + 다시 시도 버튼 + 페이지 패딩 여유.
    -->
    <div class="relative aspect-[3/4] w-full max-h-[calc(100vh-220px)] max-w-[480px] overflow-hidden rounded-lg bg-black">
    <!-- 라이브 뷰 — 캡처 후에도 video 엘리먼트는 유지(언마운트 → MediaStream 재시작 비용 회피) -->
    <video
      bind:this={ref_this_video_el}
      class="absolute inset-0 h-full w-full object-cover {g_captured ? 'invisible' : ''}"
      style="transform: scaleX(-1);"
      playsinline
      autoplay
      muted
    ></video>
    <canvas
      bind:this={ref_this_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full object-cover {g_captured
        ? 'invisible'
        : ''}"
      style="transform: scaleX(-1);"
    ></canvas>

    {#if g_captured}
      <!-- 캡처 결과 -->
      <img
        src={g_captured.image_url}
        alt="captured side profile"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div
        class="pointer-events-none absolute right-2.5 top-2.5 z-10 grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 rounded-lg border border-emerald-400/50 bg-black/65 px-3 py-2 text-[11px] tabular-nums text-zinc-100 backdrop-blur-sm"
        aria-label="캡처 결과"
      >
        <div class="col-span-2 mb-0.5 text-[10px] font-bold text-emerald-300">
          ✓ {g_captured.side === 'right' ? '오른쪽' : '왼쪽'} 측면 캡처
        </div>
        <span class="text-white/65">yaw</span><b class="text-right tabular-nums"
          >{g_captured.yaw.toFixed(1)}°</b
        >
        <span class="text-white/65">pitch</span><b class="text-right tabular-nums"
          >{g_captured.pitch.toFixed(1)}°</b
        >
        <span class="text-white/65">roll</span><b class="text-right tabular-nums"
          >{g_captured.roll.toFixed(1)}°</b
        >
      </div>
    {:else}
      <!-- 우측 상단: 6DRepNet360 라이브 결과 -->
      <div
        class="pointer-events-none absolute right-2.5 top-2.5 z-10 grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] tabular-nums text-zinc-100 backdrop-blur-sm"
        aria-label="6DRepNet360 결과"
      >
        <div class="col-span-2 mb-0.5 text-[10px] font-bold text-fuchsia-300">6DRepNet360</div>
        <span class="text-white/65">yaw</span><b class="text-right tabular-nums">{fmt_deg(g_yaw)}</b
        >
        <span class="text-white/65">pitch</span><b class="text-right tabular-nums"
          >{fmt_deg(g_pitch)}</b
        >
        <span class="text-white/65">roll</span><b class="text-right tabular-nums"
          >{fmt_deg(g_roll)}</b
        >
      </div>

      <!-- 좌측 상단: 90° 홀드 진행률 (타깃 영역 진입 시에만 표시) -->
      {#if g_capture_progress > 0}
        <div
          class="pointer-events-none absolute left-2.5 top-2.5 z-10 flex w-44 flex-col gap-1 rounded-lg border border-emerald-400/50 bg-black/65 px-3 py-2 text-[11px] backdrop-blur-sm"
          aria-live="polite"
        >
          <div class="flex items-baseline justify-between text-emerald-300">
            <span class="font-bold">측면 자세 유지 중</span>
            <span class="tabular-nums">{Math.round(g_capture_progress)}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-sm bg-emerald-900/50">
            <div
              class="h-full bg-emerald-400 transition-[width] duration-100"
              style="width: {g_capture_progress}%;"
            ></div>
          </div>
        </div>
      {/if}

      <!-- 하단: 검출/안내 상태 -->
      <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <span
          class="inline-block rounded-full border-[1.5px] px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm {g_use_mediapipe && g_face_detected
            ? 'border-emerald-400/70 text-emerald-300'
            : 'border-white/25 text-zinc-200'}"
          style="background: rgba(0,0,0,0.55);"
        >
          {#if g_capture_progress > 0}
            그대로 유지하세요
          {:else if !g_use_mediapipe}
            중앙 박스에 얼굴을 맞추고 좌우 90°로 돌리세요
          {:else if !g_face_detected}
            얼굴이 감지되지 않습니다
          {:else}
            고개를 좌우 90°로 천천히 돌리세요
          {/if}
        </span>
      </div>
    {/if}
  </div>

    {#if g_captured}
      <button
        type="button"
        onclick={on_click_retry}
        class="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100 transition-colors hover:bg-zinc-700"
      >
        다시 시도
      </button>
    {/if}
  </div>
</main>
