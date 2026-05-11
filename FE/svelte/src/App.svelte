<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { ensure_cache_warm } from '@/lib/sixdrepnet360/preload'
  import { get_active_variant } from '@/lib/sixdrepnet360/inference'

  let url = ''
  /** @type {HTMLDivElement | undefined} */
  let ref_shell_el
  /** @type {HTMLDivElement | undefined} */
  let ref_content_el
  let g_is_model_ready = $state(false)

  // 현재 페이지 main 의 배경색을 외곽 부분에 자동 동기화
  function sync_shell_bg() {
    if (!ref_shell_el || !ref_content_el) return

    const local_main_el = ref_content_el.querySelector('main.app-frame-page')
    if (!local_main_el) return

    const local_bg = window.getComputedStyle(local_main_el).backgroundColor
    if (local_bg) ref_shell_el.style.background = local_bg
  }

  // 1024×768 베이스 레이아웃을 viewport 에 맞게 균일 스케일.
  // scale = min(vw/1024, vh/768) — 작은 viewport 에선 축소, 큰 viewport 에선 확대.
  // edge-extend 변수는 좌우/하단 viewport 끝까지 배경 확장에 쓰는 negative offset.
  function update_app_frame_scale() {
    const local_w = window.innerWidth
    const local_h = window.innerHeight
    const local_scale = Math.min(local_w / 1024, local_h / 768)
    document.documentElement.style.setProperty('--app-frame-scale', String(local_scale))

    const local_edge_extend_px = Math.max(0, (local_w / local_scale - 1024) / 2)
    document.documentElement.style.setProperty(
      '--app-frame-edge-extend',
      `${local_edge_extend_px}px`,
    )

    const local_edge_extend_y_px = Math.max(0, (local_h / local_scale - 768) / 2)
    document.documentElement.style.setProperty(
      '--app-frame-edge-extend-y',
      `${local_edge_extend_y_px}px`,
    )
  }

  // 라우터 이동 시점에 모델 Cache Storage 가 비어있지 않은지 점검. 메모리 InferenceSession 은
  // 살아있어도 외부에서 Cache Storage 가 삭제될 수 있고, 그 상태로 다음 full reload 가 일어나면
  // 측정용 앱이라는 특성상 부담스러운 ~94MB 재다운로드 freeze 가 발생한다. fire-and-forget —
  // UI 차단 없이 백그라운드 복구. splash 가 처리 중일 때는 splash 가 알아서 채우므로 skip.
  function on_route_change() {
    if (!g_is_model_ready) return
    void ensure_cache_warm(get_active_variant())
  }

  onMount(() => {
    // bind:this 가 채워지지 않은 비정상 상황 방어. 정상 경로에선 onMount 시점에 ref 가 모두 잡혀있다.
    if (!ref_content_el) return

    // childList 만으로는 라우트 전환 시 Router 내부에서 일어나는 main 교체/class 변경을 못 잡아
    // 페이지 bg 가 dark navy(.app-frame-shell 기본값) 그대로 남아 위아래 빈 공간이 어색해진다.
    // subtree + attributes(class 만) 로 늘려 main.app-frame-page 가 마운트/리클래스될 때마다 동기화.
    const local_observer = new MutationObserver(sync_shell_bg)
    local_observer.observe(ref_content_el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    sync_shell_bg()

    update_app_frame_scale()
    window.addEventListener('resize', update_app_frame_scale)

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
      local_observer.disconnect()
      window.removeEventListener('resize', update_app_frame_scale)
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

{#if !g_is_model_ready}
  <SplashScreen onready={on_model_ready} />
{/if}
