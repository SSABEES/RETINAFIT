<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { CalendarDays, Phone, Search, UserPlus } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'
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
  import { selected_opt_store_obj, selected_admin_obj } from '@/lib/stores/admin'

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
          const local_visit_arr = Array.isArray(local_result_obj?.visits) ? local_result_obj.visits : []
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
    g_confirm_confirm_label = '분석 결과 보기'
    g_confirm_cancel_action = on_click_go_customer_detail
    g_confirm_confirm_action = on_click_go_analysis_result
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

  // 가장 최근 방문 결과를 세션에 저장하고 결과 페이지로 이동한다.
  function on_click_go_analysis_result() {
    g_visit_confirm_open = false

    if (g_recent_visit_obj) {
      set_selected_visit(g_recent_visit_obj)
    }

    navigate(PATH.analysisResult)
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

      if (customer_obj.status_key === 'analysis_done' || customer_obj.status_key === 'remeasure_recommended') {
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

  // 전화번호 검색 입력값에서 숫자만 남긴다.
  function on_input_search_phone(local_event) {
    ref_search_phone = /** @type {HTMLInputElement} */ (local_event.currentTarget).value.replace(
      /[^0-9]/g,
      '',
    )
    g_search_error_message = ''
  }

  // 전화번호와 안경원 번호로 고객 목록을 조회하고 분석 상태를 함께 채운다.
  async function on_submit_search_customer(local_event) {
    local_event.preventDefault()

    if (!$selected_opt_store_obj?.opt_no) {
      g_search_error_message = '선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.'
      return
    }

    if (!ref_search_phone) {
      g_search_error_message = '검색할 전화번호를 입력해 주세요.'
      return
    }

    g_is_search_loading = true
    g_search_error_message = ''

    try {
      const local_customer_arr = await search_customer({
        phone_no: ref_search_phone,
        opt_no: $selected_opt_store_obj.opt_no,
      })
      const local_normalized_customer_arr = normalize_customer_arr(
        Array.isArray(local_customer_arr) ? local_customer_arr : [],
      )

      ref_customer_arr = await enrich_customer_arr_with_visit_status(local_normalized_customer_arr)
      customer_arr_store.set(ref_customer_arr)
    } catch (local_error) {
      g_search_error_message =
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 조회 중 오류가 발생했습니다.'
    } finally {
      g_is_search_loading = false
    }
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

<DashboardShell active_key="users" title="고객 관리">
  <section class="px-10 py-12">
    <div class="mx-auto max-w-[980px]">
      <form class="mx-auto w-full max-w-[720px]" onsubmit={on_submit_search_customer}>
        <div class="grid grid-cols-[1fr_auto] gap-3">
          <label class="relative block" for="customer-search">
            <Search
              class="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400"
              size={26}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <input
              id="customer-search"
              class="min-h-[72px] w-full rounded-2xl border border-[#E7E9F0] bg-white pl-[68px] pr-7 text-xl font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              type="search"
              inputmode="numeric"
              maxlength="11"
              value={ref_search_phone}
              placeholder="전화번호로 검색"
              disabled={g_is_search_loading}
              oninput={on_input_search_phone}
            />
          </label>

          <button
            class="min-h-[72px] cursor-pointer rounded-2xl border-0 bg-[#4B0055] px-7 text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={g_is_search_loading}
          >
            {g_is_search_loading ? '조회 중' : '조회'}
          </button>
        </div>

        {#if g_search_error_message}
          <p
            class="mt-4 rounded-lg bg-red-50 px-5 py-3 text-left text-base font-bold text-red-700"
            role="alert"
          >
            {g_search_error_message}
          </p>
        {/if}
      </form>

      <div class="mb-6 mt-9 flex items-center justify-between gap-4">
        <p class="m-0 text-left text-lg font-bold text-slate-600">
          총 <span class="text-[#4B0055]">{ref_customer_arr.length}명</span>의 고객
        </p>
        <button
          class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-6 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
          type="button"
          onclick={on_click_open_customer_create_modal}
        >
          <UserPlus size={21} strokeWidth={2.4} aria-hidden="true" />
          <span>신규 등록</span>
        </button>
      </div>

      {#if ref_customer_arr.length > 0}
        <div class="grid gap-5">
          {#each ref_customer_arr as customer_obj (customer_obj.id)}
            <button
              type="button"
              class="block w-full rounded-lg outline-none transition hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-[#9A1BFF]/20 disabled:cursor-not-allowed disabled:opacity-70"
              onclick={() => on_click_select_customer(customer_obj)}
              aria-label={`${customer_obj.name} 고객 상세로 이동`}
              disabled={g_is_customer_select_loading}
            >
              <article
                class="grid min-h-[126px] grid-cols-[1fr_auto] items-center rounded-lg border border-[#ECE6EF] bg-white px-7 py-6 text-left shadow-sm shadow-slate-200/50 transition hover:border-[#DCC9E2] hover:shadow-md hover:shadow-slate-200/70"
              >
                <div class="flex min-w-0 items-center gap-6">
                  <div
                    class="grid h-16 w-16 flex-none place-items-center rounded-full bg-[#F5EAF7] text-2xl font-extrabold text-[#4B0055]"
                  >
                    {get_initial(customer_obj.name)}
                  </div>

                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-3">
                      <h2 class="m-0 text-2xl font-extrabold text-zinc-950">
                        {customer_obj.name}
                      </h2>
                    </div>

                    <div
                      class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg font-semibold text-slate-500"
                    >
                      <span class="inline-flex items-center gap-1">
                        <Phone size={18} strokeWidth={2.2} aria-hidden="true" />
                        {customer_obj.phone}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
                        최근 방문: {customer_obj.last_visit_dt}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  class={`grid min-h-[74px] min-w-[180px] place-items-center rounded-lg px-5 ${customer_obj.status_box_class}`}
                >
                  <p class="m-0 text-base font-extrabold">{customer_obj.status}</p>
                </div>
              </article>
            </button>
          {/each}
        </div>
      {:else}
        <div
          class="grid min-h-[220px] place-items-center rounded-lg border border-[#ECE6EF] bg-white px-7 py-8 text-center shadow-sm shadow-slate-200/50"
        >
          <p class="m-0 text-lg font-extrabold text-slate-500">조회된 고객 정보가 없습니다.</p>
        </div>
      {/if}
    </div>
  </section>

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
</DashboardShell>
