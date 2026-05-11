<script>
  import Header from '@/components/layout/header.svelte'
  import AnalysisStepBar from '@/components/layout/analysis_step_bar.svelte'

  /**
   * 얼굴 분석 플로우의 공통 레이아웃.
   *
   * fit_viewport=true (default):
   *   main 이 정확히 viewport 높이 (h-[100svh]) 를 차지하고 overflow-hidden.
   *   자식 flex-1 영역이 (viewport - header - step bar) 만큼 정확히 잡혀 카메라 등
   *   viewport-fit 콘텐츠가 빈 공간 없이 채워진다.
   *
   * fit_viewport=false:
   *   콘텐츠 길이에 따라 페이지가 자연 스크롤. 리포트/결과 페이지처럼 본문이 긴 경우 사용.
   *
   * @type {{
   *   current_step: 1 | 2 | 3 | 4 | 5,
   *   bg_class?: string,
   *   fit_viewport?: boolean,
   *   edge_extend_bg?: boolean,
   *   onback?: () => void,
   *   onlogout?: () => void,
   *   show_back?: boolean,
   *   show_logout?: boolean,
   *   show_step_bar?: boolean,
   *   children: import('svelte').Snippet,
   * }}
   */
  let {
    current_step,
    bg_class = 'bg-white',
    fit_viewport = true,
    edge_extend_bg = false,
    onback = undefined,
    onlogout = undefined,
    show_back = true,
    show_logout = true,
    show_step_bar = true,
    children,
  } = $props()
</script>

<main
  class={`app-frame-page flex flex-col ${fit_viewport ? 'min-h-screen md:h-[100svh] md:overflow-hidden' : 'min-h-screen'} ${bg_class}`}
>
  <Header {onback} {onlogout} {show_back} {show_logout} />

  {#if show_step_bar}
    <AnalysisStepBar {current_step} />
  {/if}

  {@render children()}
</main>
