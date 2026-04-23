<script>
  import { link } from '@maks11060/svelte5-router'
  import { CalendarDays, Phone, Search, UserPlus } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import { PATH } from '@/config/path'
  import { retina_create_customer, retina_find_customer_by_phone } from '@/lib/api/retina'
  import { customer_arr_store } from '@/lib/stores/customer'
  import { selected_opt_store_obj } from '@/lib/stores/admin'

  let ref_customer_arr = $state([])
  let ref_customer_create_modal_open = $state(false)
  let ref_search_phone = $state('')
  let g_search_error_message = $state('')
  let g_create_error_message = $state('')
  let g_is_search_loading = $state(false)

  // 고객 이름에서 목록 아바타에 사용할 첫 글자를 추출한다.
  function get_initial(name) {
    return name.slice(0, 1)
  }

  /**
   * API 고객 응답을 고객 관리 목록 카드 데이터로 변환한다.
   * @param {Array<Record<string, unknown>>} customer_arr
   */
  function normalize_customer_arr(customer_arr) {
    return customer_arr.map((customer_obj, local_index) => ({
      id: Number(customer_obj.CUST_NO ?? customer_obj.CUST_ID ?? local_index + 1),
      name: String(customer_obj.CUST_NAME ?? customer_obj.CUSTOMER_NAME ?? '고객'),
      phone: String(customer_obj.PHONE1 ?? customer_obj.PHONE ?? customer_obj.MOBILE ?? ''),
      last_visit_dt: String(customer_obj.LAST_VISIT_DT ?? customer_obj.REG_DT ?? '-'),
      visit_count: Number(customer_obj.VISIT_COUNT ?? customer_obj.CUST_VISIT_CNT ?? 0),
      status:
        customer_obj.ANALYSIS_DONE === '1' || customer_obj.ANALYSIS_YN === 'Y' ? '분석완료' : '',
      raw_obj: customer_obj,
    }))
  }

  /**
   * 고객 검색 입력값을 숫자만 남긴 휴대폰 번호 상태로 반영한다.
   * @param {Event} local_event
   */
  function on_input_search_phone(local_event) {
    ref_search_phone = /** @type {HTMLInputElement} */ (local_event.currentTarget).value.replace(
      /[^0-9]/g,
      '',
    )
    g_search_error_message = ''
  }

  /**
   * 선택된 안경원 번호와 휴대폰 번호로 고객 정보를 조회해 목록을 갱신한다.
   * @param {SubmitEvent} local_event
   */
  async function on_submit_search_customer(local_event) {
    local_event.preventDefault()

    if (!$selected_opt_store_obj?.opt_no) {
      g_search_error_message = '선택된 안경점 정보가 없습니다. 다시 로그인해주세요.'
      return
    }

    if (!ref_search_phone) {
      g_search_error_message = '검색할 휴대폰 번호를 입력해주세요.'
      return
    }

    g_is_search_loading = true
    g_search_error_message = ''

    try {
      const local_result_obj = await retina_find_customer_by_phone({
        opt_no: $selected_opt_store_obj.opt_no,
        phone: ref_search_phone,
      })

      if (local_result_obj.result_no !== '0') {
        throw new Error('고객 정보 조회에 실패했습니다.')
      }

      ref_customer_arr = normalize_customer_arr(local_result_obj.customer_arr)
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

  /**
   * 신규 고객 등록 폼 값을 API에 저장하고 목록 맨 앞에 반영한다.
   * @param {{ name: string, gender: string, birth_dt: string, phone1: string, phone2: string }} customer_obj
   */
  async function on_create_customer(customer_obj) {
    if (!$selected_opt_store_obj?.opt_no) {
      g_create_error_message = '선택된 안경점 정보가 없습니다. 다시 로그인해주세요.'
      return
    }

    const local_phone1 = customer_obj.phone1.replace(/[^0-9]/g, '')
    const local_phone2 = customer_obj.phone2.replace(/[^0-9]/g, '')
    const local_result_obj = await retina_create_customer({
      opt_no: $selected_opt_store_obj.opt_no,
      name: customer_obj.name,
      phone1: local_phone1,
      phone2: local_phone2,
      birth_dt: customer_obj.birth_dt,
      gender: customer_obj.gender,
    })

    if (local_result_obj.result_no !== '1' || local_result_obj.error_no !== '0') {
      g_create_error_message = '고객 정보 등록에 실패했습니다.'
      return
    }

    const local_new_customer_obj = {
      id: local_result_obj.cust_no || Date.now(),
      name: customer_obj.name,
      phone: local_phone1,
      gender: customer_obj.gender === '0' ? '남' : '여',
      birth_dt: customer_obj.birth_dt,
      last_visit_dt: '-',
      visit_count: 0,
      status: '',
    }

    ref_customer_arr = [local_new_customer_obj, ...ref_customer_arr]
    customer_arr_store.set(ref_customer_arr)
    g_create_error_message = ''
    ref_customer_create_modal_open = false
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
              placeholder="휴대폰 번호로 검색"
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
            <a
              use:link
              class="block rounded-lg outline-none transition hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-[#9A1BFF]/20"
              href={PATH.userDetail(customer_obj.id)}
              aria-label={`${customer_obj.name} 고객 상세로 이동`}
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
                      {#if customer_obj.status}
                        <span
                          class="rounded-full bg-[#4B0055] px-3.5 py-1.5 text-sm font-extrabold text-white"
                        >
                          {customer_obj.status}
                        </span>
                      {/if}
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
                  class="grid min-h-[74px] min-w-24 place-items-center rounded-lg bg-[#F6F7FA] px-5"
                >
                  <p class="m-0 text-base font-bold text-slate-500">총 방문</p>
                  <p class="m-0 text-3xl font-extrabold text-zinc-950">
                    {customer_obj.visit_count}회
                  </p>
                </div>
              </article>
            </a>
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
</DashboardShell>
