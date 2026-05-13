<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { CircleCheck, Plus } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import Keypad from '@/components/input/keypad.svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import ConfirmModal from '@/components/modal/confirm_modal.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { get_visit_list } from '@/lib/api/visit'
  import { customer_arr_store, set_selected_customer } from '@/lib/stores/customer'
  import { selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast } from '@/lib/stores/toast'

  const g_six_month_millisecond = 1000 * 60 * 60 * 24 * 30 * 6

  let ref_customer_arr = $state([])
  let ref_customer_create_modal_open = $state(false)
  let ref_consent_modal_open = $state(false)

  const g_consent_modal_message =
    '안경 추천 및 가상 피팅 서비스 제공을 위해 아래 정보를 수집·이용합니다.\n\n' +
    '· 수집 항목: 이름, 휴대폰 번호, 생년월일, 성별, 얼굴 이미지\n' +
    '· 이용 목적: 얼굴 분석 및 안경 추천·가상 피팅 서비스 제공\n' +
    '· 보유 기간: 동의 철회 시까지 (관련 법령에 따른 보관 기간 포함)\n\n' +
    '동의를 거부할 권리가 있으며, 거부 시 서비스 이용이 제한될 수 있습니다.'
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

  /** @param {string | null | undefined} test_dt */
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

  /**
   * @param {string | null | undefined} primary_date
   * @param {string | null | undefined} secondary_date
   * @param {string | null | undefined} fallback_date
   */
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

  // 개인정보 보호 — 이름 두 번째 글자를 'O' 로 마스킹.
  // 김철수 → 김O수, 김철 → 김O, 남궁민수 → 남O민수.
  /** @param {string | null | undefined} name */
  function mask_name(name) {
    const local_name = String(name ?? '')
    if (local_name.length < 2) return local_name
    return local_name[0] + 'O' + local_name.slice(2)
  }

  /** @param {string | number | Date | null | undefined} date_value */
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

  /** @param {Array<Record<string, any>>} customer_arr */
  function normalize_customer_arr(customer_arr) {
    return customer_arr.map((/** @type {Record<string, any>} */ customer_obj, local_index) => ({
      id: Number(customer_obj.cust_no ?? customer_obj.CUST_NO ?? local_index + 1),
      name: String(customer_obj.cust_name ?? customer_obj.CUST_NAME ?? '고객'),
      phone: String(customer_obj.phone1 ?? customer_obj.PHONE1 ?? ''),
      phone2: String(customer_obj.phone2 ?? customer_obj.PHONE2 ?? ''),
      birth_dt: String(customer_obj.birthday ?? customer_obj.BIRTHDAY ?? ''),
      gender: Number(customer_obj.sex ?? customer_obj.SEX ?? 0) === 0 ? '남' : '여',
      // TODO: BE가 last_visit_dt 필드 추가하면 아래 주석 해제 후 enrich_customer_arr_with_visit_status 호출 제거
      // last_visit_dt: format_visit_dt(customer_obj.last_visit_dt ?? customer_obj.LAST_VISIT_DT ?? null),
      last_visit_dt: '-',
      visit_count: 0,
      status_key: 'needs_analysis',
      status: '',
      status_box_class: 'bg-[#FFF4E5] text-[#C2410C]',
      // BE 가 응답에 has_face_analysis / has_lifestyle 플래그를 포함해 보내준다.
      // 카드 우측 아이콘이 이 두 값으로 Active/Default 토글된다.
      has_face_analysis: Boolean(customer_obj.has_face_analysis ?? customer_obj.HAS_FACE_ANALYSIS),
      has_lifestyle: Boolean(customer_obj.has_lifestyle ?? customer_obj.HAS_LIFESTYLE),
      raw_obj: customer_obj,
    }))
  }

  /** @param {Array<Record<string, any>>} customer_arr */
  async function enrich_customer_arr_with_visit_status(customer_arr) {
    const local_customer_result_arr = await Promise.all(
      customer_arr.map(async (/** @type {Record<string, any>} */ customer_obj) => {
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

  // 고객 행 클릭 시 — 선택한 고객을 store 에 저장하고 고객 상세 페이지로 이동.
  /** @param {Record<string, any>} customer_obj */
  function on_click_select_customer(customer_obj) {
    if (g_is_customer_select_loading) return

    set_selected_customer(customer_obj)
    navigate(PATH.userDetail(customer_obj.id))
  }

  /** @param {string} local_phone */
  async function run_phone_search(local_phone) {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    g_search_request_id += 1
    const local_request_id = g_search_request_id
    g_is_search_loading = true
    const local_opt_no = $selected_opt_store_obj.opt_no

    try {
      const local_customer_arr = await search_customer({
        phone_no: local_phone,
        opt_no: local_opt_no,
      })

      if (local_request_id !== g_search_request_id) {
        return
      }

      const local_normalized_arr = normalize_customer_arr(
        Array.isArray(local_customer_arr) ? local_customer_arr : [],
      )

      ref_customer_arr = local_normalized_arr
      customer_arr_store.set(local_normalized_arr)

      // TODO: BE가 last_visit_dt 추가하면 아래 enrichment 블록 4줄 제거 (normalize에서 바로 값이 옴)
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

  /** @param {string} local_value */
  function on_change_keypad(local_value) {
    ref_search_phone = local_value.replace(/[^0-9]/g, '')
    g_has_searched = false
    ref_customer_arr = []
    customer_arr_store.set([])
  }

  // 미동의 상태에서 누르면 수집 항목 / 이용 목적 / 보관 기간을 안내하는 모달을 띄워
  // 사용자가 읽고 명시적으로 [동의] 를 누르게 한다. 이미 동의된 상태에서 누르면
  // 모달 없이 즉시 동의 해제(체크 해제 토글)한다.
  function on_click_open_consent_modal() {
    if (ref_consent_agreed) {
      ref_consent_agreed = false
      return
    }
    ref_consent_modal_open = true
  }

  function on_click_close_consent_modal() {
    ref_consent_modal_open = false
  }

  function on_click_confirm_consent() {
    ref_consent_agreed = true
    ref_consent_modal_open = false
  }

  function on_click_cancel_consent() {
    ref_consent_modal_open = false
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

  /** @param {{ name: string, gender: string, birth_dt: string, phone1: string, phone2: string }} customer_obj */
  async function on_create_customer(customer_obj) {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    const local_phone1 = customer_obj.phone1.replace(/[^0-9]/g, '')
    const local_phone2 = customer_obj.phone2.replace(/[^0-9]/g, '')
    const local_status_obj = get_analysis_status_obj(null)
    // 성별 미선택(빈 문자열) 시 null 로 보내 BE 가 그대로 비워두게 한다 — Number('') 가 0(남) 으로 묻히는 사고 방지.
    const local_sex_value =
      customer_obj.gender === '' || customer_obj.gender == null ? null : Number(customer_obj.gender)

    try {
      await create_customer({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_name: customer_obj.name,
        phone1: local_phone1,
        phone2: local_phone2,
        birthday: customer_obj.birth_dt,
        sex: local_sex_value,
      })

      const local_new_customer_obj = {
        id: Date.now(),
        name: customer_obj.name,
        phone: local_phone1,
        phone2: local_phone2,
        birth_dt: customer_obj.birth_dt,
        gender: local_sex_value === 0 ? '남' : local_sex_value === 1 ? '여' : '',
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
  class="app-frame-page grid min-h-screen md:h-[100svh] md:overflow-hidden grid-rows-[1fr] bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <Header onback={on_click_back} />

  <div class="grid min-h-0 grid-cols-1 md:grid-cols-2">
    <section
      class="app-bg-edge-extend-left app-bg-edge-extend-bottom flex h-full min-h-0 flex-col items-center justify-center border-r border-[var(--retina-text-200)] px-8 py-[clamp(12px,2.5svh,24px)]"
      aria-label="고객 조회 키패드 영역"
    >
      <div class="flex w-fit max-w-[30rem] xl:max-w-[36rem] 2xl:max-w-[44rem] flex-col items-center gap-[clamp(10px,2svh,16px)]">
        <Keypad value={ref_search_phone} onchange={on_change_keypad} />

        <div class="grid w-full gap-[clamp(8px,1.5svh,12px)]">
          <button
            class="flex w-full cursor-pointer items-center gap-3 rounded-none border-0 bg-[var(--retina-primary-50)] px-4 py-[clamp(4px,1svh,6px)] text-left font-bold text-[var(--retina-text-800)] transition hover:bg-[var(--retina-primary-200)]/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/40"
            type="button"
            aria-pressed={ref_consent_agreed}
            onclick={on_click_open_consent_modal}
          >
            {#if ref_consent_agreed}
              <img
                src="/icons/circle-check-purple.png"
                alt=""
                class="flex-none h-[clamp(18px,3.5svh,28px)] w-[clamp(18px,3.5svh,28px)]"
                width="28"
                height="28"
                aria-hidden="true"
              />
            {:else}
              <CircleCheck
                class="flex-none text-[var(--retina-text-300)] transition h-[clamp(18px,3.5svh,28px)] w-[clamp(18px,3.5svh,28px)]"
                strokeWidth={2}
                aria-hidden="true"
              />
            {/if}
            <span class="font-bold text-[clamp(13px,2svh,22px)]"
              >개인정보 수집 및 이용에 동의합니다.</span
            >
          </button>

          <button
            class={`w-full cursor-pointer rounded-xl border-0 leading-none font-bold tracking-[0.3em] text-white transition disabled:cursor-not-allowed min-h-[clamp(44px,8svh,96px)] text-[clamp(16px,3svh,30px)] ${
              is_search_active
                ? 'bg-[var(--retina-primary-500)] hover:bg-[var(--retina-primary-600)]'
                : 'bg-[#E3B68E]'
            }`}
            type="button"
            onclick={on_click_search_submit}
            disabled={!is_search_active || g_is_search_loading}
          >
            {g_is_search_loading ? '조회 중' : '조 회'}
          </button>
        </div>
      </div>
    </section>

    <!--
      flex column 으로 구성해 list 영역만 내부 스크롤되도록 한다.
      - 결과 없음/로딩 placeholder 는 m-auto 로 섹션 정중앙에 배치 (기존 place-items-center 효과 대체)
      - 결과 있음 시 헤더(총 N명/신규등록) 는 shrink-0, 리스트는 flex-1 + min-h-0 + overflow-y-auto
        → 카드 개수가 많아져도 섹션 밖으로 흘러넘치지 않고 내부 스크롤로 처리
    -->
    <section
      class="app-bg-edge-extend-right app-bg-edge-extend-bottom flex min-h-0 flex-col bg-[var(--retina-bg-1)] px-6 py-6"
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
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--retina-primary-600)] bg-[var(--retina-surface)] px-4 py-2 text-sm font-bold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
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
          <p class="m-0 text-2xl font-bold text-[var(--retina-text-800)]">
            ← <br />먼저 휴대폰 번호로 고객을 조회해주세요.
          </p>
        </div>
      {:else}
        <div class="mx-auto mt-15 flex min-h-0 w-full max-w-[640px] xl:max-w-[900px] 2xl:max-w-[1200px] flex-1 flex-col gap-4 py-2">
          <div class="flex shrink-0 items-center justify-between">
            <p class="m-0 text-sm font-bold text-[var(--retina-text-500)]">
              총 <span class="text-[var(--retina-primary-400)]">{ref_customer_arr.length}명</span>
            </p>
            <button
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[var(--retina-primary-600)] bg-[var(--retina-surface)] px-3 py-1.5 text-sm font-bold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
              type="button"
              onclick={on_click_open_customer_create_modal}
            >
              <Plus size={14} strokeWidth={2.6} aria-hidden="true" />
              <span>신규등록</span>
            </button>
          </div>

          <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pt-1">
            {#each ref_customer_arr as customer_obj (customer_obj.id)}
              {@const is_face_done = Boolean(customer_obj.has_face_analysis)}
              {@const is_lifestyle_done = Boolean(customer_obj.has_lifestyle)}
              {@const local_masked_name = mask_name(customer_obj.name)}
              <button
                type="button"
                class="@container/card grid min-h-[112px] w-full shrink-0 cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-[10px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-7 py-5 text-left shadow-[0_4px_10px_rgba(19,25,40,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--retina-primary-600)] hover:shadow-[0_8px_18px_rgba(245,107,0,0.14)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-70"
                onclick={() => on_click_select_customer(customer_obj)}
                aria-label={`${local_masked_name} 얼굴분석 시작`}
                disabled={g_is_customer_select_loading}
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-3">
                    <!-- 이름은 절대 잘리지 않게 whitespace-nowrap. 카드 폭이 좁으면 전화번호 영역을 통째로 숨김 -->
                    <span
                      class="whitespace-nowrap text-2xl font-extrabold text-[var(--retina-text-800)]"
                    >
                      {local_masked_name}
                    </span>
                    <span
                      class="hidden @md/card:inline text-[var(--retina-text-300)]"
                      aria-hidden="true">|</span
                    >
                    <span
                      class="hidden @md/card:inline truncate text-base font-medium text-[var(--retina-text-500)]"
                    >
                      {customer_obj.phone}
                    </span>
                  </div>
                  <p class="m-0 mt-2 text-sm font-medium text-[var(--retina-text-500)]">
                    최근방문일 : {customer_obj.last_visit_dt}
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <img
                    src={is_face_done
                      ? '/icons/Property 1=Face, Property 2=Active.png'
                      : '/icons/Property 1=Face, Property 2=Default.png'}
                    alt={is_face_done ? '얼굴분석 완료' : '얼굴분석 진행 필요'}
                    class="h-[76px] w-[76px] transition"
                    class:opacity-40={!is_face_done}
                  />
                  <img
                    src={is_lifestyle_done
                      ? '/icons/Property 1=Life, Property 2=Active.png'
                      : '/icons/Property 1=Life, Property 2=Default.png'}
                    alt={is_lifestyle_done ? '생활패턴 완료' : '생활패턴 진행 필요'}
                    class="h-[76px] w-[76px] transition"
                    class:opacity-40={!is_lifestyle_done}
                  />
                  <img
                    src="/icons/Property 1=Fitting, Property 2=Default.png"
                    alt="피팅시작"
                    class="h-[76px] w-[76px] opacity-40"
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

  <ConfirmModal
    open={ref_consent_modal_open}
    title="개인정보 수집 및 이용 동의"
    message={g_consent_modal_message}
    cancelLabel="취소"
    confirmLabel="동의"
    onclose={on_click_close_consent_modal}
    oncancel={on_click_cancel_consent}
    onconfirm={on_click_confirm_consent}
  />
</main>
