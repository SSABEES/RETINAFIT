<script>
  /**
   * AR 미지원 환경(웹/iOS) 용 Three.js 가상 안경 try-on.
   * /test 검증 페이지(`src/router/test.svelte`) 의 안경 렌더링 로직을 그대로 옮긴 컴포넌트.
   * Flutter native AR 경로와 완전히 분리된 코드 — arfitting.svelte 가 환경에 따라 둘 중 하나만 mount.
   *
   * 부모 부담: selected_glasses_obj prop 으로 안경 선택 알림 + oncaptured 콜백으로 슬롯 갱신.
   * 부모는 GLB url 추출 / 모델 다운로드 / 카메라 라이프사이클을 신경쓰지 않음.
   *
   * test 페이지에 있던 디버그 UI (슬라이더, 토글, face landmark overlay) 는 운영용이 아니라 제외.
   * 안경 보정값은 슬라이더의 default 그대로 const 로 박아두며, 향후 필요 시 노출 가능한 형태.
   */
  import { onMount } from 'svelte'
  import { Group as ThreeGroup, Matrix4, Plane, Quaternion, Vector3 } from 'three'
  import {
    get_video_landmarker,
    detect_from_video,
    clear_video_cache,
  } from '@/lib/mediapipe/face_landmarker.js'
  import { init_three_scene, swap_glasses_child } from '@/lib/tryon/three_scene.js'
  import { ensure_glasses_loaded, instantiate_glasses } from '@/lib/tryon/glasses_loader.js'
  import { apply_auto_alignment, compute_yaw_deg } from '@/lib/tryon/face_alignment.js'
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
    /** @type {SlotKey | null} */
    next_slot_key = null,
    /** @type {(slot_key: SlotKey, blob: Blob) => void} */
    oncaptured = () => {},
  } = $props()

  // test 페이지 슬라이더 default 그대로 const 화. 향후 사용자 노출 필요해지면 $state 로 풀면 됨.
  // override_group transform 단위는 align_group 의 cm 좌표계 — 자산 단위 무관 1 칸 = 1cm.
  const POSE_OVERRIDE = Object.freeze({
    offset_x: 0,
    offset_y: 0,
    offset_z: 0,
    rot_x_deg: 0,
    rot_y_deg: 0,
    rot_z_deg: 0,
    scale_factor: 1,
  })
  // MediaPipe 검출 빈도 — 1 = 매 프레임 (60Hz). lag 없음.
  const FRAME_SKIP = 1
  // pose 보간 강도 — 1.0 = 보간 완전 제거, 검출 결과 그대로 적용.
  // 남은 lag = MediaPipe inference + video frame transit (불가피한 하한). jitter 가 시인되면
  // 0.85-0.9 로 절충 가능.
  const POSE_LERP = 1.0
  // PerspectiveCamera fov (degree). test 페이지의 슬라이더 default 와 정합.
  const FOV_DEG = 63
  // 안경 mesh polygonOffset — face_occluder 와 z 충돌로 다리가 잘리는 것 방지. fragment depth 를
  // 카메라쪽으로 끌어와 face mesh 보다 항상 앞에 그려지게. test 페이지 슬라이더 default 와 정합.
  const POLY_OFFSET_ENABLED = true
  const POLY_OFFSET_FACTOR = -15
  const POLY_OFFSET_UNITS = -8
  // 다리 끝 (귀 영역) 자르기 — face anchor frame 의 z 임계점 (cm). z<clip_z 영역 (face 뒤쪽) clip.
  // plane_a 가 대칭 clip 보장 + plane_b 가 yaw 비대칭 (한쪽 다리 더 짧게).
  const TEMPLE_CLIP_ENABLED = true
  const TEMPLE_CLIP_Z = -9
  const TEMPLE_CLIP_YAW_ASYM = -0.03
  // head_back_occluder — test 페이지에선 default off (다리 옆 / 뒤 가리개로 효용 < 부작용). 운영도
  // 동일. yaw gate 의 default 임계도 같이 박아둠 (활성화 시 동작 유지).
  const HEAD_OCC_USE = false
  const HEAD_OCC_YAW_GATE_ENABLED = true
  const HEAD_OCC_YAW_HIDE_START = 15
  const HEAD_OCC_YAW_HIDE_END = 45

  /** @type {HTMLVideoElement | null} */
  let ref_video_el = $state(null)
  // 백드롭 video — 부모 영역(가로형) 의 양옆까지 카메라 시야로 채워 letterbox 를 없애는 시각적 fill 용.
  // 같은 stream 을 한 번 더 paint 할 뿐 decode 는 메인 video 와 공유 (성능 영향 미미). camera_view.svelte 와 동일 패턴.
  /** @type {HTMLVideoElement | null} */
  let ref_this_backdrop_video_el = $state(null)
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

  // pose 보간 — 마지막 검출의 target + 매 프레임 current 를 보간 (test 페이지와 동일 패턴).
  const g_target_translation = new Vector3()
  const g_target_quaternion = new Quaternion()
  const g_current_translation = new Vector3()
  const g_current_quaternion = new Quaternion()
  const g_decompose_scale = new Vector3()
  const g_pose_temp_matrix = new Matrix4()
  let g_pose_initialized = false
  // 다리 끝 clip plane 두 개 (union). plane_a: 대칭 (정면 / 회전 무관 다리 끝 clip 보장). plane_b:
  // yaw 비대칭 (한쪽 다리만 더 짧음). face_anchor_offset_group.matrixWorld 로 매 프레임 world 변환.
  const g_temple_clip_plane_a = new Plane(new Vector3(0, 0, 1), 6)
  const g_temple_clip_plane_b = new Plane(new Vector3(0, 0, 1), 6)

  // 사용자 보정 (cm 단위 평행이동 + deg 회전 + uniform scale) 을 override_group transform 에 적용.
  // override_group 은 자동 정렬 group 의 *부모* 라, 단위는 자산 모델 단위가 아닌 cm.
  function apply_pose_overrides(override_group, ox, oy, oz, rx_deg, ry_deg, rz_deg, sf) {
    if (!override_group) return
    override_group.position.set(ox, oy, oz)
    const k = Math.PI / 180
    override_group.rotation.set(rx_deg * k, ry_deg * k, rz_deg * k)
    override_group.scale.setScalar(sf)
  }

  // 안경 mesh 의 material 전체에 polygonOffset 설정 — fragment depth 를 카메라쪽으로 끌어와 face
  // mesh 보다 앞에 그려지게. 다리가 face mesh 에 잘리는 z-fighting 해소.
  function apply_glasses_poly_offset(root_obj, enabled, factor, units) {
    if (!root_obj) return
    root_obj.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        m.polygonOffset = enabled
        m.polygonOffsetFactor = factor
        m.polygonOffsetUnits = units
      }
    })
  }

  // 안경 mesh material 의 clippingPlanes 에 다리 끝 clip plane reference 등록. plane.normal /
  // .constant 는 매 프레임 face_anchor_offset_group.matrixWorld 따라 갱신되므로 reference 만 한 번
  // 묶어두면 자동 반영. shader 재컴파일 필요 → m.needsUpdate=true.
  function apply_glasses_clip(root_obj, enabled, planes) {
    if (!root_obj) return
    root_obj.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        m.clippingPlanes = enabled ? planes : []
        m.needsUpdate = true
      }
    })
  }

  // 마운트 시 카메라 + landmarker 시작. 언마운트 시 모두 해제.
  onMount(() => {
    void start_camera()
    return () => {
      stop_camera()
      g_scene_ctx?.dispose()
      g_scene_ctx = null
    }
  })

  // three.js 캔버스가 mount 되면 1회 init. 모든 occluder default (face_occluder 위치 (0,0,-1) +
  // head_back_occluder ellipsoid scale 8/11/14 / position (0,0,-2) + face_anchor_offset_group
  // (0, 3.27, 5.24)) 가 init_three_scene 안에서 세팅되어 추가 셋업 불필요.
  $effect(() => {
    if (!ref_three_canvas_el || g_scene_ctx) return
    g_scene_ctx = init_three_scene({ canvas: ref_three_canvas_el, fov_deg: FOV_DEG })
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

      // 가로 1280×720 (16:9) 로 요청 — camera_view.svelte 와 동일 패턴.
      // 부모 영역(arfitting 의 카메라 섹션) 이 가로형이라 3:4 stream 으로는 양옆에 letterbox 가 생기거나
      // 위·아래가 잘려 보임. 16:9 stream 을 object-cover 로 풀필하면 카메라 시야가 자연스럽게 가로 영역을 채움.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          // 60Hz 지원 카메라/브라우저면 검출 주기 33ms → 16ms 로 단축. 미지원 시 ideal 무시.
          frameRate: { ideal: 60 },
        },
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
      // 같은 stream 을 백드롭 video 에도 연결 — 별도 onloadedmetadata 없이 자동재생만.
      if (ref_this_backdrop_video_el) {
        ref_this_backdrop_video_el.srcObject = g_stream
        ref_this_backdrop_video_el.play().catch(() => {})
      }
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
    if (ref_this_backdrop_video_el) {
      ref_this_backdrop_video_el.srcObject = null
    }
    clear_video_cache()
  }

  // 선택된 GLB 를 캐시로부터 받아 씬에 swap. 캐시 원본 보호용 instantiate_glasses 로 clone.
  // test 페이지의 load_and_swap_glasses 와 동일한 group 합성 패턴:
  // face_anchor_offset_group → override_group → align_group → GLB scene
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
      // 자동 정렬 group 위에 사용자 보정 group 을 한 단계 끼워 단위가 자산 무관 cm 가 되게.
      const override_group = new ThreeGroup()
      override_group.add(align_group)
      // face_anchor_offset_group 의 자식으로 둔다 (그 group 이 미간 정합 layer). marker 는 보존.
      swap_glasses_child(
        g_scene_ctx.face_anchor_offset_group,
        override_group,
        g_scene_ctx.face_anchor_marker,
      )
      // 새 child 에도 override default 즉시 반영 (test 페이지와 동일 패턴).
      apply_pose_overrides(
        override_group,
        POSE_OVERRIDE.offset_x,
        POSE_OVERRIDE.offset_y,
        POSE_OVERRIDE.offset_z,
        POSE_OVERRIDE.rot_x_deg,
        POSE_OVERRIDE.rot_y_deg,
        POSE_OVERRIDE.rot_z_deg,
        POSE_OVERRIDE.scale_factor,
      )
      // polygonOffset — z-fighting 해소 (다리 잘림 방지). 안경 mesh material 에 적용.
      apply_glasses_poly_offset(
        scene,
        POLY_OFFSET_ENABLED,
        POLY_OFFSET_FACTOR,
        POLY_OFFSET_UNITS,
      )
      // 다리 끝 clip plane reference 등록 — plane 의 normal / constant 는 매 프레임 갱신.
      apply_glasses_clip(scene, TEMPLE_CLIP_ENABLED, [g_temple_clip_plane_a, g_temple_clip_plane_b])
      // head_back_occluder 토글 — 운영 default off (test 와 동일).
      g_scene_ctx.head_back_occluder.visible = HEAD_OCC_USE
      g_active_glb_url = url
    } catch (err) {
      push_error_toast('안경 모델을 불러오지 못했습니다.')
      console.error('[tryon-fallback] glb load failed', url, err)
    } finally {
      g_glb_loading = false
      if (g_pending_glb_url === url) g_pending_glb_url = null
    }
  }

  // rAF 한 틱: FRAME_SKIP 마다 MediaPipe 검출 + target pose 갱신, 매 프레임 보간 + render.
  // test 페이지의 on_loop_frame 과 동일 알고리즘.
  function on_loop_frame() {
    if (!g_stream || !ref_video_el || !g_landmarker || !g_scene_ctx) return
    g_frame_counter++

    if (g_frame_counter % FRAME_SKIP === 0) {
      const result = detect_from_video(g_landmarker, ref_video_el)
      if (result?.faceLandmarks?.length) {
        const matrices = result.facialTransformationMatrixes
        if (matrices?.length) {
          // column-major matrix → temp 에 그대로 복사 → decompose 해 target 갱신.
          g_pose_temp_matrix.fromArray(matrices[0].data)
          g_pose_temp_matrix.decompose(g_target_translation, g_target_quaternion, g_decompose_scale)
          g_face_detected = true
          g_scene_ctx.glasses_root_obj.visible = true
          if (!g_pose_initialized) {
            g_current_translation.copy(g_target_translation)
            g_current_quaternion.copy(g_target_quaternion)
            g_pose_initialized = true
          }
        } else {
          g_face_detected = false
          g_scene_ctx.glasses_root_obj.visible = false
        }
      } else {
        g_face_detected = false
        g_scene_ctx.glasses_root_obj.visible = false
      }
    }
    // 매 프레임: current 를 target 으로 lerp/slerp → matrix 합성. 검출 사이를 부드럽게 따라감.
    if (g_pose_initialized && g_scene_ctx.glasses_root_obj.visible) {
      g_current_translation.lerp(g_target_translation, POSE_LERP)
      g_current_quaternion.slerp(g_target_quaternion, POSE_LERP)
      g_scene_ctx.glasses_root_obj.matrix.compose(
        g_current_translation,
        g_current_quaternion,
        g_decompose_scale,
      )
      g_scene_ctx.glasses_root_obj.matrixWorldNeedsUpdate = true
      // head_back occluder yaw gate (활성 시) — yaw 가 임계 넘으면 점진적 scale 0.
      const yaw_deg = compute_yaw_deg(g_current_quaternion)
      const abs_yaw = Math.abs(yaw_deg)
      if (HEAD_OCC_USE) {
        const s = Math.min(HEAD_OCC_YAW_HIDE_START, HEAD_OCC_YAW_HIDE_END)
        const e = Math.max(HEAD_OCC_YAW_HIDE_START, HEAD_OCC_YAW_HIDE_END)
        const span = e - s
        const factor = !HEAD_OCC_YAW_GATE_ENABLED
          ? 1
          : abs_yaw <= s
            ? 1
            : abs_yaw >= e || span <= 0
              ? 0
              : (e - abs_yaw) / span
        const head_occ = g_scene_ctx.head_back_occluder
        if (factor <= 0.001) {
          head_occ.visible = false
        } else {
          head_occ.visible = true
          // init_three_scene default scale (8, 11, 14) 에 factor 곱.
          head_occ.scale.set(8 * factor, 11 * factor, 14 * factor)
        }
      }
      // 다리 끝 clip plane — face_anchor_offset_group.matrixWorld 로 world 변환. plane_a 항상 대칭,
      // plane_b 가 yaw 따라 비대칭 (한쪽 다리 더 짧음).
      if (TEMPLE_CLIP_ENABLED) {
        g_scene_ctx.glasses_root_obj.updateMatrixWorld(true)
        const face_anchor_group = g_scene_ctx.face_anchor_offset_group
        g_temple_clip_plane_a.normal.set(0, 0, 1)
        g_temple_clip_plane_a.constant = -TEMPLE_CLIP_Z
        g_temple_clip_plane_a.applyMatrix4(face_anchor_group.matrixWorld)
        g_temple_clip_plane_b.normal.set(yaw_deg * TEMPLE_CLIP_YAW_ASYM, 0, 1).normalize()
        g_temple_clip_plane_b.constant = -g_temple_clip_plane_b.normal.z * TEMPLE_CLIP_Z
        g_temple_clip_plane_b.applyMatrix4(face_anchor_group.matrixWorld)
      }
    }
    g_scene_ctx.render()
    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  // 출력 캡처 해상도 — camera_view 와 동일하게 3:4 (480×640) 로 정규화. 라이브는 16:9 풀필이지만
  // 캡처는 가운데 3:4 영역만 잘라 저장 → real_fitting / analysis index 의 다른 캡처와 해상도 일관.
  const CAPTURE_OUTPUT_W = 480
  const CAPTURE_OUTPUT_H = 640

  // 가운데 3:4 영역 crop 좌표 계산. video / canvas 가 서로 다른 intrinsic 해상도(특히 canvas 는
  // setPixelRatio 로 dpr 곱이 적용된 backing buffer) 라 각자의 width/height 기준으로 따로 계산해야
  // 동일한 비율 영역이 추출된다. (이전 버그: 비디오 좌표를 그대로 canvas 에 쓰면 dpr 배만큼 어긋난
  // 좁은 영역만 잘려 안경 레이어가 빠짐.)
  function compute_center_3to4_crop(source_w, source_h) {
    const local_target_aspect = CAPTURE_OUTPUT_W / CAPTURE_OUTPUT_H
    const local_crop_h = source_h
    const local_crop_w = Math.round(source_h * local_target_aspect)
    const local_crop_x = Math.round((source_w - local_crop_w) / 2)
    return { sx: local_crop_x, sy: 0, sw: local_crop_w, sh: local_crop_h }
  }

  // 캡처 버튼 클릭 — video + three.js 의 가운데 3:4 영역을 crop·미러해 Blob 으로 부모 전달.
  async function on_click_capture(slot_key) {
    if (!g_face_detected || !ref_video_el || !ref_three_canvas_el) return
    if (g_capturing) return
    g_capturing = true
    try {
      // video crop: stream intrinsic (e.g., 1280×720) 기준.
      const local_video_crop = compute_center_3to4_crop(
        ref_video_el.videoWidth,
        ref_video_el.videoHeight,
      )
      // canvas crop: backing buffer (dpr 곱 적용된 canvas.width × canvas.height) 기준.
      const local_canvas_crop = compute_center_3to4_crop(
        ref_three_canvas_el.width,
        ref_three_canvas_el.height,
      )

      const off = document.createElement('canvas')
      off.width = CAPTURE_OUTPUT_W
      off.height = CAPTURE_OUTPUT_H
      const ctx = off.getContext('2d')
      if (!ctx) return
      // CSS scaleX(-1) 미러를 픽셀로 굳혀 native AR 결과(셀피처럼 좌우 반전)와 정합.
      ctx.translate(CAPTURE_OUTPUT_W, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(
        ref_video_el,
        local_video_crop.sx, local_video_crop.sy, local_video_crop.sw, local_video_crop.sh,
        0, 0, CAPTURE_OUTPUT_W, CAPTURE_OUTPUT_H,
      )
      ctx.drawImage(
        ref_three_canvas_el,
        local_canvas_crop.sx, local_canvas_crop.sy, local_canvas_crop.sw, local_canvas_crop.sh,
        0, 0, CAPTURE_OUTPUT_W, CAPTURE_OUTPUT_H,
      )
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

<div class="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
  <!--
    camera_view.svelte 와 동일한 2단 구조 — 백드롭 video(부모 양옆까지 카메라 시야로 fill) +
    중앙 3:4 wrapper(실제 캡처되는 영역, AR 안경 오버레이가 이 안에서만 그려짐).
    같은 stream 을 두 video 에 paint 하지만 decode 는 한 번이라 비용 미미. WYSIWYG: 사용자가 보는
    중앙 3:4 = 캡처되는 영역.
  -->
  <video
    bind:this={ref_this_backdrop_video_el}
    class="pointer-events-none absolute inset-0 h-full w-full object-cover"
    style="transform: scaleX(-1);"
    aria-hidden="true"
    playsinline
    autoplay
    muted
  ></video>
  <!--
    중앙 3:4 wrapper — 실제 분석/캡처 영역. 같은 stream 을 한번 더 깔지만 좌표계 정합
    (canvas overlay 안경 정합 + 가이드/문구가 이 영역 안에서만 그려짐) 을 위해 분리.
  -->
  <div class="relative aspect-[3/4] h-full overflow-hidden bg-black">
    <video
      bind:this={ref_video_el}
      class="absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
      autoplay
      muted
      playsinline
    ></video>
    <canvas
      bind:this={ref_three_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
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

    <!--
      가운데 셔터 버튼 — 누를 때마다 부모가 계산한 next_slot_key 슬롯을 한 칸씩 채운다.
      안경 미선택 / 슬롯 만석 / 얼굴 미검출 / 캡처 진행 중에는 비활성화.
    -->
    <div class="absolute inset-x-0 bottom-8 flex justify-center">
      <button
        type="button"
        disabled={!selected_glasses_obj ||
          !g_face_detected ||
          g_capturing ||
          next_slot_key === null}
        onclick={() => next_slot_key && on_click_capture(next_slot_key)}
        aria-label="촬영"
        class="group relative grid h-[92px] w-[92px] cursor-pointer place-items-center rounded-full border-[4px] border-white bg-transparent shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-transform duration-150 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span
          class="block h-[72px] w-[72px] rounded-full bg-[var(--retina-primary-300)] transition-transform duration-150 group-active:scale-90"
        ></span>
      </button>
    </div>
  </div>
</div>
