<script>
  import { Camera, CircleAlert } from 'lucide-svelte'

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
  <div class="flex flex-col gap-3 mt-2">
    <p
      class="m-0 inline-flex items-center justify-center gap-1.5 text-center text-sm font-bold text-blue-500"
    >
      <span class="inline-block h-1.5 w-1.5 flex-none rounded-full bg-blue-500" aria-hidden="true"
      ></span>
      <span>자동촬영 준비중</span>
    </p>

    <div class="rounded-lg bg-[var(--retina-text-200)] px-3 py-2 text-left">
      <h4
        class="m-0 mb-1 inline-flex items-center gap-1 text-left text-xs font-extrabold text-[var(--retina-text-800)]"
      >
        <CircleAlert size={14} strokeWidth={2.4} aria-hidden="true" />
        <span>촬영 안내 및 주의사항</span>
      </h4>
      <ul
        class="m-0 grid list-disc gap-0 pl-1 text-left text-[10px] font-medium leading-tight text-[var(--retina-text-700)]"
      >
        {step.hint}
        <br />
        얼굴 전체가 화면 가이드 안에 들어와야 합니다.
      </ul>
    </div>

    <button
      class="inline-flex min-h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[var(--retina-text-700)] px-4 text-[11px] font-extrabold text-[var(--retina-text-100)] transition hover:bg-[var(--retina-text-800)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-text-700)]/40 disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      disabled={is_capturing}
      onclick={on_click_capture}
    >
      <Camera size={13} strokeWidth={2.5} aria-hidden="true" />
      <span>{is_capturing ? '촬영 중' : '수동 촬영'}</span>
    </button>

    <p
      class="m-0 mt-0.5 text-center text-[10px] font-medium leading-tight text-[var(--retina-text-500)]"
    >
      자동인식이 어려울 경우 버튼을 눌러주세요
    </p>
  </div>
{/if}
