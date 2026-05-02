<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { History, UserPlus } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { create_visit } from '@/lib/api/visit'
  import {
    clear_login_select_data,
    selected_admin_obj,
    selected_opt_store_obj,
  } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import { set_selected_customer, set_selected_visit } from '@/lib/stores/customer'

  const STORE_NAME = '레티나안경원 강동점'
  const GUEST_CUST_NO = 0
  const GUEST_CUST_NAME = '비회원'

  let g_is_guest_visit_loading = $state(false)
  let g_error_message = $state('')

  // 첫 방문 클릭 시 비회원(cust_no=0)으로 새 방문을 생성하고 얼굴 분석 화면으로 이동한다.
  async function on_click_start_guest_visit() {
    if (g_is_guest_visit_loading) return

    if (!$selected_opt_store_obj?.opt_no) {
      g_error_message = '선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.'
      return
    }

    g_is_guest_visit_loading = true
    g_error_message = ''

    try {
      const local_result_obj = await create_visit({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_no: GUEST_CUST_NO,
        cust_name: GUEST_CUST_NAME,
        birthday: '',
        phone_no1: '',
        phone_no2: '',
        sex: 0,
        member_no: $selected_admin_obj?.member_no ?? 0,
      })

      const local_visit_no = Number(local_result_obj?.visit_no)

      if (!Number.isFinite(local_visit_no)) {
        g_error_message = '방문 정보 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        return
      }

      set_selected_customer({
        id: GUEST_CUST_NO,
        name: GUEST_CUST_NAME,
        phone: '',
        phone2: '',
        gender: '-',
        birth_dt: '',
        visit_count: 0,
        last_visit_dt: '-',
      })

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
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '방문 정보 생성 중 오류가 발생했습니다.'
    } finally {
      g_is_guest_visit_loading = false
    }
  }

  // 재방문 클릭 시 고객 조회 화면으로 이동한다.
  function on_click_select_returning_visit() {
    navigate(PATH.users)
  }

  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <Header show_back={false} onlogout={on_click_logout} />

  <section
    class="grid items-start justify-items-center px-6 pt-6 pb-6"
    aria-label="방문 유형 선택"
  >
    <div class="grid w-full max-w-[760px] gap-5">
      <div class="grid justify-items-center gap-2 text-center">
        <h1 class="m-0 text-[34px] font-extrabold leading-tight text-[var(--retina-text)]">
          {STORE_NAME}
        </h1>
        <p class="m-0 text-base font-medium text-[var(--retina-text-500)]">
          레티나핏 서비스 이용을 위해 방문 유형을 선택해주세요.
        </p>
      </div>

      {#if g_error_message}
        <p
          class="m-0 max-w-[640px] justify-self-center rounded-lg bg-[var(--retina-bg-1)] px-5 py-3 text-center text-sm font-bold text-[var(--retina-primary-700)]"
          role="alert"
        >
          {g_error_message}
        </p>
      {/if}

      <div class="grid grid-cols-2 gap-20">
        <button
          class="group grid aspect-square cursor-pointer grid-rows-[1fr_auto] gap-6 rounded-[20px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-7 py-9 text-left shadow-[0_6px_14px_rgba(19,25,40,0.06)] transition duration-150 ease-out hover:-translate-y-1 hover:border-[var(--retina-primary-600)] hover:shadow-[0_14px_28px_rgba(245,107,0,0.18)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onclick={on_click_start_guest_visit}
          disabled={g_is_guest_visit_loading}
        >
          <span class="grid place-items-center">
            <span
              class="grid h-[120px] w-[120px] place-items-center rounded-full bg-[var(--retina-bg-1)] text-[var(--retina-primary-600)] transition duration-150 group-hover:scale-105"
            >
              <UserPlus size={56} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </span>

          <span class="grid min-h-[80px] content-start justify-items-center gap-2 text-center">
            <span class="block text-[26px] font-extrabold leading-tight text-[var(--retina-text)]">
              {g_is_guest_visit_loading ? '방문 생성 중...' : '첫 방문이에요'}
            </span>
            <span class="block text-sm font-medium text-[var(--retina-text-500)]">
              반가워요! <br>고객님 얼굴형에 맞춘 피팅을 시작해볼까요?
            </span>
          </span>
        </button>

        <button
          class="group grid aspect-square cursor-pointer grid-rows-[1fr_auto] gap-6 rounded-[20px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-7 py-9 text-left shadow-[0_6px_14px_rgba(19,25,40,0.06)] transition duration-150 ease-out hover:-translate-y-1 hover:border-[var(--retina-text-500)] hover:shadow-[0_14px_28px_rgba(19,25,40,0.12)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-text-500)]/60"
          type="button"
          onclick={on_click_select_returning_visit}
        >
          <span class="grid place-items-center">
            <span
              class="grid h-[120px] w-[120px] place-items-center rounded-full bg-[var(--retina-text-200)] text-[var(--retina-text-700)] transition duration-150 group-hover:scale-105"
            >
              <History size={56} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </span>

          <span class="grid min-h-[80px] content-start justify-items-center gap-2 text-center">
            <span class="block text-[26px] font-extrabold leading-tight text-[var(--retina-text)]">
              방문한 적 있어요
            </span>
            <span class="block text-sm font-medium text-[var(--retina-text-500)]">
              재방문 감사해요. 기존 내역을 불러올게요.
            </span>
          </span>
        </button>
      </div>
    </div>
  </section>
</main>
