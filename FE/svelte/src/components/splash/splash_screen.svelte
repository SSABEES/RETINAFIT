<script>
  import { onMount } from 'svelte'
  import { preload_sixdrepnet_model } from '@/lib/sixdrepnet360/preload.js'
  import { warm_session_from_bytes } from '@/lib/sixdrepnet360/inference'

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

  /** @type {AbortController | null} */
  let g_abort_controller = null

  // bytes 단위로 하여 읽기 좋게
  function format_bytes(bytes) {
    if (!bytes || bytes <= 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  // 모델 준비 시퀀스. 두 단계로 구성:
  //   1) preload_sixdrepnet_model: 모델 바이트 확보 (Cache Storage hit 면 즉시, miss 면 네트워크)
  //   2) warm_session_from_bytes: ort 가 WASM 그래프 컴파일 + 텐서 메모리 할당 (~0.5-2초)
  //
  // 캐시 hit 사용자도 (1) 은 0초지만 (2) 의 컴파일은 그대로 발생하므로 splash 가 그 시간만큼
  // 잠깐 보이는 게 정상 동작. 컴파일을 splash 가 끝낸 뒤 onready 를 쏘는 이유는, 첫 추론
  // 호출(predict_pose)이 컴파일 대기 없이 즉시 결과를 내도록 보장하기 위함. splash 를 더
  // 빨리 닫고 백그라운드 컴파일하는 패턴도 가능하나, 그러면 첫 추론에서 동일 시간 freeze 가
  // 옮겨갈 뿐이라 UX 이득 없음 — 명시적 splash 로 대기 컨텍스트를 제공하는 쪽이 명료.
  //
  // 실패 시 에러 노출 → 사용자가 재시도/건너뛰기 선택 가능.
  async function start_preload() {
    g_error_message = null
    g_progress_ratio = 0
    g_received_bytes = 0
    g_total_bytes = 0

    g_abort_controller = new AbortController()
    const local_signal = g_abort_controller.signal

    try {
      const local_bytes = await preload_sixdrepnet_model(
        variant,
        (progress_obj) => {
          g_progress_ratio = progress_obj.ratio
          g_received_bytes = progress_obj.received
          g_total_bytes = progress_obj.total
        },
        local_signal,
      )

      if (local_signal.aborted) return

      // 컴파일 단계 — 캐시 hit/miss 무관하게 항상 발생하며 splash 가 시각적으로 머무는 주된 이유.
      await warm_session_from_bytes(variant, local_bytes)

      if (local_signal.aborted) return
      onready?.()
    } catch (local_error) {
      if (local_signal.aborted) return
      g_error_message =
        local_error instanceof Error ? local_error.message : 'AI 모델 준비 중 오류가 발생했습니다.'
    }
  }

  // 진행 중 fetch 를 중단 후 다시 시도 (개발환경이라 혹시 모델이 없더라도 진행할 수 있도록 -> 나중에 삭제해야함)
  function on_click_retry() {
    if (g_abort_controller) g_abort_controller.abort()
    void start_preload()
  }

  // 다운로드를 건너뛰고 그대로 진행
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
        <p class="m-0 text-sm font-bold text-[var(--retina-text-700)]">AI 모델 준비 중...</p>

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
