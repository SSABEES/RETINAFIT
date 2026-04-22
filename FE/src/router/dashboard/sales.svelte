<script>
  import { CalendarDays, DollarSign, ShoppingCart, TrendingUp } from 'lucide-svelte'
  import LensRatioPieChart from '@/components/chart/lens_ratio_pie_chart.svelte'
  import OrderBarChart from '@/components/chart/order_bar_chart.svelte'
  import SalesLineChart from '@/components/chart/sales_line_chart.svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'

  const summary_arr = [
    { label: '총 매출', value: '6천만원' },
    { label: '총 주문', value: '232건' },
    { label: '평균 객단가', value: '27만원' },
  ]

  const stat_arr = [
    {
      label: '오늘 매출',
      value: '289만원',
      change: '+15.3%',
      tone: 'green',
      icon: DollarSign,
      icon_class: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: '오늘 주문',
      value: '12건',
      change: '+8.7%',
      tone: 'green',
      icon: ShoppingCart,
      icon_class: 'bg-[#F5EAF7] text-slate-700',
    },
    {
      label: '평균 주문액',
      value: '24만원',
      change: '+5.2%',
      tone: 'green',
      icon: TrendingUp,
      icon_class: 'bg-[#4B0055] text-white',
    },
    {
      label: '신규 고객',
      value: '3명',
      change: '-2.1%',
      tone: 'red',
      icon: CalendarDays,
      icon_class: 'bg-amber-50 text-orange-600',
    },
  ]

  const sales_trend_arr = [
    { label: '1월', value: 12.5 },
    { label: '2월', value: 15.8 },
    { label: '3월', value: 18.5 },
    { label: '4월', value: 17.2 },
  ]

  const order_trend_arr = [
    { label: '1월', value: 45 },
    { label: '2월', value: 58 },
    { label: '3월', value: 68 },
    { label: '4월', value: 62 },
  ]

  const popular_glasses_arr = [
    { rank: 1, name: '레이벤 RB2132', count: 28, revenue: '445만원' },
    { rank: 2, name: '젠틀몬스터 릴라', count: 24, revenue: '475만원' },
    { rank: 3, name: '린드버그 N.O.W', count: 18, revenue: '441만원' },
    { rank: 4, name: '마르쿠스 ME2622', count: 15, revenue: '267만원' },
    { rank: 5, name: '기타', count: 42, revenue: '715만원' },
  ]

  const lens_ratio_arr = [
    { label: '싱글렌즈', value: 45, color: '#65006F' },
    { label: '프로그레시브', value: 30, color: '#7A338E' },
    { label: '이중초점', value: 25, color: '#A162B1' },
  ]
</script>

<DashboardShell active_key="sales" title="판매 통계">
  <section class="px-8 py-10">
    <div class="mx-auto max-w-[894px]">
      <section
        class="rounded-2xl border border-[#EFE7F2] bg-[#F8F1F8] px-8 py-8 text-left shadow-sm"
      >
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">이번 달 요약</h2>
        <div class="mt-5 grid grid-cols-3 gap-10">
          {#each summary_arr as summary_obj (summary_obj.label)}
            <div>
              <p class="m-0 text-base font-bold text-slate-500">{summary_obj.label}</p>
              <p class="m-0 mt-2 text-4xl font-extrabold text-[#4B0055]">{summary_obj.value}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="mt-8 grid grid-cols-4 gap-6">
        {#each stat_arr as stat_obj (stat_obj.label)}
          <article
            class="min-h-[172px] rounded-xl border border-slate-200 bg-white px-6 py-6 text-left shadow-sm shadow-slate-200/40"
          >
            <div class="flex items-start justify-between gap-3">
              <div class={`grid h-13 w-13 place-items-center rounded-xl ${stat_obj.icon_class}`}>
                <stat_obj.icon size={29} strokeWidth={2.3} aria-hidden="true" />
              </div>
              <span
                class={`rounded-full px-3 py-1 text-sm font-extrabold ${
                  stat_obj.tone === 'red'
                    ? 'bg-red-50 text-red-500'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {stat_obj.change}
              </span>
            </div>
            <p class="mb-1 mt-5 text-base font-bold text-slate-500">{stat_obj.label}</p>
            <p class="m-0 text-3xl font-extrabold text-zinc-950">{stat_obj.value}</p>
          </article>
        {/each}
      </section>

      <section class="mt-8 grid grid-cols-2 gap-7">
        <SalesLineChart data_arr={sales_trend_arr} />
        <OrderBarChart data_arr={order_trend_arr} />
      </section>

      <section class="mt-8 grid grid-cols-2 gap-7">
        <article
          class="min-h-[430px] rounded-xl border border-slate-200 bg-white px-8 py-8 text-left shadow-sm shadow-slate-200/40"
        >
          <h2 class="m-0 text-2xl font-extrabold text-zinc-950">인기 안경 TOP 5</h2>

          <div class="mt-7 grid gap-3.5">
            {#each popular_glasses_arr as glasses_obj (glasses_obj.rank)}
              <div
                class="grid min-h-[76px] grid-cols-[3.5rem_1fr_auto] items-center gap-4 rounded-xl bg-[#F8F9FB] px-4"
              >
                <div
                  class="grid h-11 w-11 place-items-center rounded-full bg-[#F5EAF7] text-lg font-extrabold text-[#4B0055]"
                >
                  {glasses_obj.rank}
                </div>

                <div class="min-w-0">
                  <p class="m-0 truncate text-base font-extrabold text-zinc-950">
                    {glasses_obj.name}
                  </p>
                  <p class="m-0 mt-1 text-sm font-semibold text-slate-500">
                    {glasses_obj.count}개 판매
                  </p>
                </div>

                <p class="m-0 text-lg font-extrabold text-[#4B0055]">{glasses_obj.revenue}</p>
              </div>
            {/each}
          </div>
        </article>

        <LensRatioPieChart data_arr={lens_ratio_arr} />
      </section>
    </div>
  </section>
</DashboardShell>
