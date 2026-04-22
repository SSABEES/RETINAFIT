<script>
  import { Link } from '@maks11060/svelte5-router'
  import { ArrowLeft, CalendarDays, ChevronRight, Download, FileText } from 'lucide-svelte'
  import DashboardShell from '../../../../components/layout/dashboard_shell.svelte'
  import { PATH } from '../../../../config/path'
  import { fitting_report_arr, get_customer_by_id } from '../user_data'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  let g_customer_obj = $derived(get_customer_by_id(id))
</script>

<DashboardShell active_key="users" title="기록 관리">
  {#snippet header_left()}
    <Link
      class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
      href={PATH.userDetail(id)}
    >
      <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
      <span>고객 상세</span>
    </Link>
  {/snippet}

  <section class="px-8 py-8">
    <div class="mx-auto max-w-[944px]">
      <section class="grid gap-8">
        <div
          class="flex min-h-36 items-center justify-between rounded-2xl bg-[#4B0055] px-8 py-7 text-left text-white"
        >
          <div>
            <h1 class="m-0 text-3xl font-extrabold">{g_customer_obj.name}님의 피팅 리포트</h1>
          </div>

          <div class="grid h-20 w-20 place-items-center rounded-full bg-white text-[#4B0055]">
            <FileText size={38} strokeWidth={2.1} aria-hidden="true" />
          </div>
        </div>

        <div class="grid gap-4">
          {#each fitting_report_arr as report_obj (report_obj.id)}
            <article
              class="grid min-h-[132px] grid-cols-[1fr_auto] items-center gap-6 rounded-2xl border border-[#E8EAF0] bg-white px-6 py-6 text-left"
            >
              <div class="flex min-w-0 items-center gap-6">
                <div
                  class="grid h-16 w-16 flex-none place-items-center rounded-xl bg-[#F3E8F5] text-[#4B0055]"
                >
                  <FileText size={31} strokeWidth={2.2} aria-hidden="true" />
                </div>

                <div class="min-w-0">
                  <h2 class="m-0 truncate text-xl font-extrabold text-zinc-950">
                    {report_obj.title}
                  </h2>
                  <p class="m-0 mt-2 text-base font-bold text-slate-600">
                    {report_obj.product_nm}
                  </p>
                  <p
                    class="m-0 mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500"
                  >
                    <CalendarDays size={16} strokeWidth={2.1} aria-hidden="true" />
                    {report_obj.created_dt}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-6">
                <span
                  class="rounded-full bg-[#DCFCE7] px-4 py-1.5 text-sm font-extrabold text-[#15803D]"
                >
                  {report_obj.status}
                </span>
                <button
                  class="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#4B0055] hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/20"
                  type="button"
                  aria-label={`${report_obj.title} 다운로드`}
                >
                  <Download size={21} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  class="grid h-11 w-8 cursor-pointer place-items-center border-0 bg-transparent text-slate-400 transition hover:text-[#4B0055] focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/20"
                  type="button"
                  aria-label={`${report_obj.title} 상세 보기`}
                >
                  <ChevronRight size={25} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    </div>
  </section>
</DashboardShell>
