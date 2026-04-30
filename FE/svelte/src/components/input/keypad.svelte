<script>
  import { Delete } from 'lucide-svelte'

  /** @type {{
   *   value?: string,
   *   onchange?: ((value: string) => void) | undefined,
   * }}
   */
  let { value = '', onchange = undefined } = $props()

  const MAX_LENGTH = 11
  const PREFIX_010 = '010'
  const DIGIT_ARR = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const PLACEHOLDER = '010 - 1234 - 5678'

  // 한 자리 숫자를 끝에 추가하고 onchange 로 알린다.
  function on_click_digit(digit) {
    if (value.length >= MAX_LENGTH) return
    onchange?.(value + digit)
  }

  // 010 접두를 한 번에 입력. 이미 010 으로 시작하거나 입력값이 있으면 무시.
  function on_click_prefix_010() {
    if (value.length > 0) return
    onchange?.(PREFIX_010)
  }

  // 마지막 한 자리 제거.
  function on_click_backspace() {
    if (value.length === 0) return
    onchange?.(value.slice(0, -1))
  }

  // 입력값을 010 - 1234 - 5678 형식 문자열로 포맷한다.
  let g_formatted_value = $derived.by(() => {
    if (value.length <= 3) return value
    if (value.length <= 7) return `${value.slice(0, 3)} - ${value.slice(3)}`
    return `${value.slice(0, 3)} - ${value.slice(3, 7)} - ${value.slice(7)}`
  })
</script>

<div class="flex w-full max-w-xs flex-col items-center gap-7">
  <!-- 표시 영역 -->
  <div class="w-full text-center">
    <p class="mb-3 text-sm font-bold tracking-wide text-zinc-500">휴대폰 번호를 입력해주세요.</p>
    <div class="border-b border-zinc-300/70 pb-3">
      {#if value.length === 0}
        <span class="text-3xl font-bold tracking-[0.08em] text-zinc-300">{PLACEHOLDER}</span>
      {:else}
        <span class="text-3xl font-bold tracking-[0.08em] text-zinc-900">{g_formatted_value}</span>
      {/if}
    </div>
  </div>

  <!-- 키패드 그리드 -->
  <div class="grid w-full grid-cols-3 gap-3">
    {#each DIGIT_ARR as digit (digit)}
      <button
        type="button"
        onclick={() => on_click_digit(digit)}
        class="h-16 rounded-2xl border border-white/60 bg-white/40 text-2xl font-bold text-zinc-800 shadow-[0_2px_10px_rgba(75,0,85,0.05)] backdrop-blur-md transition-all duration-150 hover:bg-white/70 hover:shadow-[0_4px_14px_rgba(75,0,85,0.08)] active:scale-95 active:bg-white/85"
      >
        {digit}
      </button>
    {/each}

    <!-- 010 빠른 입력 -->
    <button
      type="button"
      onclick={on_click_prefix_010}
      disabled={value.length > 0}
      class="h-16 rounded-2xl border border-[var(--retinal-primary-600)]/30 bg-[#F5EAF7]/50 text-2xl font-bold text-[var(--retinal-primary-600)] shadow-[0_2px_10px_rgba(75,0,85,0.08)] backdrop-blur-md transition-all duration-150 hover:bg-[#F5EAF7]/80 hover:shadow-[0_4px_14px_rgba(75,0,85,0.15)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
    >
      010
    </button>

    <!-- 0 -->
    <button
      type="button"
      onclick={() => on_click_digit('0')}
      class="h-16 rounded-2xl border border-white/60 bg-white/40 text-2xl font-bold text-zinc-800 shadow-[0_2px_10px_rgba(75,0,85,0.05)] backdrop-blur-md transition-all duration-150 hover:bg-white/70 hover:shadow-[0_4px_14px_rgba(75,0,85,0.08)] active:scale-95 active:bg-white/85"
    >
      0
    </button>

    <!-- 백스페이스 -->
    <button
      type="button"
      onclick={on_click_backspace}
      aria-label="한 자리 지우기"
      disabled={value.length === 0}
      class="flex h-16 items-center justify-center rounded-2xl border border-white/60 bg-white/40 text-zinc-600 shadow-[0_2px_10px_rgba(75,0,85,0.05)] backdrop-blur-md transition-all duration-150 hover:bg-white/70 hover:text-zinc-900 hover:shadow-[0_4px_14px_rgba(75,0,85,0.08)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Delete size={22} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </div>
</div>
