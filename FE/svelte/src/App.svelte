<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { wait_for_flutter_bridge } from '@/lib/flutter/bridge'

  let url = ''
  let ref_shell_el
  let ref_content_el
  let g_is_model_ready = $state(false)
  let g_is_env_detected = $state(false)

  // 현재 페이지 main 의 배경색을 외곽 부분에 자동 동기화
  function sync_shell_bg() {
    if (!ref_shell_el || !ref_content_el) return

    const local_main_el = ref_content_el.querySelector('main.app-frame-page')
    if (!local_main_el) return

    const local_bg = window.getComputedStyle(local_main_el).backgroundColor
    if (local_bg) ref_shell_el.style.background = local_bg
  }

  // viewport 가 베이스(1024×640) 보다 크면 같은 비율로 .app-frame 을 확대해 UI 가 화면에
  // 맞게 자연스럽게 떨어져 보이게 한다. 작은 viewport 는 app.css 의 @media fluid fallback
  // (width: 100vw, height: auto) 에 맡기므로 scale 은 1 로 유지.
  function update_app_frame_scale() {
    const local_w = window.innerWidth
    const local_h = window.innerHeight
    if (local_w <= 1280 || local_h <= 820) {
      document.documentElement.style.setProperty('--app-frame-scale', '1')
      return
    }
    const local_scale = Math.min(local_w / 1024, local_h / 640)
    document.documentElement.style.setProperty('--app-frame-scale', String(local_scale))
  }

  onMount(async () => {
    const local_observer = new MutationObserver(sync_shell_bg)
    local_observer.observe(ref_content_el, { childList: true })
    sync_shell_bg()

    update_app_frame_scale()
    window.addEventListener('resize', update_app_frame_scale)

    // Flutter WebView 환경에서만 모델 사전 다운로드 splash 노출. 일반 웹은 skip.
    const local_is_flutter = await wait_for_flutter_bridge(300, 100)
    if (!local_is_flutter) g_is_model_ready = true
    g_is_env_detected = true

    return () => {
      local_observer.disconnect()
      window.removeEventListener('resize', update_app_frame_scale)
    }
  })

  // 스플래시에서 모델 ready 신호 (다운로드 완료, 건너뛰기)를 수신함
  function on_model_ready() {
    g_is_model_ready = true
  }
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

{#if g_is_env_detected && !g_is_model_ready}
  <SplashScreen onready={on_model_ready} />
{/if}
