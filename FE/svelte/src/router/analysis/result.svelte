<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Glasses, UserRound, UserPlus } from 'lucide-svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { get_visit, update_visit } from '@/lib/api/visit'
  import { consume_prefetch_visit } from '@/lib/stores/visit_prefetch'
  import { selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast, push_success_toast } from '@/lib/stores/toast'
  import {
    selected_customer_obj,
    selected_visit_obj,
    set_selected_customer,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import {
    get_skin_tone_recommendation,
    get_chip_text_class,
    SKIN_TONE_FRAME_COLOR_MAP,
  } from '@/lib/recommendations/frame_recommendations.js'
  import MeasureCanvas from '@/components/analysis/measure_canvas.svelte'
  import MeasurementList from '@/components/analysis/measurement_list.svelte'
  import { MEASUREMENT_TEMPLATE } from '@/lib/measurements/template.js'
  import { pixel_distance, vertical_signed_angle_deg } from '@/lib/measurements/measurement_utils.js'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import AiInsightPanel from '@/components/analysis/ai_insight_panel.svelte'
  import BottomActionBar from '@/components/analysis/bottom_action_bar.svelte'
  // 이전 화면(real_fitting/arfitting) 의 CameraView 가 재생을 시작한 음성이
  // voice_guide 싱글톤을 통해 result 까지 끌려올 수 있다. 진입 즉시 강제 정지로 차단.
  import { silence as silence_voice } from '@/lib/audio/voice_guide.js'
  import { read_real_wearing_oh } from '@/lib/utils/real_wearing_oh_storage.js'
  const FACE_SHAPE_LABEL_OBJ = {
    oval: '계란형',
    round: '둥근형',
    heart: '하트형',
    square: '사각형',
    oblong: '긴형',
  }

  const SKIN_TONE_DESCRIPTION_OBJ = {
    COOL: '차가운 톤',
    WARM: '따뜻한 톤',
    NEUTRAL: '중성 톤',
  }

  // visit GET 응답을 통째로 보관해 각 섹션 derived 가 여기서 꺼내쓴다.
  // 방문 이력에서 진입 시 selected_visit_obj 에 test_json 이 있으면 즉시 분석 요약 렌더링.
  // 이후 load_visit_data 가 완료되면 AI 인사이트 등 나머지 데이터로 교체된다.
  let g_visit_obj = $state(
    $selected_visit_obj?.test_json ? /** @type {Record<string, any>} */ ({ ...$selected_visit_obj }) : null,
  )
  let g_visit_loading = $state(!$selected_visit_obj?.test_json)

  let ref_customer_create_modal_open = $state(false)
  // 비회원 → 고객 등록 (create_customer + create_visit + update_visit) 진행 중 플래그.
  // 모달 onclose/oncreate 와 화면 PATCH 가 동시에 진행돼 중복 클릭/네비게이션을 막아야 한다.
  let g_is_registering_customer = $state(false)

  // 리포트 페이지 탭 네비게이션 — 한 화면에 모든 섹션을 펼치는 대신 탭으로 분리해 페이지처럼 전환.
  /** @typedef {'overview' | 'measurement' | 'lifestyle' | 'fitting' | 'real_fitting' | 'insight'} TabId */
  const TAB_ARR = /** @type {{ id: TabId, label: string }[]} */ ([
    { id: 'overview', label: '분석 요약' },
    { id: 'measurement', label: '측정 상세' },
    { id: 'lifestyle', label: '생활 패턴' },
    { id: 'fitting', label: 'AR 피팅' },
    { id: 'real_fitting', label: '실제 착용 사진' },
    { id: 'insight', label: 'AI 인사이트' },
  ])
  let g_active_tab = $state(/** @type {TabId} */ ('overview'))

  // 좌우 스와이프로 탭 전환 — touch + mouse drag 모두 지원.
  // diff < 0 (왼쪽으로 끌기) → 다음 탭, diff > 0 (오른쪽으로 끌기) → 이전 탭.
  const SWIPE_THRESHOLD_PX = 60
  let g_swipe_start_x = /** @type {number | null} */ (null)
  let g_swipe_start_y = /** @type {number | null} */ (null)

  /**
   * 활성 탭을 delta(+1: 다음, -1: 이전) 만큼 이동. 양 끝에서 멈춤.
   * @param {number} delta
   */
  function shift_active_tab(delta) {
    const local_current_idx = TAB_ARR.findIndex((local_tab) => local_tab.id === g_active_tab)
    if (local_current_idx < 0) return
    const local_next_idx = Math.max(0, Math.min(TAB_ARR.length - 1, local_current_idx + delta))
    g_active_tab = TAB_ARR[local_next_idx].id
  }

  /** @param {TouchEvent} local_event */
  function on_touchstart_swipe(local_event) {
    const local_touch = local_event.touches[0]
    if (!local_touch) return
    g_swipe_start_x = local_touch.clientX
    g_swipe_start_y = local_touch.clientY
  }

  /** @param {TouchEvent} local_event */
  function on_touchend_swipe(local_event) {
    if (g_swipe_start_x === null || g_swipe_start_y === null) return
    const local_touch = local_event.changedTouches[0]
    if (!local_touch) return
    const local_dx = local_touch.clientX - g_swipe_start_x
    const local_dy = local_touch.clientY - g_swipe_start_y
    g_swipe_start_x = null
    g_swipe_start_y = null
    // 세로 움직임이 더 크면 스크롤 의도 — 무시.
    if (Math.abs(local_dy) > Math.abs(local_dx)) return
    if (Math.abs(local_dx) < SWIPE_THRESHOLD_PX) return
    shift_active_tab(local_dx < 0 ? 1 : -1)
  }

  /** @param {PointerEvent} local_event */
  function on_pointerdown_swipe(local_event) {
    // 터치는 touchstart 가 먼저 처리하므로 mouse 만 추적.
    if (local_event.pointerType !== 'mouse') return
    g_swipe_start_x = local_event.clientX
    g_swipe_start_y = local_event.clientY
  }

  /** @param {PointerEvent} local_event */
  function on_pointerup_swipe(local_event) {
    if (local_event.pointerType !== 'mouse') return
    if (g_swipe_start_x === null || g_swipe_start_y === null) return
    const local_dx = local_event.clientX - g_swipe_start_x
    const local_dy = local_event.clientY - g_swipe_start_y
    g_swipe_start_x = null
    g_swipe_start_y = null
    if (Math.abs(local_dy) > Math.abs(local_dx)) return
    if (Math.abs(local_dx) < SWIPE_THRESHOLD_PX) return
    shift_active_tab(local_dx < 0 ? 1 : -1)
  }

  // real_fitting.svelte 가 prefetch 한 visit_obj 를 즉시 사용하기 위한 sessionStorage 키.
  const PREFETCH_VISIT_KEY = 'retinal_prefetched_visit_obj'

  // 비회원(cust_no = 0) 으로 진입한 경우에만 고객정보등록 버튼을 노출한다.
  const g_is_guest_visit = $derived(Number($selected_customer_obj?.id) === 0)

  // visit_obj.test_json (얼굴 분석 결과 schema_version 3)
  const g_test_json = $derived(g_visit_obj?.test_json ?? null)

  // visit_obj.opt_recommend_json (렌즈 상담 답변)
  const g_opt_recommend_json = $derived(g_visit_obj?.opt_recommend_json ?? null)

  // visit_obj.vp_json (AR 피팅 결과 — fitting_arr 포함)
  const g_vp_json = $derived(g_visit_obj?.vp_json ?? null)

  // visit_obj.real_vp_json (실 착용 사진 세트 — sets[]: { front_url, left_url, right_url, ... })
  const g_real_vp_set_arr = $derived.by(() => {
    const local_sets = g_visit_obj?.real_vp_json?.sets
    return Array.isArray(local_sets) ? local_sets : []
  })

  // 실 착용 세트별 현재 사진 뷰 (정면 / 좌측 / 우측). 키는 set_index — set_no 가 없는 레거시 데이터도 안전하게 매핑.
  let g_real_vp_view_obj = $state(
    /** @type {Record<number, 'front' | 'left' | 'right'>} */ ({}),
  )

  /** @param {number} set_index */
  function get_real_vp_view(set_index) {
    return g_real_vp_view_obj[set_index] ?? 'front'
  }

  /**
   * @param {number} set_index
   * @param {'front' | 'left' | 'right'} view
   */
  function on_click_real_vp_view(set_index, view) {
    g_real_vp_view_obj = { ...g_real_vp_view_obj, [set_index]: view }
    // 이 set 의 active 가 다른 view 면 해제 — 새 view 캔버스에서 잘못된 측정 방지.
    // 다른 set 의 active 는 건드리지 않음 (set 별 독립).
    const local_active = g_real_vp_active_by_set_obj[set_index]
    if (local_active && local_active.view !== view) {
      g_real_vp_active_by_set_obj = {
        ...g_real_vp_active_by_set_obj,
        [set_index]: null,
      }
    }
  }

  // 실 착용 사진용 capture 좌표계 — test_json 캡처와 동일한 480×640 으로 통일해 mm_per_px 변환 호환.
  const REAL_VP_CAPTURE_WIDTH = 480
  const REAL_VP_CAPTURE_HEIGHT = 640

  // 뷰별 측정 항목 정의 — 정면은 OH(좌/우) 거리, 좌/우 측면은 전경각(각도).
  // save_key 는 BE 저장 schema(measurement_obj_by_view) 에서 사용하는 필드명.
  const REAL_VP_VIEW_ARR = /** @type {('front' | 'left' | 'right')[]} */ ([
    'front',
    'left',
    'right',
  ])
  const REAL_VP_ITEMS_BY_VIEW = {
    front: [
      {
        item_id: 'oh_left',
        label: 'OH (좌)',
        kind: /** @type {'distance'} */ ('distance'),
        save_key: 'oh_left_mm',
      },
      {
        item_id: 'oh_right',
        label: 'OH (우)',
        kind: /** @type {'distance'} */ ('distance'),
        save_key: 'oh_right_mm',
      },
    ],
    left: [
      {
        item_id: 'pantoscopic_tilt',
        label: '전경각',
        kind: /** @type {'angle'} */ ('angle'),
        save_key: 'pantoscopic_tilt_deg',
      },
    ],
    right: [
      {
        item_id: 'pantoscopic_tilt',
        label: '전경각',
        kind: /** @type {'angle'} */ ('angle'),
        save_key: 'pantoscopic_tilt_deg',
      },
    ],
  }

  // 세트별 활성 측정 항목 — 각 set 이 독립된 active 를 가져서, set 2 클릭이 set 1 의 측정 라인을 지우지 않음.
  // set 1 OH(우) 라인과 set 2 OH(우) 라인을 동시에 시각 확인 가능하도록 분리.
  let g_real_vp_active_by_set_obj = $state(
    /** @type {Record<number, { view: 'front' | 'left' | 'right', item_id: string } | null>} */ (
      {}
    ),
  )

  // 사용자가 photo 위에서 2점을 찍은 좌표 (set_index → view → item_id → [p1, p2]).
  let g_real_vp_points_obj = $state(
    /** @type {Record<number, Record<'front' | 'left' | 'right', Record<string, any>>>} */ ({}),
  )

  // 표시용 측정값 문자열 — 점 클릭으로만 갱신. (set_index → view → item_id → string)
  let g_real_vp_value_obj = $state(
    /** @type {Record<number, Record<'front' | 'left' | 'right', Record<string, string>>>} */ ({}),
  )
  // 각 (set, view, item_id) 값의 출처 — 'auto' = real_fitting 게이트 자동 측정 / 'manual' = 사용자 zoom_modal 수동 측정(또는 이전 visit 의 BE 저장값).
  let g_real_vp_source_obj = $state(
    /** @type {Record<number, Record<'front' | 'left' | 'right', Record<string, 'auto' | 'manual'>>>} */ ({}),
  )
  // BE 응답에서 한 번만 시드.
  let g_real_vp_measurement_seeded = $state(false)
  // 현재 저장 중인 set_index — null 이면 idle. 동시에 한 set 만 저장 (다른 버튼은 모두 비활성).
  let g_saving_real_vp_set_index = $state(/** @type {number | null} */ (null))

  // visit 응답이 도착해 sets 가 생기는 즉시 1회만 초깃값 채우기. measurement_obj_by_view 가 있으면 그 값 사용.
  $effect(() => {
    if (g_real_vp_measurement_seeded) return
    if (g_real_vp_set_arr.length === 0) return
    /** @type {Record<number, Record<'front' | 'left' | 'right', Record<string, string>>>} */
    const local_seed_obj = {}
    /** @type {Record<number, Record<'front' | 'left' | 'right', Record<string, 'auto' | 'manual'>>>} */
    const local_source_seed_obj = {}
    for (let local_idx = 0; local_idx < g_real_vp_set_arr.length; local_idx++) {
      const local_m_by_view_obj = g_real_vp_set_arr[local_idx]?.measurement_obj_by_view ?? {}
      /** @type {Record<'front' | 'left' | 'right', Record<string, string>>} */
      const local_view_obj = { front: {}, left: {}, right: {} }
      /** @type {Record<'front' | 'left' | 'right', Record<string, 'auto' | 'manual'>>} */
      const local_view_source_obj = { front: {}, left: {}, right: {} }
      for (const local_view of REAL_VP_VIEW_ARR) {
        for (const local_item_def of REAL_VP_ITEMS_BY_VIEW[local_view]) {
          const local_v = local_m_by_view_obj?.[local_view]?.[local_item_def.save_key]
          local_view_obj[local_view][local_item_def.item_id] = local_v != null ? String(local_v) : ''
          // BE 에 저장된 값은 이전 세션에서 사용자가 수동 측정한 결과로 간주.
          if (local_v != null) {
            local_view_source_obj[local_view][local_item_def.item_id] = 'manual'
          }
        }
      }
      local_seed_obj[local_idx] = local_view_obj
      local_source_seed_obj[local_idx] = local_view_source_obj
    }
    g_real_vp_value_obj = local_seed_obj
    g_real_vp_source_obj = local_source_seed_obj
    g_real_vp_measurement_seeded = true
  })

  // 미러 OH 가 한 visit 당 1번만 시도되도록 가드 (set_selected_visit 재발동 시 idempotent 보장).
  let g_oh_prefill_done = $state(false)

  // BE 시딩이 완료된 직후 sessionStorage 의 OH 미러를 읽어 빈 항목만 pre-fill.
  // g_oh_prefill_done 으로 1회 가드.
  $effect(() => {
    if (!g_real_vp_measurement_seeded) return
    if (g_oh_prefill_done) return
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) return
    pre_fill_oh_from_real_wearing(local_visit_no)
    g_oh_prefill_done = true
  })

  /**
   * (set, view, item_id) 의 표시값 갱신.
   * @param {number} set_index
   * @param {'front' | 'left' | 'right'} view
   * @param {string} item_id
   * @param {string} value
   */
  function set_real_vp_value(set_index, view, item_id, value) {
    const local_prev_set = g_real_vp_value_obj[set_index] ?? { front: {}, left: {}, right: {} }
    const local_prev_view = local_prev_set[view] ?? {}
    g_real_vp_value_obj = {
      ...g_real_vp_value_obj,
      [set_index]: {
        ...local_prev_set,
        [view]: { ...local_prev_view, [item_id]: value },
      },
    }
    // 사용자 zoom_modal 측정 — 'manual' 로 마킹 (기존 'auto' 도 덮어쓴다 = 사용자 수동 보정 우선).
    mark_real_vp_source(set_index, view, item_id, 'manual')
  }

  // real_fitting 에서 미러링한 정면 슬롯 OH 값을 실착용 세트에 자동 pre-fill.
  // 이미 사용자가 수동으로 set 한 값이 있으면 덮어쓰지 않는다 (수동 보정 우선).
  // storage sets 는 newest-first (real_fitting 의 g_saved_set_arr 순서) 이고
  // BE real_vp_set_arr 는 oldest-first (set_no 1, 2, 3) 이므로 역순으로 매칭한다.
  function pre_fill_oh_from_real_wearing(visit_no) {
    const mirror = read_real_wearing_oh(visit_no)
    if (!mirror || !Array.isArray(mirror.sets) || mirror.sets.length === 0) return
    // storage 는 newest-first → chronological 순으로 뒤집어 BE 인덱스와 대응시킴.
    const local_chron_arr = [...mirror.sets].reverse()
    for (let local_idx = 0; local_idx < local_chron_arr.length; local_idx++) {
      const local_entry = local_chron_arr[local_idx]
      // malformed storage entry 방어 (read_real_wearing_oh 가 per-entry 검증 안 함)
      if (!local_entry) continue
      apply_oh_prefill_to_set(local_idx, local_entry.oh_left_mm, local_entry.oh_right_mm)
    }
  }

  // 한 실착용 세트의 정면 view 의 oh_left/oh_right 항목을 mirror 값으로 채움. 이미 값 있으면 skip.
  /**
   * @param {number} set_index
   * @param {number} oh_left_mm
   * @param {number} oh_right_mm
   */
  function apply_oh_prefill_to_set(set_index, oh_left_mm, oh_right_mm) {
    if (!Number.isFinite(oh_left_mm) || !Number.isFinite(oh_right_mm)) return
    const local_set_val = g_real_vp_value_obj[set_index] ?? { front: {}, left: {}, right: {} }
    const local_front_val = local_set_val.front ?? {}
    // oh_left
    if (!local_front_val.oh_left) {
      g_real_vp_value_obj = {
        ...g_real_vp_value_obj,
        [set_index]: {
          ...local_set_val,
          front: { ...local_front_val, oh_left: oh_left_mm.toFixed(1) },
        },
      }
      mark_real_vp_source(set_index, 'front', 'oh_left', 'auto')
    }
    // g_real_vp_value_obj 가 방금 갱신됐을 수 있으므로 최신 참조로 다시 읽기.
    const local_set_val2 = g_real_vp_value_obj[set_index] ?? { front: {}, left: {}, right: {} }
    const local_front_val2 = local_set_val2.front ?? {}
    if (!local_front_val2.oh_right) {
      g_real_vp_value_obj = {
        ...g_real_vp_value_obj,
        [set_index]: {
          ...local_set_val2,
          front: { ...local_front_val2, oh_right: oh_right_mm.toFixed(1) },
        },
      }
      mark_real_vp_source(set_index, 'front', 'oh_right', 'auto')
    }
  }

  // (set, view, item_id) 의 측정값 출처를 갱신. apply_oh_prefill_to_set 와 set_real_vp_value 가 사용.
  /**
   * @param {number} set_index
   * @param {'front' | 'left' | 'right'} view
   * @param {string} item_id
   * @param {'auto' | 'manual'} source
   */
  function mark_real_vp_source(set_index, view, item_id, source) {
    const local_prev_set = g_real_vp_source_obj[set_index] ?? { front: {}, left: {}, right: {} }
    const local_prev_view = local_prev_set[view] ?? {}
    g_real_vp_source_obj = {
      ...g_real_vp_source_obj,
      [set_index]: {
        ...local_prev_set,
        [view]: { ...local_prev_view, [item_id]: source },
      },
    }
  }

  /** 측정 행 클릭 — 해당 set 의 active 토글. 다른 set 의 active 는 그대로 유지. */
  function on_select_real_vp_item(set_index, view, item_id) {
    const local_prev = g_real_vp_active_by_set_obj[set_index] ?? null
    const local_is_active = local_prev?.view === view && local_prev?.item_id === item_id
    g_real_vp_active_by_set_obj = {
      ...g_real_vp_active_by_set_obj,
      [set_index]: local_is_active ? null : { view, item_id },
    }
  }

  /** 특정 set 의 active 해제 (MeasureCanvas oncancel 콜백). */
  function on_cancel_real_vp_for_set(set_index) {
    g_real_vp_active_by_set_obj = {
      ...g_real_vp_active_by_set_obj,
      [set_index]: null,
    }
  }

  /** 현재 (set, view) 의 active item_id 매핑 — 다른 view 면 null. */
  function get_active_real_vp_item_id(set_index, view) {
    const local_active = g_real_vp_active_by_set_obj[set_index]
    if (!local_active) return null
    if (local_active.view !== view) return null
    return local_active.item_id
  }

  /** 각도 항목용 ViewAngle — vertical_signed_angle_deg 가 좌측면일 때 부호 보정. */
  function get_real_vp_angle_view_id(view) {
    if (view === 'left') return 'left_no_glasses'
    if (view === 'right') return 'right_no_glasses'
    return 'front_no_glasses'
  }

  /**
   * MeasureCanvas items_arr 합성 — 거리/각도 둘 다 처리. 측정 상세 탭의 schema 와 동일.
   * @param {number} set_index
   * @param {'front' | 'left' | 'right'} view
   */
  function build_real_vp_items_arr(set_index, view) {
    const local_pts_view_obj = g_real_vp_points_obj[set_index]?.[view] ?? {}
    const local_mm_per_px = g_scale_obj?.mm_per_px ?? null
    return REAL_VP_ITEMS_BY_VIEW[view].map((local_item_def) => {
      const local_pts = local_pts_view_obj?.[local_item_def.item_id] ?? null
      if (local_item_def.kind === 'angle') {
        const local_view_id = get_real_vp_angle_view_id(view)
        const local_deg = local_pts
          ? vertical_signed_angle_deg(local_pts[0], local_pts[1], local_view_id)
          : null
        return {
          item_id: local_item_def.item_id,
          label: local_item_def.label,
          view: [local_view_id],
          source: 'manual',
          kind: 'angle',
          points: local_pts,
          value_deg_raw: local_deg,
          value_deg_corrected: local_deg,
          head_image_tilt_deg_used: null,
        }
      }
      const local_px = local_pts ? pixel_distance(local_pts[0], local_pts[1]) : null
      const local_mm =
        local_px !== null && local_mm_per_px !== null ? local_px * local_mm_per_px : null
      return {
        item_id: local_item_def.item_id,
        label: local_item_def.label,
        view: [`${view}_no_glasses`],
        source: 'manual',
        kind: 'distance',
        points: local_pts,
        value_px: local_px,
        value_mm: local_mm,
      }
    })
  }

  // MeasureCanvas 가 2점을 모두 찍으면 호출 — 클로저로 set_index 받아 해당 set 의 active 항목에 값 기록.
  function on_points_set_real_vp_for_set(set_index, _item_id, points) {
    const local_active = g_real_vp_active_by_set_obj[set_index]
    if (!local_active) return
    const local_view = local_active.view
    const local_item_id = local_active.item_id

    const local_item_def = REAL_VP_ITEMS_BY_VIEW[local_view].find(
      (local_item) => local_item.item_id === local_item_id,
    )
    if (!local_item_def) return

    // 점 좌표 보관
    const local_prev_set = g_real_vp_points_obj[set_index] ?? {
      front: {},
      left: {},
      right: {},
    }
    const local_prev_view = local_prev_set[local_view] ?? {}
    g_real_vp_points_obj = {
      ...g_real_vp_points_obj,
      [set_index]: {
        ...local_prev_set,
        [local_view]: { ...local_prev_view, [local_item_id]: points },
      },
    }

    // 값 계산 → 표시 문자열
    let local_value_str = ''
    if (local_item_def.kind === 'angle') {
      const local_deg = vertical_signed_angle_deg(
        points[0],
        points[1],
        get_real_vp_angle_view_id(local_view),
      )
      // 측정 상세와 동일하게 절댓값으로 표시 (좌/우 측면이 같은 안경에서 같은 값을 보이도록).
      local_value_str = Math.abs(local_deg).toFixed(1)
    } else {
      const local_px = pixel_distance(points[0], points[1])
      const local_mm_per_px = g_scale_obj?.mm_per_px ?? null
      local_value_str =
        local_mm_per_px !== null ? (local_px * local_mm_per_px).toFixed(1) : local_px.toFixed(0)
    }
    set_real_vp_value(set_index, local_view, local_item_id, local_value_str)
  }

  // 특정 set 의 측정값만 PATCH. 다른 set 의 measurement_obj_by_view 는 그대로 보존
  // (set 별 명시적 저장 — 한 set 의 점 클릭이 의도치 않게 다른 set 의 변경분을 덮어쓰지 않게).
  /** @param {number} set_index */
  async function on_click_save_real_vp_set(set_index) {
    if (g_saving_real_vp_set_index !== null) return
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      push_error_toast('방문 정보가 없어 저장할 수 없습니다.')
      return
    }

    g_saving_real_vp_set_index = set_index
    try {
      const local_next_set_arr = g_real_vp_set_arr.map((local_set_obj, local_idx) => {
        if (local_idx !== set_index) return local_set_obj

        const local_value_view_obj = g_real_vp_value_obj[local_idx] ?? {
          front: {},
          left: {},
          right: {},
        }
        /** @type {Record<'front' | 'left' | 'right', Record<string, number | null>>} */
        const local_next_m_by_view_obj = { front: {}, left: {}, right: {} }
        for (const local_view of REAL_VP_VIEW_ARR) {
          for (const local_item_def of REAL_VP_ITEMS_BY_VIEW[local_view]) {
            const local_str = String(
              local_value_view_obj?.[local_view]?.[local_item_def.item_id] ?? '',
            ).trim()
            local_next_m_by_view_obj[local_view][local_item_def.save_key] =
              local_str === '' ? null : Number(local_str)
          }
        }
        return {
          ...local_set_obj,
          measurement_obj_by_view: local_next_m_by_view_obj,
        }
      })

      const local_patched_real_vp_json = {
        ...(g_visit_obj?.real_vp_json ?? {}),
        sets: local_next_set_arr,
      }

      const local_updated = await update_visit({
        visit_no: local_visit_no,
        body: { real_vp_json: local_patched_real_vp_json },
      })

      g_visit_obj =
        local_updated && local_updated.real_vp_json
          ? local_updated
          : { ...(g_visit_obj ?? {}), real_vp_json: local_patched_real_vp_json }
      push_success_toast(`세트 ${set_index + 1} 측정 내용을 저장했어요.`)
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '측정 내용 저장에 실패했습니다.',
      )
    } finally {
      g_saving_real_vp_set_index = null
    }
  }

  /** @param {unknown} face_shape_value */
  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '')
      .trim()
      .toLowerCase()
    if (local_value.includes('round') || local_value.includes('둥근')) return 'round'
    if (
      local_value.includes('heart') ||
      local_value.includes('triangle') ||
      local_value.includes('하트')
    )
      return 'heart'
    if (local_value.includes('square') || local_value.includes('사각')) return 'square'
    if (
      local_value.includes('oblong') ||
      local_value.includes('long') ||
      local_value.includes('긴')
    )
      return 'oblong'
    return 'oval'
  }

  const g_customer_name_label = $derived.by(() => {
    // 비회원(cust_no=0) 으로 진입한 경우엔 실제 이름("비회원") 대신 "고객님" 으로 표시.
    if (Number($selected_customer_obj?.id) === 0) return '고객님'
    const local_name = $selected_customer_obj?.name?.trim()
    if (!local_name) return '고객'
    return local_name.endsWith('님') ? local_name : `${local_name}님`
  })

  // 얼굴형 — 실제 데이터(visit.test_json or 고객 메타) 가 있을 때만 정규화 / 라벨 매핑.
  const g_face_shape_raw = $derived(
    g_test_json?.face_shape ?? $selected_customer_obj?.face_shape ?? null,
  )
  const g_face_shape_key = $derived(
    g_face_shape_raw ? normalize_face_shape_key(g_face_shape_raw) : null,
  )
  const g_face_shape_label = $derived(
    g_face_shape_key ? (FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? null) : null,
  )

  // 피부톤 — 실제 데이터가 있을 때만 추천 객체 산출. 없으면 null → 화면에서 '-'.
  const g_skin_tone_raw = $derived(
    g_test_json?.skin_tone?.tone ?? $selected_customer_obj?.skin_tone ?? null,
  )
  const g_skin_tone_recommendation_obj = $derived(
    g_skin_tone_raw ? get_skin_tone_recommendation(g_skin_tone_raw) : null,
  )

  // 라벨 → tone_class 글로벌 lookup (모든 톤의 칩 합집합). BE 가 라벨만 보내도 색이 입혀지도록.
  const LABEL_TO_TONE_CLASS_OBJ = (() => {
    /** @type {Record<string, string>} */
    const local_obj = {}
    for (const local_tone_key of Object.keys(SKIN_TONE_FRAME_COLOR_MAP)) {
      for (const local_chip of SKIN_TONE_FRAME_COLOR_MAP[local_tone_key]) {
        local_obj[local_chip.label] = local_chip.tone_class
      }
    }
    return local_obj
  })()

  // BE 가 보내준 추천 칩 배열만 사용. tone_class 가 없으면 라벨로 FE 매핑에서 보충.
  const g_recommended_color_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.skin_tone_recommendations)
      ? g_test_json.skin_tone_recommendations
      : []
    if (local_be_arr.length === 0) return []
    return local_be_arr
      .slice(0, 4)
      .map((/** @type {{ label?: string, tone_class?: string }} */ local_chip) => {
        const local_label = String(local_chip.label ?? '')
        return {
          label: local_label,
          tone_class:
            local_chip.tone_class ?? LABEL_TO_TONE_CLASS_OBJ[local_label] ?? 'bg-slate-300',
        }
      })
  })

  // BE 가 보내준 추천 모양 배열만 사용. FE 로컬 매핑 fallback 제거.
  const g_recommended_frame_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.face_shape_recommendations)
      ? g_test_json.face_shape_recommendations
      : []
    return local_be_arr.length > 0 ? local_be_arr.slice(0, 6) : []
  })

  // 1순위만 추출 — 추천 모양 슬롯에 4개까지 채울 후보.
  const g_priority_one_frame_arr = $derived(
    g_recommended_frame_arr.filter((local_obj) => local_obj.priority === 1),
  )

  // 렌즈 상담 답변 (BE 가 selection_arr 로 저장한다)
  const g_lens_selection_arr = $derived.by(() => {
    const local_arr = Array.isArray(g_opt_recommend_json?.selection_arr)
      ? g_opt_recommend_json.selection_arr
      : []
    return /** @type {{question_text: string, label_arr: string[]}[]} */ (local_arr)
  })

  // AR 피팅 결과 (BE 가 fitting_arr 로 저장한다)
  // capture_arr 의 항목은 S3 object key 만 들고 있고, presigned URL 은 BE 가 vp_file_arr 로 변환해
  // 별도 응답한다. img src 는 key → vp_file_arr 매칭으로 구성한다.
  const g_saved_fitting_arr = $derived.by(() => {
    const local_arr = Array.isArray(g_vp_json?.fitting_arr) ? g_vp_json.fitting_arr : []
    return /** @type {{brand: string, model: string, capture_arr: {label: string, key?: string, url?: string}[]}[]} */ (
      local_arr
    )
  })

  // BE _convert_visit_urls 가 vp_file_arr 를 presigned URL 배열로 응답한다.
  // capture_arr[].key 로 그 안에서 같은 object key 를 가리키는 presigned URL 을 찾아 src 로 사용.
  const g_vp_presigned_arr = $derived(
    Array.isArray(g_visit_obj?.vp_file_arr) ? g_visit_obj.vp_file_arr : [],
  )

  /**
   * S3 object key 로 presigned URL 검색. presigned URL 의 path 가 key 와 같거나 끝나는 항목을 매칭.
   * 둘 다 없으면 빈 문자열 — 호출처에서 placeholder 처리.
   * 레거시 데이터(예전 저장본의 raw url) 호환: capture_arr 항목에 key 가 없고 url 만 있으면 그대로 반환.
   * @param {{ key?: string, url?: string }} capture_obj
   */
  function resolve_capture_src(capture_obj) {
    if (!capture_obj) return ''
    const local_key = capture_obj.key
    if (!local_key) return capture_obj.url ?? ''
    const local_matched = g_vp_presigned_arr.find((local_url) => {
      if (typeof local_url !== 'string') return false
      const local_path = local_url.split('?')[0]
      return local_path.endsWith(local_key)
    })
    return local_matched ?? ''
  }

  // 측정 상세 — visit.test_json 에 저장된 측정값/측정점/이미지 dims 를 읽어 인터랙티브 화면을 합성.
  const g_measurements_obj = $derived(g_test_json?.measurements ?? null)
  const g_measurement_points_obj = $derived(g_test_json?.measurement_points_obj ?? null)
  const g_image_dims_obj = $derived(g_test_json?.image_dims_obj ?? null)
  const g_scale_obj = $derived(g_test_json?.scale ?? null)

  // 측정 상세 탭 내부에서 정면/좌측/우측 사진을 선택해 볼 수 있도록 sub-tab 상태.
  // test_file_arr 는 report.svelte 업로드 시 [front, left, right] 순서로 저장되며,
  // 빈 키는 filter(Boolean) 으로 제외돼서 길이가 1~3 이 될 수 있다.
  /** @typedef {'front_no_glasses' | 'left_no_glasses' | 'right_no_glasses'} MeasurementView */
  let g_measurement_view = $state(/** @type {MeasurementView} */ ('front_no_glasses'))

  const g_test_file_arr = $derived(
    Array.isArray(g_visit_obj?.test_file_arr) ? g_visit_obj.test_file_arr : [],
  )
  // 좌/우 측면 존재 판정 — test_file_arr[1]/[2] 가 비어있지 않으면 있음.
  // (정면만 있는 케이스에선 length=1 이고 [1]/[2] undefined.)
  const g_has_left_photo = $derived(Boolean(g_test_file_arr[1]))
  const g_has_right_photo = $derived(Boolean(g_test_file_arr[2]))

  // 현재 선택 뷰의 사진 URL.
  const g_active_measurement_src = $derived.by(() => {
    if (g_measurement_view === 'front_no_glasses') return g_visit_obj?.main_file ?? ''
    if (g_measurement_view === 'left_no_glasses') return g_test_file_arr[1] ?? ''
    if (g_measurement_view === 'right_no_glasses') return g_test_file_arr[2] ?? ''
    return ''
  })

  // 측정 상세 sub-navbar 에 노출할 탭 — 정면은 항상, 측면은 사진이 있을 때만.
  const g_measurement_view_tab_arr = $derived.by(() => {
    /** @type {{ id: MeasurementView, label: string }[]} */
    const local_arr = [{ id: 'front_no_glasses', label: '정면' }]
    if (g_has_left_photo) local_arr.push({ id: 'left_no_glasses', label: '좌측' })
    if (g_has_right_photo) local_arr.push({ id: 'right_no_glasses', label: '우측' })
    return local_arr
  })

  // 현재 뷰가 더 이상 노출 가능한 탭이 아니면 정면으로 fallback (BE 응답이 늦게 도착하는 등 race).
  $effect(() => {
    const local_available_id_arr = g_measurement_view_tab_arr.map((local_tab) => local_tab.id)
    if (!local_available_id_arr.includes(g_measurement_view)) {
      g_measurement_view = 'front_no_glasses'
    }
  })

  // 현재 뷰 라벨 — MeasurementList view_label 에 그대로 사용.
  const g_measurement_view_label = $derived.by(() => {
    if (g_measurement_view === 'left_no_glasses') return '좌측 (미착용)'
    if (g_measurement_view === 'right_no_glasses') return '우측 (미착용)'
    return '정면 (미착용)'
  })

  // 사용자가 클릭으로 갱신할 수 있는 항목별 점 좌표. BE 저장본을 시드로 사용하고
  // 이후 변경은 로컬에만 유지 (지금 화면에서는 BE 재저장은 하지 않음).
  let g_local_points_obj = $state(
    /** @type {Record<string, [{x:number,y:number}, {x:number,y:number}]>} */ ({}),
  )
  let g_local_active_item_id = $state(/** @type {string | null} */ (null))
  // BE 응답이 들어온 후 한 번만 점 좌표를 시드. 사용자가 수정한 이후로는 덮어쓰지 않게 플래그.
  let g_points_seeded = $state(false)

  $effect(() => {
    if (g_points_seeded) return
    if (g_measurement_points_obj && Object.keys(g_measurement_points_obj).length > 0) {
      g_local_points_obj = { ...g_measurement_points_obj }
      g_points_seeded = true
    }
  })

  // 현재 선택된 뷰에 해당하는 측정 항목들만 추려 MeasureCanvas/MeasurementList 가 기대하는 형태로 빌드.
  // template.js 의 view 는 배열 — 다중 뷰 항목(예: left_glasses+right_glasses) 지원을 위해
  // 문자열 비교가 아니라 includes 로 매칭한다. (이전 버그: view==='front_no_glasses' 는 항상 false 라
  // items_arr 가 항상 비어 "이 뷰에 정의된 측정 항목이 없습니다." 가 노출되었다.)
  const g_items_arr = $derived.by(() => {
    return MEASUREMENT_TEMPLATE.filter((local_entry) =>
      local_entry.view?.includes?.(g_measurement_view),
    ).map((local_entry) => {
      const local_points = g_local_points_obj?.[local_entry.item_id] ?? null
      const local_value_px = local_points ? pixel_distance(local_points[0], local_points[1]) : null
      const local_mm_per_px = g_scale_obj?.mm_per_px ?? null
      const local_saved_mm = g_measurements_obj?.[local_entry.item_id]?.value_mm ?? null
      const local_value_mm =
        local_value_px !== null && local_mm_per_px !== null
          ? local_value_px * local_mm_per_px
          : local_saved_mm
      return {
        item_id: local_entry.item_id,
        label: local_entry.label,
        view: local_entry.view,
        source: local_entry.source,
        points: local_points,
        value_px: local_value_px,
        value_mm: local_value_mm,
      }
    })
  })

  // MeasureCanvas 가 요구하는 capture-shape 객체를 BE 데이터로 합성.
  // BE 사진은 업로드 시점에 좌우 반전된 상태이므로 MeasureCanvas 의 mirror_x 로직과 정합.
  // 측면 뷰도 image_dims_obj 는 정면 기준 dims 그대로 사용 — 측면 별도 dims 가 BE 응답에 없고,
  // 사진 비율이 3:4 로 거의 동일해서 시각화상 어색하지 않음. (정확한 픽셀↔mm 환산이 필요한 측정은
  // 정면에 한정돼 있어 측면 dims 차이가 측정값 자체엔 영향 없음.)
  const g_synthesized_capture = $derived.by(() => {
    if (!g_active_measurement_src || !g_image_dims_obj?.width || !g_image_dims_obj?.height) {
      return null
    }
    return /** @type {any} */ ({
      object_url: g_active_measurement_src,
      width: g_image_dims_obj.width,
      height: g_image_dims_obj.height,
    })
  })

  /** @param {string} item_id */
  function on_select_measurement(item_id) {
    g_local_active_item_id = g_local_active_item_id === item_id ? null : item_id
  }

  /** @param {string} item_id */
  function on_clear_measurement(item_id) {
    const local_next_obj = { ...g_local_points_obj }
    delete local_next_obj[item_id]
    g_local_points_obj = local_next_obj
  }

  /**
   * @param {string} item_id
   * @param {[{x:number,y:number}, {x:number,y:number}]} points
   */
  function on_points_set_measurement(item_id, points) {
    g_local_points_obj = { ...g_local_points_obj, [item_id]: points }
    // active 를 유지 — 점 2개 잇자마자 그린 선이 그대로 보이도록 (특히 전경각처럼 수동으로 두 점 찍는 항목).
    // 사용자가 해제하고 싶으면 MeasurementList 의 같은 항목을 다시 눌러 토글.
  }

  function on_cancel_measurement() {
    g_local_active_item_id = null
  }

  // 측정 내용 저장 — 사용자가 다시 그린 점 좌표를 BE 에 PATCH 한다.
  // 거리 항목은 (value_px, value_mm), 각도 항목은 (value_deg_raw, value_deg_corrected) 까지 재계산해 측정값 필드를 갱신.
  // 사후 측정이라 image_tilt 정보가 없어 각도 보정값(corrected)은 raw 와 동일, head_image_tilt_deg_used 는 null.
  let g_is_saving_measurements = $state(false)

  async function on_click_save_measurements() {
    if (g_is_saving_measurements) return
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      push_error_toast('방문 정보가 없어 저장할 수 없습니다.')
      return
    }

    g_is_saving_measurements = true
    try {
      const local_mm_per_px = g_scale_obj?.mm_per_px ?? null
      /** @type {Record<string, any>} */
      const local_next_measurements = { ...(g_measurements_obj ?? {}) }

      for (const local_entry of MEASUREMENT_TEMPLATE) {
        const local_points = g_local_points_obj?.[local_entry.item_id]
        if (!local_points) continue
        if (local_entry.kind === 'distance') {
          const local_px = pixel_distance(local_points[0], local_points[1])
          local_next_measurements[local_entry.item_id] = {
            value_px: local_px,
            value_mm: local_mm_per_px !== null ? local_px * local_mm_per_px : null,
            source: local_entry.source,
          }
        } else if (local_entry.kind === 'angle') {
          const local_view_id = local_entry.view[0]
          const local_raw = vertical_signed_angle_deg(
            local_points[0],
            local_points[1],
            local_view_id,
          )
          local_next_measurements[local_entry.item_id] = {
            value_deg_raw: local_raw,
            value_deg_corrected: local_raw,
            head_image_tilt_deg_used: null,
            source: local_entry.source,
          }
        }
      }

      const local_patched_test_json = {
        ...(g_test_json ?? {}),
        measurement_points_obj: { ...g_local_points_obj },
        measurements: local_next_measurements,
      }

      const local_updated = await update_visit({
        visit_no: local_visit_no,
        body: { test_json: local_patched_test_json },
      })

      // BE 응답 우선 반영 — 응답이 없거나 test_json 누락 시 로컬 합성본으로 fallback.
      g_visit_obj =
        local_updated && local_updated.test_json
          ? local_updated
          : { ...(g_visit_obj ?? {}), test_json: local_patched_test_json }
      push_success_toast('측정 내용을 저장했어요.')
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '측정 내용 저장에 실패했습니다.',
      )
    } finally {
      g_is_saving_measurements = false
    }
  }

  // 고객 정보 표시용 (없는 값은 '-' 처리)
  const g_customer_phone = $derived($selected_customer_obj?.phone ?? '-')
  const g_customer_age_label = $derived.by(() => {
    if ($selected_customer_obj?.age) return String($selected_customer_obj.age)
    const local_birth_dt = String($selected_customer_obj?.birth_dt ?? '').trim()
    const local_birth_year_match = local_birth_dt.match(/\d{4}/)
    if (!local_birth_year_match) return '-'
    return `${new Date().getFullYear() - Number(local_birth_year_match[0]) + 1}세`
  })
  const g_visit_dt_label = $derived.by(() => {
    const local_visit_dt = String($selected_customer_obj?.last_visit_dt ?? '').trim()
    if (!local_visit_dt || local_visit_dt === '-') {
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date())
    }
    const local_date = new Date(local_visit_dt)
    if (Number.isNaN(local_date.getTime())) return local_visit_dt
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(local_date)
  })

  function on_click_go_main() {
    navigate(PATH.visitSelect)
  }

  function on_click_open_customer_create_modal() {
    ref_customer_create_modal_open = true
  }

  function on_click_close_customer_create_modal() {
    ref_customer_create_modal_open = false
  }

  /**
   * 비회원 분석 결과를 새로 등록한 고객 정보로 연결한다.
   * 1) create_customer 로 신규 고객 등록 → search_customer 로 새 cust_no 추출
   * 2) 기존 visit 의 식별 필드(cust_no/이름/전화/생년월일/성별)만 PATCH 로 갱신
   *    - visit_no 그대로, 분석/리포트/사진 데이터 그대로 → URL 이중 인코딩/visit 중복 생성 없음
   * 3) selected_customer / selected_visit 갱신 (sessionStorage 의 visit_no 는 변경 없음)
   * @param {{ name: string, gender: string, birth_dt: string, phone1: string, phone2: string }} customer_obj
   */
  async function on_create_customer(customer_obj) {
    if (g_is_registering_customer) return
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      push_error_toast('연결할 방문 정보가 없습니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    const local_phone1 = customer_obj.phone1.replace(/[^0-9]/g, '')
    const local_phone2 = customer_obj.phone2.replace(/[^0-9]/g, '')
    // 성별 미선택(빈 문자열) 시 null 로 보내 BE 가 그대로 비워두게 한다 — Number('') 가 0(남) 으로 묻히는 사고 방지.
    const local_sex_value =
      customer_obj.gender === '' || customer_obj.gender == null ? null : Number(customer_obj.gender)

    g_is_registering_customer = true
    try {
      await create_customer({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_name: customer_obj.name,
        phone1: local_phone1,
        phone2: local_phone2,
        birthday: customer_obj.birth_dt,
        sex: local_sex_value,
      })

      const local_search_arr = await search_customer({
        phone_no: local_phone1,
        opt_no: $selected_opt_store_obj.opt_no,
      })
      const local_search_obj_arr = Array.isArray(local_search_arr) ? local_search_arr : []
      const local_new_customer_obj =
        local_search_obj_arr.find(
          (local_obj) =>
            String(local_obj?.cust_name ?? '').trim() === customer_obj.name.trim() &&
            String(local_obj?.phone1 ?? '').replace(/[^0-9]/g, '') === local_phone1,
        ) ?? local_search_obj_arr[0]
      const local_new_cust_no = Number(local_new_customer_obj?.cust_no)

      if (!Number.isFinite(local_new_cust_no) || local_new_cust_no <= 0) {
        push_error_toast('등록한 고객 정보를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      // 기존 visit 의 식별 필드만 PATCH 로 덮어쓴다 — 분석/사진/리포트는 그대로 보존.
      // BE VisitUpdateRequest 에 cust_no / cust_name / phone_no1 / phone_no2 / birthday / sex 필드 허용 필요.
      await update_visit({
        visit_no: local_visit_no,
        body: {
          cust_no: local_new_cust_no,
          cust_name: customer_obj.name,
          phone_no1: local_phone1,
          phone_no2: local_phone2,
          birthday: customer_obj.birth_dt,
          sex: local_sex_value,
        },
      })

      set_selected_customer({
        id: local_new_cust_no,
        name: customer_obj.name,
        phone: local_phone1,
        phone2: local_phone2,
        gender: local_sex_value === 0 ? '남' : local_sex_value === 1 ? '여' : '',
        birth_dt: customer_obj.birth_dt,
        visit_count: 1,
        last_visit_dt: '-',
      })

      // visit_no 변경 없음 → sessionStorage 의 retinal_visit_no 도 그대로 둔다.
      // 식별 필드만 머지해서 selected_visit 갱신.
      set_selected_visit({
        ...$selected_visit_obj,
        cust_no: local_new_cust_no,
        cust_name: customer_obj.name,
        phone_no1: local_phone1,
        phone_no2: local_phone2,
        birthday: customer_obj.birth_dt,
        sex: local_sex_value,
        is_new: false,
      })

      ref_customer_create_modal_open = false
      // PATCH 반영 후 BE 응답 기준으로 화면 데이터 다시 로드 (visit_no 동일).
      await load_visit_data()
    } catch (local_error) {
      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 등록 중 오류가 발생했습니다.',
      )
    } finally {
      g_is_registering_customer = false
    }
  }

  // real_fitting.svelte 가 미리 GET 해둔 visit_obj 가 sessionStorage 에 있으면 즉시 화면에 채운다.
  // 캐시는 1회용 — 사용 직후 제거해서 다음 진입 시 항상 fresh fetch 가 일어나게 한다.
  function try_consume_prefetched_visit(local_visit_no) {
    try {
      const local_cached_text = sessionStorage.getItem(PREFETCH_VISIT_KEY)
      if (!local_cached_text) return null
      const local_cached_obj = JSON.parse(local_cached_text)
      sessionStorage.removeItem(PREFETCH_VISIT_KEY)
      if (Number(local_cached_obj?.visit_no) !== local_visit_no) return null
      if (!local_cached_obj?.visit_obj) return null
      return local_cached_obj.visit_obj
    } catch {
      try {
        sessionStorage.removeItem(PREFETCH_VISIT_KEY)
      } catch {
        // ignore
      }
      return null
    }
  }

  // 현재 visit 의 분석/리포트/피팅 데이터를 한 번에 GET 해서 화면을 채운다.
  async function load_visit_data() {
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      g_visit_loading = false
      return
    }

    // real_fitting → result 전환 시 prefetch 된 데이터가 있으면 그걸로 즉시 채워 BE GET 생략.
    const local_prefetched_obj = try_consume_prefetched_visit(local_visit_no)
    if (local_prefetched_obj) {
      g_visit_obj = local_prefetched_obj
      g_visit_loading = false
      return
    }

    const local_fallback_no = Number(sessionStorage.getItem('retinal_fallback_face_visit_no'))
    sessionStorage.removeItem('retinal_fallback_face_visit_no')

    try {
      // [id].svelte 클릭 시점에 시작된 prefetch Promise 가 있으면 그걸 await (이미 완료됐으면 즉시 반환)
      const local_prefetch_promise = consume_prefetch_visit(local_visit_no)
      const [local_visit, local_fallback_visit] = local_prefetch_promise
        ? await local_prefetch_promise
        : await Promise.all([
            get_visit({ visit_no: local_visit_no }),
            Number.isFinite(local_fallback_no) && local_fallback_no > 0
              ? get_visit({ visit_no: local_fallback_no }).catch(() => null)
              : Promise.resolve(null),
          ])

      g_visit_obj = local_visit
      if (!g_visit_obj?.test_json && local_fallback_visit?.test_json) {
        g_visit_obj = { ...g_visit_obj, test_json: local_fallback_visit.test_json }
      }
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '방문 정보를 불러오지 못했습니다.',
      )
    } finally {
      g_visit_loading = false
    }
  }

  onMount(() => {
    // 이전 화면에서 시작된 음성이 모듈 싱글톤 audio 채널에 남아있을 수 있으니 진입 즉시 차단.
    silence_voice()
    void load_visit_data()
  })
</script>

<AnalysisPageLayout
  current_step={5}
  bg_class="bg-[var(--retina-text-100)] text-zinc-950"
  fit_viewport={true}
  show_step_bar={false}
>
  <!--
    활성 탭 컨텐츠 — 탭 내부에서만 세로 스크롤. main 의 회색 bg 를 그대로 상속.
    좌우 스와이프(터치 + 마우스 드래그) 로 탭 전환.
    상단 sticky 헤더(제목+탭) 는 section 내부 첫 자식으로 두어야 한다. sticky 가 동작하려면
    sticky 요소의 nearest scrolling ancestor 와 같은 overflow 컨텍스트 안에 있어야 하기 때문.
    section 외부에 두면 section 의 overflow-y-auto 스크롤을 sticky 가 인식 못 해 고정 안 됨.
    a11y: aria-label 만으로도 <section> 이 implicit region role 을 가지므로 role="region" 은 중복.
  -->
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto touch-pan-y"
    aria-label="리포트 컨텐츠 (좌우 스와이프로 탭 전환)"
    ontouchstart={on_touchstart_swipe}
    ontouchend={on_touchend_swipe}
    onpointerdown={on_pointerdown_swipe}
    onpointerup={on_pointerup_swipe}
  >
    <div
      class="app-bg-edge-extend sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white px-[clamp(12px,3svh,24px)] pt-[clamp(6px,1.5svh,14px)]"
    >
      <h1
        class="m-0 text-center font-extrabold tracking-[-0.02em] text-zinc-950 text-[clamp(14px,3svh,28px)]"
      >
        {g_customer_name_label}의 최종 분석 리포트
      </h1>
      <nav
        class="mt-[clamp(6px,1.5svh,14px)] flex items-end justify-center gap-2 overflow-x-auto"
        aria-label="리포트 섹션 네비게이션"
      >
        {#each TAB_ARR as tab_obj (tab_obj.id)}
          {@const local_is_active = g_active_tab === tab_obj.id}
          <button
            type="button"
            class={`shrink-0 cursor-pointer border-b-[3px] font-extrabold transition px-[clamp(10px,2.5svh,20px)] py-[clamp(6px,1.5svh,14px)] text-[clamp(13px,2.5svh,22px)] ${
              local_is_active
                ? 'border-[var(--retina-primary-500)] text-[var(--retina-primary-600)]'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
            aria-pressed={local_is_active}
            onclick={() => (g_active_tab = tab_obj.id)}
          >
            {tab_obj.label}
          </button>
        {/each}
      </nav>
    </div>

    <!--
      모든 탭이 자연 height 로 흐르며 부모 section 의 overflow-y-auto 가 스크롤 처리.
      이전엔 일부 탭에 min-h-full 을 줘서 카드를 viewport 까지 늘렸는데, 컨텐츠보다 카드가
      길어지면 하단에 빈 영역이 남아 어색하므로 모두 자연 흐름으로 통일.
      내부 padding 은 sticky 헤더가 full-bleed 가 되도록 section 이 아닌 이 컨테이너로 옮겨둔다.
    -->
    <div
      class="mx-auto flex w-full max-w-[760px] xl:max-w-[1000px] 2xl:max-w-[1240px] flex-col gap-[clamp(7px,1.7svh,14px)] px-[clamp(12px,3svh,24px)] py-[clamp(7px,1.7svh,14px)]"
    >
      {#if g_active_tab === 'overview'}
        <!-- 1. 고객 정보 -->
        <section
          class="rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(6px,1.4svh,12px)]"
        >
          <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">고객 정보</h2>
          <div class="mt-2 grid grid-cols-4 gap-[clamp(8px,2svh,16px)]">
            <div>
              <p class="m-0 font-bold text-slate-400 text-[clamp(11px,1.9svh,18px)]">고객명</p>
              <p class="mt-1 font-extrabold text-zinc-900 text-[clamp(13px,2.8svh,26px)]">
                {g_customer_name_label}
              </p>
            </div>
            <div>
              <p class="m-0 font-bold text-slate-400 text-[clamp(11px,1.9svh,18px)]">연령</p>
              <p class="mt-1 font-extrabold text-zinc-900 text-[clamp(13px,2.8svh,26px)]">
                {g_customer_age_label}
              </p>
            </div>
            <div>
              <p class="m-0 font-bold text-slate-400 text-[clamp(11px,1.9svh,18px)]">연락처</p>
              <p class="mt-1 font-extrabold text-zinc-900 text-[clamp(13px,2.8svh,26px)]">
                {g_customer_phone}
              </p>
            </div>
            <div>
              <p class="m-0 font-bold text-slate-400 text-[clamp(11px,1.9svh,18px)]">방문일</p>
              <p class="mt-1 font-extrabold text-zinc-900 text-[clamp(13px,2.8svh,26px)]">
                {g_visit_dt_label}
              </p>
            </div>
          </div>
        </section>

        <!-- 2. 얼굴 분석 결과 — report.svelte 우측 패널과 동일한 구성 (얼굴형/피부톤 박스 → 추천 컬러 칩 → 추천 모양) -->
        <section
          class="flex flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(6px,1.4svh,12px)]"
        >
          <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">
            얼굴 분석 결과
          </h2>

          <article class="mt-2 flex flex-col">
            <div class="grid grid-cols-2 gap-[clamp(6px,1.5svh,12px)]">
              <div
                class="flex flex-col justify-center rounded-[8px] border border-[#FFEDD5] bg-[#FFF7ED] text-center px-[clamp(8px,1.8svh,16px)] py-[clamp(4px,1svh,8px)]"
              >
                <p class="m-0 font-bold text-slate-700 text-[clamp(12px,2svh,20px)]">얼굴형</p>
                <p class="m-0 mt-1 font-extrabold text-[#F97316] text-[clamp(14px,2.6svh,26px)]">
                  {g_face_shape_label ?? '-'}
                </p>
              </div>
              <div
                class="flex flex-col justify-center rounded-[8px] border border-[#D8E2FF] bg-[#EDF0FF] text-center px-[clamp(8px,1.8svh,16px)] py-[clamp(4px,1svh,8px)]"
              >
                <p class="m-0 font-bold text-slate-700 text-[clamp(12px,2svh,20px)]">피부톤</p>
                <p class="m-0 mt-1 font-extrabold leading-tight text-[#1660C7] text-[clamp(13px,2.4svh,24px)]">
                  {#if g_skin_tone_recommendation_obj}
                    {g_skin_tone_recommendation_obj.label}
                    <br />
                    {SKIN_TONE_DESCRIPTION_OBJ[g_skin_tone_recommendation_obj.key] ?? '-'}
                  {:else}
                    -
                  {/if}
                </p>
              </div>
            </div>

            <div class="my-1 h-px shrink-0 bg-slate-200"></div>

            <!-- 추천 컬러 / 추천 모양 같은 행에 배치. 모양은 1순위만 노출. -->
            <div class="grid grid-cols-2 gap-[clamp(8px,2svh,16px)]">
              <section class="flex flex-col">
                <h3
                  class="m-0 shrink-0 text-center font-extrabold text-slate-800 text-[clamp(13px,2.4svh,22px)]"
                >
                  추천 안경테 컬러
                </h3>
                <!--
                  기본 4개 슬롯 (2×2). 데이터가 있을 때만 chip 노출, 없으면 grid 영역에 '-' 한 번만.
                -->
                {#if g_recommended_color_arr.length === 0}
                  <div
                    class="mt-2 grid place-items-center font-extrabold text-slate-400 text-[clamp(14px,2.8svh,26px)] grid-rows-[repeat(2,clamp(44px,7.5svh,72px))]"
                  >
                    -
                  </div>
                {:else}
                  <div
                    class="mt-2 grid grid-cols-2 gap-[clamp(6px,1.5svh,12px)] grid-rows-[repeat(2,clamp(44px,7.5svh,72px))]"
                  >
                    {#each Array.from({ length: 4 }) as _, color_index (color_index)}
                      {@const local_color_obj = g_recommended_color_arr[color_index]}
                      {#if local_color_obj}
                        <div
                          class={`flex items-center justify-center rounded-[10px] border border-black/5 text-center shadow-sm px-[clamp(8px,1.8svh,16px)] py-[clamp(4px,1svh,8px)] ${local_color_obj.gradient_class ?? local_color_obj.tone_class}`}
                        >
                          <p
                            class={`m-0 font-black text-[clamp(13px,2.4svh,24px)] ${get_chip_text_class(local_color_obj)}`}
                          >
                            {local_color_obj.label}
                          </p>
                        </div>
                      {:else}
                        <div aria-hidden="true"></div>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </section>

              <section class="flex flex-col">
                <h3
                  class="m-0 shrink-0 text-center font-extrabold text-slate-800 text-[clamp(13px,2.4svh,22px)]"
                >
                  추천 안경테 모양
                </h3>
                {#if g_priority_one_frame_arr.length === 0}
                  <div
                    class="mt-2 grid place-items-center font-extrabold text-slate-400 text-[clamp(14px,2.8svh,26px)] grid-rows-[repeat(2,clamp(44px,7.5svh,72px))]"
                  >
                    -
                  </div>
                {:else}
                  <div
                    class="mt-2 grid grid-cols-2 gap-[clamp(6px,1.5svh,12px)] grid-rows-[repeat(2,clamp(44px,7.5svh,72px))]"
                  >
                    {#each Array.from({ length: 4 }) as _, frame_index (frame_index)}
                      {@const local_frame_obj = g_priority_one_frame_arr[frame_index]}
                      {#if local_frame_obj}
                        <div
                          class="flex items-center justify-center rounded-[10px] border border-[#F97316] bg-white text-center shadow-sm px-[clamp(8px,1.8svh,16px)] py-[clamp(4px,1svh,8px)]"
                        >
                          <p class="m-0 font-black text-[#F97316] text-[clamp(13px,2.4svh,24px)]">
                            {local_frame_obj.name}
                          </p>
                        </div>
                      {:else}
                        <div aria-hidden="true"></div>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </section>
            </div>
          </article>
        </section>
      {:else if g_active_tab === 'measurement'}
        <!-- 얼굴 측정 상세 (사진 + 클릭으로 라인 표시) — 사진 아래 여백을 위해 pb 만 확장. -->
        <section
          class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] pt-[clamp(6px,1.4svh,12px)] pb-[clamp(6px,3svh,40px)]"
        >
          <div class="flex flex-wrap items-center justify-between gap-[clamp(8px,2svh,16px)]">
            <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">
              얼굴 측정 상세
            </h2>
            <div class="flex items-center gap-[clamp(6px,1.5svh,14px)]">
              {#if g_measurement_view_tab_arr.length > 1}
                <nav
                  class="flex items-end gap-1 overflow-x-auto"
                  aria-label="측정 사진 뷰 선택"
                >
                  {#each g_measurement_view_tab_arr as view_tab_obj (view_tab_obj.id)}
                    {@const local_is_active_view = g_measurement_view === view_tab_obj.id}
                    <button
                      type="button"
                      class={`shrink-0 cursor-pointer border-b-[3px] font-extrabold transition px-[clamp(8px,2svh,16px)] py-[clamp(4px,1svh,10px)] text-[clamp(11px,2svh,18px)] ${
                        local_is_active_view
                          ? 'border-[var(--retina-primary-500)] text-[var(--retina-primary-600)]'
                          : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}
                      aria-pressed={local_is_active_view}
                      onclick={() => (g_measurement_view = view_tab_obj.id)}
                    >
                      {view_tab_obj.label}
                    </button>
                  {/each}
                </nav>
              {/if}
              <button
                type="button"
                onclick={on_click_save_measurements}
                disabled={g_is_saving_measurements || g_visit_loading || !g_synthesized_capture}
                class="shrink-0 cursor-pointer rounded-lg border-0 bg-[var(--retina-primary-500)] font-extrabold text-white transition hover:bg-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-50 px-[clamp(10px,2.4svh,20px)] py-[clamp(5px,1.2svh,12px)] text-[clamp(11px,2svh,18px)]"
              >
                {g_is_saving_measurements ? '저장 중...' : '측정 내용 저장'}
              </button>
            </div>
          </div>

          {#if g_visit_loading}
            <p class="mt-2 font-semibold text-slate-400 text-[clamp(12px,2.1svh,19px)]">
              측정 데이터 불러오는 중...
            </p>
          {:else if !g_synthesized_capture}
            <p class="mt-2 font-semibold text-slate-400 text-[clamp(12px,2.1svh,19px)]">
              저장된 사진 또는 측정 좌표가 없습니다.
            </p>
          {:else}
            <div
              class="mt-2 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-[clamp(8px,2svh,16px)]"
            >
              <div class="flex items-start justify-center">
                <div
                  class="flex aspect-[3/4] h-full max-h-[clamp(220px,52svh,440px)] w-full max-w-[clamp(165px,39svh,330px)] overflow-hidden rounded-[10px] bg-slate-100 shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
                >
                  <MeasureCanvas
                    capture={g_synthesized_capture}
                    items_arr={g_items_arr}
                    active_item_id={g_local_active_item_id}
                    onpoints_set={on_points_set_measurement}
                    oncancel={on_cancel_measurement}
                  />
                </div>
              </div>
              <div class="flex flex-col">
                <MeasurementList
                  items_arr={g_items_arr}
                  active_item_id={g_local_active_item_id}
                  view_label={g_measurement_view_label}
                  onselect={on_select_measurement}
                  onclear={on_clear_measurement}
                  show_clear={false}
                />
              </div>
            </div>
          {/if}
        </section>
      {:else if g_active_tab === 'lifestyle'}
        <!-- 생활 패턴 -->
        <section
          class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(6px,1.4svh,12px)]"
        >
          <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">생활 패턴</h2>

          {#if g_lens_selection_arr.length === 0}
            <p class="mt-3 font-semibold text-slate-400 text-[clamp(13px,2.4svh,22px)]">
              선택한 항목이 없습니다.
            </p>
          {:else}
            <div class="mt-3 grid grid-cols-2 gap-[clamp(10px,2.2svh,18px)]">
              {#each g_lens_selection_arr as selection_obj, selection_index (selection_index)}
                <div
                  class="rounded-[10px] border border-slate-100 bg-slate-50 px-[clamp(12px,2.4svh,24px)] py-[clamp(10px,2.4svh,20px)]"
                >
                  <p class="m-0 font-bold text-slate-500 text-[clamp(13px,2.5svh,24px)]">
                    Q{selection_index + 1}. {selection_obj.question_text}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    {#if selection_obj.label_arr.length === 0}
                      <span class="font-semibold text-slate-400 text-[clamp(13px,2.4svh,22px)]"
                        >-</span
                      >
                    {:else}
                      {#each selection_obj.label_arr as label_text, label_index (`${selection_index}-${label_index}`)}
                        <span
                          class="inline-flex items-center rounded-md border border-[var(--retina-primary-300)] bg-white font-bold text-[var(--retina-primary-400)] px-[clamp(10px,2.2svh,20px)] py-[clamp(4px,1svh,10px)] text-[clamp(13px,2.4svh,22px)]"
                        >
                          {label_text}
                        </span>
                      {/each}
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {:else if g_active_tab === 'fitting'}
        <!-- AR 피팅 결과 -->
        <section
          class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(6px,1.4svh,12px)]"
        >
          <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">
            AR 피팅 결과
          </h2>

          {#if g_saved_fitting_arr.length === 0}
            <div class="mt-2 grid flex-1 place-items-center gap-3 rounded-[10px] bg-slate-50 py-8">
              <Glasses size={40} class="text-slate-300" />
              <p class="m-0 font-bold text-slate-400 text-[clamp(12px,2.1svh,19px)]">
                저장된 피팅이 없습니다.
              </p>
            </div>
          {:else}
            <!-- 각 피팅: 브랜드/모델 헤더 + 정면/좌측/우측 사진 3장을 같은 행에 표시. 피팅 카드 자체는 세로로 stack. -->
            <div class="mt-2 flex flex-col gap-[clamp(7px,1.7svh,14px)]">
              {#each g_saved_fitting_arr as fitting_obj, fitting_index (fitting_index)}
                {@const local_photo_arr = (fitting_obj.capture_arr ?? []).slice(0, 3)}
                <article
                  class="rounded-[12px] border border-slate-100 bg-slate-50 p-[clamp(8px,1.8svh,16px)]"
                >
                  <header class="mb-[clamp(6px,1.4svh,12px)] flex flex-col">
                    <span
                      class="font-bold uppercase tracking-wider text-slate-400 text-[clamp(11px,1.9svh,18px)]"
                    >
                      {fitting_obj.brand || 'BRAND'}
                    </span>
                    <p
                      class="m-0 truncate font-extrabold text-zinc-900 text-[clamp(14px,2.6svh,24px)]"
                    >
                      {fitting_obj.model || '-'}
                    </p>
                  </header>
                  <div
                    class="grid justify-center gap-[clamp(6px,1.5svh,12px)] grid-cols-[repeat(3,minmax(0,clamp(160px,28svh,300px)))]"
                  >
                    {#each local_photo_arr as capture_obj, capture_idx (capture_idx)}
                      {@const local_src = resolve_capture_src(capture_obj)}
                      <div
                        class="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] border border-slate-200 bg-white"
                      >
                        {#if local_src}
                          <img
                            src={local_src}
                            alt={`${fitting_obj.model} ${capture_obj?.label ?? ''}`}
                            class="h-full w-full object-cover"
                          />
                        {:else}
                          <div class="grid h-full w-full place-items-center text-slate-300">
                            <UserRound size={32} strokeWidth={1.7} />
                          </div>
                        {/if}
                        {#if capture_obj?.label}
                          <span
                            class="absolute bottom-1 left-1 rounded-sm bg-black/55 px-1 py-0.5 font-extrabold text-white text-[clamp(11px,1.8svh,16px)]"
                          >
                            {capture_obj.label}
                          </span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {:else if g_active_tab === 'real_fitting'}
        <!-- 실 착용 사진 세트 (정면 / 좌 / 우) -->
        <section
          class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(6px,1.4svh,12px)]"
        >
          <h2 class="m-0 font-extrabold text-zinc-900 text-[clamp(14px,3svh,28px)]">
            실제 착용 사진
          </h2>

          {#if g_real_vp_set_arr.length === 0}
            <div class="mt-2 grid flex-1 place-items-center gap-3 rounded-[10px] bg-slate-50 py-8">
              <Glasses size={40} class="text-slate-300" />
              <p class="m-0 font-bold text-slate-400 text-[clamp(13px,2.1svh,18px)]">
                저장된 실제 착용 사진이 없습니다.
              </p>
            </div>
          {:else}
            <div class="mt-2 flex flex-col gap-2">
              {#each g_real_vp_set_arr as set_obj, set_index (set_index)}
                {@const local_view_tab_arr = [
                  {
                    id: /** @type {'front'} */ ('front'),
                    label: '정면',
                    url: set_obj.front_url ?? set_obj.front_key ?? '',
                    view_label: '정면 (실 착용)',
                  },
                  {
                    id: /** @type {'left'} */ ('left'),
                    label: '좌측',
                    url: set_obj.left_url ?? set_obj.left_key ?? '',
                    view_label: '좌측 (실 착용)',
                  },
                  {
                    id: /** @type {'right'} */ ('right'),
                    label: '우측',
                    url: set_obj.right_url ?? set_obj.right_key ?? '',
                    view_label: '우측 (실 착용)',
                  },
                ]}
                {@const local_current_view = get_real_vp_view(set_index)}
                {@const local_current_tab_obj =
                  local_view_tab_arr.find((t) => t.id === local_current_view) ?? local_view_tab_arr[0]}
                <article
                  class="flex flex-col rounded-[14px] border border-slate-200 bg-white shadow-sm px-[clamp(14px,3svh,28px)] py-[clamp(4px,1svh,10px)]"
                >
                  <!-- 헤더 — 세트 라벨 + 사진 뷰 sub-tab + 세트별 저장 버튼. -->
                  <div
                    class="flex flex-wrap items-center justify-between gap-[clamp(8px,2svh,16px)]"
                  >
                    <h3
                      class="m-0 font-extrabold text-zinc-900 text-[clamp(13px,2.4svh,22px)]"
                    >
                      세트 {set_obj.set_no ?? set_index + 1}
                    </h3>
                    <div class="flex items-center gap-[clamp(6px,1.5svh,14px)]">
                      <nav
                        class="flex items-end gap-1 overflow-x-auto"
                        aria-label="실 착용 사진 뷰 선택"
                      >
                        {#each local_view_tab_arr as view_tab_obj (view_tab_obj.id)}
                          {@const local_is_active_view = local_current_view === view_tab_obj.id}
                          <button
                            type="button"
                            class={`shrink-0 cursor-pointer border-b-[3px] font-extrabold transition px-[clamp(8px,2svh,16px)] py-[clamp(4px,1svh,10px)] text-[clamp(11px,2svh,18px)] ${
                              local_is_active_view
                                ? 'border-[var(--retina-primary-500)] text-[var(--retina-primary-600)]'
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                            }`}
                            aria-pressed={local_is_active_view}
                            onclick={() => on_click_real_vp_view(set_index, view_tab_obj.id)}
                          >
                            {view_tab_obj.label}
                          </button>
                        {/each}
                      </nav>
                      <button
                        type="button"
                        onclick={() => on_click_save_real_vp_set(set_index)}
                        disabled={g_saving_real_vp_set_index !== null || g_visit_loading}
                        class="shrink-0 cursor-pointer rounded-lg border-0 bg-[var(--retina-primary-500)] font-extrabold text-white transition hover:bg-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-50 px-[clamp(10px,2.4svh,20px)] py-[clamp(5px,1.2svh,12px)] text-[clamp(11px,2svh,18px)]"
                      >
                        {g_saving_real_vp_set_index === set_index ? '저장 중...' : '측정 내용 저장'}
                      </button>
                    </div>
                  </div>

                  <!-- 본문 — 측정 상세와 동일한 2컬럼 (사진 1fr / 측정 리스트 1.2fr). -->
                  <div
                    class="mt-2 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-[clamp(8px,2svh,16px)]"
                  >
                    <div class="flex items-start justify-center">
                      <div
                        class="relative flex aspect-[3/4] h-full max-h-[clamp(160px,38svh,320px)] w-full max-w-[clamp(120px,28svh,240px)] overflow-hidden rounded-[10px] bg-slate-100 shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
                      >
                        {#if local_current_tab_obj.url}
                          {@const local_capture_obj = {
                            object_url: local_current_tab_obj.url,
                            width: REAL_VP_CAPTURE_WIDTH,
                            height: REAL_VP_CAPTURE_HEIGHT,
                          }}
                          {@const local_canvas_active_id = get_active_real_vp_item_id(
                            set_index,
                            local_current_view,
                          )}
                          {@const local_canvas_items_arr = build_real_vp_items_arr(
                            set_index,
                            local_current_view,
                          )}
                          <MeasureCanvas
                            capture={local_capture_obj}
                            items_arr={local_canvas_items_arr}
                            active_item_id={local_canvas_active_id}
                            keyboard_enabled={false}
                            onpoints_set={(local_item_id, local_points) =>
                              on_points_set_real_vp_for_set(
                                set_index,
                                local_item_id,
                                local_points,
                              )}
                            oncancel={() => on_cancel_real_vp_for_set(set_index)}
                          />
                        {:else}
                          <div class="grid h-full w-full place-items-center text-slate-300">
                            <UserRound size={40} strokeWidth={1.7} />
                          </div>
                        {/if}
                        <span
                          class="absolute bottom-1 left-1 z-20 rounded-sm bg-black/55 px-1 py-0.5 font-extrabold text-white text-[clamp(11px,1.8svh,16px)]"
                        >
                          {local_current_tab_obj.label}
                        </span>
                      </div>
                    </div>

                    <!--
                      측정 패널 — 측정 상세 탭 MeasurementList 와 동일한 구조/스타일.
                      뷰별 항목 정의(REAL_VP_ITEMS_BY_VIEW)에 따라 다른 항목 렌더링.
                      정면: OH(좌), OH(우) · 좌측/우측: 전경각.
                    -->
                    <section
                      class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
                      aria-label="실 착용 측정 항목"
                    >
                      <div class="flex items-baseline justify-between">
                        <h4 class="m-0 text-[13px] font-extrabold text-slate-800">측정 항목</h4>
                        <span class="text-xs font-semibold text-slate-500">
                          {local_current_tab_obj.view_label}
                        </span>
                      </div>
                      <ul class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0">
                        {#each REAL_VP_ITEMS_BY_VIEW[local_current_view] as item_def_obj (item_def_obj.item_id)}
                          {@const local_value_str =
                            g_real_vp_value_obj[set_index]?.[local_current_view]?.[
                              item_def_obj.item_id
                            ] ?? ''}
                          {@const local_has_value = local_value_str !== ''}
                          {@const local_source =
                            g_real_vp_source_obj[set_index]?.[local_current_view]?.[
                              item_def_obj.item_id
                            ] ?? null}
                          {@const local_is_auto = local_source === 'auto'}
                          {@const local_unit_label =
                            item_def_obj.kind === 'angle' ? '°' : ' mm'}
                          {@const local_is_active_row =
                            g_real_vp_active_by_set_obj[set_index]?.view === local_current_view &&
                            g_real_vp_active_by_set_obj[set_index]?.item_id === item_def_obj.item_id}
                          <li>
                            <div
                              class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-[#FFF6EB]"
                              class:bg-[#FFF6EB]={local_is_active_row}
                              role="button"
                              tabindex="0"
                              aria-pressed={local_is_active_row}
                              onclick={() =>
                                on_select_real_vp_item(
                                  set_index,
                                  local_current_view,
                                  item_def_obj.item_id,
                                )}
                              onkeydown={(local_event) => {
                                if (local_event.key === 'Enter' || local_event.key === ' ') {
                                  local_event.preventDefault()
                                  on_select_real_vp_item(
                                    set_index,
                                    local_current_view,
                                    item_def_obj.item_id,
                                  )
                                }
                              }}
                            >
                              <span
                                class="grid h-4 w-4 flex-none place-items-center rounded-full border border-slate-400"
                                class:border-[#F97316]={local_is_active_row}
                                aria-hidden="true"
                              >
                                {#if local_is_active_row}
                                  <span class="h-2 w-2 rounded-full bg-[#F97316]"></span>
                                {/if}
                              </span>
                              <span class="flex-1 truncate text-sm font-semibold text-slate-700">
                                {item_def_obj.label}
                              </span>
                              <span
                                class="flex-none text-sm font-bold tabular-nums"
                                class:text-[var(--retina-text)]={local_has_value}
                                class:text-slate-400={!local_has_value}
                              >
                                {local_has_value ? `${local_value_str}${local_unit_label}` : '—'}
                              </span>
                              {#if local_has_value}
                                <span
                                  class="flex-none rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                                  class:bg-emerald-100={local_is_auto}
                                  class:text-emerald-800={local_is_auto}
                                  class:bg-amber-100={!local_is_auto}
                                  class:text-amber-800={!local_is_auto}
                                >
                                  {local_is_auto ? '자동' : '수동'}
                                </span>
                              {/if}
                            </div>
                          </li>
                        {/each}
                      </ul>
                    </section>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {:else if g_active_tab === 'insight'}
        <!-- AI 분석 인사이트 — 공유 컴포넌트로 추출 (visit_detail.svelte 와 동일 사용). -->
        <AiInsightPanel visit_obj={g_visit_obj} is_loading={g_visit_loading} />

        <p class="m-0 px-1 text-center text-[12px] font-medium leading-relaxed text-slate-400">
          본 리포트는 AI 기반 얼굴 분석 결과를 토대로 자동 생성되었으며, 참고용 추천 자료입니다.
          실제 시야·착용감·도수 등은 개인차가 있을 수 있으니
          <span class="font-bold text-[var(--retina-primary-400)]"
            >자세한 사항은 전문 안경사와 상담해 주세요.</span
          >
        </p>
      {/if}
    </div>
  </section>

  <!-- 하단 액션바 — 어떤 탭에 있든 항상 노출. -->
  <BottomActionBar padding_class="px-[clamp(12px,3svh,24px)] py-[clamp(6px,1.5svh,14px)]">
    <div
      class={`mx-auto grid w-full max-w-[760px] xl:max-w-[1000px] 2xl:max-w-[1240px] gap-[clamp(8px,2svh,16px)] ${
        g_is_guest_visit ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      <button
        type="button"
        onclick={on_click_go_main}
        class="grid cursor-pointer place-items-center rounded-lg border-0 bg-[var(--retina-primary-300)] tracking-tight text-[var(--retina-surface)] shadow-sm transition hover:bg-[var(--retina-primary-400)] h-[clamp(40px,7.5svh,80px)] text-[clamp(15px,3.6svh,36px)]"
      >
        메인으로 이동
      </button>
      {#if g_is_guest_visit}
        <button
          type="button"
          onclick={on_click_open_customer_create_modal}
          class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--retina-primary-600)] bg-white text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)] h-[clamp(40px,7.5svh,80px)] text-[clamp(14px,3.2svh,32px)]"
        >
          <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
          <span>고객정보등록하기</span>
        </button>
      {/if}
    </div>
  </BottomActionBar>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />

  <LoadingOverlay open={g_is_registering_customer} label="고객 정보 등록 중..." />
</AnalysisPageLayout>
