<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, LogOut } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import { clear_visit_session_data } from '@/lib/stores/customer'
  import { reset as reset_capture_session } from '@/lib/stores/capture_session.svelte.js'

  /** @type {{
   *   onback?: (() => void) | undefined,
   *   onlogout?: (() => void) | undefined,
   *   show_back?: boolean,
   *   show_logout?: boolean,
   * }} */
  let { onback = undefined, onlogout = undefined, show_back = true, show_logout = true } = $props()

  // 기본 뒤로가기: 브라우저 히스토리를 거슬러 올라간다.
  // onback prop이 주어지면 그 동작을 우선 사용한다.
  function handle_back_click() {
    if (onback) {
      onback()
      return
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
  }

  // 기본 로그아웃: 토큰/자동 로그인/로그인 선택 상태 + 방문/캡쳐 세션을 모두 비우고 로그인 화면으로 이동.
  // capture_session 과 visit 데이터까지 비워 두지 않으면, SPA 인 특성상 모듈 상태가 살아남아 다음 로그인 사용자에게
  // 이전 사용자의 review phase 가 그대로 노출돼 얼굴 분석을 건너뛰고 report 로 튕기는 버그가 발생한다.
  // onlogout prop이 주어지면 그 동작을 우선 사용한다.
  function handle_logout_click() {
    if (onlogout) {
      onlogout()
      return
    }

    reset_capture_session()
    clear_visit_session_data()
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  // 로고 클릭 — "강력 새로고침" 기능. 진행 중이던 캡쳐/방문 세션, 분석 관련 sessionStorage,
  // SW/정적 자산 Cache Storage 까지 비운 뒤 visit_select 로 풀 페이지 리로드. window.location.href 를
  // 써서 SPA 가 아닌 브라우저 단 전체 리로드를 일으켜 모듈 메모리도 함께 초기화한다.
  // auth 토큰은 유지 — 로그아웃이 아니라 "방문 선택으로 다시 가기" 동선.
  // AI 모델 (94MB ONNX) 캐시 (sixdrepnet360-models-v1) 만 보존해 매 클릭마다 모델 재다운로드 회피.
  async function handle_logo_click() {
    reset_capture_session()
    clear_visit_session_data()

    // 분석 흐름의 잔여 sessionStorage 키. clear_visit_session_data 가 일부 처리하지만 명시 정리.
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('retinal_visit_no')
      sessionStorage.removeItem('retinal_lens_selections')
      sessionStorage.removeItem('retinal_saved_fittings')
    }

    // Cache Storage — AI 모델 캐시는 제외하고 나머지만 삭제.
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const local_cache_keys = await caches.keys()
        await Promise.all(
          local_cache_keys
            .filter((local_key) => local_key !== 'sixdrepnet360-models-v1')
            .map((local_key) => caches.delete(local_key)),
        )
      } catch {
        // best-effort — 캐시 삭제 실패해도 다음 단계 진행.
      }
    }

    window.location.href = PATH.visitSelect
  }
</script>

<!--
  position: fixed + .app-edge-extend → .app-frame 좌우 빈 공간까지 viewport 끝까지 확장.
  .app-edge-extend 의 left/right 가 JS 로 갱신되는 --app-frame-edge-extend 변수를 negative 로 사용.
-->
<header
  class="app-edge-extend fixed top-0 z-30 grid h-[52px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-[var(--retina-surface)] px-6"
>
  <div class="flex justify-start">
    {#if show_back}
      <button
        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        type="button"
        aria-label="뒤로가기"
        onclick={handle_back_click}
      >
        <ArrowLeft size={24} strokeWidth={2.2} aria-hidden="true" />
      </button>
    {:else}
      <span class="h-8 w-8" aria-hidden="true"></span>
    {/if}
  </div>

  <button
    type="button"
    class="grid h-8 cursor-pointer place-items-center border-0 bg-transparent p-0"
    aria-label="홈으로 (캐시/세션 초기화)"
    onclick={handle_logo_click}
  >
    <img class="h-6 w-auto" src="/logo/LogoWide_2.png" alt="Retina Fit" width="240" height="52" />
  </button>

  <div class="flex justify-end">
    {#if show_logout}
      <button
        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        type="button"
        aria-label="로그아웃"
        onclick={handle_logout_click}
      >
        <LogOut size={22} strokeWidth={2.2} aria-hidden="true" />
      </button>
    {:else}
      <span class="h-8 w-8" aria-hidden="true"></span>
    {/if}
  </div>
</header>
