<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import { prefetch_models } from '@/lib/sixdrepnet360/inference'

  let url = ''
  let ref_shell_el
  let ref_content_el

  // 현재 페이지 main 의 배경색을 외곽 shell 에 자동 동기화 (letterbox)
  function sync_shell_bg() {
    if (!ref_shell_el || !ref_content_el) return

    const local_main_el = ref_content_el.querySelector('main.app-frame-page')
    if (!local_main_el) return

    const local_bg = window.getComputedStyle(local_main_el).backgroundColor
    if (local_bg) ref_shell_el.style.background = local_bg
  }

  onMount(() => {
    const local_observer = new MutationObserver(sync_shell_bg)
    local_observer.observe(ref_content_el, { childList: true })
    sync_shell_bg()

    // 6DRepNet360 ONNX 자산을 HTTP 캐시에 미리 채워 첫 추론 진입 시 다운로드 대기를 줄인다.
    // 메모리는 안 먹는 raw fetch 라 fire-and-forget 으로 충분. 실패는 inference.js 내부에서 silent.
    prefetch_models()

    return () => local_observer.disconnect()
  })
</script>

<div class="app-frame-shell" bind:this={ref_shell_el}>
  <div class="app-frame">
    <div class="app-frame-content" bind:this={ref_content_el}>
      <Router {url}>
        {#each routes as route (route.path)}
          <Route path={route.path} component={route.component} />
        {/each}
      </Router>
    </div>
  </div>
</div>
