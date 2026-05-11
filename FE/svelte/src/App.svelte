<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { wait_for_flutter_bridge } from '@/lib/flutter/bridge'

  let url = ''
  let g_is_model_ready = $state(false)
  let g_is_env_detected = $state(false)

  // Flutter WebView 환경에서만 모델 사전 다운로드 splash 노출. 일반 웹은 skip.
  onMount(() => {
    void (async () => {
      const local_is_flutter = await wait_for_flutter_bridge(300, 100)
      if (!local_is_flutter) g_is_model_ready = true
      g_is_env_detected = true
    })()
  })

  // 스플래시에서 모델 ready 신호 (다운로드 완료, 건너뛰기)를 수신함
  function on_model_ready() {
    g_is_model_ready = true
  }
</script>

<div class="app-root">
  <Router {url}>
    {#each routes as route (route.path)}
      <Route path={route.path} component={route.component} />
    {/each}
  </Router>
</div>

<GlobalToast />

{#if g_is_env_detected && !g_is_model_ready}
  <SplashScreen onready={on_model_ready} />
{/if}
