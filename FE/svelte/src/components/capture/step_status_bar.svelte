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
  <section class="flex flex-col gap-3">
    <div
      class="text-[11px] tracking-[0.22em] uppercase italic"
      style="font-family: var(--font-serif); color: var(--cp-graphite);"
    >
      Current
    </div>

    <div class="text-[15px] font-bold leading-tight" style="color: var(--cp-ink);">
      {step.label}
    </div>
    <div class="text-xs leading-relaxed" style="color: var(--cp-graphite);">
      {step.hint}
    </div>

    <div class="mt-1 h-px w-full" style="background: var(--cp-rule);" aria-hidden="true"></div>

    {#if step.capture_mode === 'manual'}
      <button
        class="mt-1 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border-0 px-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--cp-plum)]/30 disabled:cursor-not-allowed disabled:opacity-50"
        style="font-family: var(--font-serif); background: var(--cp-plum);"
        type="button"
        disabled={is_capturing}
        onclick={on_click_capture}
      >
        <Camera size={14} strokeWidth={2} aria-hidden="true" />
        <span>{is_capturing ? 'Capturing' : 'Shutter'}</span>
      </button>
    {:else}
      <div
        class="text-[10px] tracking-[0.2em] uppercase"
        style="font-family: var(--font-mono); color: var(--cp-graphite);"
      >
        Auto · Waiting
      </div>
      <button
        class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border bg-transparent px-4 text-[12px] font-medium uppercase tracking-[0.2em] transition hover:bg-[color:var(--cp-paper)] focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        style="font-family: var(--font-serif); border-color: var(--cp-graphite); color: var(--cp-ink);"
        type="button"
        disabled={is_capturing}
        onclick={on_click_capture}
        aria-label="수동으로 촬영하기"
      >
        <Camera size={12} strokeWidth={2} aria-hidden="true" />
        <span>Manual</span>
      </button>
    {/if}
  </section>
{/if}
