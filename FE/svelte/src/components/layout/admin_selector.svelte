<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronDown, LogOut, UserRound } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { clear_login_select_data, selected_admin_obj } from '@/lib/stores/admin'

  let ref_admin_dropdown_open = $state(false)

  // 로그인 사용자 메뉴 드롭다운의 열림 상태를 전환한다.
  function on_click_toggle_admin_dropdown() {
    ref_admin_dropdown_open = !ref_admin_dropdown_open
  }

  // 로그인 사용자 메뉴 드롭다운을 닫는다.
  function on_click_close_admin_dropdown() {
    ref_admin_dropdown_open = false
  }

  // 저장된 로그인 토큰을 삭제하고 로그인 화면으로 이동한다.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    ref_admin_dropdown_open = false
    navigate(PATH.login)
  }
</script>

<svelte:window onclick={on_click_close_admin_dropdown} />

<div
  class="relative w-[190px]"
  role="presentation"
  onclick={(local_event) => local_event.stopPropagation()}
>
  <button
    class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left transition hover:border-[#4B0055]/30 hover:bg-[#F8F1F8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/25"
    type="button"
    aria-haspopup="menu"
    aria-expanded={ref_admin_dropdown_open}
    onclick={on_click_toggle_admin_dropdown}
  >
    <span class="flex min-w-0 items-center gap-2">
      <span
        class="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#F5EAF7] text-[#4B0055]"
      >
        <UserRound size={18} strokeWidth={2.3} aria-hidden="true" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-sm font-extrabold text-zinc-950">
          {$selected_admin_obj.name}
        </span>
        <span class="block truncate text-xs font-bold text-slate-500">
          {$selected_admin_obj.position}
        </span>
      </span>
    </span>
    <ChevronDown
      class={`flex-none text-slate-400 transition ${ref_admin_dropdown_open ? 'rotate-180' : ''}`}
      size={17}
      strokeWidth={2.4}
      aria-hidden="true"
    />
  </button>

  {#if ref_admin_dropdown_open}
    <div
      class="absolute right-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-2 text-left shadow-xl shadow-slate-900/12"
      role="menu"
      aria-label="사용자 메뉴"
    >
      <button
        class="flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-white px-4 text-left text-[#D92D20] transition hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-red-100"
        type="button"
        role="menuitem"
        onclick={on_click_logout}
      >
        <span class="grid h-8 w-8 flex-none place-items-center rounded-full bg-red-50">
          <LogOut size={18} strokeWidth={2.3} aria-hidden="true" />
        </span>
        <span class="text-sm font-extrabold">로그아웃</span>
      </button>
    </div>
  {/if}
</div>
