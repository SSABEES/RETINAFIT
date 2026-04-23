<script>
  /** @type {{
   *   id?: string,
   *   label?: string,
   *   type?: string,
   *   value?: string,
   *   placeholder?: string,
   *   disabled?: boolean,
   *   required?: boolean,
   *   oninput?: ((event: Event) => void) | undefined,
   * }}
   */
  let {
    id = 'auth-input',
    label = 'Input',
    type = 'text',
    value = '',
    placeholder = '',
    disabled = false,
    required = false,
    oninput = undefined,
  } = $props()
</script>

<label class="grid gap-2 text-left text-sm font-semibold text-zinc-800" for={id}>
  {label}
  <input
    class="min-h-12 rounded-lg border border-zinc-200 bg-white px-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-600/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
    {id}
    {type}
    {value}
    {placeholder}
    {disabled}
    {required}
    {oninput}
  />
</label>
