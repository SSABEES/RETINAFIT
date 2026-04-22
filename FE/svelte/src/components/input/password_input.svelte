<script>
  /** @type {{
   *   id?: string,
   *   label?: string,
   *   value?: string,
   *   placeholder?: string,
   *   variant?: 'light' | 'dark',
   *   autocomplete?: string,
   *   oninput?: ((event: Event) => void) | undefined,
   * }}
   */
  let {
    id = 'password',
    label = 'Password',
    value = '',
    placeholder = '',
    variant = 'light',
    autocomplete = 'current-password',
    oninput = undefined,
  } = $props()
</script>

<label
  class={`grid gap-3 text-left text-base font-bold ${variant === 'dark' ? 'text-white/82' : 'text-zinc-800'}`}
  for={id}
>
  {label}
  <!-- dark variant는 로그인 카드의 반투명 입력창 스타일에 맞춘다. -->
  <input
    class={`min-h-14 rounded-xl px-5 text-lg outline-none transition ${variant === 'dark' ? 'border border-white/12 bg-white/12 text-white placeholder:text-white/36 focus:border-white/30 focus:ring-3 focus:ring-white/10' : 'border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-600/15'}`}
    {id}
    type="password"
    {autocomplete}
    {value}
    {placeholder}
    {oninput}
  />
</label>
