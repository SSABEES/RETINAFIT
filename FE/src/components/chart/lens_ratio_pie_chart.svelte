<script>
  import { onMount } from 'svelte'
  import Chart from 'chart.js/auto'

  /** @type {{ data_arr?: Array<{ label: string, value: number, color: string }> }} */
  let { data_arr = [] } = $props()

  let ref_this_lens_ratio_chart
  let g_lens_ratio_chart_obj

  // 렌즈 판매 비율 데이터를 사용해 원형 차트를 생성한다.
  function create_lens_ratio_chart() {
    g_lens_ratio_chart_obj = new Chart(ref_this_lens_ratio_chart, {
      type: 'pie',
      data: {
        labels: data_arr.map((lens_obj) => lens_obj.label),
        datasets: [
          {
            data: data_arr.map((lens_obj) => lens_obj.value),
            backgroundColor: data_arr.map((lens_obj) => lens_obj.color),
            borderColor: '#FFFFFF',
            borderWidth: 1,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: {
              size: 13,
              weight: 700,
            },
            bodyFont: {
              size: 13,
              weight: 700,
            },
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.label} ${context.parsed}%`,
            },
          },
        },
      },
    })
  }

  // 컴포넌트가 화면에 표시되면 차트를 생성하고 제거 시 인스턴스를 정리한다.
  onMount(() => {
    create_lens_ratio_chart()

    return () => {
      g_lens_ratio_chart_obj?.destroy()
    }
  })
</script>

<article
  class="min-h-[430px] rounded-xl border border-slate-200 bg-white px-8 py-8 text-left shadow-sm shadow-slate-200/40"
>
  <h2 class="m-0 text-2xl font-extrabold text-zinc-950">렌즈 종류별 판매 비율</h2>

  <div class="mx-auto mt-7 h-[240px] w-[300px]">
    <canvas bind:this={ref_this_lens_ratio_chart} aria-label="렌즈 종류별 판매 비율 원형 그래프"
    ></canvas>
  </div>

  <div class="mt-7 grid grid-cols-3 gap-5 text-center">
    {#each data_arr as lens_obj (lens_obj.label)}
      <div>
        <div class="mx-auto h-4 w-4 rounded-full" style={`background-color: ${lens_obj.color}`}
        ></div>
        <p class="mb-1 mt-3 text-base font-extrabold text-zinc-950">{lens_obj.label}</p>
        <p class="m-0 text-sm font-semibold text-slate-500">{lens_obj.value}%</p>
      </div>
    {/each}
  </div>
</article>
