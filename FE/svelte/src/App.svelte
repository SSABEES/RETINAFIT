<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
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
    // Flutter / 일반 웹 모두 splash 를 항상 띄워 메모리 워밍을 마친 뒤 앱 진입하도록 통일.
    // 모델 바이트는 Cache Storage 에 영구 보존돼 첫 진입 이후 다운로드 0이지만, (a) ort 의 WASM
    // 그래프 컴파일 + 텐서 할당 (b) MediaPipe BlazeFace 검출기 인스턴스 생성은 메모리 상태라
    // 페이지 reload 마다 다시 일어나야 한다. 이걸 splash 가 끝낸 뒤 닫히도록 한다.
    // (이전엔 web + cache hit 시 splash 를 skip 해서 측면 캡처 진입 시점에 처음 컴파일/검출기
    //  init 이 일어나 multi-second freeze 가 발생했음.)
    g_is_env_detected = true

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
