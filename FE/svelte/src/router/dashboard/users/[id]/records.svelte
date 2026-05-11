<script>
  import { Link, navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, CalendarDays, ChevronRight, Download, FileText } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'
  import { PATH } from '@/config/path'
  import { get_visit, get_visit_list } from '@/lib/api/visit'
  import { get_customer_store_by_id, set_selected_visit } from '@/lib/stores/customer'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  let g_customer_obj = $derived(get_customer_store_by_id(id))
  let ref_visit_arr = $state([])
  let g_error_message = $state('')
  let g_pending_visit_no = $state(/** @type {number | null} */ (null))

  // 얼굴 분석이 완료된 방문(중간 리포트 이상)만 최신순으로 정렬한다.
  function get_report_visit_arr(visit_arr) {
    return visit_arr
      .filter((visit_obj) => visit_obj?.test_dt)
      .sort((left_visit_obj, right_visit_obj) => {
        const left_time = new Date(
          left_visit_obj?.update_dt ??
            left_visit_obj?.real_vp_dt ??
            left_visit_obj?.vp_dt ??
            left_visit_obj?.test_dt ??
            left_visit_obj?.create_dt ??
            0,
        ).getTime()
        const right_time = new Date(
          right_visit_obj?.update_dt ??
            right_visit_obj?.real_vp_dt ??
            right_visit_obj?.vp_dt ??
            right_visit_obj?.test_dt ??
            right_visit_obj?.create_dt ??
            0,
        ).getTime()

        return right_time - left_time
      })
  }

  /**
   * 방문 응답을 기록 관리 화면 카드 형태로 변환한다.
   * 최종 리포트(report_json) 유무에 따라 라벨/상태 표기가 달라진다.
   * @param {Array<Record<string, unknown>>} visit_arr
   */
  function normalize_visit_arr(visit_arr) {
    return visit_arr.map((visit_obj, local_index) => {
      const local_has_final = Boolean(visit_obj.report_json)

      return {
        id: Number(visit_obj.visit_no ?? local_index + 1),
        visit_no: Number(visit_obj.visit_no ?? 0),
        title: `${local_index + 1}차 ${local_has_final ? '최종 리포트' : '중간 리포트'}`,
        product_nm:
          /** @type {any} */ (visit_obj.report_json)?.product_nm ??
          (local_has_final ? '최종 리포트' : '얼굴 분석 결과'),
        created_dt: String(
          visit_obj.update_dt ??
            visit_obj.real_vp_dt ??
            visit_obj.vp_dt ??
            visit_obj.test_dt ??
            visit_obj.create_dt ??
            '-',
        ),
        status: local_has_final ? '최종 리포트 완료' : '중간 리포트',
        status_box_class: local_has_final
          ? 'bg-[#DCFCE7] text-[#15803D]'
          : 'bg-[#FFF4E5] text-[#C2410C]',
        has_final: local_has_final,
        raw_obj: visit_obj,
      }
    })
  }

  // 최종 리포트가 있는 방문 이력만 불러와 기록 관리 목록에 반영한다.
  async function load_visit_arr() {
    if (!g_customer_obj?.id) {
      g_error_message = '고객 정보가 없습니다.'
      return
    }

    g_error_message = ''

    try {
      const local_result_obj = await get_visit_list({
        cust_no: g_customer_obj.id,
      })
      const local_visit_arr = Array.isArray(local_result_obj?.visits) ? local_result_obj.visits : []
      const local_report_visit_arr = get_report_visit_arr(local_visit_arr)

      ref_visit_arr = normalize_visit_arr(local_report_visit_arr)
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '방문 이력 조회 중 오류가 발생했습니다.'
    }
  }

  // 선택한 방문의 중간/최종 리포트를 동시에 받아 세션에 저장하고 결과 화면으로 이동한다.
  async function on_click_select_visit(visit_obj) {
    if (!visit_obj.visit_no || g_pending_visit_no !== null) {
      return
    }

    g_pending_visit_no = visit_obj.visit_no
    g_error_message = ''

    try {
      const local_visit_obj = await get_visit({ visit_no: visit_obj.visit_no })

      set_selected_visit({
        ...visit_obj.raw_obj,
        ...local_visit_obj,
      })

      navigate(visit_obj.has_final ? PATH.analysisResult : PATH.analysisReport)
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '리포트 조회 중 오류가 발생했습니다.'
    } finally {
      g_pending_visit_no = null
    }
  }

  $effect(() => {
    load_visit_arr()
  })
</script>

<DashboardShell active_key="users" title="기록 관리">
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
      <section class="grid gap-8">
        <div
          class="flex min-h-36 items-center justify-between rounded-2xl bg-[#4B0055] px-8 py-7 text-left text-white"
        >
          <div>
            <h1 class="m-0 text-3xl font-extrabold">{g_customer_obj?.name}님의 얼굴 분석 기록</h1>
          </div>

          <div class="grid h-20 w-20 place-items-center rounded-full bg-white text-[#4B0055]">
            <FileText size={38} strokeWidth={2.1} aria-hidden="true" />
          </div>
        </div>

        {#if g_error_message}
          <p
            class="m-0 rounded-lg bg-red-50 px-5 py-4 text-base font-bold text-red-700"
            role="alert"
          >
            {g_error_message}
          </p>
        {/if}

        {#if ref_visit_arr.length > 0}
          <div class="grid gap-4">
            {#each ref_visit_arr as visit_obj (visit_obj.id)}
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
                      {visit_obj.title}
                    </h2>
                    <p class="m-0 mt-2 text-base font-bold text-slate-600">
                      {visit_obj.product_nm}
                    </p>
                    <p
                      class="m-0 mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500"
                    >
                      <CalendarDays size={16} strokeWidth={2.1} aria-hidden="true" />
                      {visit_obj.created_dt}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-6">
                  <span
                    class={`rounded-full px-4 py-1.5 text-sm font-extrabold ${visit_obj.status_box_class}`}
                  >
                    {visit_obj.status}
                  </span>
                  <button
                    class="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#4B0055] hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/20"
                    type="button"
                    aria-label={`${visit_obj.title} 다운로드`}
                  >
                    <Download size={21} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  <button
                    class="grid h-11 w-8 cursor-pointer place-items-center border-0 bg-transparent text-slate-400 transition hover:text-[#4B0055] focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    aria-label={`${visit_obj.title} 상세 보기`}
                    disabled={g_pending_visit_no !== null}
                    onclick={() => on_click_select_visit(visit_obj)}
                  >
                    <ChevronRight size={25} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <div
            class="grid min-h-[220px] place-items-center rounded-2xl border border-[#E8EAF0] bg-white px-7 py-8 text-center"
          >
            <p class="m-0 text-lg font-extrabold text-slate-500">얼굴 분석 기록이 없습니다.</p>
          </div>
        {/if}
      </section>
    </div>
  </section>
</DashboardShell>
