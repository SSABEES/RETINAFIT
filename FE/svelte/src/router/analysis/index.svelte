<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import CaptureShell from '@/components/capture/capture_shell.svelte'

  // 이전 화면으로 돌아가 고객 상세 흐름을 유지한다.
  function on_click_go_back() {
    window.history.back()
  }

  // 촬영 완료 후 얼굴 분석 리포트 화면으로 이동한다.
  function on_click_start_analysis() {
    navigate(PATH.analysisReport)
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
      <CaptureShell />
    </div>
  </section>
</main>
