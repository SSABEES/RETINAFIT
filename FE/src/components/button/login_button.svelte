<script>
  /** @type {{
   *   type?: 'button' | 'submit' | 'reset',
   *   disabled?: boolean,
   *   label?: string,
   *   onclick?: ((event: MouseEvent) => void) | undefined,
   * }}
   */
  let { type = 'button', disabled = false, label = 'Login', onclick = undefined } = $props()
</script>

<button
  class="min-h-12 w-full cursor-pointer rounded-lg border-0 bg-violet-600 text-base font-bold text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-600/25 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30 disabled:cursor-not-allowed disabled:opacity-60"
  {type}
  {disabled}
  {onclick}
>
  {label}
</button>
