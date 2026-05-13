<script>
  /** @type {{
   *   value?: string,
   *   onchange?: ((value: string) => void) | undefined,
   * }}
   */
  let { value = '', onchange = undefined } = $props()

  const MAX_LENGTH = 11
  const PREFIX_010 = '010'
  // 디지트 → 이미지 파일 매핑. 디자인이 keypad.png(=1), keypad-1.png(=2) ... 식으로 한 칸씩 밀려서 export 되어 있음.
  const DIGIT_KEY_ARR = [
    { digit: '1', src: '/icons/keypad.png' },
    { digit: '2', src: '/icons/keypad-1.png' },
    { digit: '3', src: '/icons/keypad-2.png' },
    { digit: '4', src: '/icons/keypad-3.png' },
    { digit: '5', src: '/icons/keypad-4.png' },
    { digit: '6', src: '/icons/keypad-5.png' },
    { digit: '7', src: '/icons/keypad-6.png' },
    { digit: '8', src: '/icons/keypad-7.png' },
    { digit: '9', src: '/icons/keypad-8.png' },
  ]
  const PLACEHOLDER = '010 - 1234 - 5678'

  // 한 자리 숫자를 끝에 추가하고 onchange 로 알린다.
  /** @param {string} digit */
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

<!--
  Viewport-fit 모드 — 키패드 전체 사이즈를 svh 기반 clamp 로 자동 스케일.
  버튼 높이/gap/표시 영역 폰트가 viewport 세로에 비례해 작아지므로 좁은 디바이스(예: 537px)
  에서도 잘림 없이 한 화면 fit. 큰 모니터에선 상한 (원본 디자인 값) 까지만 커진다.
-->
<div class="flex w-full flex-col items-center gap-[clamp(10px,2.5svh,28px)]">
  <!-- 표시 영역 -->
  <div class="w-full text-center">
    <p class="mb-1 tracking-wide text-zinc-900 text-[clamp(14px,2.5svh,30px)]">
      휴대폰 번호를 입력해주세요.
    </p>
    <div
      class="flex items-end justify-center border-b-2 border-zinc-800 pb-2 min-h-[clamp(44px,8svh,96px)]"
    >
      {#if value.length === 0}
        <img
          src="/icons/Property 1=Default.png"
          alt={PLACEHOLDER}
          class="w-auto h-[clamp(28px,5.5svh,64px)]"
        />
      {:else}
        <span class="tracking-[0.02em] text-zinc-900 leading-none text-[clamp(28px,5.5svh,64px)]"
          >{g_formatted_value}</span
        >
      {/if}
    </div>
  </div>

  <!--
    키패드 그리드 — 각 버튼은 정사각형에 가까운 비율(4:3) 로 자동 폭/높이 결정.
    grid-cols-3 + w-full + aspect-[4/3] → 버튼 폭은 컬럼 폭 따라가고 높이는 그 75%.
    추가로 max-h 를 svh 로 제한해서 큰 화면에서도 키패드가 너무 커지지 않게.
  -->
  <div class="grid w-full grid-cols-3 gap-[clamp(6px,1.6svh,18px)]">
    {#each DIGIT_KEY_ARR as key_obj (key_obj.digit)}
      <button
        type="button"
        onclick={() => on_click_digit(key_obj.digit)}
        aria-label={`${key_obj.digit} 입력`}
        class="block w-full max-h-[clamp(48px,11svh,112px)] aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all duration-100 hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)] active:translate-y-0.5"
      >
        <img src={key_obj.src} alt={key_obj.digit} class="h-full w-full" />
      </button>
    {/each}

    <!-- 010 빠른 입력 -->
    <button
      type="button"
      onclick={on_click_prefix_010}
      disabled={value.length > 0}
      aria-label="010 입력"
      class="block w-full max-h-[clamp(48px,11svh,112px)] aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border border-[#dbe7ff] bg-[#eef3ff] p-0 shadow-[0_3px_10px_rgba(75,123,236,0.14)] transition-all duration-100 hover:shadow-[0_4px_14px_rgba(75,123,236,0.20)] active:translate-y-0.5 disabled:cursor-not-allowed"
    >
      <img src="/icons/keypad-9.png" alt="010" class="h-full w-full" />
    </button>

    <!-- 0 -->
    <button
      type="button"
      onclick={() => on_click_digit('0')}
      aria-label="0 입력"
      class="block w-full max-h-[clamp(48px,11svh,112px)] aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all duration-100 hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)] active:translate-y-0.5"
    >
      <img src="/icons/keypad-10.png" alt="0" class="h-full w-full" />
    </button>

    <!-- 백스페이스 -->
    <button
      type="button"
      onclick={on_click_backspace}
      aria-label="한 자리 지우기"
      disabled={value.length === 0}
      class="block w-full max-h-[clamp(48px,11svh,112px)] aspect-[16/9] cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all duration-100 hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <img src="/icons/keypad-11.png" alt="" class="h-full w-full" aria-hidden="true" />
    </button>
  </div>
</div>
