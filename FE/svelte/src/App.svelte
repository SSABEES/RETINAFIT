<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { wait_for_flutter_bridge } from '@/lib/flutter/bridge'
  import { ensure_cache_warm } from '@/lib/sixdrepnet360/preload'
  import { get_active_variant } from '@/lib/sixdrepnet360/inference'

  let url = ''
  let g_is_model_ready = $state(false)
  // env 감지가 끝나기 전까지 splash 가 깜빡 노출되는 것을 막는 게이트.
  // 일반 웹이면 env 감지 직후 model_ready 도 true 가 되어 splash 자체가 안 뜬다.
  let g_is_env_detected = $state(false)

  // 라우터 이동 시점에 모델 Cache Storage 가 비어있지 않은지 점검. 메모리 InferenceSession 은
  // 살아있어도 외부에서 Cache Storage 가 삭제될 수 있고, 그 상태로 다음 full reload 가 일어나면
  // 측정용 앱이라는 특성상 부담스러운 ~94MB 재다운로드 freeze 가 발생한다. fire-and-forget —
  // UI 차단 없이 백그라운드 복구. splash 가 처리 중일 때는 splash 가 알아서 채우므로 skip.
  function on_route_change() {
    if (!g_is_model_ready) return
    void ensure_cache_warm(get_active_variant())
  }

  onMount(() => {
    // Flutter WebView 환경에서만 모델 사전 다운로드 splash 노출. 일반 웹은 skip.
    // bridge 감지가 끝나면 env_detected 를 켜고, 일반 웹이면 model_ready 까지 true.
    void (async () => {
      const local_is_flutter = await wait_for_flutter_bridge(300, 100)
      if (!local_is_flutter) g_is_model_ready = true
      g_is_env_detected = true
    })()

    // svelte5-router 의 navigate() 는 history.pushState 를 호출한다. 브라우저 back/forward 는
    // popstate. 세 진입점을 모두 hook 해 모든 SPA navigation 마다 cache 점검을 트리거.
    // history API monkey-patch 는 invasive 한 편이라 cleanup 에서 반드시 원본 복원.
    const orig_push = history.pushState
    const orig_replace = history.replaceState
    history.pushState = function (...args) {
      const r = orig_push.apply(this, args)
      on_route_change()
      return r
    }
    history.replaceState = function (...args) {
      const r = orig_replace.apply(this, args)
      on_route_change()
      return r
    }
    window.addEventListener('popstate', on_route_change)

    return () => {
      history.pushState = orig_push
      history.replaceState = orig_replace
      window.removeEventListener('popstate', on_route_change)
    }
  })

  // 스플래시에서 모델 ready 신호 (다운로드 완료, 건너뛰기)를 수신함. splash 가 cache 를 채우지 못한
  // 케이스 (skip 버튼 / 네트워크 오류) 대비 ready 직후 한 번 더 검증.
  function on_model_ready() {
    g_is_model_ready = true
    void ensure_cache_warm(get_active_variant())
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
