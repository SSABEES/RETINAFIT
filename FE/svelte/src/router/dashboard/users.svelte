<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronRight, CircleCheck, Plus } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import Keypad from '@/components/input/keypad.svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { get_visit_list, create_visit } from '@/lib/api/visit'
  import {
    customer_arr_store,
    set_selected_customer,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import { selected_admin_obj, selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast } from '@/lib/stores/toast'

  const g_six_month_millisecond = 1000 * 60 * 60 * 24 * 30 * 6

  let ref_customer_arr = $state([])
  let ref_customer_create_modal_open = $state(false)
  let g_visit_target_customer = $state(/** @type {any} */ (null))
  let ref_search_phone = $state('')
  let ref_consent_agreed = $state(false)
  let g_is_search_loading = $state(false)
  let g_is_customer_select_loading = $state(false)
  let g_has_searched = $state(false)

  const g_phone_full_length = 11

  let is_search_active = $derived(
    ref_search_phone.length === g_phone_full_length && ref_consent_agreed,
  )
  let g_search_request_id = 0

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

  // 얼굴분석 버튼을 클릭하면 매번 새 방문 정보를 생성한 뒤 분석 화면으로 이동한다.
  async function on_click_select_customer(customer_obj) {
    if (g_is_customer_select_loading) return

    set_selected_customer(customer_obj)
    g_visit_target_customer = customer_obj
    g_is_customer_select_loading = true

    try {
      await on_start_new_visit()
    } finally {
      g_is_customer_select_loading = false
    }
  }

  async function on_start_new_visit() {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    try {
      const local_visit_customer_obj = get_visit_customer_payload(g_visit_target_customer)
      const local_result_obj = await create_visit({
        opt_no: $selected_opt_store_obj.opt_no,
        member_no: $selected_admin_obj?.member_no ?? 0,
        ...local_visit_customer_obj,
      })

      const local_visit_no = Number(local_result_obj?.visit_no)

      if (!Number.isFinite(local_visit_no)) {
        push_error_toast('방문 정보 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      set_selected_visit({
        ...local_result_obj,
        visit_no: local_visit_no,
        test_dt: null,
        vp_dt: null,
        real_vp_dt: null,
        update_dt: null,
        is_new: true,
      })

      // report.svelte 가 우선 조회하는 visit_no 키도 함께 갱신해 둔다.
      sessionStorage.setItem('retinal_visit_no', String(local_visit_no))
      // 새 방문이므로 직전 방문에서 result.svelte 가 보던 데이터는 제거한다.
      sessionStorage.removeItem('retinal_lens_selections')
      sessionStorage.removeItem('retinal_saved_fittings')

      navigate(PATH.analysis)
    } catch (local_error) {
      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '방문 정보 생성 중 오류가 발생했습니다.',
      )
    }
  }

  async function run_phone_search(local_phone) {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    g_search_request_id += 1
    const local_request_id = g_search_request_id
    g_is_search_loading = true

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

      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 조회 중 오류가 발생했습니다.',
      )
    } finally {
      if (local_request_id === g_search_request_id) {
        g_is_search_loading = false
      }
    }
  }

  function on_change_keypad(local_value) {
    ref_search_phone = local_value.replace(/[^0-9]/g, '')
    g_has_searched = false
    ref_customer_arr = []
    customer_arr_store.set([])
  }

  function on_click_toggle_consent() {
    ref_consent_agreed = !ref_consent_agreed
  }

  async function on_click_search_submit() {
    if (!is_search_active) {
      return
    }

    await run_phone_search(ref_search_phone)
    g_has_searched = true
  }

  function on_click_open_customer_create_modal() {
    ref_customer_create_modal_open = true
  }

  function on_click_close_customer_create_modal() {
    ref_customer_create_modal_open = false
  }

  function on_click_back() {
    navigate(PATH.visitSelect)
  }

  async function on_create_customer(customer_obj) {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
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
      ref_customer_create_modal_open = false
    } catch (local_error) {
      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 등록 중 오류가 발생했습니다.',
      )
    }
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <Header onback={on_click_back} />

  <div class="grid min-h-0 grid-cols-2">
    <section
      class="grid min-h-0 grid-rows-[1fr_auto] gap-5 border-r border-[var(--retina-text-200)] px-8 pt-6 pb-6"
      aria-label="고객 조회 키패드 영역"
    >
      <div class="w-full max-w-[30rem] self-start justify-self-center">
        <Keypad value={ref_search_phone} onchange={on_change_keypad} />
      </div>

      <div class="grid w-full max-w-[30rem] justify-self-center gap-3">
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-[var(--retina-bg-1)] px-4 py-3 text-left text-sm font-bold text-[var(--retina-text-800)] transition hover:bg-[var(--retina-primary-200)]/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/40"
          type="button"
          aria-pressed={ref_consent_agreed}
          onclick={on_click_toggle_consent}
        >
          <CircleCheck
            class={`flex-none transition ${
              ref_consent_agreed
                ? 'text-[var(--retina-primary-700)]'
                : 'text-[var(--retina-text-300)]'
            }`}
            size={20}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>개인정보 수집 및 이용에 동의합니다.</span>
        </button>

        <button
          class={`min-h-16 w-full cursor-pointer rounded-xl border-0 text-2xl font-bold tracking-[0.3em] text-white transition disabled:cursor-not-allowed ${
            is_search_active
              ? 'bg-[var(--retina-primary-600)] hover:bg-[var(--retina-primary-700)]'
              : 'bg-[var(--retina-primary-300)]/60 text-white/90'
          }`}
          type="button"
          onclick={on_click_search_submit}
          disabled={!is_search_active || g_is_search_loading}
        >
          {g_is_search_loading ? '조회 중' : '조 회'}
        </button>
      </div>
    </section>

    <!--
      flex column 으로 구성해 list 영역만 내부 스크롤되도록 한다.
      - 결과 없음/로딩 placeholder 는 m-auto 로 섹션 정중앙에 배치 (기존 place-items-center 효과 대체)
      - 결과 있음 시 헤더(총 N명/신규등록) 는 shrink-0, 리스트는 flex-1 + min-h-0 + overflow-y-auto
        → 카드 개수가 많아져도 섹션 밖으로 흘러넘치지 않고 내부 스크롤로 처리
    -->
    <section
      class="flex min-h-0 flex-col bg-[var(--retina-text-100)] px-6 py-6"
      aria-label="고객 조회 결과 영역"
    >
      {#if g_is_search_loading && ref_customer_arr.length === 0}
        <p class="m-auto text-sm font-bold text-[var(--retina-text-700)]">조회 중...</p>
      {:else if ref_customer_arr.length === 0 && g_has_searched}
        <div class="m-auto grid justify-items-center gap-4 text-center">
          <img
            src="/icons/Stylized Empty State Illustration.png"
            alt=""
            class="h-[120px] w-[120px]"
            aria-hidden="true"
          />
          <p class="m-0 text-sm font-bold text-[var(--retina-text-800)]">검색결과가 없어요</p>
          <button
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--retina-primary-600)] bg-[var(--retina-surface)] px-4 py-2 text-sm font-bold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
            type="button"
            onclick={on_click_open_customer_create_modal}
          >
            <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
            <span>신규등록</span>
          </button>
        </div>
      {:else if ref_customer_arr.length === 0}
        <div class="m-auto grid justify-items-center gap-3 text-center">
          <img
            src="/icons/Stylized Empty State Illustration.png"
            alt=""
            class="h-[120px] w-[120px]"
            aria-hidden="true"
          />
          <p class="m-0 text-sm font-bold text-[var(--retina-text-800)]">
            ← <br />먼저 휴대폰 번호로 고객을 조회해주세요.
          </p>
        </div>
      {:else}
        <div class="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col gap-4 py-2">
          <div class="flex shrink-0 items-center justify-between">
            <p class="m-0 text-sm font-bold text-[var(--retina-text-500)]">
              총 <span class="text-[var(--retina-text-700)]">{ref_customer_arr.length}명</span>
            </p>
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--retina-primary-600)] bg-[var(--retina-surface)] px-3 py-1.5 text-sm font-bold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
              type="button"
              onclick={on_click_open_customer_create_modal}
            >
              <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
              <span>신규등록</span>
            </button>
          </div>

          <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {#each ref_customer_arr as customer_obj (customer_obj.id)}
              {@const is_face_done = customer_obj.status_key === 'analysis_done'}
              <button
                type="button"
                class="grid w-full shrink-0 cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-5 py-4 text-left shadow-[0_4px_10px_rgba(19,25,40,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--retina-primary-600)] hover:shadow-[0_8px_18px_rgba(245,107,0,0.14)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-70"
                onclick={() => on_click_select_customer(customer_obj)}
                aria-label={`${customer_obj.name} 얼굴분석 시작`}
                disabled={g_is_customer_select_loading}
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2.5">
                    <span class="truncate text-lg font-extrabold text-[var(--retina-text-800)]">
                      {customer_obj.name}
                    </span>
                    <span class="text-[var(--retina-text-300)]" aria-hidden="true">|</span>
                    <span class="truncate text-sm font-medium text-[var(--retina-text-700)]">
                      {customer_obj.phone}
                    </span>
                  </div>
                  <p class="m-0 mt-1.5 text-xs font-medium text-[var(--retina-text-500)]">
                    최근방문일 : {customer_obj.last_visit_dt}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <img
                    src={is_face_done
                      ? '/icons/Property 1=Face, Property 2=Active.png'
                      : '/icons/Property 1=Face, Property 2=Default.png'}
                    alt={is_face_done ? '얼굴분석 완료' : '얼굴분석 진행 필요'}
                    class="h-9 w-9 md:h-11 md:w-11 lg:h-12 lg:w-12"
                  />
                  <img
                    src="/icons/Property 1=Life, Property 2=Default.png"
                    alt="생활패턴"
                    class="h-9 w-9 md:h-11 md:w-11 lg:h-12 lg:w-12"
                  />
                  <img
                    src="/icons/Property 1=Fitting, Property 2=Default.png"
                    alt="피팅시작"
                    class="h-9 w-9 md:h-11 md:w-11 lg:h-12 lg:w-12"
                  />
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>
  </div>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />
</main>
