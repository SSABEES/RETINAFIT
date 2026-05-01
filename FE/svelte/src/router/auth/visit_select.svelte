<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { History, UserPlus } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

  const STORE_NAME = '레티나안경원 강동점'

  function on_click_select_visit_type() {
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

      <div class="grid grid-cols-2 gap-20">
        <button
          class="group grid aspect-square cursor-pointer grid-rows-[1fr_auto] gap-6 rounded-[20px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-7 py-9 text-left shadow-[0_6px_14px_rgba(19,25,40,0.06)] transition duration-150 ease-out hover:-translate-y-1 hover:border-[var(--retina-primary-600)] hover:shadow-[0_14px_28px_rgba(245,107,0,0.18)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-primary-600)]/60"
          type="button"
          onclick={on_click_select_visit_type}
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
              첫 방문이에요
            </span>
            <span class="block text-sm font-medium text-[var(--retina-text-500)]">
              반가워요! <br>고객님 얼굴형에 맞춘 피팅을 시작해볼까요?
            </span>
          </span>
        </button>

        <button
          class="group grid aspect-square cursor-pointer grid-rows-[1fr_auto] gap-6 rounded-[20px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-7 py-9 text-left shadow-[0_6px_14px_rgba(19,25,40,0.06)] transition duration-150 ease-out hover:-translate-y-1 hover:border-[var(--retina-text-500)] hover:shadow-[0_14px_28px_rgba(19,25,40,0.12)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-text-500)]/60"
          type="button"
          onclick={on_click_select_visit_type}
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
