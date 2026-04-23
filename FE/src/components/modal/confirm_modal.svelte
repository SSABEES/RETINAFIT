<script>
  /** @type {{
   *   open?: boolean,
   *   title?: string,
   *   message?: string,
   *   cancelLabel?: string,
   *   confirmLabel?: string,
   *   oncancel?: (() => void) | undefined,
   *   onconfirm?: (() => void) | undefined,
   * }}
   */
  let {
    open = false,
    title = 'Confirm',
    message = '',
    cancelLabel = 'Cancel',
    confirmLabel = 'Confirm',
    oncancel = undefined,
    onconfirm = undefined,
  } = $props()
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5" role="presentation">
    <section class="w-full max-w-sm rounded-lg bg-white p-6 text-left shadow-xl" role="dialog" aria-modal="true">
      <h2 class="m-0 text-xl font-bold text-zinc-950">{title}</h2>
      {#if message}
        <p class="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
      {/if}
      <div class="mt-6 grid grid-cols-2 gap-3">
        <button class="min-h-11 rounded-lg border border-zinc-200 bg-white font-bold text-zinc-800" type="button" onclick={oncancel}>
          {cancelLabel}
        </button>
        <button class="min-h-11 rounded-lg bg-violet-600 font-bold text-white" type="button" onclick={onconfirm}>
          {confirmLabel}
        </button>
      </div>
    </section>
  </div>
{/if}
