<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'

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

<GlobalToast />
