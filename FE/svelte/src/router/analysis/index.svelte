<script>
  import { ArrowLeft, Camera, Sparkles } from 'lucide-svelte'

  const shot_step_arr = [
    {
      title: '정면 (안경 착용)',
      description: '안경을 착용한 상태로 정면을 바라봐 주세요',
    },
    {
      title: '정면 (안경 미착용)',
      description: '안경을 벗은 상태로 정면을 바라봐 주세요',
    },
    {
      title: '왼쪽 귀',
      description: '왼쪽 귀가 잘 보이도록 촬영해주세요',
    },
    {
      title: '오른쪽 귀',
      description: '오른쪽 귀가 잘 보이도록 촬영해주세요',
    },
  ]

  // 이전 화면으로 돌아가 고객 상세 흐름을 유지한다.
  function on_click_go_back() {
    window.history.back()
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
        type="button"
        onclick={on_click_go_back}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>

    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 분석</h1>

    <div></div>
  </header>

  <section class="h-[calc(100%-72px)] overflow-y-auto px-8 py-4">
    <div class="mx-auto max-w-[1216px]">
      <section
        class="mx-auto grid h-[458px] max-w-[804px] place-items-center rounded-2xl bg-[#0F1628] px-10 text-center text-white"
        aria-label="촬영 가이드"
      >
        <p class="m-0 text-[46px] font-extrabold leading-tight tracking-normal text-white/92">
          고객과 관련한<br />
          가이드 도입
        </p>
      </section>

      <section
        class="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-200/40"
        aria-label="촬영 단계"
      >
        <div class="grid grid-cols-4 gap-4">
          {#each shot_step_arr as shot_step_obj (shot_step_obj.title)}
            <article class="min-w-0 text-left">
              <h2 class="m-0 text-base font-extrabold text-zinc-950">{shot_step_obj.title}</h2>
              <p class="m-0 mt-2 min-h-5 truncate text-sm font-semibold text-slate-500">
                {shot_step_obj.description}
              </p>
              <button
                class="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#AA83B4] px-4 text-sm font-extrabold text-white transition hover:bg-[#9A6CA8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#AA83B4]/30"
                type="button"
              >
                <Camera size={16} strokeWidth={2.5} aria-hidden="true" />
                <span>촬영하기</span>
              </button>
            </article>
          {/each}
        </div>
      </section>

      <button
        class="mt-3 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-0 bg-[#AA83B4] px-6 text-lg font-extrabold text-white transition hover:bg-[#9A6CA8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#AA83B4]/30"
        type="button"
      >
        <Sparkles size={22} strokeWidth={2.5} aria-hidden="true" />
        <span>얼굴 분석 시작</span>
      </button>
    </div>
  </section>
</main>
