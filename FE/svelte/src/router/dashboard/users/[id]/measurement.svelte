<script>
  import { Link, navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, Eye, Save } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'
  import { PATH } from '@/config/path'
  import { get_customer_by_id } from '@/router/dashboard/users/user_data'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  let ref_measurement_obj = $state({
    l_sph: '-2.00',
    l_cyl: '-0.50',
    l_axis: '90',
    l_vision: '1.0',
    r_sph: '-2.25',
    r_cyl: '-0.75',
    r_axis: '85',
    r_vision: '1.0',
    bridge_width: '18',
    lens_width: '52',
    lens_height: '42',
    temple_length: '145',
  })

  let g_customer_obj = $derived(get_customer_by_id(id))

  /**
   * 측정값 입력 폼 제출 시 기본 제출을 막고 고객 목록으로 돌아간다.
   * @param {SubmitEvent} local_event
   */
  function on_submit_measurement(local_event) {
    local_event.preventDefault()
    navigate(PATH.users)
  }
</script>

<DashboardShell active_key="users" title="측정값 입력">
  {#snippet header_left()}
    <Link
      class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
      href={PATH.users}
    >
      <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
      <span>고객 목록</span>
    </Link>
  {/snippet}

  <section class="flex flex-1 items-start bg-[#F7F8FA] px-4 py-6 sm:px-6 md:items-center md:px-8 md:py-8">
    <div class="mx-auto w-full max-w-[944px]">
      <form class="grid gap-8" onsubmit={on_submit_measurement}>
        <section class="rounded-2xl border border-[#E8EAF0] bg-white px-8 py-8 text-left">
          <h1 class="m-0 inline-flex items-center gap-3 text-2xl font-extrabold text-zinc-950">
            <Eye size={24} strokeWidth={2.4} class="text-[#9A1BFF]" aria-hidden="true" />
            <span>{g_customer_obj.name}님의 시력 측정</span>
          </h1>

          <div class="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h2 class="m-0 text-lg font-extrabold text-slate-700">좌안 (L)</h2>
              <div class="mt-5 grid gap-4">
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  구면도수 (SPH)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.l_sph}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  난시도수 (CYL)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.l_cyl}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  난시축 (AXIS)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.l_axis}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  교정시력
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.l_vision}
                  />
                </label>
              </div>
            </div>

            <div>
              <h2 class="m-0 text-lg font-extrabold text-slate-700">우안 (R)</h2>
              <div class="mt-5 grid gap-4">
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  구면도수 (SPH)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.r_sph}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  난시도수 (CYL)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.r_cyl}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  난시축 (AXIS)
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.r_axis}
                  />
                </label>
                <label class="grid gap-2 text-sm font-extrabold text-slate-700">
                  교정시력
                  <input
                    class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
                    bind:value={ref_measurement_obj.r_vision}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-[#E8EAF0] bg-white px-8 py-8 text-left">
          <h1 class="m-0 text-2xl font-extrabold text-zinc-950">안경테 측정값(선택)</h1>

          <div class="mt-7 grid grid-cols-2 gap-x-8 gap-y-5">
            <label class="grid gap-2 text-sm font-extrabold text-slate-700">
              브릿지 너비
              <div
                class="flex min-h-12 items-center rounded-xl border border-slate-200 px-4 focus-within:border-[#9A1BFF] focus-within:ring-3 focus-within:ring-[#9A1BFF]/15"
              >
                <input
                  class="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-zinc-900 outline-none"
                  bind:value={ref_measurement_obj.bridge_width}
                />
                <span class="text-base font-semibold text-slate-400">mm</span>
              </div>
            </label>
            <label class="grid gap-2 text-sm font-extrabold text-slate-700">
              렌즈 너비
              <div
                class="flex min-h-12 items-center rounded-xl border border-slate-200 px-4 focus-within:border-[#9A1BFF] focus-within:ring-3 focus-within:ring-[#9A1BFF]/15"
              >
                <input
                  class="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-zinc-900 outline-none"
                  bind:value={ref_measurement_obj.lens_width}
                />
                <span class="text-base font-semibold text-slate-400">mm</span>
              </div>
            </label>
            <label class="grid gap-2 text-sm font-extrabold text-slate-700">
              렌즈 높이
              <div
                class="flex min-h-12 items-center rounded-xl border border-slate-200 px-4 focus-within:border-[#9A1BFF] focus-within:ring-3 focus-within:ring-[#9A1BFF]/15"
              >
                <input
                  class="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-zinc-900 outline-none"
                  bind:value={ref_measurement_obj.lens_height}
                />
                <span class="text-base font-semibold text-slate-400">mm</span>
              </div>
            </label>
            <label class="grid gap-2 text-sm font-extrabold text-slate-700">
              다리 길이
              <div
                class="flex min-h-12 items-center rounded-xl border border-slate-200 px-4 focus-within:border-[#9A1BFF] focus-within:ring-3 focus-within:ring-[#9A1BFF]/15"
              >
                <input
                  class="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-zinc-900 outline-none"
                  bind:value={ref_measurement_obj.temple_length}
                />
                <span class="text-base font-semibold text-slate-400">mm</span>
              </div>
            </label>
          </div>
        </section>

        <div class="grid grid-cols-2 gap-4">
          <Link
            class="grid min-h-14 place-items-center rounded-xl border border-slate-300 bg-white text-base font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            href={PATH.users}
          >
            취소
          </Link>
          <button
            class="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#4B0055] text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
            type="submit"
          >
            <Save size={20} strokeWidth={2.4} aria-hidden="true" />
            <span>저장하기</span>
          </button>
        </div>
      </form>
    </div>
  </section>
</DashboardShell>
