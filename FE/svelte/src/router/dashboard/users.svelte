<script>
  import { navigate } from '@maks11060/svelte5-router'
  import {
    ArrowLeft,
    CalendarDays,
    LogOut,
    Phone,
    Search,
    UserPlus,
    UserSearch,
  } from 'lucide-svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import ConfirmModal from '@/components/modal/confirm_modal.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { get_visit_list, create_visit } from '@/lib/api/visit'
  import {
    customer_arr_store,
    set_selected_customer,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import {
    clear_login_select_data,
    selected_admin_obj,
    selected_opt_store_obj,
  } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

  const g_six_month_millisecond = 1000 * 60 * 60 * 24 * 30 * 6

  let ref_customer_arr = $state([])
  let ref_customer_create_modal_open = $state(false)
  let g_visit_confirm_open = $state(false)
  let g_visit_target_customer = $state(/** @type {any} */ (null))
  let g_recent_visit_obj = $state(/** @type {any} */ (null))
  let g_confirm_title = $state('이전 방문 기록이 있습니다')
  let g_confirm_message = $state('이어서 상담을 진행하시겠습니까?')
  let g_confirm_cancel_label = $state('새로 시작')
  let g_confirm_confirm_label = $state('이어서 상담')
  let g_confirm_cancel_action = $state(() => {})
  let g_confirm_confirm_action = $state(() => {})
  let ref_search_phone = $state('')
  let g_search_error_message = $state('')
  let g_create_error_message = $state('')
  let g_is_search_loading = $state(false)
  let g_is_customer_select_loading = $state(false)

  const g_min_search_length = 2
  const g_search_debounce_ms = 250
  let g_search_request_id = 0
  let g_search_debounce_timer = /** @type {ReturnType<typeof setTimeout> | null} */ (null)

  // 고객 이름에서 목록 아바타에 사용할 첫 글자를 추출한다.
  function get_initial(name) {
    return name.slice(0, 1)
  }

  // 방문 상태 박스에 사용할 문구와 색상을 반환한다.
  function get_analysis_status_obj(test_dt) {
    if (!test_dt) {
      return {
        key: 'needs_analysis',
        label: '얼굴분석 진행 필요',
        box_class: 'bg-[#FFF4E5] text-[#C2410C]',
      }
    }

    const local_test_time = new Date(test_dt).getTime()

    if (Number.isNaN(local_test_time)) {
      return {
        key: 'needs_analysis',
        label: '얼굴분석 진행 필요',
        box_class: 'bg-[#FFF4E5] text-[#C2410C]',
      }
    }

    if (Date.now() - local_test_time <= g_six_month_millisecond) {
      return {
        key: 'analysis_done',
        label: '얼굴분석 완료',
        box_class: 'bg-[#DCFCE7] text-[#15803D]',
      }
    }

    return {
      key: 'remeasure_recommended',
      label: '재측정 권장',
      box_class: 'bg-[#FDECEC] text-[#B42318]',
    }
  }

  // 후보 날짜 중 가장 최신 날짜를 반환하고, 둘 다 없으면 기본 날짜를 사용한다.
  function get_latest_visit_date(primary_date, secondary_date, fallback_date) {
    const local_primary_time = primary_date ? new Date(primary_date).getTime() : Number.NaN
    const local_secondary_time = secondary_date ? new Date(secondary_date).getTime() : Number.NaN

    if (!Number.isNaN(local_primary_time) && !Number.isNaN(local_secondary_time)) {
      return local_primary_time >= local_secondary_time ? primary_date : secondary_date
    }

    if (!Number.isNaN(local_primary_time)) {
      return primary_date
    }

    if (!Number.isNaN(local_secondary_time)) {
      return secondary_date
    }

    return fallback_date ?? ''
  }

  // 날짜 문자열을 고객 목록에서 읽기 쉬운 형식으로 변환한다.
  function format_visit_dt(date_value) {
    if (!date_value) {
      return '-'
    }

    const local_date_obj = new Date(date_value)

    if (Number.isNaN(local_date_obj.getTime())) {
      return '-'
    }

    return local_date_obj.toLocaleDateString('ko-KR')
  }

  // 화면 고객 데이터를 방문 생성 요청 형식으로 변환한다.
  function get_visit_customer_payload(customer_obj) {
    return {
      cust_no: customer_obj.id,
      cust_name: customer_obj.name,
      birthday: customer_obj.birth_dt ?? '',
      phone_no1: customer_obj.phone ?? '',
      phone_no2: customer_obj.phone2 ?? '',
      sex: customer_obj.gender === '여' ? 1 : 0,
    }
  }

  // 고객 검색 응답을 기본 목록 형태로 변환한다.
  function normalize_customer_arr(customer_arr) {
    return customer_arr.map((customer_obj, local_index) => ({
      id: Number(customer_obj.cust_no ?? customer_obj.CUST_NO ?? local_index + 1),
      name: String(customer_obj.cust_name ?? customer_obj.CUST_NAME ?? '고객'),
      phone: String(customer_obj.phone1 ?? customer_obj.PHONE1 ?? ''),
      phone2: String(customer_obj.phone2 ?? customer_obj.PHONE2 ?? ''),
      birth_dt: String(customer_obj.birthday ?? customer_obj.BIRTHDAY ?? ''),
      gender: Number(customer_obj.sex ?? customer_obj.SEX ?? 0) === 0 ? '남' : '여',
      last_visit_dt: '-',
      visit_count: 0,
      status_key: 'needs_analysis',
      status: '',
      status_box_class: 'bg-[#FFF4E5] text-[#C2410C]',
      raw_obj: customer_obj,
    }))
  }

  // 최신 방문 이력을 붙여 고객 목록 표시용 상태를 완성한다.
  async function enrich_customer_arr_with_visit_status(customer_arr) {
    const local_customer_result_arr = await Promise.all(
      customer_arr.map(async (customer_obj) => {
        try {
          const local_result_obj = await get_visit_list({
            cust_no: customer_obj.id,
          })
          const local_visit_arr = Array.isArray(local_result_obj?.visits)
            ? local_result_obj.visits
            : []
          const local_recent_visit_obj = local_visit_arr[0] ?? null
          const local_status_obj = get_analysis_status_obj(local_recent_visit_obj?.test_dt ?? null)
          const local_latest_visit_dt = get_latest_visit_date(
            local_recent_visit_obj?.test_dt ?? '',
            local_recent_visit_obj?.vp_dt ?? '',
            local_recent_visit_obj?.create_dt ?? '',
          )

          return {
            ...customer_obj,
            last_visit_dt: format_visit_dt(local_latest_visit_dt),
            visit_count: local_visit_arr.length,
            status_key: local_status_obj.key,
            status: local_status_obj.label,
            status_box_class: local_status_obj.box_class,
          }
        } catch {
          const local_status_obj = get_analysis_status_obj(null)

          return {
            ...customer_obj,
            status_key: local_status_obj.key,
            status: local_status_obj.label,
            status_box_class: local_status_obj.box_class,
          }
        }
      }),
    )

    return local_customer_result_arr
  }

  // 결과 확인 모달을 분석 이력 안내용으로 설정한다.
  function open_analysis_result_confirm_modal() {
    g_confirm_title = '얼굴 분석 이력이 있습니다'
    g_confirm_message = '분석결과와 함께 ar 가상 피팅 진행하시겠습니까?'
    g_confirm_cancel_label = '아니요'
    g_confirm_confirm_label = '최근 분석 이력 보기'
    g_confirm_cancel_action = on_click_go_customer_detail
    g_confirm_confirm_action = on_click_go_recent_analysis
    g_visit_confirm_open = true
  }

  // 선택한 고객의 상세 페이지로 이동한다.
  function on_click_go_customer_detail() {
    g_visit_confirm_open = false

    if (!g_visit_target_customer?.id) {
      return
    }

    navigate(PATH.userDetail(g_visit_target_customer.id))
  }

  // 가장 최근 방문 정보를 세션에 저장하고 중간 리포트(얼굴 측정) 화면으로 이동한다.
  function on_click_go_recent_analysis() {
    g_visit_confirm_open = false

    if (g_recent_visit_obj) {
      set_selected_visit(g_recent_visit_obj)
    }

    navigate(PATH.analysisFaceMeasurement)
  }

  // 고객 카드를 누르면 실제 방문 이력을 조회해 다음 동작을 결정한다.
  async function on_click_select_customer(customer_obj) {
    set_selected_customer(customer_obj)
    g_visit_target_customer = customer_obj
    g_recent_visit_obj = null
    g_is_customer_select_loading = true

    try {
      const local_result_obj = await get_visit_list({
        cust_no: customer_obj.id,
      })
      const local_visit_arr = Array.isArray(local_result_obj?.visits) ? local_result_obj.visits : []
      const local_recent_visit_obj = local_visit_arr[0] ?? null

      g_recent_visit_obj = local_recent_visit_obj

      if (
        customer_obj.status_key === 'analysis_done' ||
        customer_obj.status_key === 'remeasure_recommended'
      ) {
        open_analysis_result_confirm_modal()
        return
      }

      if (local_visit_arr.length > 0) {
        navigate(PATH.userDetail(customer_obj.id))
        return
      }

      await on_start_new_visit()
    } catch {
      await on_start_new_visit()
    } finally {
      g_is_customer_select_loading = false
    }
  }

  // 신규 방문을 생성하고 고객 상세 화면으로 이동한다.
  async function on_start_new_visit() {
    g_visit_confirm_open = false

    try {
      const local_visit_customer_obj = get_visit_customer_payload(g_visit_target_customer)
      const local_result_obj = await create_visit({
        opt_no: $selected_opt_store_obj?.opt_no ?? 0,
        member_no: $selected_admin_obj?.member_no ?? 0,
        ...local_visit_customer_obj,
      })

      set_selected_visit({
        ...local_result_obj,
        test_dt: null,
        vp_dt: null,
        real_vp_dt: null,
        update_dt: null,
        is_new: true,
      })
    } catch {
      set_selected_visit({
        visit_no: null,
        create_dt: new Date().toISOString(),
        test_dt: null,
        vp_dt: null,
        real_vp_dt: null,
        update_dt: null,
        is_new: true,
      })
    }

    navigate(PATH.userDetail(g_visit_target_customer.id))
  }

  // 입력된 전화번호로 고객을 조회하고 방문 이력으로 분석 상태를 채운다. 디바운스/제출 양쪽에서 호출된다.
  async function run_phone_search(local_phone) {
    if (!$selected_opt_store_obj?.opt_no) {
      g_search_error_message = '선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.'
      return
    }

    g_search_request_id += 1
    const local_request_id = g_search_request_id
    g_is_search_loading = true
    g_search_error_message = ''

    try {
      const local_customer_arr = await search_customer({
        phone_no: local_phone,
        opt_no: $selected_opt_store_obj.opt_no,
      })

      if (local_request_id !== g_search_request_id) {
        return
      }

      const local_normalized_arr = normalize_customer_arr(
        Array.isArray(local_customer_arr) ? local_customer_arr : [],
      )

      ref_customer_arr = local_normalized_arr
      customer_arr_store.set(local_normalized_arr)

      const local_enriched_arr = await enrich_customer_arr_with_visit_status(local_normalized_arr)

      if (local_request_id !== g_search_request_id) {
        return
      }

      ref_customer_arr = local_enriched_arr
      customer_arr_store.set(local_enriched_arr)
    } catch (local_error) {
      if (local_request_id !== g_search_request_id) {
        return
      }

      g_search_error_message =
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 조회 중 오류가 발생했습니다.'
    } finally {
      if (local_request_id === g_search_request_id) {
        g_is_search_loading = false
      }
    }
  }

  // 전화번호 입력값에서 숫자만 남기고 2자리 이상이면 디바운스 후 자동 조회한다.
  function on_input_search_phone(local_event) {
    ref_search_phone = /** @type {HTMLInputElement} */ (local_event.currentTarget).value.replace(
      /[^0-9]/g,
      '',
    )
    g_search_error_message = ''

    if (g_search_debounce_timer !== null) {
      clearTimeout(g_search_debounce_timer)
      g_search_debounce_timer = null
    }

    if (ref_search_phone.length < g_min_search_length) {
      g_search_request_id += 1
      g_is_search_loading = false
      ref_customer_arr = []
      customer_arr_store.set([])
      return
    }

    const local_search_phone = ref_search_phone

    g_search_debounce_timer = setTimeout(() => {
      g_search_debounce_timer = null
      run_phone_search(local_search_phone)
    }, g_search_debounce_ms)
  }

  // 검색 폼 제출 시 디바운스를 건너뛰고 즉시 조회한다.
  async function on_submit_search_customer(local_event) {
    local_event.preventDefault()

    if (g_search_debounce_timer !== null) {
      clearTimeout(g_search_debounce_timer)
      g_search_debounce_timer = null
    }

    if (!ref_search_phone) {
      g_search_error_message = '검색할 전화번호를 입력해 주세요.'
      return
    }

    await run_phone_search(ref_search_phone)
  }

  // 신규 고객 등록 모달을 연다.
  function on_click_open_customer_create_modal() {
    g_create_error_message = ''
    ref_customer_create_modal_open = true
  }

  // 신규 고객 등록 모달을 닫는다.
  function on_click_close_customer_create_modal() {
    g_create_error_message = ''
    ref_customer_create_modal_open = false
  }

  // 확인 모달을 닫고 고객 목록 화면에 그대로 머문다.
  function on_click_close_visit_confirm_modal() {
    g_visit_confirm_open = false
  }

  // 헤더의 뒤로가기 버튼 — 방문 유형 선택 화면으로 돌아간다.
  function on_click_back() {
    navigate(PATH.visitSelect)
  }

  // 헤더의 로그아웃 버튼 — 토큰/자동로그인/스토어를 비우고 로그인 화면으로 이동한다.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  // 신규 고객을 등록하고 기본 상태와 함께 목록 앞에 즉시 반영한다.
  async function on_create_customer(customer_obj) {
    if (!$selected_opt_store_obj?.opt_no) {
      g_create_error_message = '선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.'
      return
    }

    const local_phone1 = customer_obj.phone1.replace(/[^0-9]/g, '')
    const local_phone2 = customer_obj.phone2.replace(/[^0-9]/g, '')
    const local_status_obj = get_analysis_status_obj(null)

    try {
      await create_customer({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_name: customer_obj.name,
        phone1: local_phone1,
        phone2: local_phone2,
        birthday: customer_obj.birth_dt,
        sex: Number(customer_obj.gender),
      })

      const local_new_customer_obj = {
        id: Date.now(),
        name: customer_obj.name,
        phone: local_phone1,
        phone2: local_phone2,
        birth_dt: customer_obj.birth_dt,
        gender: customer_obj.gender === '0' ? '남' : '여',
        last_visit_dt: '-',
        visit_count: 0,
        status_key: local_status_obj.key,
        status: local_status_obj.label,
        status_box_class: local_status_obj.box_class,
      }

      ref_customer_arr = [local_new_customer_obj, ...ref_customer_arr]
      customer_arr_store.set(ref_customer_arr)
      g_create_error_message = ''
      ref_customer_create_modal_open = false
    } catch (local_error) {
      g_create_error_message =
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 등록 중 오류가 발생했습니다.'
    }
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <header
    class="flex items-center justify-between border-b border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-6 py-3"
  >
    <button
      class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
      type="button"
      aria-label="뒤로가기"
      onclick={on_click_back}
    >
      <ArrowLeft size={22} strokeWidth={2} aria-hidden="true" />
    </button>

    <img
      class="h-9 w-auto"
      src="/logo/LogoWide.png"
      alt="RetinaFit"
      width="320"
      height="80"
    />

    <button
      class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
      type="button"
      aria-label="로그아웃"
      onclick={on_click_logout}
    >
      <LogOut size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  </header>

  <div class="grid min-h-0 grid-cols-2">
    <section
      class="min-h-0 border-r border-[var(--retina-text-200)] px-6 py-6"
      aria-label="고객 조회 키패드 영역"
    >
      <!-- 키패드 컴포넌트 자리. 추후 컴포넌트가 들어갈 영역. -->
    </section>

    <section
      class="grid min-h-0 place-items-center px-6 py-6"
      aria-label="고객 조회 결과 영역"
    >
      <div class="grid justify-items-center gap-3 text-center">
        <span
          class="grid h-[100px] w-[100px] place-items-center rounded-full bg-[var(--retina-bg-1)] text-[var(--retina-primary-600)]/55"
          aria-hidden="true"
        >
          <UserSearch size={42} strokeWidth={1.5} />
        </span>
        <p class="m-0 text-sm font-bold text-[var(--retina-text-800)]">
          ← 먼저 휴대폰 번호로 고객을 조회해주세요.
        </p>
      </div>
    </section>
  </div>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    error_message={g_create_error_message}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />

  <ConfirmModal
    open={g_visit_confirm_open}
    title={g_confirm_title}
    message={g_confirm_message}
    cancelLabel={g_confirm_cancel_label}
    confirmLabel={g_confirm_confirm_label}
    onclose={on_click_close_visit_confirm_modal}
    oncancel={g_confirm_cancel_action}
    onconfirm={g_confirm_confirm_action}
  />
</main>
