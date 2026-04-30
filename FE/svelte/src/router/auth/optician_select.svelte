<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronLeft, ChevronRight, UserRound } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { admin_arr, selected_opt_store_obj, set_selected_admin } from '@/lib/stores/admin'

  const g_page_size = 6

  let g_current_page_no = $state(1)
  let g_total_page_no = $derived(Math.max(1, Math.ceil($admin_arr.length / g_page_size)))
  let g_visible_admin_arr = $derived(
    $admin_arr.slice((g_current_page_no - 1) * g_page_size, g_current_page_no * g_page_size),
  )
  let g_empty_slot_arr = $derived(
    Array.from(
      { length: g_page_size - g_visible_admin_arr.length },
      (_, local_index) => local_index,
    ),
  )
  let g_can_prev_page = $derived(g_current_page_no > 1)
  let g_can_next_page = $derived(g_current_page_no < g_total_page_no)

  // 선택한 안경사를 전역 상태에 저장하고 고객 관리 화면으로 이동한다.
  function on_click_select_optician(optician_obj) {
    set_selected_admin(optician_obj)
    navigate(PATH.users)
  }

  // 안경사 목록을 이전 페이지로 이동한다.
  function on_click_prev_page() {
    if (!g_can_prev_page) {
      return
    }

    g_current_page_no -= 1
  }

  // 안경사 목록을 다음 페이지로 이동한다.
  function on_click_next_page() {
    if (!g_can_next_page) {
      return
    }

    g_current_page_no += 1
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[1fr_auto] overflow-hidden bg-[var(--retina-bg-1)] px-6 pt-6 pb-4 text-[var(--retina-text)]"
>
  <section
    class="grid w-full max-w-[760px] justify-items-center justify-self-center self-center gap-4"
    aria-label="안경사 선택"
  >
    <img
      class="h-auto w-[140px]"
      src="/logo/LogoHeight.png"
      alt="RetinaFit"
      width="16568"
      height="16568"
    />

    <section
      class="min-h-0 w-full rounded-[18px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-6 py-5 shadow-[0_6px_14px_rgba(19,25,40,0.06)]"
      aria-label="안경사 목록"
    >
      <div class="mb-4 grid min-h-10 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div></div>

        <div class="min-w-0">
          {#if $selected_opt_store_obj}
            <div
              class="max-w-[240px] truncate rounded-full border border-[var(--retina-primary-200)] bg-[var(--retina-bg-1)] px-3.5 py-1.5 text-center text-xs font-extrabold text-[var(--retina-primary-700)]"
            >
              {$selected_opt_store_obj.name}
            </div>
          {/if}
        </div>

        {#if g_total_page_no > 1}
          <div class="flex items-center justify-end gap-3">
            <button
              class="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[var(--retina-text-300)] bg-[var(--retina-surface)] text-[var(--retina-text)] transition hover:border-[var(--retina-primary-600)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              aria-label="이전 안경사 페이지"
              disabled={!g_can_prev_page}
              onclick={on_click_prev_page}
            >
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>

            <span class="min-w-16 text-center text-xs font-extrabold text-[var(--retina-text-700)]">
              {g_current_page_no} / {g_total_page_no}
            </span>

            <button
              class="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[var(--retina-text-300)] bg-[var(--retina-surface)] text-[var(--retina-text)] transition hover:border-[var(--retina-primary-600)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              aria-label="다음 안경사 페이지"
              disabled={!g_can_next_page}
              onclick={on_click_next_page}
            >
              <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        {:else}
          <div></div>
        {/if}
      </div>

      <div class="grid h-[280px] grid-cols-3 grid-rows-2 gap-3">
        {#each g_visible_admin_arr as optician_obj (optician_obj.id)}
          <button
            class="group grid h-[136px] cursor-pointer grid-rows-[auto_1fr] gap-3 rounded-lg border-2 border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-4 py-3 text-left text-[var(--retina-text)] shadow-[0_4px_10px_rgba(19,25,40,0.04)] transition duration-150 ease-out hover:-translate-y-1 hover:border-[var(--retina-primary-600)] hover:bg-[var(--retina-bg-1)] hover:shadow-[0_10px_22px_rgba(245,107,0,0.18)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-primary-600)]/60"
            type="button"
            onclick={() => on_click_select_optician(optician_obj)}
          >
            <span class="flex items-start justify-between gap-3">
              <span
                class="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--retina-bg-1)] text-[var(--retina-primary-600)] transition duration-150 group-hover:bg-[var(--retina-primary-600)] group-hover:text-[var(--retina-text-100)] group-hover:shadow-lg group-hover:shadow-[var(--retina-primary-600)]/25"
              >
                <UserRound size={22} strokeWidth={2.3} aria-hidden="true" />
              </span>
            </span>

            <span class="grid min-w-0 content-end">
              <span
                class="block max-w-full truncate text-base font-extrabold leading-6 text-[var(--retina-text)]"
              >
                {optician_obj.name}
              </span>
              <span
                class="mt-0.5 block max-w-full truncate text-xs font-bold leading-4 text-[var(--retina-text-500)]"
              >
                {optician_obj.position}
              </span>
            </span>
          </button>
        {/each}

        {#each g_empty_slot_arr as local_empty_slot (local_empty_slot)}
          <div class="h-[136px] rounded-lg border-2 border-transparent" aria-hidden="true"></div>
        {/each}
      </div>
    </section>
  </section>

  <p class="m-0 justify-self-center text-center text-sm font-medium text-[var(--retina-primary-900)]/80">
    © 2026 RETINA Co,Ltd. All rights reserved.
  </p>
</main>
