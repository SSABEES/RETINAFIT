<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { UserRound } from 'lucide-svelte'
  import { PATH } from '../../config/path'
  import { admin_arr, selected_admin_obj } from '../../lib/stores/admin'

  function on_click_select_optician(optician_obj) {
    selected_admin_obj.set(optician_obj)
    navigate(PATH.users)
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-center overflow-y-auto px-5 py-8 sm:px-6 sm:py-10 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="optician-select-title"
  >
    <div class="relative z-10 flex w-full max-w-[760px] flex-col items-center">
      <div class="mb-6 flex flex-col items-center text-center sm:mb-8">
        <img
          class="mb-4 h-auto w-[112px] rounded-xl shadow-2xl shadow-black/20 sm:mb-5 sm:w-[148px]"
          src="/icnos.png"
          alt="Retin AI"
          width="900"
          height="900"
        />
        <h1
          id="optician-select-title"
          class="m-0 text-2xl font-extrabold tracking-normal text-white sm:text-3xl"
        >
          안경사 선택
        </h1>
      </div>

      <section
        class="w-full rounded-[22px] border border-white/8 bg-white/12 px-5 py-5 shadow-2xl shadow-black/22 backdrop-blur-md sm:rounded-[26px] sm:px-9 sm:py-8"
        aria-label="안경사 목록"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          {#each $admin_arr as optician_obj (optician_obj.id)}
            <button
              class="group grid min-h-[116px] cursor-pointer grid-cols-[auto_1fr] items-center gap-4 rounded-lg border-2 border-transparent bg-white px-4 py-4 text-left text-zinc-950 shadow-lg shadow-black/10 transition duration-150 ease-out hover:-translate-y-1 hover:border-[#9A1BFF] hover:bg-[#F8F1F8] hover:shadow-2xl hover:shadow-violet-950/30 active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white/70 sm:min-h-[172px] sm:grid-cols-1 sm:content-between sm:items-stretch sm:gap-0 sm:px-5 sm:py-5"
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

              <span class="min-w-0 sm:mt-5">
                <span class="block truncate text-xl font-extrabold text-zinc-950">
                  {optician_obj.name}
                </span>
                <span class="mt-1 block truncate text-sm font-bold text-slate-500">
                  {optician_obj.position}
                </span>
              </span>
            </button>
          {/each}
        </div>
      </section>

      <p class="mt-6 text-sm font-medium text-white/42 sm:mt-8 sm:text-base">
        © 2026 RETINA. All rights reserved.
      </p>
    </div>
  </section>
</main>
