<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { ensure_cache_warm } from '@/lib/sixdrepnet360/preload'
  import { get_active_variant } from '@/lib/sixdrepnet360/inference'
  import { ensure_blaze_face_cache_warm } from '@/lib/mediapipe/blaze_face_cache'
  import { BLAZE_FACE_MODEL_URL } from '@/lib/mediapipe/face_detector'
  import { warming_state, start_warming } from '@/lib/model_warming.svelte.js'

  let url = ''

  // splash 를 노출하지 않을 라우트 — 현재는 모든 라우트 허용 (다운로드 중이면 어디서든 노출).
  // 만약 특정 페이지에서 splash 를 가리고 싶으면 이 Set 에 PATH.* 를 추가하면 됨.
  const SPLASH_SKIP_PATH_SET = new Set()

  // 현재 라우트 경로 (reactive) — on_route_change 에서 갱신. SSR 환경 가드는 typeof window 로.
  let g_current_path = $state(
    typeof window !== 'undefined' ? window.location.pathname : '',
  )

  // splash 가 보이는 조건:
  //   1) 백그라운드 워밍이 cache miss 라 실제 네트워크 다운로드 중일 때 (is_downloading)
  //      또는 에러 발생해서 사용자에게 retry 옵션을 제공해야 할 때 (error_message)
  //   2) AI 모델을 쓰는 라우트에 있을 때 (skip 리스트 외)
  // 컴파일 / 검출기 init 은 백그라운드 — splash 표시 안 함.
  const g_should_show_splash = $derived(
    (warming_state.is_downloading || warming_state.error_message !== null) &&
      !SPLASH_SKIP_PATH_SET.has(g_current_path),
  )

  // 라우터 이동 시점에 모델 Cache Storage 가 비어있지 않은지 점검. 메모리 InferenceSession 은
  // 살아있어도 외부에서 Cache Storage 가 삭제될 수 있고, 그 상태로 다음 full reload 가 일어나면
  // 측정용 앱이라는 특성상 부담스러운 ~94MB 재다운로드 freeze 가 발생한다. fire-and-forget —
  // UI 차단 없이 백그라운드 복구. 워밍이 진행 중이면 어차피 워밍이 채우므로 skip.
  function on_route_change() {
    // 현재 경로 갱신 — splash 노출 조건이 라우트별로 갈리므로 navigate / popstate 마다 sync.
    if (typeof window !== 'undefined') g_current_path = window.location.pathname
    if (!warming_state.is_ready) return
    void ensure_cache_warm(get_active_variant())
    void ensure_blaze_face_cache_warm(BLAZE_FACE_MODEL_URL)
  }

  onMount(() => {
    // 앱 진입 즉시 워밍 백그라운드로 시작. cache miss 일 때만 splash 가 자동으로 떠 progress 노출,
    // 그 외 (cache hit, 컴파일, 검출기 init) 는 모두 화면 표시 없이 진행되므로 일반적으론 splash
    // 자체가 안 뜬다.
    void start_warming()

    // svelte5-router 의 navigate() 는 history.pushState 를 호출한다. 브라우저 back/forward 는
    // popstate. 세 진입점을 모두 hook 해 모든 SPA navigation 마다 cache 점검 + 경로 sync 를 트리거.
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
</script>

<div class="app-root">
  <Router {url}>
    {#each routes as route (route.path)}
      <Route path={route.path} component={route.component} />
    {/each}
  </Router>
</div>

<GlobalToast />

{#if g_should_show_splash}
  <!-- onready 는 splash skip 버튼 호환용 — 워밍 자체는 model_warming 모듈이 백그라운드로 끝까지 진행. -->
  <SplashScreen onready={() => {}} />
{/if}
