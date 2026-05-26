<script>
  // 워밍 자체는 model_warming.svelte.js 가 App.svelte 진입 직후 백그라운드로 시작.
  // 본 컴포넌트는 그 상태를 구독해 다운로드 중일 때만 UI 노출.
  import { warming_state, retry_warming, dismiss_warming_ui } from '@/lib/model_warming.svelte.js'

  /**
   * @type {{
   *   onready?: () => void,   // 사용자가 skip 버튼 누르거나 다운로드가 끝났을 때 호출 (호환용)
   * }}
   */
  let { onready } = $props()

  function format_bytes(bytes) {
    if (!bytes || bytes <= 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  function on_click_retry() {
    void retry_warming()
  }

  // skip — 다운로드 UI 만 닫고 백그라운드 워밍은 계속. 호출처(App.svelte) 는 is_ready 별도로 감시.
  function on_click_skip() {
    dismiss_warming_ui()
    onready?.()
  }

  const g_progress_percent = $derived(Math.round(warming_state.download_progress.ratio * 100))
</script>

<div
  class="fixed inset-0 z-50 grid h-svh w-svw place-items-center bg-[var(--retina-bg-1)] text-[var(--retina-text)]"
  role="status"
  aria-live="polite"
  aria-label="AI 모델 준비 중"
>
  <div class="flex w-full max-w-[420px] flex-col items-center gap-8 px-8 text-center">
    <img
      class="h-auto w-[220px] select-none"
      src="/logo/LogoHeight.png"
      alt="RetinaFit"
      draggable="false"
    />

    {#if warming_state.error_message}
      <div class="flex w-full flex-col items-center gap-4">
        <p class="m-0 text-sm font-bold text-[var(--retina-text-700)]">
          AI 모델을 불러오지 못했습니다
        </p>
        <p class="m-0 text-xs font-medium text-[var(--retina-text-500)]">
          {warming_state.error_message}
        </p>
        <div class="flex gap-3">
          <button
            type="button"
            class="min-h-11 cursor-pointer rounded-lg border-0 bg-[var(--retina-primary-600)] px-5 text-sm font-bold text-white transition hover:bg-[var(--retina-primary-700)]"
            onclick={on_click_retry}
          >
            재시도
          </button>
          <button
            type="button"
            class="min-h-11 cursor-pointer rounded-lg border border-[var(--retina-text-300)] bg-white px-5 text-sm font-bold text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)]"
            onclick={on_click_skip}
          >
            건너뛰기
          </button>
        </div>
      </div>
    {:else}
      <div class="flex w-full flex-col items-center gap-3">
        <p class="m-0 text-sm font-bold text-[var(--retina-text-700)]">
          {warming_state.stage_label}
        </p>

        <div
          class="h-2 w-full overflow-hidden rounded-full bg-[var(--retina-text-200)]"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={g_progress_percent}
        >
          <div
            class="h-full rounded-full bg-[var(--retina-primary-400)] transition-[width] duration-200 ease-out"
            style="width: {g_progress_percent}%"
          ></div>
        </div>

        <p class="m-0 text-xs font-medium text-[var(--retina-text-500)] tabular-nums">
          {g_progress_percent}% · {format_bytes(warming_state.download_progress.received)} / {format_bytes(
            warming_state.download_progress.total,
          )}
        </p>
        <p class="m-0 text-[11px] font-medium text-[var(--retina-text-400)]">
          최초 실행 시 약 1분 정도 소요될 수 있습니다
        </p>
      </div>
    {/if}
  </div>
</div>
