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

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-start justify-items-center px-6 pt-24 pb-12 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="optician-select-title"
  >
    <div class="relative z-10 flex h-full max-h-[820px] w-full max-w-[820px] flex-col items-center">
      <div class="mb-10 flex flex-col items-center text-center">
        <img
          class="mb-5 h-auto w-[148px] rounded-xl shadow-2xl shadow-black/20"
          src="/icnos.png"
          alt="RetinaFit"
          width="900"
          height="900"
        />
        <h1
          id="optician-select-title"
          class="m-0 text-3xl font-extrabold tracking-normal text-white"
        >
          안경사 선택
        </h1>
      </div>

      <section
        class="min-h-0 w-full rounded-[26px] border border-white/8 bg-white/12 px-8 py-7 shadow-2xl shadow-black/22 backdrop-blur-md"
        aria-label="안경사 목록"
      >
        <div class="mb-5 grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div></div>

          <div class="min-w-0">
            {#if $selected_opt_store_obj}
              <div
                class="max-w-[260px] truncate rounded-full border border-white/12 bg-white/12 px-4 py-2 text-center text-sm font-extrabold text-white/82"
              >
                {$selected_opt_store_obj.name}
              </div>
            {/if}
          </div>

          {#if g_total_page_no > 1}
            <div class="flex items-center justify-end gap-4">
              <button
                class="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-white/14 bg-white/10 text-white transition hover:bg-white/16 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                aria-label="이전 안경사 페이지"
                disabled={!g_can_prev_page}
                onclick={on_click_prev_page}
              >
                <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
              </button>

              <span class="min-w-20 text-center text-sm font-extrabold text-white/82">
                {g_current_page_no} / {g_total_page_no}
              </span>

              <button
                class="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-white/14 bg-white/10 text-white transition hover:bg-white/16 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                aria-label="다음 안경사 페이지"
                disabled={!g_can_next_page}
                onclick={on_click_next_page}
              >
                <ChevronRight size={24} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          {:else}
            <div></div>
          {/if}
        </div>

        <div class="grid h-[376px] grid-cols-3 grid-rows-2 gap-4">
          {#each g_visible_admin_arr as optician_obj (optician_obj.id)}
            <button
              class="group grid h-[180px] cursor-pointer grid-rows-[auto_1fr] gap-5 rounded-lg border-2 border-transparent bg-white px-5 py-5 text-left text-zinc-950 shadow-lg shadow-black/10 transition duration-150 ease-out hover:-translate-y-1 hover:border-[#9A1BFF] hover:bg-[#F8F1F8] hover:shadow-2xl hover:shadow-violet-950/30 active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white/70"
              type="button"
              onclick={() => on_click_select_optician(optician_obj)}
            >
              <span class="flex items-start justify-between gap-3">
                <span
                  class="grid h-12 w-12 flex-none place-items-center rounded-full bg-[#F5EAF7] text-[#4B0055] transition duration-150 group-hover:bg-[#4B0055] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#4B0055]/25"
                >
                  <UserRound size={25} strokeWidth={2.3} aria-hidden="true" />
                </span>
              </span>

              <span class="grid min-w-0 content-end">
                <span
                  class="block max-w-full truncate text-xl font-extrabold leading-7 text-zinc-950"
                >
                  {optician_obj.name}
                </span>
                <span
                  class="mt-1 block max-w-full truncate text-sm font-bold leading-5 text-slate-500"
                >
                  {optician_obj.position}
                </span>
              </span>
            </button>
          {/each}

          {#each g_empty_slot_arr as local_empty_slot (local_empty_slot)}
            <div class="h-[180px] rounded-lg border-2 border-transparent" aria-hidden="true"></div>
          {/each}
        </div>
      </section>
    </div>

    <p
      class="absolute bottom-10 left-1/2 z-10 m-0 -translate-x-1/2 text-base font-medium text-white/42"
    >
      © 2026 Retina. All rights reserved.
    </p>
  </section>
</main>
