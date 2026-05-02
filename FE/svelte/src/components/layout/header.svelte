<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, LogOut } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

  /** @type {{
   *   onback?: (() => void) | undefined,
   *   onlogout?: (() => void) | undefined,
   *   show_back?: boolean,
   *   show_logout?: boolean,
   * }} */
  let {
    onback = undefined,
    onlogout = undefined,
    show_back = true,
    show_logout = true,
  } = $props()

  // 기본 뒤로가기: 브라우저 히스토리를 거슬러 올라간다.
  // onback prop이 주어지면 그 동작을 우선 사용한다.
  function handle_back_click() {
    if (onback) {
      onback()
      return
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
  }

  // 기본 로그아웃: 토큰/자동 로그인/로그인 선택 상태를 모두 비우고 로그인 화면으로 이동.
  // onlogout prop이 주어지면 그 동작을 우선 사용한다.
  function handle_logout_click() {
    if (onlogout) {
      onlogout()
      return
    }

    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }
</script>

<header class="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 px-6">
  <div class="flex justify-start">
    {#if show_back}
      <button
        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        type="button"
        aria-label="뒤로가기"
        onclick={handle_back_click}
      >
        <ArrowLeft size={24} strokeWidth={2.2} aria-hidden="true" />
      </button>
    {:else}
      <span class="h-8 w-8" aria-hidden="true"></span>
    {/if}
  </div>

  <img
    class="h-6 w-auto"
    src="/logo/LogoWide_2.png"
    alt="Retina Fit"
    width="240"
    height="52"
  />

  <div class="flex justify-end">
    {#if show_logout}
      <button
        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        type="button"
        aria-label="로그아웃"
        onclick={handle_logout_click}
      >
        <LogOut size={22} strokeWidth={2.2} aria-hidden="true" />
      </button>
    {:else}
      <span class="h-8 w-8" aria-hidden="true"></span>
    {/if}
  </div>
</header>
