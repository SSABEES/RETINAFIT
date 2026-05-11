<script>
  /**
   * AR 미지원 환경(웹/iOS) 용 Three.js 가상 안경 try-on. arfitting.svelte 의 카메라 영역에
   * mount 되어 getUserMedia + MediaPipe FaceLandmarker(video mode) + Three.js 로 GLB 안경을
   * 얼굴 위에 실시간 합성한다. 캡처는 1/2/3 버튼으로 수동 (Flutter native AR UX 와 정합).
   *
   * 부모 부담: selected_glasses_obj prop 으로 안경 선택 알림 + oncaptured 콜백으로 슬롯 갱신.
   * 부모는 GLB url 추출/모델 다운로드/카메라 라이프사이클을 신경쓰지 않음.
   */
  import { onMount } from 'svelte'
  import { Group as ThreeGroup, Matrix4, Quaternion, Vector3 } from 'three'
  import { get_video_landmarker, detect_from_video, clear_video_cache } from '@/lib/mediapipe/face_landmarker.js'
  import { init_three_scene, swap_glasses_child } from '@/lib/tryon/three_scene.js'
  import { ensure_glasses_loaded, instantiate_glasses } from '@/lib/tryon/glasses_loader.js'
  import { apply_face_pose, apply_auto_alignment, compute_yaw_deg } from '@/lib/tryon/face_alignment.js'
  import { get_virtual_fitting_model_url } from '@/lib/flutter'
  import { push_error_toast } from '@/lib/stores/toast'

  /**
   * @typedef {{
   *   id: number,
   *   glasses_no: number,
   *   model: string,
   *   brand: string,
   *   glasses_3d_url: string,
   * } | null} SelectedGlasses
   *
   * @typedef {'front' | 'left' | 'right'} SlotKey
   */

  let {
    /** @type {SelectedGlasses} */
    selected_glasses_obj = null,
    /** @type {(slot_key: SlotKey, blob: Blob) => void} */
    oncaptured = () => {},
  } = $props()

  // 1번/2번/3번 버튼 메타 — Flutter FaceFittingScreen 의 CAPTURE_SLOT_ARR 와 정합.
  const SLOT_KEY_ARR = [
    { key: 'front', label: '1번' },
    { key: 'left', label: '2번' },
    { key: 'right', label: '3번' },
  ]

  // Flutter FaceFittingScreen.kt:92 의 TEMPLE_HIDE_YAW_DEG = 5f 와 정합.
  const TEMPLE_HIDE_YAW_DEG = 5
  // MediaPipe 검출 빈도 — 1 = 매 프레임 (60Hz desktop).
  const FRAME_SKIP = 1
  // pose 보간 강도 — 0.5 = jitter 흡수 + 빠른 반응.
  const POSE_LERP = 0.5

  /** @type {HTMLVideoElement | null} */
  let ref_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_three_canvas_el = $state(null)

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)
  let g_face_detected = $state(false)
  let g_glb_loading = $state(false)
  let g_capturing = $state(false)

  // 비반응형 내부 상태
  let g_start_generation = 0
  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {ReturnType<typeof init_three_scene> | null} */
  let g_scene_ctx = null
  /** @type {number | null} */
  let g_raf_id = null
  let g_frame_counter = 0

  /** @type {string | null} */
  let g_active_glb_url = null
  /** @type {string | null} */
  let g_pending_glb_url = null

  // pose 보간 (test.svelte 와 동일 패턴)
  const g_target_translation = new Vector3()
  const g_target_quaternion = new Quaternion()
  const g_current_translation = new Vector3()
  const g_current_quaternion = new Quaternion()
  const g_decompose_scale = new Vector3()
  const g_pose_temp_matrix = new Matrix4()
  let g_pose_initialized = false

  // 마운트 시 카메라 + landmarker 시작. 언마운트 시 모두 해제.
  onMount(() => {
    void start_camera()
    return () => {
      stop_camera()
      g_scene_ctx?.dispose()
      g_scene_ctx = null
    }
  })

  // three.js 캔버스가 mount 되면 1회 init.
  $effect(() => {
    if (!ref_three_canvas_el || g_scene_ctx) return
    g_scene_ctx = init_three_scene({ canvas: ref_three_canvas_el, fov_deg: 63 })
  })

  // selected_glasses_obj 변경 → GLB swap.
  $effect(() => {
    const url = selected_glasses_obj ? get_virtual_fitting_model_url(selected_glasses_obj) : ''
    if (!url) return
    void load_and_swap_glasses(url)
  })

  // 카메라 권한 + MediaPipe 비디오 랜드마커 로드 + rAF 시작.
  async function start_camera() {
    const my_gen = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false
      g_face_detected = false

      const landmarker = await get_video_landmarker()
      if (my_gen !== g_start_generation) return
      g_landmarker = landmarker

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      })
      if (my_gen !== g_start_generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      g_stream = stream

      // <video> 가 아직 마운트 안 됐을 수 있어 한 틱 대기 (test.svelte 패턴).
      await new Promise((r) => setTimeout(r, 0))
      if (my_gen !== g_start_generation) return
      if (!ref_video_el) throw new Error('video element missing')
      ref_video_el.srcObject = g_stream
      ref_video_el.onloadedmetadata = () => {
        if (my_gen !== g_start_generation || !ref_video_el || !g_stream) return
        void ref_video_el.play()
        if (g_scene_ctx) {
          g_scene_ctx.resize(ref_video_el.videoWidth, ref_video_el.videoHeight)
        }
        on_loop_frame()
      }
    } catch (err) {
      stop_camera()
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
  function stop_camera() {
    g_start_generation++
    if (g_raf_id !== null) {
      cancelAnimationFrame(g_raf_id)
      g_raf_id = null
    }
    if (g_stream) {
      g_stream.getTracks().forEach((t) => t.stop())
      g_stream = null
    }
    if (ref_video_el) {
      ref_video_el.onloadedmetadata = null
      ref_video_el.srcObject = null
    }
    clear_video_cache()
  }

  // 선택된 GLB 를 캐시로부터 받아 씬에 swap. 캐시 원본 보호용 instantiate_glasses 로 clone.
  async function load_and_swap_glasses(url) {
    if (!g_scene_ctx) return
    if (g_active_glb_url === url) {
      g_pending_glb_url = null
      return
    }
    g_pending_glb_url = url
    g_glb_loading = true
    try {
      const cached = await ensure_glasses_loaded(url)
      // race: 다른 카드 클릭으로 이 url 이 더 이상 pending 아니면 무시.
      if (g_pending_glb_url !== url) return
      const { scene, calibration } = instantiate_glasses(cached)
      const align_group = new ThreeGroup()
      apply_auto_alignment(align_group, calibration)
      align_group.add(scene)
      // override_group 은 운영에선 identity 로 그대로 둔다 (사용자 슬라이더 보정 없음).
      const override_group = new ThreeGroup()
      override_group.add(align_group)
      swap_glasses_child(
        g_scene_ctx.face_anchor_offset_group,
        override_group,
        g_scene_ctx.face_anchor_marker,
      )
      g_active_glb_url = url
    } catch (err) {
      push_error_toast('안경 모델을 불러오지 못했습니다.')
      console.error('[tryon-fallback] glb load failed', url, err)
    } finally {
      g_glb_loading = false
      if (g_pending_glb_url === url) g_pending_glb_url = null
    }
  }

  // FRAME_SKIP 마다 MediaPipe 검출 → target pose 갱신, 매 프레임 보간 + render + 다리 가시성.
  function on_loop_frame() {
    if (!g_stream || !ref_video_el || !g_landmarker || !g_scene_ctx) return
    g_frame_counter++

    if (g_frame_counter % FRAME_SKIP === 0) {
      const result = detect_from_video(g_landmarker, ref_video_el)
      if (result?.faceLandmarks?.length && result.facialTransformationMatrixes?.length) {
        g_face_detected = true
        g_pose_temp_matrix.fromArray(result.facialTransformationMatrixes[0].data)
        g_pose_temp_matrix.decompose(g_target_translation, g_target_quaternion, g_decompose_scale)
        g_scene_ctx.glasses_root_obj.visible = true
        if (!g_pose_initialized) {
          g_current_translation.copy(g_target_translation)
          g_current_quaternion.copy(g_target_quaternion)
          g_pose_initialized = true
        }
        update_temple_visibility(compute_yaw_deg(g_target_quaternion))
      } else {
        g_face_detected = false
        g_scene_ctx.glasses_root_obj.visible = false
      }
    }
    if (g_pose_initialized && g_scene_ctx.glasses_root_obj.visible) {
      g_current_translation.lerp(g_target_translation, POSE_LERP)
      g_current_quaternion.slerp(g_target_quaternion, POSE_LERP)
      g_scene_ctx.glasses_root_obj.matrix.compose(
        g_current_translation,
        g_current_quaternion,
        g_decompose_scale,
      )
      g_scene_ctx.glasses_root_obj.matrixWorldNeedsUpdate = true
    }
    g_scene_ctx.render()
    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  // 안경 다리 노드(temple_left/right) 가시성을 yaw 로 토글. 분리 노드가 없는 GLB 는 noop.
  function update_temple_visibility(yaw_deg) {
    if (!g_scene_ctx) return
    const override_group = g_scene_ctx.face_anchor_offset_group.children.find(
      (c) => c !== g_scene_ctx.face_anchor_marker,
    )
    if (!override_group) return
    const tl = override_group.getObjectByName('temple_left')
    const tr = override_group.getObjectByName('temple_right')
    if (tl) tl.visible = yaw_deg < -TEMPLE_HIDE_YAW_DEG
    if (tr) tr.visible = yaw_deg > TEMPLE_HIDE_YAW_DEG
  }

  // 캡처 버튼 클릭 — video + three.js 를 미러된 픽셀로 합성해 Blob 으로 부모 전달.
  async function on_click_capture(slot_key) {
    if (!g_face_detected || !ref_video_el || !ref_three_canvas_el) return
    if (g_capturing) return
    g_capturing = true
    try {
      const w = ref_video_el.videoWidth
      const h = ref_video_el.videoHeight
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const ctx = off.getContext('2d')
      if (!ctx) return
      // CSS scaleX(-1) 미러를 픽셀로 굳혀 native AR 결과(셀피처럼 좌우 반전)와 정합.
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(ref_video_el, 0, 0, w, h)
      ctx.drawImage(ref_three_canvas_el, 0, 0, w, h)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const blob = await new Promise((resolve) =>
        off.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
      )
      if (!blob) {
        push_error_toast('캡처 이미지를 만들지 못했습니다.')
        return
      }
      oncaptured(slot_key, blob)
    } finally {
      g_capturing = false
    }
  }
</script>

<div class="relative h-full w-full bg-black">
  <video
    bind:this={ref_video_el}
    class="absolute inset-0 h-full w-full object-cover"
    style="transform: scaleX(-1); transform-origin: center;"
    autoplay
    muted
    playsinline
  ></video>
  <canvas
    bind:this={ref_three_canvas_el}
    class="pointer-events-none absolute inset-0 h-full w-full"
    style="transform: scaleX(-1); transform-origin: center;"
  ></canvas>

  {#if g_init_error}
    <div
      class="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white"
    >
      {g_init_error}
      {#if g_permission_denied}
        <span class="ml-1 text-[10px] opacity-80">
          브라우저 잠금 아이콘에서 카메라 접근을 허용해 주세요.
        </span>
      {/if}
    </div>
  {/if}

  {#if g_glb_loading}
    <div
      class="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-black/60 px-3 py-1 text-xs text-zinc-100"
    >
      안경 모델 불러오는 중...
    </div>
  {/if}

  {#if !g_face_detected && !g_init_error && !g_glb_loading}
    <div
      class="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-black/60 px-3 py-1 text-xs text-zinc-100"
    >
      얼굴을 화면 안에 비춰주세요
    </div>
  {/if}

  <div class="absolute inset-x-0 bottom-6 flex justify-center gap-3">
    {#each SLOT_KEY_ARR as item (item.key)}
      <button
        type="button"
        disabled={!g_face_detected || g_capturing}
        onclick={() => on_click_capture(item.key)}
        aria-label={`${item.label} 촬영`}
        class="cursor-pointer rounded-full bg-[var(--retinal-primary-600)] px-6 py-3 text-sm font-extrabold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {item.label}
      </button>
    {/each}
  </div>
</div>
