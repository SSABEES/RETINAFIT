<script>
  import { X } from 'lucide-svelte'

  /**
   * @typedef {object} ConfirmModalProps
   * @property {boolean} [open]
   * @property {string} [title]
   * @property {string} [message]
   * @property {string} [cancelLabel]
   * @property {string} [confirmLabel]
   * @property {(() => void) | undefined} [onclose]
   * @property {(() => void) | undefined} [oncancel]
   * @property {(() => void) | undefined} [onconfirm]
   */

  /** @type {ConfirmModalProps} */
  let {
    open = false,
    title = 'Confirm',
    message = '',
    cancelLabel = 'Cancel',
    confirmLabel = 'Confirm',
    onclose = undefined,
    oncancel = undefined,
    onconfirm = undefined,
  } = $props()

  // 우측 상단 닫기 버튼 클릭 시 현재 화면은 유지한 채 모달만 닫는다.
  function on_click_close() {
    onclose?.()
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5" role="presentation">
    <section
      class="relative w-full max-w-sm rounded-[14px] border border-slate-200 bg-white p-6 text-left shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
      role="dialog"
      aria-modal="true"
    >
      <button
        class="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-slate-500 transition hover:bg-[#FFF6EB] hover:text-[#F97316] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]/30"
        type="button"
        aria-label="모달 닫기"
        onclick={on_click_close}
      >
        <X size={22} strokeWidth={2.4} aria-hidden="true" />
      </button>

      <h2 class="m-0 pr-12 text-xl font-extrabold text-[var(--retina-text)]">{title}</h2>

      {#if message}
        <p class="mt-3 text-sm font-semibold leading-6 text-slate-600">{message}</p>
      {/if}

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button
          class="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white font-extrabold text-slate-400 transition hover:border-slate-400 hover:text-slate-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
          type="button"
          onclick={oncancel}
        >
          {cancelLabel}
        </button>
        <button
          class="min-h-11 cursor-pointer rounded-xl border-0 bg-[#F97316] font-extrabold text-white transition hover:bg-[#EA580C] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]/30"
          type="button"
          onclick={onconfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  </div>
{/if}
