<script>
  import { Camera } from 'lucide-svelte'

  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   */

  /** @type {{
   *   step?: StepConfig | null,
   *   is_capturing?: boolean,
   *   oncapture_click?: (() => void) | undefined,
   * }}
   */
  let { step = null, is_capturing = false, oncapture_click = undefined } = $props()

  // 수동 촬영 버튼 클릭 — 부모로 위임.
  function on_click_capture() {
    oncapture_click?.()
  }
</script>

{#if step}
  <div
    class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
  >
    <div>
      <div class="text-sm font-extrabold text-zinc-950">{step.label}</div>
      <div class="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{step.hint}</div>
    </div>

    {#if step.capture_mode === 'manual'}
      <button
        class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#4B0055] px-4 text-sm font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={is_capturing}
        onclick={on_click_capture}
      >
        <Camera size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>{is_capturing ? '촬영 중' : '촬영'}</span>
      </button>
    {:else}
      <div class="text-xs font-semibold text-slate-500">자동 촬영 준비 중...</div>
      <button
        class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={is_capturing}
        onclick={on_click_capture}
        aria-label="수동으로 촬영하기"
      >
        <Camera size={14} strokeWidth={2.5} aria-hidden="true" />
        <span>수동 촬영</span>
      </button>
    {/if}
  </div>
{/if}
