<script>
  import { Link } from '@maks11060/svelte5-router'
  import {
    ArrowLeft,
    CalendarDays,
    FileText,
    Phone,
    Ruler,
    ScanFace,
    Sparkles,
    UserRound,
  } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'
  import { PATH } from '@/config/path'
  import { get_visit_list } from '@/lib/api/visit'
  import { set_selected_customer, set_selected_visit } from '@/lib/stores/customer'
  import { get_customer_by_id } from '@/router/dashboard/users/user_data'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  let g_customer_obj = $derived(get_customer_by_id(id))
  let g_recent_visit_obj = $state(/** @type {any} */ (null))
  let g_is_analysis_completed = $derived(Boolean(g_recent_visit_obj?.test_dt))

  let action_card_arr = $derived([
    {
      title: '얼굴 분석',
      description: '얼굴형 및 톤 분석',
      href: PATH.analysis,
      icon: ScanFace,
      color_class: 'bg-[#4B0055] text-white',
      status: g_is_analysis_completed ? '완료' : '',
    },
    {
      title: '측정값 입력',
      description: '신규 측정값 입력',
      href: PATH.userMeasurement(id),
      icon: Ruler,
      color_class: 'bg-[#F3E8F5] text-[#4B0055]',
    },
    {
      title: '기록 관리',
      description: '최종 리포트와 분석 이력 확인',
      href: PATH.userRecords(id),
      icon: FileText,
      color_class: 'bg-[#DDF8ED] text-[#00856A]',
    },
  ])

  // 고객 상세 진입 시 최신 방문 이력을 불러와 분석 상태 표시 기준으로 사용한다.
  async function load_recent_visit() {
    try {
      const local_result_obj = await get_visit_list({
        cust_no: id,
      })
      const local_visit_arr = Array.isArray(local_result_obj?.visits) ? local_result_obj.visits : []

      g_recent_visit_obj = local_visit_arr[0] ?? null

      if (g_recent_visit_obj) {
        set_selected_visit(g_recent_visit_obj)
      }
    } catch {
      g_recent_visit_obj = null
    }
  }

  $effect(() => {
    set_selected_customer(g_customer_obj)
  })

  $effect(() => {
    load_recent_visit()
  })
</script>

<DashboardShell active_key="users" title="고객 상세">
  {#snippet header_left()}
    <Link
      class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
      href={PATH.users}
    >
      <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
      <span>고객 목록</span>
    </Link>
  {/snippet}

  <!--
    flex min-h-full items-center → 컨텐츠를 스크롤 영역 안에서 세로 중앙 정렬.
    bg-[#F7F8FA] → 부모 main 의 회색 bg 가 스크롤 영역까지 확실히 보이도록 명시.
    .app-bg-edge-extend → 좌우 viewport 끝까지 bg 확장.
  -->
  <section
    class="app-bg-edge-extend flex min-h-full items-center bg-[#F7F8FA] px-6 py-2"
  >
    <div class="mx-auto w-full max-w-[944px]">
      <section
        class="grid min-h-[80px] grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-[#E8EAF0] bg-white px-5 py-2.5 text-left"
      >
        <div>
          <h1 class="m-0 text-[20px] font-extrabold leading-tight text-zinc-950">
            {g_customer_obj.name}
          </h1>

          <div
            class="mt-1.5 flex max-w-[640px] items-center gap-4 text-[12px] font-semibold text-slate-600"
          >
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Phone size={13} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.phone}
            </span>
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <UserRound size={13} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.gender}
            </span>
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <CalendarDays size={13} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.birth_dt}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="grid min-h-12 min-w-[96px] place-items-center rounded-xl bg-[#F1E4F2] px-3 py-1">
            <p class="m-0 text-[10px] font-bold text-[#4B0055]">총 방문</p>
            <p class="m-0 text-base font-extrabold text-[#4B0055]">{g_customer_obj.visit_count}회</p>
          </div>
          <p class="m-0 text-[11px] font-semibold whitespace-nowrap text-slate-500">
            최근: {g_customer_obj.last_visit_dt}
          </p>
        </div>
      </section>

      {#if g_is_analysis_completed}
        <section
          class="mt-2 flex min-h-[52px] items-center justify-between gap-4 rounded-xl bg-[#F3E8F5] px-4 py-2 text-left"
        >
          <div class="flex items-center gap-2.5">
            <div class="grid h-8 w-8 place-items-center rounded-full bg-[#4B0055] text-white">
              <ScanFace size={16} strokeWidth={2.3} aria-hidden="true" />
            </div>
            <div>
              <h2 class="m-0 text-[13px] font-extrabold text-[#4B0055]">얼굴형 분석 완료</h2>
              <div class="mt-0.5 flex flex-wrap gap-1">
                <span
                  class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-extrabold text-[#6D1B7B]"
                >
                  미분석
                </span>
                <span
                  class="rounded-full bg-[#FFE7D4] px-2 py-0.5 text-[10px] font-extrabold text-[#C2410C]"
                >
                  미분석
                </span>
              </div>
            </div>
          </div>

          <button
            class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#4B0055] px-4 text-[12px] font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
            type="button"
          >
            <Sparkles size={13} strokeWidth={2.5} aria-hidden="true" />
            <span>AR 피팅 시작</span>
          </button>
        </section>
      {/if}

      <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        {#each action_card_arr as action_obj (action_obj.title)}
          <Link
            class="relative min-h-[88px] rounded-xl border border-[#E8EAF0] bg-white px-4 py-3 text-left transition hover:border-[#DCC9E2] hover:shadow-md hover:shadow-slate-200/60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
            href={action_obj.href}
          >
            {#if action_obj.status}
              <span
                class="absolute right-3 top-3 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-extrabold text-[#16A34A]"
              >
                {action_obj.status}
              </span>
            {/if}

            <div class={`grid h-9 w-9 place-items-center rounded-lg ${action_obj.color_class}`}>
              <action_obj.icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </div>

            <h2 class="m-0 mt-1.5 text-[14px] font-extrabold text-zinc-950">{action_obj.title}</h2>
            <p class="m-0 mt-0.5 text-[12px] font-semibold text-slate-500">
              {action_obj.description}
            </p>
          </Link>
        {/each}
      </div>
    </div>
  </section>
</DashboardShell>
