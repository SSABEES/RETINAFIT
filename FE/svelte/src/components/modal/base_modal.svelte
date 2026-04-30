<script>
  /** @type {{
   *   open?: boolean,
   *   title?: string,
   *   message?: string,
   *   closeLabel?: string,
   *   onclose?: (() => void) | undefined,
   * }}
   */
  let {
    open = false,
    title = 'Modal',
    message = '',
    closeLabel = 'Close',
    onclose = undefined,
  } = $props()
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5" role="presentation">
    <div
      class="w-full max-w-sm rounded-lg bg-white p-6 text-left shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="base-modal-title"
    >
      <h2 id="base-modal-title" class="m-0 text-xl font-bold text-zinc-950">{title}</h2>
      {#if message}
        <p class="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
      {/if}
      <button
        class="mt-6 min-h-11 w-full rounded-lg bg-violet-600 px-4 font-bold text-white transition hover:bg-violet-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30"
        type="button"
        onclick={onclose}
      >
        {closeLabel}
      </button>
    </div>
  </div>
{/if}
