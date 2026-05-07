<script>
  import { onMount } from 'svelte'
  import { Route, Router } from '@maks11060/svelte5-router'
  import { routes } from '@/config/routes'
  import GlobalToast from '@/components/toast/global_toast.svelte'
  import SplashScreen from '@/components/splash/splash_screen.svelte'
  import { wait_for_flutter_bridge } from '@/lib/flutter/bridge'

  let url = ''
  /** @type {HTMLDivElement | undefined} */
  let ref_shell_el
  /** @type {HTMLDivElement | undefined} */
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

  // onMount 콜백은 sync cleanup 함수만 반환 가능 — async 함수가 cleanup 을 Promise 로
  // 감싸 반환하면 타입 에러가 난다. 비동기 작업(Flutter 브리지 감지) 은 fire-and-forget IIFE 로
  // 분리하고 cleanup 은 동기로 즉시 등록한다.
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

    // Flutter WebView 환경에서만 모델 사전 다운로드 splash 노출. 일반 웹은 skip.
    void (async () => {
      const local_is_flutter = await wait_for_flutter_bridge(300, 100)
      if (!local_is_flutter) g_is_model_ready = true
      g_is_env_detected = true
    })()

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
