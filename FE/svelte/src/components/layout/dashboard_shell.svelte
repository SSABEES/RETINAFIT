<script>
  import { Menu, X } from 'lucide-svelte'
  import AdminSelector from '@/components/layout/admin_selector.svelte'
  import DashboardSidebar from '@/components/layout/dashboard_sidebar.svelte'

  /** @type {{ active_key?: string, title?: string, children?: import('svelte').Snippet, header_left?: import('svelte').Snippet, header_action?: import('svelte').Snippet }} */
  let { active_key = '', title = '', children, header_left, header_action } = $props()

  // 모바일/소형 화면 사이드바 토글. md 이상에선 사이드바가 항상 노출되므로 무관.
  let g_is_mobile_nav_open = $state(false)

  // 햄버거 클릭 — 사이드바 오버레이 토글.
  function on_click_toggle_nav() {
    g_is_mobile_nav_open = !g_is_mobile_nav_open
  }

  // 오버레이 백드롭 클릭 시 닫기.
  function on_click_close_nav() {
    g_is_mobile_nav_open = false
  }
</script>

<main
  class="app-frame-page grid min-h-screen w-full grid-cols-1 bg-[#F7F8FA] text-[var(--retinal-text)] md:grid-cols-[240px_1fr]"
>
  <!-- md 이상: 사이드바 상시 노출 -->
  <div class="hidden md:block">
    <DashboardSidebar {active_key} />
  </div>

  <!-- md 미만: 햄버거 토글 시 사이드바 오버레이 -->
  {#if g_is_mobile_nav_open}
    <button
      type="button"
      class="fixed inset-0 z-40 cursor-default border-0 bg-black/40 p-0 md:hidden"
      aria-label="메뉴 닫기"
      onclick={on_click_close_nav}
    ></button>
    <div class="fixed inset-y-0 left-0 z-50 md:hidden">
      <DashboardSidebar {active_key} />
    </div>
  {/if}

  <section class="flex min-h-0 min-w-0 flex-col overflow-hidden">
    <header
      class="grid h-[64px] grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--retinal-border)] bg-white px-4 sm:h-[80px] sm:px-6 md:h-[92px] md:grid-cols-[1fr_auto_1fr] md:px-8"
    >
      <div class="flex items-center justify-start gap-3">
        <!-- 모바일 햄버거 — md 이상에선 숨김 -->
        <button
          type="button"
          class="grid h-10 w-10 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-zinc-700 transition hover:bg-slate-100 md:hidden"
          aria-label="메뉴 열기"
          onclick={on_click_toggle_nav}
        >
          {#if g_is_mobile_nav_open}
            <X size={22} strokeWidth={2.2} />
          {:else}
            <Menu size={22} strokeWidth={2.2} />
          {/if}
        </button>
        {@render header_left?.()}
      </div>

      <h1
        class="m-0 truncate text-lg font-extrabold tracking-normal text-zinc-950 sm:text-xl md:text-center md:text-2xl"
      >
        {title}
      </h1>

      <div class="flex items-center justify-end gap-2 sm:gap-3">
        <AdminSelector />
        {@render header_action?.()}
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
  </section>
</main>
