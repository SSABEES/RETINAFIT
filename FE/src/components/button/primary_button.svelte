<script>
  /** @type {{
   *   type?: 'button' | 'submit' | 'reset',
   *   label?: string,
   *   disabled?: boolean,
   *   onclick?: ((event: MouseEvent) => void) | undefined,
   * }}
   */
  let {
    type = 'button',
    label = 'Button',
    disabled = false,
    onclick = undefined,
  } = $props()
</script>

<button
  class="min-h-12 rounded-lg bg-violet-600 px-5 text-base font-bold text-white transition hover:bg-violet-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30 disabled:cursor-not-allowed disabled:opacity-60"
  {type}
  {disabled}
  {onclick}
>
  {label}
</button>
