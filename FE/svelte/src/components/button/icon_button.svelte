<script>
  /** @type {{
   *   label?: string,
   *   icon?: string,
   *   disabled?: boolean,
   *   onclick?: ((event: MouseEvent) => void) | undefined,
   * }}
   */
  let { label = 'Button', icon = '+', disabled = false, onclick = undefined } = $props()
</script>

<button
  class="inline-grid size-11 place-items-center rounded-lg border border-zinc-200 bg-white text-lg font-bold text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30 disabled:cursor-not-allowed disabled:opacity-60"
  type="button"
  aria-label={label}
  {disabled}
  {onclick}
>
  {icon}
</button>
