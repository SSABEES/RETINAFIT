<script>
  import { onMount } from 'svelte'
  import { preload_sixdrepnet_model } from '@/lib/sixdrepnet360/preload.js'

  /**
   * @type {{
   *   variant?: 'fp32' | 'dynamic' | 'static',
   *   onready?: () => void,
   * }}
   */
  let { variant = 'fp32', onready } = $props()

  let g_progress_ratio = $state(0)
  let g_received_bytes = $state(0)
  let g_total_bytes = $state(0)
  let g_error_message = $state(/** @type {string | null} */ (null))
  let g_attempt_no = $state(0)

  /** @type {AbortController | null} */
  let g_abort_controller = null

  // bytes 를 사람이 읽기 좋은 단위로 포맷한다.
  function format_bytes(bytes) {
    if (!bytes || bytes <= 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  // 모델 다운로드를 시작한다. 실패 시 에러 메시지를 노출하고 사용자가 재시도 버튼을 눌러야 다시 시도한다.
  async function start_preload() {
    g_error_message = null
    g_progress_ratio = 0
    g_received_bytes = 0
    g_total_bytes = 0

    g_abort_controller = new AbortController()
    const local_signal = g_abort_controller.signal

    try {
      await preload_sixdrepnet_model(
        variant,
        (progress_obj) => {
          g_progress_ratio = progress_obj.ratio
          g_received_bytes = progress_obj.received
          g_total_bytes = progress_obj.total
        },
        local_signal,
      )

      if (local_signal.aborted) return
      onready?.()
    } catch (local_error) {
      if (local_signal.aborted) return
      g_error_message =
        local_error instanceof Error ? local_error.message : 'AI 모델 준비 중 오류가 발생했습니다.'
    }
  }

  // 재시도 버튼 핸들러. 진행 중인 fetch 를 중단하고 다시 시작한다.
  function on_click_retry() {
    if (g_abort_controller) g_abort_controller.abort()
    g_attempt_no += 1
    void start_preload()
  }

  // 사용자가 다운로드를 건너뛰고 그대로 진행하도록 한다 (개발용 fallback).
  function on_click_skip() {
    if (g_abort_controller) g_abort_controller.abort()
    onready?.()
  }

  onMount(() => {
    void start_preload()

    return () => {
      if (g_abort_controller) g_abort_controller.abort()
    }
  })

  // 진행률을 정수 퍼센트로 표기.
  let g_progress_percent = $derived(Math.round(g_progress_ratio * 100))
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

    {#if g_error_message}
      <div class="flex w-full flex-col items-center gap-4">
        <p class="m-0 text-sm font-bold text-[var(--retina-text-700)]">
          AI 모델을 불러오지 못했습니다
        </p>
        <p class="m-0 text-xs font-medium text-[var(--retina-text-500)]">
          {g_error_message}
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
          AI 모델 준비 중...
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
          {g_progress_percent}% · {format_bytes(g_received_bytes)} / {format_bytes(g_total_bytes)}
        </p>
        <p class="m-0 text-[11px] font-medium text-[var(--retina-text-400)]">
          최초 실행 시 약 1분 정도 소요될 수 있습니다
        </p>
      </div>
    {/if}
  </div>
</div>
