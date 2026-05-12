<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { create_visit } from '@/lib/api/visit'
  import { selected_admin_obj, selected_opt_store_obj } from '@/lib/stores/admin'
  import {
    clear_visit_session_data,
    set_selected_customer,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import { reset as reset_capture_session } from '@/lib/stores/capture_session.svelte.js'

  // 방문 유형 선택 화면 진입 시점은 곧 새 방문의 시작점이므로, 직전 사용자/방문/캡쳐/피팅 데이터가
  // 모듈 메모리나 sessionStorage 에 남아 있으면 모두 비운다. (안 비우면 capture_session.phase 가
  // 'review' 상태로 살아남아 다음 분석 진입 시 얼굴 분석을 건너뛰고 report 로 튕긴다.)
  onMount(() => {
    reset_capture_session()
    clear_visit_session_data()
  })

  const GUEST_CUST_NO = 0
  const GUEST_CUST_NAME = '비회원'

  let g_is_guest_visit_loading = $state(false)
  let g_error_message = $state('')

  // 로그인 단계에서 선택한 안경원의 표시 이름. 없으면 안전한 기본 문구로 대체한다.
  const g_store_name = $derived(String($selected_opt_store_obj?.name ?? '').trim() || '안경원')

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
</script>

<main
  class="app-frame-page grid min-h-screen grid-rows-[auto_1fr] bg-[#FAFAFB] text-[var(--retina-text)]"
>
  <Header show_back={false} />

  <!--
    Viewport-fit 모드 — 콘텐츠 사이즈를 svh (small viewport height) 비율로 자동 스케일.
    clamp(min, viewport_ratio, max) 로 디바이스 높이가 작아지면 자동 축소, 커지면 디자인 상한 유지.
    디바이스 픽셀별로 미세 조정 안 함 — 한 캐스케이드로 모든 viewport 자동 fit.
  -->
  <section
    class="flex flex-1 flex-col items-center self-stretch gap-[clamp(20px,5svh,56px)] pt-[clamp(16px,4svh,40px)]"
    aria-label="방문 유형 선택"
  >
    <div class="grid justify-items-center gap-2 text-center">
      <h1
        class="m-0 font-extrabold leading-tight text-[var(--retina-text)] text-[clamp(20px,4.5svh,34px)]"
      >
        {g_store_name} 안경점
      </h1>
      <p class="m-0 font-medium text-[var(--retina-text-500)] text-[clamp(12px,1.8svh,16px)]">
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

    <!--
      카드 두 장 — md+ 부터 한 행 강제, 모바일~sm 은 wrap.
      카드 안 모든 사이즈(padding/icon/text/gap) 를 svh 기반 clamp 로 자동 스케일.
      viewport 세로가 작으면 자동 축소 → 디바이스 픽셀별 분기 없이 한 화면 fit.
    -->
    <section
      class="flex w-full flex-wrap justify-center gap-[clamp(16px,4svh,40px)] px-4 sm:px-8 md:flex-nowrap"
      aria-label="방문 유형 카드"
    >
      <button
        class="group flex aspect-[5/4] w-full max-w-[clamp(260px,72svh,480px)] flex-1 cursor-pointer flex-col items-center justify-center rounded-[32px] bg-white px-[clamp(20px,4svh,40px)] py-[clamp(20px,5svh,48px)] gap-[clamp(18px,4svh,36px)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.10)] transition duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_16px_36px_-12px_rgba(245,107,0,0.20)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onclick={on_click_start_guest_visit}
        disabled={g_is_guest_visit_loading}
      >
        <img
          src="/icons/LabelFirst.png"
          alt=""
          class="h-[clamp(110px,24svh,190px)] w-[clamp(110px,24svh,190px)] transition duration-150 group-hover:scale-105"
          aria-hidden="true"
        />

        <span class="flex flex-col items-center gap-1 text-center">
          <span
            class="block font-extrabold leading-tight text-[var(--retina-text)] text-[clamp(20px,4.2svh,30px)]"
          >
            {g_is_guest_visit_loading ? '방문 생성 중...' : '첫 방문이에요'}
          </span>
          <span
            class="block font-medium text-[var(--retina-text-500)] text-[clamp(12px,2svh,16px)]"
          >
            반가워요! 고객님 얼굴형에 맞춘 피팅을 시작해볼까요?
          </span>
        </span>
      </button>

      <button
        class="group flex aspect-[5/4] w-full max-w-[clamp(260px,72svh,480px)] flex-1 cursor-pointer flex-col items-center justify-center rounded-[32px] bg-white px-[clamp(20px,4svh,40px)] py-[clamp(20px,5svh,48px)] gap-[clamp(18px,4svh,36px)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.10)] transition duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_16px_36px_-12px_rgba(19,25,40,0.16)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-text-500)]/60"
        type="button"
        onclick={on_click_select_returning_visit}
      >
        <img
          src="/icons/LabelVisit.png"
          alt=""
          class="h-[clamp(110px,24svh,190px)] w-[clamp(110px,24svh,190px)] transition duration-150 group-hover:scale-105"
          aria-hidden="true"
        />

        <span class="flex flex-col items-center gap-1 text-center">
          <span
            class="block font-extrabold leading-tight text-[var(--retina-text)] text-[clamp(20px,4.2svh,30px)]"
          >
            방문한 적 있어요
          </span>
          <span
            class="block font-medium text-[var(--retina-text-500)] text-[clamp(12px,2svh,16px)]"
          >
            재방문 감사해요. 기존 내역을 불러올게요.
          </span>
        </span>
      </button>
    </section>
  </section>
</main>
