<script>
  /**
   * 안경 try-on 검증 페이지 (/test).
   *
   * 전면 카메라 + MediaPipe FaceLandmarker(facialTransformationMatrixes 4x4) + Three.js 로
   * 얼굴 위에 GLB 안경을 실시간 렌더하는 기술 검증 화면. 안경 GLB 의 origin/축 차이는 로드 시
   * 1회 자동 정렬로 자식 그룹에 굳혀두고, 매 프레임 head pose 4x4 만 안경 root.matrix 에 주입한다.
   *
   * UX: 진입 즉시 카메라 시작 + 활성 안경 카탈로그 로드 + 첫 활성 안경 자동 swap.
   *     디버그 토글로 face landmark · 안경 axes · offset_y/offset_z/fov 슬라이더 노출.
   */

  import {
    get_video_landmarker,
    detect_from_video,
    clear_video_cache,
  } from '@/lib/mediapipe/face_landmarker.js'
  import { load_local_glasses } from '@/lib/api/glasses'
  import { init_three_scene, swap_glasses_child } from '@/lib/tryon/three_scene.js'
  import { ensure_glasses_loaded, instantiate_glasses } from '@/lib/tryon/glasses_loader.js'
  import {
    apply_face_pose,
    apply_auto_alignment,
    compute_yaw_deg,
  } from '@/lib/tryon/face_alignment.js'
  import { Group as ThreeGroup, Matrix4, Plane, Quaternion, Vector3 } from 'three'
  import { sync_canvas_size, draw_debug, clear_debug } from '@/lib/tryon/debug_overlay.js'

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_three_canvas_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_debug_canvas_el = $state(null)

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)

  let g_face_detected = $state(false)
  /** @type {{ x: number, y: number, w: number, h: number } | null} */
  let g_face_bbox = $state(null)

  // 디버그 토글 — 서로 독립.
  let g_show_face_mesh = $state(false) // 디버그 캔버스에 face landmark 점 + face bbox 그리기
  let g_show_axes_helper = $state(false) // 안경 root 의 AxesHelper R/G/B 표시
  let g_show_glasses_panel = $state(false) // 안경 조정 슬라이더 패널
  let g_use_face_occluder = $state(true) // canonical face mesh occluder — 얼굴 앞면 가리기
  let g_use_head_occluder = $state(false) // 머리 뒤쪽 반구 occluder — 다리가 옆 / 뒤로 빠지면 가려짐. 일단 비활성
  let g_show_face_anchor_marker = $state(false) // anchor 위치 빨간 점 — 슬라이더 조정 가이드
  // 머리 occluder ellipsoid 반지름 — 옆 (rx) / 위아래 (ry) / 뒤 (rz) 각각 cm. 머리는 앞뒤 깊이가
  // 폭보다 큰 비균등 타원체라 균등 sphere 로는 위/아래까지 같이 커져 안경 다리 곡선부와 충돌함.
  let g_occ_rx = $state(8)
  let g_occ_ry = $state(11)
  let g_occ_rz = $state(14)
  // sphere center 위치 — 기본 (0, 0, -2). face_occluder 가 z=-1 만큼 뒤로 밀려 있어서 머리
  // occluder 도 그 만큼 더 뒤로 두어야 두 occluder 가 연속적으로 가려짐. 반구라 앞쪽 끝이 z=-2 부터
  // 시작 → 얼굴 옆 (귀 위치) 영역과 매끄럽게 이어짐.
  let g_occ_x = $state(0)
  let g_occ_y = $state(0)
  let g_occ_z = $state(-2)
  // occluder 시각화 디버그 모드 — 색을 보이게 해 face / head occluder 위치를 직관 확인.
  // face_occluder 와 head_back_occluder 가 material 공유라 한 토글로 둘 다 동시에 노출됨.
  let g_show_occluder_color = $state(false)
  // 측면 회전 시 머리 occluder 자동 축소 — |yaw| 가 hide_start ~ hide_end 구간에서 scale 1→0
  // linear 보간, 0 이면 visible=false. 옆모습일 때 안경 다리의 보여야 할 부분이 잘리지 않게.
  // hide_start == hide_end 로 두면 사실상 이진 토글.
  let g_yaw_gate_enabled = $state(true)
  let g_yaw_hide_start = $state(15)
  let g_yaw_hide_end = $state(45)
  let g_yaw_current_deg = $state(0) // 매 프레임 갱신되는 디버그 표시용
  // 안경 mesh polygonOffset — 안경 다리가 face_occluder 와 z-fighting / 겹침으로 잘리는 현상 해결.
  // 음수일수록 fragment depth 가 카메라쪽으로 끌려와 face mesh 보다 앞에 그려져 가려지지 않음.
  //   factor: polygon 기울기에 비례. 측면 회전으로 다리가 기울어질 때 영향
  //   units : 평탄한 영역에도 일관되게 적용되는 고정 offset (depth buffer ULP 단위)
  let g_use_poly_offset = $state(true)
  let g_glasses_poly_offset_factor = $state(-15)
  let g_glasses_poly_offset_units = $state(-8)
  // 안경 다리 끝 (귀 영역) 자르기 — face anchor frame (= face local) 의 z 좌표 임계점.
  // face local 의 +z 가 forward (카메라쪽). 안경 vertex 의 face local z 가 clip_z 보다 작은 영역
  // (즉 face 뒤쪽 영역) 은 clip 되어 안 그려짐. canonical face 의 광대 / 관자놀이 끝 z 가 -1~-3,
  // face anchor z=+5.24 라 face anchor frame 에선 광대 끝이 약 z=-6~-8. 그 보다 뒤로 자르려면
  // clip_z = -6 ~ -8 정도.
  let g_temple_clip_enabled = $state(true)
  let g_temple_clip_z = $state(-9)
  // 좌 / 우 비대칭 강도 — yaw 도당 plane normal 의 x 성분 변화율. 0 = 대칭, 양수면 yaw 부호에 따라
  // 한쪽 다리가 더 일찍 잘림. 부호는 시연 후 사용자 의도 (먼 쪽 다리 짧게) 와 매칭되게 조정.
  let g_temple_clip_yaw_asym = $state(-0.03)

  let g_offset_x = $state(0) // 모델 단위. 좌/우 보정 (자동 정렬이 비대칭 GLB origin 을 못 잡은 경우)
  let g_offset_y = $state(0) // 모델 단위. 위/아래 보정
  let g_offset_z = $state(0) // 모델 단위. 앞/뒤 보정
  // 자동 정렬이 모델 축을 잘못 매핑한 경우용 — 사용자 회전 보정 (각도, deg). XYZ Euler order.
  let g_rot_x_deg = $state(0)
  let g_rot_y_deg = $state(0)
  let g_rot_z_deg = $state(0)
  // 안경 모델 전체 uniform scale — 자동 정렬 결과 위에 배수. 1 = 자동 정렬 그대로.
  // 키우면 안경 자체가 커지면서 다리 길이도 비례 확장 → 카메라 perspective 로 원근감 강조.
  let g_scale_factor = $state(1)
  let g_fov_deg = $state(63)
  // face anchor (눈 사이, 안경 코걸이 닿는 점) 의 canonical face 좌표.
  // canonical_face_model.obj landmark 168 (nasion = 코뼈 위쪽) 좌표: (0, 3.27, 5.24).
  let g_face_anchor_x = $state(0)
  let g_face_anchor_y = $state(3.27)
  let g_face_anchor_z = $state(5.24)

  /** @type {Array<{glasses_no:number, brand:string, model:string, img_url:string, glasses_3d_url:string}>} */
  let g_glasses_arr = $state([])
  let g_glasses_loading = $state(true)
  let g_glasses_load_error = $state(/** @type {string | null} */ (null))
  let g_selected_glasses_no = $state(/** @type {number | null} */ (null))
  /** 현재 씬에 올라간 안경 URL */
  let g_active_glb_url = $state(/** @type {string | null} */ (null))
  /** 클릭 후 로딩/swap 진행 중 URL — race 가드용 */
  let g_pending_glb_url = $state(/** @type {string | null} */ (null))

  /** @type {Array<{x:number,y:number}> | null} */
  let g_face_landmarks_arr = $state(null)
  /** 디버그 패널 표시용 calibration 사본 */
  /** @type {import('@/lib/tryon/face_alignment.js').AutoCalibration | null} */
  let g_calibration_obj = $state(null)

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
  // MediaPipe 검출 빈도 (60fps / 5 ≈ 12Hz). 안경 transform 도 이 주기로 갱신.
  // MediaPipe 검출 빈도 — 1 = 매 프레임 (60Hz, 검출 lag 거의 없음). 모바일에서 부담 크면
  // 사용자가 슬라이더로 늘림. 보간으로 부드러움 자체는 보장되니 default 는 가장 빠른 1.
  let g_frame_skip = $state(1)
  // pose 보간 강도 — 0.05 = 매우 부드러움/lag, 1 = 보간 없음 (jerky). 매 프레임 검출이면 보간 강도
  // 키워도 lag 거의 없음. default 0.5 로 jitter 흡수 + 빠른 반응.
  let g_pose_lerp = $state(0.5)
  // multi-face — 동시에 추적 / 렌더할 최대 face 수. face_sets 와 보간 state array 길이.
  // 1 = single face (multi-face off). 2~3 으로 키우면 동시 try-on.
  const NUM_FACES = 1
  // pose 보간용 — face 마다 별도의 target/current pair. 검출된 face 수 N (≤ NUM_FACES) 만큼만 사용.
  const g_target_translations = Array.from({ length: NUM_FACES }, () => new Vector3())
  const g_target_quaternions = Array.from({ length: NUM_FACES }, () => new Quaternion())
  const g_current_translations = Array.from({ length: NUM_FACES }, () => new Vector3())
  const g_current_quaternions = Array.from({ length: NUM_FACES }, () => new Quaternion())
  const g_decompose_scale = new Vector3()
  const g_pose_temp_matrix = new Matrix4()
  const g_pose_initialized = Array.from({ length: NUM_FACES }, () => false)
  // 안경 다리 끝 clip plane — face 마다 별도 쌍 (plane_a 대칭 + plane_b 비대칭). multi-face 에서
  // 각 face 의 face pose 따라 plane 이 다르게 변환되어야 하므로 face_sets 와 1:1 대응 array.
  //   plane_a : 정면 / 회전 무관하게 z<clip_z 영역 (다리 끝) 항상 clip
  //   plane_b : yaw 따라 비대칭 — 한쪽 다리만 더 짧게. normal=(yaw*asym, 0, 1).normalize()
  const g_temple_clip_planes_a = Array.from(
    { length: NUM_FACES },
    () => new Plane(new Vector3(0, 0, 1), 6),
  )
  const g_temple_clip_planes_b = Array.from(
    { length: NUM_FACES },
    () => new Plane(new Vector3(0, 0, 1), 6),
  )
  // 디버그 임시: 첫 face pose / 1초 후 상태 / matrix 부재 케이스를 한 번씩만 콘솔에 dump.
  let g_logged_pose_once = false
  let g_logged_no_matrix = false
  let g_logged_diag_once = false

  // 사용자 보정 (cm 단위 평행이동 + 도 단위 회전 + uniform scale) 을 override_group transform 에 적용.
  // override_group 은 자동 정렬 group 의 *부모* 라, 여기 적용된 단위는 자산 모델 단위가 아닌
  // 카메라 좌표계 단위(=cm) 이다 — 자산이 m 든 mm 든 슬라이더 1 칸 = 1cm 로 일정.
  function apply_pose_overrides(override_group, ox, oy, oz, rx_deg, ry_deg, rz_deg, sf) {
    if (!override_group) return
    override_group.position.set(ox, oy, oz)
    const k = Math.PI / 180
    override_group.rotation.set(rx_deg * k, ry_deg * k, rz_deg * k)
    override_group.scale.setScalar(sf)
  }

  // multi-face 에서 각 face 의 안경 mesh 의 material 이 *다른 clipping plane* 을 가져야 하므로,
  // instantiate_glasses 후 mesh material 을 face_set 안에서 *한 번씩* clone 한다. 같은 face_set 내
  // mesh 간엔 material share 유지 (clone 결과를 map 으로 캐시).
  function clone_glasses_materials(root_obj) {
    if (!root_obj) return
    const material_map = new Map()
    root_obj.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const new_mats = mats.map((m) => {
        if (!material_map.has(m)) material_map.set(m, m.clone())
        return material_map.get(m)
      })
      obj.material = Array.isArray(obj.material) ? new_mats : new_mats[0]
    })
  }

  // face_sets 모두에 대해 fn(set, index) 호출. effect / loop 에서 일괄 적용 + 필요 시 index 활용
  // (face_sets 와 1:1 대응 array — clip plane 등 — 인덱싱).
  function for_all_face_sets(fn) {
    if (!g_scene_ctx) return
    for (let i = 0; i < g_scene_ctx.face_sets.length; i++) fn(g_scene_ctx.face_sets[i], i)
  }

  // 안경 mesh 의 material 전체에 polygonOffset 설정 적용. 음수 factor / units 가 fragment depth
  // 를 카메라쪽으로 끌어와 face_occluder 보다 앞에 그려지게 — 다리가 face mesh 에 잘리는 현상 해결.
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

  // 안경 mesh material 의 clippingPlanes 에 temple-tip clip plane reference 두 개 (대칭 A, 비대칭 B)
  // 를 등록 (swap 직후). plane 자체는 매 프레임 on_loop_frame 에서 face_anchor_offset_group.
  // matrixWorld 따라 transform 갱신. clippingPlanes 배열 길이 변경되면 shader 재컴파일 → needsUpdate.
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

  // 디버그 슬라이더 모든 보정값을 기본값으로 되돌린다.
  function on_click_reset_overrides() {
    g_offset_x = 0
    g_offset_y = 0
    g_offset_z = 0
    g_rot_x_deg = 0
    g_rot_y_deg = 0
    g_rot_z_deg = 0
    g_scale_factor = 1
    g_face_anchor_x = 0
    g_face_anchor_y = 3.27
    g_face_anchor_z = 5.24
  }

  // MediaPipe 478 랜드마크의 정규화 좌표 min/max 로 face bbox(0-1) 를 계산한다 — 디버그 오버레이 전용.
  function compute_bbox_from_landmarks(landmarks) {
    let min_x = 1
    let min_y = 1
    let max_x = 0
    let max_y = 0
    for (const lm of landmarks) {
      if (lm.x < min_x) min_x = lm.x
      if (lm.y < min_y) min_y = lm.y
      if (lm.x > max_x) max_x = lm.x
      if (lm.y > max_y) max_y = lm.y
    }
    return { x: min_x, y: min_y, w: max_x - min_x, h: max_y - min_y }
  }

  // 마운트 시 카메라/카탈로그를 병렬 시작. 언마운트 시 모두 해제.
  $effect(() => {
    void on_start_camera()
    void load_glasses_catalog()
    return () => {
      on_stop_camera()
      g_scene_ctx?.dispose()
      g_scene_ctx = null
    }
  })

  // three.js 캔버스가 마운트되면 1회 init.
  $effect(() => {
    if (!ref_this_three_canvas_el || g_scene_ctx) return
    g_scene_ctx = init_three_scene({
      canvas: ref_this_three_canvas_el,
      fov_deg: g_fov_deg,
      num_face_sets: NUM_FACES,
    })
  })

  // fov 슬라이더 변경 시 카메라 갱신.
  $effect(() => {
    const deg = g_fov_deg
    if (g_scene_ctx) g_scene_ctx.set_fov(deg)
  })

  // axes_helper visibility 토글 — 모든 face_set 의 axes_helper 일괄.
  $effect(() => {
    for_all_face_sets((s) => (s.axes_helper.visible = g_show_axes_helper))
  })
  // face occluder 토글 — 모든 face_set 의 face_occluder 일괄.
  $effect(() => {
    for_all_face_sets((s) => (s.face_occluder.visible = g_use_face_occluder))
  })
  // head occluder 토글 — 모든 face_set 의 head_back_occluder 일괄.
  $effect(() => {
    for_all_face_sets((s) => (s.head_back_occluder.visible = g_use_head_occluder))
  })
  // face anchor (눈 사이 미간) 위치 슬라이더 변경 시 모든 face_set 의 anchor offset 동일하게 set.
  $effect(() => {
    for_all_face_sets((s) =>
      s.face_anchor_offset_group.position.set(g_face_anchor_x, g_face_anchor_y, g_face_anchor_z),
    )
  })
  // anchor 마커 visibility — 모든 face_set 일괄.
  $effect(() => {
    for_all_face_sets((s) => (s.face_anchor_marker.visible = g_show_face_anchor_marker))
  })
  // head occluder position 슬라이더 변경 시 모든 face_set 의 head_back_occluder.position 일괄.
  $effect(() => {
    for_all_face_sets((s) => s.head_back_occluder.position.set(g_occ_x, g_occ_y, g_occ_z))
  })
  // head occluder ellipsoid scale — 모든 face_set 일괄. (rAF 내 yaw gate 가 매 프레임 overwrite 함)
  $effect(() => {
    for_all_face_sets((s) => s.head_back_occluder.scale.set(g_occ_rx, g_occ_ry, g_occ_rz))
  })
  // 시각화 모드 — face / head occluder material 은 모든 face_set 이 공유 (init_three_scene shared).
  // 그래서 face_sets[0] 의 material 만 set 해도 모두 동시 반영.
  $effect(() => {
    if (!g_scene_ctx) return
    const first = g_scene_ctx.face_sets[0]
    if (!first) return
    const mats = [first.face_occluder.material, first.head_back_occluder.material]
    for (const m of mats) {
      m.colorWrite = g_show_occluder_color
      m.transparent = g_show_occluder_color
      m.opacity = g_show_occluder_color ? 0.3 : 1
      m.color.set(g_show_occluder_color ? 0x44ddff : 0xffffff)
      m.needsUpdate = true
    }
  })
  // face mesh OFF 시 디버그 캔버스 클리어.
  $effect(() => {
    if (!g_show_face_mesh && ref_this_debug_canvas_el) clear_debug(ref_this_debug_canvas_el)
  })

  // 안경 선택 → GLB 로딩 + swap.
  $effect(() => {
    const sel = g_selected_glasses_no
    if (sel === null) return
    const item = g_glasses_arr.find((item) => item.glasses_no === sel)
    if (!item || !item.glasses_3d_url) return
    void load_and_swap_glasses(item.glasses_3d_url)
  })

  // 사용자 보정 슬라이더 변경 시 현재 align_group 자식 transform 갱신.
  $effect(() => {
    const ox = g_offset_x
    const oy = g_offset_y
    const oz = g_offset_z
    const rx = g_rot_x_deg
    const ry = g_rot_y_deg
    const rz = g_rot_z_deg
    const sf = g_scale_factor
    if (!g_scene_ctx) return
    for_all_face_sets((s) => {
      const ag = s.face_anchor_offset_group.children.find((c) => c !== s.face_anchor_marker)
      apply_pose_overrides(ag, ox, oy, oz, rx, ry, rz, sf)
    })
  })
  // polygonOffset 슬라이더 변경 시 모든 face_set 의 안경 mesh material 에 재적용.
  $effect(() => {
    const enabled = g_use_poly_offset
    const factor = g_glasses_poly_offset_factor
    const units = g_glasses_poly_offset_units
    if (!g_scene_ctx) return
    for_all_face_sets((s) => {
      const ag = s.face_anchor_offset_group.children.find((c) => c !== s.face_anchor_marker)
      apply_glasses_poly_offset(ag, enabled, factor, units)
    })
  })
  // 다리 끝 clip on/off 토글 — face_set 마다 자기 plane 쌍 (planes_a[i], planes_b[i]) 등록.
  $effect(() => {
    const enabled = g_temple_clip_enabled
    if (!g_scene_ctx) return
    for_all_face_sets((s, i) => {
      const ag = s.face_anchor_offset_group.children.find((c) => c !== s.face_anchor_marker)
      apply_glasses_clip(ag, enabled, [g_temple_clip_planes_a[i], g_temple_clip_planes_b[i]])
    })
  })

  // 카메라 권한 요청 + MediaPipe 비디오 랜드마커 로드 + rAF 루프 시작.
  async function on_start_camera() {
    const my_generation = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false
      g_face_detected = false
      g_face_bbox = null
      g_face_landmarks_arr = null

      const landmarker = await get_video_landmarker(NUM_FACES)
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
        if (g_scene_ctx) {
          g_scene_ctx.resize(ref_this_video_el.videoWidth, ref_this_video_el.videoHeight)
        }
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

  // 안경 카탈로그 조회 + 첫 활성 안경 자동 선택.
  async function load_glasses_catalog() {
    g_glasses_loading = true
    g_glasses_load_error = null
    try {
      const arr = await load_local_glasses()
      g_glasses_arr = arr
      const first_active = arr.find((item) => item.glasses_3d_url)
      if (first_active) g_selected_glasses_no = first_active.glasses_no
    } catch (err) {
      g_glasses_load_error = err instanceof Error ? err.message : String(err)
      console.error('[try-on] catalog load failed', err)
    } finally {
      g_glasses_loading = false
    }
  }

  // 선택된 GLB 를 캐시로부터 받아 씬에 swap. 캐시 원본을 보호하기 위해 instantiate_glasses 로 clone.
  async function load_and_swap_glasses(url) {
    if (!g_scene_ctx) return
    if (g_active_glb_url === url) {
      g_pending_glb_url = null
      return
    }
    g_pending_glb_url = url
    console.log('[try-on] swap start', url)
    const t0 = performance.now()
    try {
      const cached = await ensure_glasses_loaded(url)
      console.log('[try-on] ensure_glasses_loaded done', url, 'in', (performance.now() - t0).toFixed(0), 'ms')
      // race: 다른 카드 클릭으로 이 url 이 더 이상 pending 아니면 무시
      if (g_pending_glb_url !== url) {
        console.log('[try-on] swap superseded, skip', url)
        return
      }
      // multi-face — face_set 마다 GLB 를 별도 instantiate (clone). material 도 face_set 안에서
      // clone 하여 face_set 별 다른 clipping plane 을 가질 수 있게.
      let first_calibration = null
      for (let i = 0; i < g_scene_ctx.face_sets.length; i++) {
        const face_set = g_scene_ctx.face_sets[i]
        const { scene, calibration } = instantiate_glasses(cached)
        if (!first_calibration) {
          first_calibration = calibration
          console.log(
            '[try-on] calibration',
            calibration.debug_obj,
            'scale=', calibration.scale.toFixed(3),
            'flip=', calibration.forward_flip,
            'anchor=', calibration.anchor.toArray(),
          )
        }
        const align_group = new ThreeGroup()
        apply_auto_alignment(align_group, calibration)
        align_group.add(scene)
        const override_group = new ThreeGroup()
        override_group.add(align_group)
        swap_glasses_child(face_set.face_anchor_offset_group, override_group, face_set.face_anchor_marker)
        apply_pose_overrides(
          override_group,
          g_offset_x,
          g_offset_y,
          g_offset_z,
          g_rot_x_deg,
          g_rot_y_deg,
          g_rot_z_deg,
          g_scale_factor,
        )
        // material 을 face_set 안에서 clone — 다른 face_set 과 clipping plane 독립
        clone_glasses_materials(scene)
        apply_glasses_poly_offset(
          scene,
          g_use_poly_offset,
          g_glasses_poly_offset_factor,
          g_glasses_poly_offset_units,
        )
        apply_glasses_clip(scene, g_temple_clip_enabled, [
          g_temple_clip_planes_a[i],
          g_temple_clip_planes_b[i],
        ])
      }
      g_active_glb_url = url
      g_calibration_obj = first_calibration
      g_pending_glb_url = null
      console.log('[try-on] swap complete', url, 'total', (performance.now() - t0).toFixed(0), 'ms')
    } catch (err) {
      console.error('[try-on] glb load failed', url, err)
      if (g_pending_glb_url === url) g_pending_glb_url = null
    }
  }

  // rAF 한 틱: FRAME_SKIP 마다 MediaPipe 검출 + 안경 root.matrix 갱신, 매 프레임 three.js 렌더.
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker || !g_scene_ctx) return
    g_frame_counter++

    // FRAME_SKIP 마다 MediaPipe 검출 → target pose 갱신 (보간 대상).
    if (g_frame_counter % g_frame_skip === 0) {
      const result = detect_from_video(g_landmarker, ref_this_video_el)
      const matrices = result?.facialTransformationMatrixes
      const landmarks_arr = result?.faceLandmarks
      const detected_count = matrices?.length ?? 0
      g_face_detected = detected_count > 0
      g_face_bbox = g_face_detected ? compute_bbox_from_landmarks(landmarks_arr[0]) : null
      g_face_landmarks_arr = g_face_detected ? landmarks_arr[0] : null
      // multi-face — face_sets array 와 detected face 1:1 매핑. 검출 못 한 face_set 은 visible=false.
      for (let i = 0; i < g_scene_ctx.face_sets.length; i++) {
        const face_set = g_scene_ctx.face_sets[i]
        if (i < detected_count) {
          g_pose_temp_matrix.fromArray(matrices[i].data)
          g_pose_temp_matrix.decompose(
            g_target_translations[i],
            g_target_quaternions[i],
            g_decompose_scale,
          )
          face_set.glasses_root_obj.visible = true
          if (!g_pose_initialized[i]) {
            g_current_translations[i].copy(g_target_translations[i])
            g_current_quaternions[i].copy(g_target_quaternions[i])
            g_pose_initialized[i] = true
          }
        } else {
          face_set.glasses_root_obj.visible = false
        }
      }
    }
    // 매 프레임: face 마다 current 를 target 으로 보간 + matrix 합성 + yaw gate + clip plane.
    const compute_gate_factor = (abs_yaw, enabled, hide_start, hide_end) => {
      if (!enabled) return 1
      const s = Math.min(hide_start, hide_end)
      const e = Math.max(hide_start, hide_end)
      const span = e - s
      if (abs_yaw <= s) return 1
      if (abs_yaw >= e || span <= 0) return 0
      return (e - abs_yaw) / span
    }
    for (let i = 0; i < g_scene_ctx.face_sets.length; i++) {
      const face_set = g_scene_ctx.face_sets[i]
      if (!g_pose_initialized[i] || !face_set.glasses_root_obj.visible) continue
      g_current_translations[i].lerp(g_target_translations[i], g_pose_lerp)
      g_current_quaternions[i].slerp(g_target_quaternions[i], g_pose_lerp)
      face_set.glasses_root_obj.matrix.compose(
        g_current_translations[i],
        g_current_quaternions[i],
        g_decompose_scale,
      )
      face_set.glasses_root_obj.matrixWorldNeedsUpdate = true
      const yaw_deg = compute_yaw_deg(g_current_quaternions[i])
      if (i === 0) g_yaw_current_deg = yaw_deg
      const abs_yaw = Math.abs(yaw_deg)
      // head_back occluder yaw gate
      if (g_use_head_occluder) {
        const factor = compute_gate_factor(abs_yaw, g_yaw_gate_enabled, g_yaw_hide_start, g_yaw_hide_end)
        if (factor <= 0.001) {
          face_set.head_back_occluder.visible = false
        } else {
          face_set.head_back_occluder.visible = true
          face_set.head_back_occluder.scale.set(
            g_occ_rx * factor,
            g_occ_ry * factor,
            g_occ_rz * factor,
          )
        }
      }
      // 다리 끝 clip plane (face_set 별 별도 plane 쌍)
      if (g_temple_clip_enabled) {
        face_set.glasses_root_obj.updateMatrixWorld(true)
        const face_anchor_group = face_set.face_anchor_offset_group
        const plane_a = g_temple_clip_planes_a[i]
        const plane_b = g_temple_clip_planes_b[i]
        plane_a.normal.set(0, 0, 1)
        plane_a.constant = -g_temple_clip_z
        plane_a.applyMatrix4(face_anchor_group.matrixWorld)
        plane_b.normal.set(yaw_deg * g_temple_clip_yaw_asym, 0, 1).normalize()
        plane_b.constant = -plane_b.normal.z * g_temple_clip_z
        plane_b.applyMatrix4(face_anchor_group.matrixWorld)
      }
    }
    // 1초 (rAF 60틱) 후 한 번만 상태 dump — 안경이 안 보일 때 어디서 막혔는지 진단용.
    if (g_frame_counter === 60 && !g_logged_diag_once) {
      g_logged_diag_once = true
      console.log(
        '[try-on] diag tick60: face_detected=',
        g_face_detected,
        'glasses.visible=',
        g_scene_ctx.glasses_root_obj.visible,
        'children=',
        g_scene_ctx.glasses_root_obj.children.length,
        'video',
        ref_this_video_el?.videoWidth,
        'x',
        ref_this_video_el?.videoHeight,
      )
    }

    if (g_show_face_mesh && ref_this_debug_canvas_el && ref_this_video_el.videoWidth > 0) {
      sync_canvas_size(ref_this_debug_canvas_el, ref_this_video_el)
      draw_debug(ref_this_debug_canvas_el, g_face_landmarks_arr, g_face_bbox)
    }

    g_scene_ctx.render()
    g_raf_id = requestAnimationFrame(on_loop_frame)
  }
</script>

<main
  class="app-frame-page mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:flex-row md:items-start"
>
  <!-- 좌측: 카메라 + try-on 영역 -->
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
      bind:this={ref_this_three_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full"
      style="transform: scaleX(-1); transform-origin: center;"
    ></canvas>
    <canvas
      bind:this={ref_this_debug_canvas_el}
      class="pointer-events-none absolute inset-0 h-full w-full"
      style="transform: scaleX(-1); transform-origin: center; opacity: {g_show_face_mesh
        ? 1
        : 0};"
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
    {#if !g_face_detected && !g_init_error}
      <div
        class="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-black/60 px-3 py-1 text-xs text-zinc-200"
      >
        얼굴을 화면 안에 비춰주세요
      </div>
    {/if}


    <!-- 안경 조정 패널: 카메라 영역 우상단 absolute. 사이드바 그리드 길이와 무관하게 항상
         슬라이더 조작 가능. 슬라이더는 거친 조정용, 옆 number input 으로 정밀 입력. -->
    {#if g_show_glasses_panel}
      <div
        class="pointer-events-auto absolute top-2 right-2 flex w-72 flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900/85 p-2 text-xs text-zinc-300 shadow-lg backdrop-blur-sm"
      >
        <div class="font-bold text-zinc-200">안경 조정</div>
        {#if g_calibration_obj}
          <div class="text-[11px] tabular-nums text-zinc-400">
            axes={g_calibration_obj.debug_obj.axes_map} · verts={g_calibration_obj.debug_obj
              .vertex_count} · width={g_calibration_obj.debug_obj.width_in_model_units.toFixed(3)} ·
            scale={g_calibration_obj.scale.toFixed(3)} · flip={String(
              g_calibration_obj.forward_flip,
            )}
          </div>
        {/if}
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">offset_x</span>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.1"
            bind:value={g_offset_x}
            class="flex-1"
          />
          <input
            type="number"
            step="0.01"
            bind:value={g_offset_x}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">offset_y</span>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.1"
            bind:value={g_offset_y}
            class="flex-1"
          />
          <input
            type="number"
            step="0.01"
            bind:value={g_offset_y}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">offset_z</span>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.1"
            bind:value={g_offset_z}
            class="flex-1"
          />
          <input
            type="number"
            step="0.01"
            bind:value={g_offset_z}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">rot_x°</span>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.5"
            bind:value={g_rot_x_deg}
            class="flex-1"
          />
          <input
            type="number"
            step="0.1"
            bind:value={g_rot_x_deg}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">rot_y°</span>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.5"
            bind:value={g_rot_y_deg}
            class="flex-1"
          />
          <input
            type="number"
            step="0.1"
            bind:value={g_rot_y_deg}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">rot_z°</span>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.5"
            bind:value={g_rot_z_deg}
            class="flex-1"
          />
          <input
            type="number"
            step="0.1"
            bind:value={g_rot_z_deg}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">scale</span>
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.01"
            bind:value={g_scale_factor}
            class="flex-1"
          />
          <input
            type="number"
            step="0.01"
            bind:value={g_scale_factor}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1">
          <span class="w-12 text-zinc-400">fov°</span>
          <input type="range" min="40" max="90" step="0.5" bind:value={g_fov_deg} class="flex-1" />
          <input
            type="number"
            step="0.1"
            bind:value={g_fov_deg}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1" title="MediaPipe 검출 빈도. 1 = 60Hz, 5 = 12Hz">
          <span class="w-12 text-zinc-400">검출/N</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            bind:value={g_frame_skip}
            class="flex-1"
          />
          <input
            type="number"
            step="1"
            bind:value={g_frame_skip}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <label class="flex items-center gap-1" title="pose 보간 강도. 작을수록 부드러움/lag, 1이면 보간 없음">
          <span class="w-12 text-zinc-400">보간 α</span>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            bind:value={g_pose_lerp}
            class="flex-1"
          />
          <input
            type="number"
            step="0.01"
            bind:value={g_pose_lerp}
            class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
          />
        </label>
        <button
          type="button"
          class="self-end rounded border border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
          onclick={on_click_reset_overrides}
        >
          보정값 리셋
        </button>

        <div class="mt-1 border-t border-zinc-700 pt-2">
          <div class="mb-1 font-bold text-zinc-200">
            face anchor (미간 정합, cm)
          </div>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">anc_x</span>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              bind:value={g_face_anchor_x}
              class="flex-1"
            />
            <input
              type="number"
              step="0.01"
              bind:value={g_face_anchor_x}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">anc_y</span>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.1"
              bind:value={g_face_anchor_y}
              class="flex-1"
            />
            <input
              type="number"
              step="0.01"
              bind:value={g_face_anchor_y}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">anc_z</span>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.1"
              bind:value={g_face_anchor_z}
              class="flex-1"
            />
            <input
              type="number"
              step="0.01"
              bind:value={g_face_anchor_z}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
        </div>

        <div class="mt-1 border-t border-zinc-700 pt-2">
          <div class="mb-1 flex items-center justify-between font-bold text-zinc-200">
            <span>머리 occluder (옆 / 뒤)</span>
            <label class="flex items-center gap-1 text-[11px] font-normal text-zinc-400">
              <input
                type="checkbox"
                bind:checked={g_show_occluder_color}
                class="accent-emerald-500"
              />
              모양 보기
            </label>
          </div>
          <label class="flex items-center gap-1" title="옆 (좌우) 반지름. 머리 폭의 절반.">
            <span class="w-12 text-zinc-400">반지름 X</span>
            <input
              type="range"
              min="2"
              max="25"
              step="0.1"
              bind:value={g_occ_rx}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_rx}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1" title="위 / 아래 반지름. 머리 높이의 절반.">
            <span class="w-12 text-zinc-400">반지름 Y</span>
            <input
              type="range"
              min="2"
              max="25"
              step="0.1"
              bind:value={g_occ_ry}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_ry}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1" title="앞 / 뒤 반지름. 머리 깊이 (코끝~뒤통수) 의 절반.">
            <span class="w-12 text-zinc-400">반지름 Z</span>
            <input
              type="range"
              min="2"
              max="30"
              step="0.1"
              bind:value={g_occ_rz}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_rz}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">occ_x</span>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.1"
              bind:value={g_occ_x}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_x}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">occ_y</span>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.1"
              bind:value={g_occ_y}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_y}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1">
            <span class="w-12 text-zinc-400">occ_z</span>
            <input
              type="range"
              min="-20"
              max="10"
              step="0.1"
              bind:value={g_occ_z}
              class="flex-1"
            />
            <input
              type="number"
              step="0.05"
              bind:value={g_occ_z}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <div class="mt-1 text-[11px] tabular-nums text-zinc-400">
            현재 yaw {g_yaw_current_deg.toFixed(1)}°
          </div>
          <label class="flex items-center gap-1" title="이 절댓값 각도부터 머리 occluder 줄이기 시작">
            <span class="w-12 text-zinc-400">hide_s°</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              bind:value={g_yaw_hide_start}
              class="flex-1"
            />
            <input
              type="number"
              step="1"
              bind:value={g_yaw_hide_start}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label class="flex items-center gap-1" title="이 절댓값 각도면 머리 occluder 완전히 0 → visible=false">
            <span class="w-12 text-zinc-400">hide_e°</span>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              bind:value={g_yaw_hide_end}
              class="flex-1"
            />
            <input
              type="number"
              step="1"
              bind:value={g_yaw_hide_end}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
        </div>

        <div class="mt-1 border-t border-zinc-700 pt-2">
          <div class="mb-1 font-bold text-zinc-200">
            안경 mesh polygonOffset
          </div>
          <label
            class="flex items-center gap-1"
            title="polygon 기울기에 비례하는 depth offset. 측면 회전 시 다리 잘림 방지. 음수 = 카메라쪽"
          >
            <span class="w-12 text-zinc-400">factor</span>
            <input
              type="range"
              min="-10"
              max="5"
              step="0.1"
              bind:value={g_glasses_poly_offset_factor}
              class="flex-1"
            />
            <input
              type="number"
              step="0.1"
              bind:value={g_glasses_poly_offset_factor}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label
            class="flex items-center gap-1"
            title="평탄한 polygon 에도 적용되는 고정 offset. 음수 = 카메라쪽. 음수 키울수록 다리가 face 보다 앞으로"
          >
            <span class="w-12 text-zinc-400">units</span>
            <input
              type="range"
              min="-64"
              max="32"
              step="1"
              bind:value={g_glasses_poly_offset_units}
              class="flex-1"
            />
            <input
              type="number"
              step="1"
              bind:value={g_glasses_poly_offset_units}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label
            class="mt-2 flex items-center gap-1"
            title="face anchor frame 의 z 임계점 (cm). vertex.z < clip_z 영역 잘림. clip_z 가 클수록 더 많이 잘림 (face 앞까지 자름)"
          >
            <span class="w-12 text-zinc-400">clip_z</span>
            <input
              type="range"
              min="-15"
              max="5"
              step="0.1"
              bind:value={g_temple_clip_z}
              class="flex-1"
            />
            <input
              type="number"
              step="0.1"
              bind:value={g_temple_clip_z}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
          <label
            class="flex items-center gap-1"
            title="좌 / 우 비대칭 강도. yaw 도당 normal.x 변화율. 0 = 대칭, 양수면 yaw 부호에 따라 한쪽 다리 짧게. 부호 잘못이면 음수로"
          >
            <span class="w-12 text-zinc-400">asym_k</span>
            <input
              type="range"
              min="-0.2"
              max="0.2"
              step="0.005"
              bind:value={g_temple_clip_yaw_asym}
              class="flex-1"
            />
            <input
              type="number"
              step="0.005"
              bind:value={g_temple_clip_yaw_asym}
              class="w-16 rounded bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
            />
          </label>
        </div>
      </div>
    {/if}
  </div>

  <!-- 우측: 사이드바 -->
  <div class="flex w-full flex-col gap-3 md:w-72 md:flex-shrink-0">
    <header class="flex items-baseline justify-between">
      <h1 class="text-lg font-bold text-zinc-100">안경 try-on (검증)</h1>
      <span class="text-xs text-zinc-400">/test</span>
    </header>

    <div
      class="flex flex-col gap-1 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
    >
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={g_show_glasses_panel}
          class="accent-emerald-500"
        />
        안경 조정 패널
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_face_mesh} class="accent-emerald-500" />
        face mesh · 얼굴 디텍션
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_show_axes_helper} class="accent-emerald-500" />
        안경 XYZ 축
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_use_face_occluder} class="accent-emerald-500" />
        얼굴 occluder (앞면)
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_use_head_occluder} class="accent-emerald-500" />
        머리 occluder (옆 / 뒤)
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_yaw_gate_enabled} class="accent-emerald-500" />
        측면 회전 시 머리 occluder 축소
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_use_poly_offset} class="accent-emerald-500" />
        안경 mesh polygonOffset
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={g_temple_clip_enabled} class="accent-emerald-500" />
        다리 끝 자르기 (귀 영역)
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={g_show_face_anchor_marker}
          class="accent-emerald-500"
        />
        face anchor 점 표시
      </label>
    </div>

    {#if g_glasses_load_error}
      <div class="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
        안경 목록 불러오기 실패: {g_glasses_load_error}
        <button class="ml-2 underline" onclick={() => load_glasses_catalog()}>재시도</button>
      </div>
    {:else if g_glasses_loading}
      <div class="text-xs text-zinc-400">카탈로그 불러오는 중…</div>
    {:else if g_glasses_arr.length === 0}
      <div class="text-xs text-zinc-400">등록된 안경이 없습니다.</div>
    {:else if !g_glasses_arr.some((item) => item.glasses_3d_url)}
      <div class="text-xs text-zinc-400">3D 모델이 등록된 안경이 없습니다.</div>
    {:else}
      <div class="grid grid-cols-2 gap-2">
        {#each g_glasses_arr as item (item.glasses_no)}
          {@const has_3d = !!item.glasses_3d_url}
          {@const is_active = g_selected_glasses_no === item.glasses_no}
          {@const is_pending =
            g_pending_glb_url === item.glasses_3d_url && g_active_glb_url !== item.glasses_3d_url}
          <button
            type="button"
            class="relative flex flex-col rounded-md border p-1.5 text-left transition
              {is_active
              ? 'border-[var(--retinal-primary-600)] bg-zinc-800'
              : 'border-zinc-700 bg-zinc-900/60'}
              {has_3d ? 'hover:border-zinc-500' : 'cursor-not-allowed opacity-50'}"
            disabled={!has_3d}
            title={has_3d ? undefined : '3D 모델 미등록'}
            onclick={() => has_3d && (g_selected_glasses_no = item.glasses_no)}
          >
            {#if item.img_url}
              <img
                src={item.img_url}
                alt={item.model}
                class="aspect-square w-full rounded object-cover"
              />
            {:else}
              <div class="aspect-square w-full rounded bg-zinc-800"></div>
            {/if}
            <span class="mt-1 truncate text-[10px] font-bold text-zinc-300">{item.brand}</span>
            <span class="truncate text-[10px] text-zinc-400">{item.model}</span>
            {#if is_pending}
              <span
                class="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-xs text-white"
                >로딩…</span
              >
            {/if}
          </button>
        {/each}
      </div>
    {/if}

  </div>
</main>
