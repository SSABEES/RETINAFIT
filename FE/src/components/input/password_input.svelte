<script>
  /** @type {{
   *   id?: string,
   *   label?: string,
   *   value?: string,
   *   placeholder?: string,
   *   oninput?: ((event: Event) => void) | undefined,
   * }}
   */
  let {
    id = 'password',
    label = 'Password',
    value = '',
    placeholder = '',
    oninput = undefined,
  } = $props()
</script>

<label class="grid gap-2 text-left text-sm font-semibold text-zinc-800" for={id}>
  {label}
  <input
    class="min-h-12 rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-600/15"
    {id}
    type="password"
    autocomplete="current-password"
    {value}
    {placeholder}
    {oninput}
  />
</label>
