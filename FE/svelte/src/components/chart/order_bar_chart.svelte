<script>
  import { onMount } from 'svelte'
  import Chart from 'chart.js/auto'

  /** @type {{ data_arr?: Array<{ label: string, value: number }> }} */
  let { data_arr = [] } = $props()

  let ref_this_order_chart
  let g_order_chart_obj
  let g_order_animation_delayed = true

  const chart_common_options_obj = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
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
      },
    },
    scales: {
      x: {
        grid: {
          color: '#EEF0F4',
          borderDash: [4, 4],
        },
        border: {
          color: '#CBD5E1',
        },
        ticks: {
          color: '#98A2B3',
          font: {
            size: 13,
            weight: 700,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#EEF0F4',
          borderDash: [4, 4],
        },
        border: {
          color: '#CBD5E1',
        },
        ticks: {
          color: '#98A2B3',
          font: {
            size: 12,
            weight: 700,
          },
        },
      },
    },
  }

  // 주문 추이 데이터를 사용해 막대 차트를 생성한다.
  function create_order_chart() {
    g_order_chart_obj = new Chart(ref_this_order_chart, {
      type: 'bar',
      data: {
        labels: data_arr.map((order_obj) => order_obj.label),
        datasets: [
          {
            data: data_arr.map((order_obj) => order_obj.value),
            backgroundColor: '#65006F',
            borderRadius: 7,
            borderSkipped: false,
            barThickness: 58,
          },
        ],
      },
      options: {
        ...chart_common_options_obj,
        animation: {
          onComplete: () => {
            g_order_animation_delayed = false
          },
        },
        animations: {
          x: {
            type: 'number',
            easing: 'easeOutQuart',
            duration: 0,
          },
          y: {
            type: 'number',
            easing: 'easeOutQuart',
            duration: 850,
            from: (context) => {
              if (context.type === 'data') {
                return context.chart.scales.y.getPixelForValue(0)
              }

              return undefined
            },
            delay: (context) => {
              if (context.type !== 'data' || !g_order_animation_delayed) {
                return 0
              }

              return context.dataIndex * 90
            },
          },
        },
        scales: {
          ...chart_common_options_obj.scales,
          y: {
            ...chart_common_options_obj.scales.y,
            suggestedMax: 80,
          },
        },
      },
    })
  }

  // 컴포넌트가 화면에 표시되면 차트를 생성하고 제거 시 인스턴스를 정리한다.
  onMount(() => {
    create_order_chart()

    return () => {
      g_order_chart_obj?.destroy()
    }
  })
</script>

<article
  class="min-h-[274px] rounded-xl border border-slate-200 bg-white px-8 py-8 text-left shadow-sm shadow-slate-200/40"
>
  <h2 class="m-0 text-2xl font-extrabold text-zinc-950">월별 주문 건수</h2>
  <div class="mt-7 h-[188px]">
    <canvas bind:this={ref_this_order_chart} aria-label="월별 주문 건수 막대 그래프"></canvas>
  </div>
</article>
