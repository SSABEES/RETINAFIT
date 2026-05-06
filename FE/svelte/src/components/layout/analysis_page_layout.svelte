<script>
  import Header from '@/components/layout/header.svelte'
  import AnalysisStepBar from '@/components/layout/analysis_step_bar.svelte'

  /**
   * 얼굴 분석 플로우 5개 페이지의 공통 레이아웃.
   *
   * 구조:
   *   <main class="app-frame-page ..."> [pb-[60px] for fixed StepBar]
   *     <Header />               (fixed top, padding-top 은 .app-frame-page 가 글로벌 처리)
   *     {@render children()}     (페이지 본문, flex-col 가운데 영역)
   *     <AnalysisStepBar />      (fixed bottom)
   *   </main>
   *
   * @type {{
   *   current_step: 1 | 2 | 3 | 4 | 5,
   *   bg_class?: string,
   *   edge_extend_bg?: boolean,
   *   onback?: () => void,
   *   onlogout?: () => void,
   *   show_back?: boolean,
   *   show_logout?: boolean,
   *   children: import('svelte').Snippet,
   * }}
   */
  let {
    current_step,
    bg_class = 'bg-white',
    edge_extend_bg = false,
    onback = undefined,
    onlogout = undefined,
    show_back = true,
    show_logout = true,
    children,
  } = $props()
</script>

<main
  class={`app-frame-page flex h-full flex-col overflow-clip [overflow-clip-margin:9999px] pb-[60px] ${bg_class} ${
    edge_extend_bg ? 'app-bg-edge-extend' : ''
  }`}
>
  <Header {onback} {onlogout} {show_back} {show_logout} />

  {@render children()}

  <AnalysisStepBar {current_step} />
</main>
