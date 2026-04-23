<script>
  import { Link } from '@maks11060/svelte5-router'
  import {
    ArrowLeft,
    ChartNoAxesColumnIncreasing,
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
  import { get_customer_by_id } from '@/router/dashboard/users/user_data'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  let action_card_arr = $derived([
    {
      title: '측정값 입력',
      description: '신규 측정값 입력',
      href: PATH.userMeasurement(id),
      icon: Ruler,
      color_class: 'bg-[#F3E8F5] text-[#4B0055]',
    },
    {
      title: '얼굴 분석',
      description: '얼굴형 및 피부톤 분석',
      href: PATH.analysis,
      icon: ScanFace,
      color_class: 'bg-[#4B0055] text-white',
      status: '완료',
    },
    {
      title: '기록 관리',
      description: '방문 및 상담 기록',
      href: PATH.userRecords(id),
      icon: FileText,
      color_class: 'bg-[#DDF8ED] text-[#00856A]',
    },
    {
      title: '분석 이력',
      description: '얼굴 분석 결과 기록',
      href: PATH.userAnalysisHistory(id),
      icon: ChartNoAxesColumnIncreasing,
      color_class: 'bg-[#FFE2B8] text-[#C2410C]',
    },
  ])

  let g_customer_obj = $derived(get_customer_by_id(id))
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

  <section class="px-8 py-8">
    <div class="mx-auto max-w-[944px]">
      <section
        class="grid min-h-[194px] grid-cols-[1fr_auto] items-center gap-8 rounded-2xl border border-[#E8EAF0] bg-white px-8 py-7 text-left"
      >
        <div>
          <h1 class="m-0 text-[42px] font-extrabold leading-tight text-zinc-950">
            {g_customer_obj.name}
          </h1>

          <div
            class="mt-6 flex max-w-[640px] items-center gap-8 text-base font-semibold text-slate-600"
          >
            <span class="inline-flex items-center gap-2 whitespace-nowrap">
              <Phone size={20} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.phone}
            </span>
            <span class="inline-flex items-center gap-2 whitespace-nowrap">
              <UserRound size={20} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.gender}
            </span>
            <span class="inline-flex items-center gap-2 whitespace-nowrap">
              <CalendarDays size={20} strokeWidth={2.1} aria-hidden="true" />
              {g_customer_obj.birth_dt}
            </span>
          </div>
        </div>

        <div class="grid justify-items-center gap-3">
          <div class="grid min-h-24 min-w-[142px] place-items-center rounded-2xl bg-[#F1E4F2] px-7">
            <p class="m-0 text-sm font-bold text-[#4B0055]">총 방문</p>
            <p class="m-0 text-4xl font-extrabold text-[#4B0055]">{g_customer_obj.visit_count}회</p>
          </div>
          <p class="m-0 text-sm font-semibold text-slate-500">
            최근 방문: {g_customer_obj.last_visit_dt}
          </p>
        </div>
      </section>

      <section
        class="mt-8 flex min-h-[108px] items-center justify-between gap-8 rounded-2xl bg-[#F3E8F5] px-7 py-6 text-left"
      >
        <div class="flex items-center gap-4">
          <div class="grid h-12 w-12 place-items-center rounded-full bg-[#4B0055] text-white">
            <ScanFace size={25} strokeWidth={2.3} aria-hidden="true" />
          </div>
          <div>
            <h2 class="m-0 text-xl font-extrabold text-[#4B0055]">얼굴형 분석 완료</h2>
            <div class="mt-2 flex flex-wrap gap-2">
              <span
                class="rounded-full bg-white/70 px-3 py-1 text-sm font-extrabold text-[#6D1B7B]"
              >
                {g_customer_obj.face_shape || '미분석'}
              </span>
              <span
                class="rounded-full bg-[#FFE7D4] px-3 py-1 text-sm font-extrabold text-[#C2410C]"
              >
                {g_customer_obj.skin_tone || '미분석'}
              </span>
            </div>
          </div>
        </div>

        <button
          class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-7 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
          type="button"
        >
          <Sparkles size={20} strokeWidth={2.5} aria-hidden="true" />
          <span>AR 피팅 시작</span>
        </button>
      </section>

      <div class="mt-6 grid grid-cols-2 gap-6">
        {#each action_card_arr as action_obj (action_obj.title)}
          <Link
            class="relative min-h-[206px] rounded-2xl border border-[#E8EAF0] bg-white px-8 py-8 text-left transition hover:border-[#DCC9E2] hover:shadow-md hover:shadow-slate-200/60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
            href={action_obj.href}
          >
            {#if action_obj.status}
              <span
                class="absolute right-5 top-5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-extrabold text-[#16A34A]"
              >
                {action_obj.status}
              </span>
            {/if}

            <div class={`grid h-16 w-16 place-items-center rounded-xl ${action_obj.color_class}`}>
              <action_obj.icon size={31} strokeWidth={2.2} aria-hidden="true" />
            </div>

            <h2 class="m-0 mt-5 text-2xl font-extrabold text-zinc-950">{action_obj.title}</h2>
            <p class="m-0 mt-2 text-base font-semibold text-slate-500">
              {action_obj.description}
            </p>
          </Link>
        {/each}
      </div>
    </div>
  </section>
</DashboardShell>
