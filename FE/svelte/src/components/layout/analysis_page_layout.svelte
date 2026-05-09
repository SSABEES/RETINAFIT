<script>
  import Header from '@/components/layout/header.svelte'
  import AnalysisStepBar from '@/components/layout/analysis_step_bar.svelte'

  /**
   * 얼굴 분석 플로우 5개 페이지의 공통 레이아웃.
   *
   * 구조:
   *   <main class="app-frame-page flex flex-col ...">  [.app-frame-page padding-top:52px = 헤더 영역]
   *     <Header />               (fixed top, 52px)
   *     <AnalysisStepBar />      (in-flow, ~60px — 헤더 바로 밑에 자연 정착)
   *     {@render children()}     (flex-1, 페이지 본문)
   *   </main>
   *
   *   StepBar 를 fixed 가 아닌 normal flow 로 두는 이유:
   *   app.css 의 unlayered .app-frame-page padding-top:52px 가 Tailwind utility 보다 우선이라
   *   pt-[112px] 같은 override 가 안 먹는다. flex-col 의 자연 자식으로 두면 padding 싸움 자체가
   *   없어지고, .app-bg-edge-extend 가 좌우 viewport 끝까지 배경 확장도 처리.
   *
   * @type {{
   *   current_step: 1 | 2 | 3 | 4 | 5,
   *   bg_class?: string,
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
  class={`app-frame-page flex h-full flex-col overflow-clip [overflow-clip-margin:9999px] ${bg_class} ${
    edge_extend_bg ? 'app-bg-edge-extend' : ''
  }`}
>
  <Header {onback} {onlogout} {show_back} {show_logout} />

  {#if show_step_bar}
    <AnalysisStepBar {current_step} />
  {/if}

  {@render children()}
</main>
