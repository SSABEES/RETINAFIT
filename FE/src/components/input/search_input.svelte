<script>
  /** @type {{
   *   value?: string,
   *   placeholder?: string,
   *   oninput?: ((event: Event) => void) | undefined,
   * }}
   */
  let {
    value = '',
    placeholder = 'Search',
    oninput = undefined,
  } = $props()
</script>

<label class="relative block text-left">
  <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">⌕</span>
  <input
    class="min-h-12 w-full rounded-lg border border-zinc-200 bg-white pl-11 pr-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-600/15"
    type="search"
    {value}
    {placeholder}
    {oninput}
  />
</label>
