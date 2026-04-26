<script>
  /**
   * @typedef {import('@/lib/capture/step_config.js').GlassesMode} GlassesMode
   */

  /** @type {{
   *   open?: boolean,
   *   onselect?: ((mode: GlassesMode) => void) | undefined,
   * }}
   */
  let { open = false, onselect = undefined } = $props()

  // 안경 착용 고객에 대해 6스텝 플로우로 진입한다.
  function on_click_with_glasses() {
    onselect?.('with_glasses')
  }

  // 안경 미착용 고객에 대해 3스텝 플로우로 진입한다.
  function on_click_no_glasses() {
    onselect?.('no_glasses')
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5"
    role="presentation"
    onkeydown={(e) => e.key === 'Escape' && e.preventDefault()}
  >
    <div
      class="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-black/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glasses-mode-title"
      tabindex="-1"
    >
      <header class="bg-[var(--retinal-primary-700)] px-7 py-5 text-white">
        <h2 id="glasses-mode-title" class="m-0 text-2xl font-extrabold">얼굴 분석 시작</h2>
        <p class="m-0 mt-1 text-sm font-medium text-white/80">
          고객의 안경 착용 상태를 선택해 주세요
        </p>
      </header>

      <div class="grid gap-3 px-7 py-6">
        <button
          class="min-h-16 cursor-pointer rounded-xl border-2 border-[var(--retinal-primary-700)]/20 bg-white px-5 text-left transition hover:border-[var(--retinal-primary-700)] hover:bg-[var(--retinal-soft-purple)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-accent)]/30"
          type="button"
          onclick={on_click_with_glasses}
        >
          <div class="text-lg font-extrabold text-zinc-950">안경 착용 중</div>
          <div class="mt-0.5 text-sm font-semibold text-slate-500">
            안경 착용/미착용 각각 3장씩 총 6장 촬영
          </div>
        </button>

        <button
          class="min-h-16 cursor-pointer rounded-xl border-2 border-[var(--retinal-primary-700)]/20 bg-white px-5 text-left transition hover:border-[var(--retinal-primary-700)] hover:bg-[var(--retinal-soft-purple)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-accent)]/30"
          type="button"
          onclick={on_click_no_glasses}
        >
          <div class="text-lg font-extrabold text-zinc-950">미착용</div>
          <div class="mt-0.5 text-sm font-semibold text-slate-500">
            미착용 3장만 촬영
          </div>
        </button>
      </div>
    </div>
  </div>
{/if}
