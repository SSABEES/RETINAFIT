<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Glasses, UserRound, UserPlus } from 'lucide-svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { get_visit, update_visit } from '@/lib/api/visit'
  import { selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast } from '@/lib/stores/toast'
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
  import { pixel_distance } from '@/lib/measurements/measurement_utils.js'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import AiInsightPanel from '@/components/analysis/ai_insight_panel.svelte'
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
  let g_visit_obj = $state(/** @type {Record<string, any> | null} */ (null))
  let g_visit_loading = $state(true)

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

  // visit_obj.report_json (BE 가 생성하는 최종 인사이트)
  const g_report_json = $derived(g_visit_obj?.report_json ?? null)

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
  const g_saved_fitting_arr = $derived.by(() => {
    const local_arr = Array.isArray(g_vp_json?.fitting_arr) ? g_vp_json.fitting_arr : []
    return /** @type {{brand: string, model: string, capture_arr: {label: string, url: string}[]}[]} */ (
      local_arr
    )
  })

  // 측정 상세 — visit.test_json 에 저장된 측정값/측정점/이미지 dims 를 읽어 인터랙티브 화면을 합성.
  const g_measurements_obj = $derived(g_test_json?.measurements ?? null)
  const g_measurement_points_obj = $derived(g_test_json?.measurement_points_obj ?? null)
  const g_image_dims_obj = $derived(g_test_json?.image_dims_obj ?? null)
  const g_scale_obj = $derived(g_test_json?.scale ?? null)

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

  // 정면 미착용 항목들만 추려 MeasureCanvas/MeasurementList 가 기대하는 형태로 빌드.
  const g_items_arr = $derived.by(() => {
    return MEASUREMENT_TEMPLATE.filter(
      (local_entry) => local_entry.view === 'front_no_glasses',
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
  const g_synthesized_capture = $derived.by(() => {
    if (!g_visit_obj?.main_file || !g_image_dims_obj?.width || !g_image_dims_obj?.height) {
      return null
    }
    return /** @type {any} */ ({
      object_url: g_visit_obj.main_file,
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
    g_local_active_item_id = null
  }

  function on_cancel_measurement() {
    g_local_active_item_id = null
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

  // BE 의 face-script BG 작업이 끝날 때까지 짧게 폴링 — 첫 진입 직후에도 AI 인사이트가 채워지게.
  // 응답이 즉시 오는 PATCH 와 별개로 report_json 은 수 초 뒤 DB 에 박히므로 mount 시 1회 fetch 만으로는 비어 있을 수 있다.
  const REPORT_POLL_MAX_ATTEMPTS = 6
  const REPORT_POLL_INTERVAL_MS = 3000
  let g_report_poll_count = $state(0)
  let g_report_poll_timer_id = /** @type {ReturnType<typeof setTimeout> | null} */ (null)

  function clear_report_poll_timer() {
    if (g_report_poll_timer_id !== null) {
      clearTimeout(g_report_poll_timer_id)
      g_report_poll_timer_id = null
    }
  }

  // report_json 이 아직 비어 있으면 일정 간격으로 visit 를 다시 가져와 AI 결과가 들어왔는지 확인.
  function schedule_report_poll() {
    if (g_report_poll_timer_id !== null) return
    if (g_report_poll_count >= REPORT_POLL_MAX_ATTEMPTS) return

    g_report_poll_timer_id = setTimeout(async () => {
      g_report_poll_timer_id = null
      g_report_poll_count += 1
      const local_visit_no = Number($selected_visit_obj?.visit_no)
      if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) return
      try {
        const local_fresh_obj = await get_visit({ visit_no: local_visit_no })
        g_visit_obj = local_fresh_obj
        if (!local_fresh_obj?.report_json) {
          schedule_report_poll()
        }
      } catch {
        // 백그라운드 재요청은 조용히 무시 — 첫 mount fetch 가 이미 화면을 채워둔 상태라 사용자 액션 불필요.
      }
    }, REPORT_POLL_INTERVAL_MS)
  }

  // 현재 visit 의 분석/리포트/피팅 데이터를 한 번에 GET 해서 화면을 채운다.
  async function load_visit_data() {
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      g_visit_loading = false
      return
    }
    try {
      g_visit_obj = await get_visit({ visit_no: local_visit_no })
      // 첫 fetch 에 report_json 이 비어 있으면 BG AI 가 끝나길 기다리며 폴링 시작.
      if (!g_visit_obj?.report_json) {
        schedule_report_poll()
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
    void load_visit_data()
    return () => {
      clear_report_poll_timer()
    }
  })
</script>

<AnalysisPageLayout
  current_step={5}
  bg_class="bg-[var(--retina-text-100)] text-zinc-950"
  edge_extend_bg
  show_step_bar={false}
>

  <!--
    페이지 헤더: 제목 + 탭 네비. 한 화면에 모든 섹션을 펼치는 대신 탭 단위로 분리해
    각 영역을 페이지처럼 전환해서 본다. 탭바는 shrink-0 으로 고정.
    .app-bg-edge-extend 로 좌우 viewport 끝까지 흰색 배경 확장.
  -->
  <div class="app-bg-edge-extend shrink-0 border-b border-slate-200 bg-white px-6 pt-3">
    <h1 class="m-0 text-center text-[18px] font-extrabold tracking-[-0.02em] text-zinc-950">
      {g_customer_name_label}의 최종 분석 리포트
    </h1>
    <nav
      class="mt-3 flex items-end justify-center gap-2 overflow-x-auto"
      aria-label="리포트 섹션 네비게이션"
    >
      {#each TAB_ARR as tab_obj (tab_obj.id)}
        {@const local_is_active = g_active_tab === tab_obj.id}
        <button
          type="button"
          class={`shrink-0 cursor-pointer border-b-[3px] px-5 py-3 text-[16px] font-extrabold transition ${
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
    활성 탭 컨텐츠 — 탭 내부에서만 세로 스크롤. main 의 회색 bg 를 그대로 상속.
    좌우 스와이프(터치 + 마우스 드래그) 로 탭 전환.
    a11y: aria-label 만으로도 <section> 이 implicit region role 을 가지므로 role="region" 은 중복.
  -->
  <section
    class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4 touch-pan-y"
    aria-label="리포트 컨텐츠 (좌우 스와이프로 탭 전환)"
    ontouchstart={on_touchstart_swipe}
    ontouchend={on_touchend_swipe}
    onpointerdown={on_pointerdown_swipe}
    onpointerup={on_pointerup_swipe}
  >
    <!--
      insight 탭은 컨텐츠가 길어 자연 height 로 흐르며 부모 section 의 overflow-y-auto 가 스크롤 처리.
      다른 탭은 min-h-full 로 카드들이 section 을 꽉 채우도록 유지 (얼굴 분석 결과 카드의 flex-1 등이 의존).
    -->
    <div
      class={`mx-auto flex w-full max-w-[940px] flex-col gap-3 ${
        g_active_tab === 'insight' ? '' : 'min-h-full'
      }`}
    >
      {#if g_active_tab === 'overview'}
        <!-- 1. 고객 정보 -->
        <section class="rounded-[14px] border border-slate-200 bg-white px-7 py-3 shadow-sm">
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">고객 정보</h2>
          <div class="mt-2 grid grid-cols-4 gap-4">
            <div>
              <p class="m-0 text-[13px] font-bold text-slate-400">고객명</p>
              <p class="mt-1 text-[18px] font-extrabold text-zinc-900">{g_customer_name_label}</p>
            </div>
            <div>
              <p class="m-0 text-[13px] font-bold text-slate-400">연령</p>
              <p class="mt-1 text-[18px] font-extrabold text-zinc-900">{g_customer_age_label}</p>
            </div>
            <div>
              <p class="m-0 text-[13px] font-bold text-slate-400">연락처</p>
              <p class="mt-1 text-[18px] font-extrabold text-zinc-900">{g_customer_phone}</p>
            </div>
            <div>
              <p class="m-0 text-[13px] font-bold text-slate-400">방문일</p>
              <p class="mt-1 text-[18px] font-extrabold text-zinc-900">{g_visit_dt_label}</p>
            </div>
          </div>
        </section>

        <!-- 2. 얼굴 분석 결과 — report.svelte 우측 패널과 동일한 구성 (얼굴형/피부톤 박스 → 추천 컬러 칩 → 추천 모양) -->
        <section class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white px-7 py-3 shadow-sm">
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">얼굴 분석 결과</h2>

          <article class="mt-2 flex min-h-0 flex-1 flex-col">
            <div class="grid shrink-0 grid-cols-2 gap-3">
              <div
                class="flex flex-col justify-center rounded-[8px] border border-[#FFEDD5] bg-[#FFF7ED] px-3 py-2.5 text-center"
              >
                <p class="m-0 text-[12px] font-bold text-slate-700">얼굴형</p>
                <p class="m-0 mt-1 text-[15px] text-[#F97316]">
                  {g_face_shape_label ?? '-'}
                </p>
              </div>
              <div
                class="flex flex-col justify-center rounded-[8px] border border-[#D8E2FF] bg-[#EDF0FF] px-3 py-2.5 text-center"
              >
                <p class="m-0 text-[12px] font-bold text-slate-700">피부톤</p>
                <p class="m-0 mt-1 text-[14px] leading-tight text-[#1660C7]">
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

            <div class="my-2 h-px shrink-0 bg-slate-200"></div>

            <!-- 추천 컬러 / 추천 모양 같은 행에 배치. 모양은 1순위만 노출. -->
            <div class="grid min-h-0 flex-1 grid-cols-2 gap-4">
              <section class="flex min-h-0 flex-col">
                <h3 class="m-0 shrink-0 text-center text-[13px] font-extrabold text-slate-800">
                  추천 안경테 컬러
                </h3>
                <!--
                  기본 4개 슬롯 (2×2). 데이터가 있을 때만 chip 노출, 없으면 grid 영역에 '-' 한 번만.
                -->
                {#if g_recommended_color_arr.length === 0}
                  <div class="mt-2 grid place-items-center text-[18px] font-extrabold text-slate-400" style="grid-template-rows: repeat(2, 52px)">
                    -
                  </div>
                {:else}
                  <div class="mt-2 grid grid-cols-2 gap-2" style="grid-template-rows: repeat(2, 52px)">
                    {#each Array.from({ length: 4 }) as _, color_index (color_index)}
                      {@const local_color_obj = g_recommended_color_arr[color_index]}
                      {#if local_color_obj}
                        <div
                          class={`flex items-center justify-center rounded-[10px] border border-black/5 px-3 py-2 text-center shadow-sm ${local_color_obj.gradient_class ?? local_color_obj.tone_class}`}
                        >
                          <p
                            class={`m-0 text-[14px] font-black ${get_chip_text_class(local_color_obj)}`}
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

              <section class="flex min-h-0 flex-col">
                <h3 class="m-0 shrink-0 text-center text-[13px] font-extrabold text-slate-800">
                  추천 안경테 모양
                </h3>
                {#if g_priority_one_frame_arr.length === 0}
                  <div class="mt-2 grid place-items-center text-[18px] font-extrabold text-slate-400" style="grid-template-rows: repeat(2, 52px)">
                    -
                  </div>
                {:else}
                  <div class="mt-2 grid grid-cols-2 gap-2" style="grid-template-rows: repeat(2, 52px)">
                    {#each Array.from({ length: 4 }) as _, frame_index (frame_index)}
                      {@const local_frame_obj = g_priority_one_frame_arr[frame_index]}
                      {#if local_frame_obj}
                        <div
                          class="flex items-center justify-center rounded-[10px] border border-[#F97316] bg-white px-3 py-2 text-center shadow-sm"
                        >
                          <p class="m-0 text-[14px] font-black text-[#F97316]">
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
        <!-- 얼굴 측정 상세 (사진 + 클릭으로 라인 표시) -->
        <section class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white px-7 py-1.5 shadow-sm">
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">얼굴 측정 상세</h2>

          {#if g_visit_loading}
            <p class="mt-2 text-[14px] font-semibold text-slate-400">측정 데이터 불러오는 중...</p>
          {:else if !g_synthesized_capture}
            <p class="mt-2 text-[14px] font-semibold text-slate-400">
              저장된 사진 또는 측정 좌표가 없습니다.
            </p>
          {:else}
            <div class="mt-2 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
              <div class="flex items-start justify-center">
                <div
                  class="flex aspect-[3/4] h-full max-h-[400px] w-full max-w-[300px] overflow-hidden rounded-[10px] bg-slate-100 shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
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
                  view_label="정면 (미착용)"
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
        <section class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white px-7 py-3 shadow-sm">
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">생활 패턴</h2>

          {#if g_lens_selection_arr.length === 0}
            <p class="mt-2 text-[14px] font-semibold text-slate-400">선택한 항목이 없습니다.</p>
          {:else}
            <div class="mt-2 grid grid-cols-2 gap-2">
              {#each g_lens_selection_arr as selection_obj, selection_index (selection_index)}
                <div class="rounded-[10px] border border-slate-100 bg-slate-50 px-4 py-2">
                  <p class="m-0 text-[14px] font-bold text-slate-500">
                    Q{selection_index + 1}. {selection_obj.question_text}
                  </p>
                  <div class="mt-2.5 flex flex-wrap gap-1.5">
                    {#if selection_obj.label_arr.length === 0}
                      <span class="text-[14px] font-semibold text-slate-400">-</span>
                    {:else}
                      {#each selection_obj.label_arr as label_text, label_index (`${selection_index}-${label_index}`)}
                        <span
                          class="inline-flex items-center rounded-md border border-[var(--retina-primary-300)] bg-white px-3 py-1 text-[14px] font-bold text-[var(--retina-primary-400)]"
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
        <section class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white px-7 py-3 shadow-sm">
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">AR 피팅 결과</h2>

          {#if g_saved_fitting_arr.length === 0}
            <div class="mt-2 grid flex-1 place-items-center gap-3 rounded-[10px] bg-slate-50 py-8">
              <Glasses size={40} class="text-slate-300" />
              <p class="m-0 text-[14px] font-bold text-slate-400">저장된 피팅이 없습니다.</p>
            </div>
          {:else}
            <div class="mt-2 grid grid-cols-3 gap-3">
              {#each g_saved_fitting_arr as fitting_obj, fitting_index (fitting_index)}
                {@const local_front_capture_obj = fitting_obj.capture_arr?.[0]}
                <article class="rounded-[12px] border border-slate-100 bg-slate-50 p-3">
                  <div
                    class="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] border border-slate-200 bg-white"
                  >
                    {#if local_front_capture_obj?.url}
                      <img
                        src={local_front_capture_obj.url}
                        alt={`${fitting_obj.model} 정면`}
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <div class="grid h-full w-full place-items-center text-slate-300">
                        <UserRound size={32} strokeWidth={1.7} />
                      </div>
                    {/if}
                  </div>
                  <div class="mt-2.5 flex flex-col">
                    <span class="text-[12px] font-bold uppercase tracking-wider text-slate-400">
                      {fitting_obj.brand || 'BRAND'}
                    </span>
                    <p class="m-0 truncate text-[16px] font-extrabold text-zinc-900">
                      {fitting_obj.model || '-'}
                    </p>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {:else if g_active_tab === 'real_fitting'}
        <!-- 실 착용 사진 세트 (정면 / 좌 / 우) -->
        <section
          class="flex flex-1 flex-col rounded-[14px] border border-slate-200 bg-white px-7 py-3 shadow-sm"
        >
          <h2 class="m-0 text-[18px] font-extrabold text-zinc-900">실제 착용 사진</h2>

          {#if g_real_vp_set_arr.length === 0}
            <div class="mt-2 grid flex-1 place-items-center gap-3 rounded-[10px] bg-slate-50 py-8">
              <Glasses size={40} class="text-slate-300" />
              <p class="m-0 text-[14px] font-bold text-slate-400">
                저장된 실제 착용 사진이 없습니다.
              </p>
            </div>
          {:else}
            <div class="mt-2 flex flex-col gap-3">
              {#each g_real_vp_set_arr as set_obj, set_index (set_obj.set_no ?? set_index)}
                {@const local_photo_arr = [
                  {
                    key: 'front',
                    url: set_obj.front_url ?? set_obj.front_key ?? '',
                    label: '정면',
                  },
                  {
                    key: 'left',
                    url: set_obj.left_url ?? set_obj.left_key ?? '',
                    label: '좌측',
                  },
                  {
                    key: 'right',
                    url: set_obj.right_url ?? set_obj.right_key ?? '',
                    label: '우측',
                  },
                ]}
                <article class="rounded-[12px] border border-slate-100 bg-slate-50 p-3">
                  <header class="mb-2 flex items-center justify-between px-0.5">
                    <span class="text-[13px] font-extrabold text-slate-700">
                      세트 {set_obj.set_no ?? set_index + 1}
                    </span>
                  </header>
                  <div class="grid grid-cols-3 gap-2.5">
                    {#each local_photo_arr as photo_obj (photo_obj.key)}
                      <div
                        class="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] border border-slate-200 bg-white"
                      >
                        {#if photo_obj.url}
                          <img
                            src={photo_obj.url}
                            alt={`세트 ${set_obj.set_no ?? set_index + 1} ${photo_obj.label}`}
                            class="h-full w-full object-cover"
                          />
                        {:else}
                          <div class="grid h-full w-full place-items-center text-slate-300">
                            <UserRound size={32} strokeWidth={1.7} />
                          </div>
                        {/if}
                        <span
                          class="absolute bottom-1 left-1 rounded-sm bg-black/55 px-1 py-0.5 text-[11px] font-extrabold text-white"
                        >
                          {photo_obj.label}
                        </span>
                      </div>
                    {/each}
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
          <span class="font-bold text-[var(--retina-primary-400)]">자세한 사항은 전문 안경사와 상담해 주세요.</span>
        </p>
      {/if}
    </div>
  </section>

  <!-- 하단 액션바 — 어떤 탭에 있든 항상 노출. .app-bg-edge-extend 로 좌우 viewport 끝까지 확장. -->
  <div class="app-bg-edge-extend shrink-0 border-t border-slate-200 bg-white px-6 py-3">
    <div
      class={`mx-auto grid w-full max-w-[940px] gap-4 ${
        g_is_guest_visit ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      <button
        type="button"
        onclick={on_click_go_main}
        class="grid h-[64px] cursor-pointer place-items-center rounded-lg border-0 bg-[var(--retina-primary-300)] text-[26px] tracking-tight text-[var(--retina-surface)] shadow-sm transition hover:bg-[var(--retina-primary-400)]"
      >
        메인으로 이동
      </button>
      {#if g_is_guest_visit}
        <button
          type="button"
          onclick={on_click_open_customer_create_modal}
          class="inline-flex h-[64px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--retina-primary-600)] bg-white text-[22px] text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)]"
        >
          <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
          <span>고객정보등록하기</span>
        </button>
      {/if}
    </div>
  </div>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />

  <LoadingOverlay open={g_is_registering_customer} label="고객 정보 등록 중..." />
</AnalysisPageLayout>
