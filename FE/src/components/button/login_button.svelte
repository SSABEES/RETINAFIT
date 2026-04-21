<script>
  import { LogIn } from 'lucide-svelte'

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
  class="min-h-14 w-full cursor-pointer rounded-xl border-0 bg-[#9A1BFF] text-lg font-bold text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-[#8A12EF] hover:shadow-lg hover:shadow-violet-600/25 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30 disabled:cursor-not-allowed disabled:opacity-60"
  {type}
  {disabled}
  {onclick}
>
  <span class="inline-flex items-center justify-center gap-2">
    <!-- 장식용 로그인 아이콘이므로 스크린 리더에는 텍스트 라벨만 전달한다. -->
    <LogIn size={22} strokeWidth={2.4} aria-hidden="true" />
    <span>{label}</span>
  </span>
</button>
