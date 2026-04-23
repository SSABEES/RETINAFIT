<script>
  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   */

  /** @type {{
   *   steps_arr?: StepConfig[],
   *   current_index?: number,
   * }}
   */
  let { steps_arr = [], current_index = 0 } = $props()

  /**
   * 스텝 상태(완료/진행중/대기)에 따른 tick 스타일 문자열을 반환한다.
   * @param {boolean} is_done
   * @param {boolean} is_current
   * @returns {string}
   */
  function tick_style(is_done, is_current) {
    if (is_current) return 'background: var(--cp-plum); border-color: var(--cp-plum);'
    if (is_done) return 'background: var(--cp-done); border-color: var(--cp-done);'
    return 'background: #ffffff; border-color: var(--cp-graphite);'
  }

  /**
   * 스텝 상태에 따른 번호(mono) 색상을 반환한다.
   * @param {boolean} is_done
   * @param {boolean} is_current
   * @returns {string}
   */
  function num_color(is_done, is_current) {
    if (is_current) return 'var(--cp-plum)'
    if (is_done) return 'var(--cp-done)'
    return 'var(--cp-graphite)'
  }

  /**
   * 스텝 상태에 따른 라벨 색상/굵기를 반환한다.
   * @param {boolean} is_done
   * @param {boolean} is_current
   * @returns {string}
   */
  function label_style(is_done, is_current) {
    if (is_current) return 'color: var(--cp-ink); font-weight: 700;'
    if (is_done) return 'color: var(--cp-graphite); font-weight: 500;'
    return 'color: var(--cp-graphite); font-weight: 500;'
  }
</script>

<nav class="flex flex-col" aria-label="촬영 진행도">
  <div
    class="mb-4 text-[11px] tracking-[0.22em] uppercase italic"
    style="font-family: var(--font-serif); color: var(--cp-graphite);"
  >
    Steps
  </div>

  <ol class="relative flex flex-col">
    <!-- 세로 룰: 첫 tick 중심부터 마지막 tick 중심까지 얇은 선. -->
    <span
      class="pointer-events-none absolute left-[9px] top-3 bottom-3 w-px"
      style="background: var(--cp-rule);"
      aria-hidden="true"
    ></span>

    {#each steps_arr as step, i (step.step_id)}
      {@const is_done = i < current_index}
      {@const is_current = i === current_index}
      {@const num = String(i + 1).padStart(2, '0')}
      <li
        class="relative flex items-center gap-4 py-2.5"
        aria-current={is_current ? 'step' : undefined}
      >
        <span
          class="relative z-10 grid h-[18px] w-[18px] flex-none place-items-center rounded-full border"
          style={tick_style(is_done, is_current)}
          aria-hidden="true"
        >
          {#if is_done}
            <svg class="h-2.5 w-2.5 text-white" viewBox="0 0 12 12">
              <path
                d="M2 6l3 3 5-6"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {:else if is_current}
            <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
          {/if}
        </span>

        <div class="flex min-w-0 flex-1 items-baseline gap-2.5">
          <span
            class="flex-none text-[11px] tracking-wide"
            style="font-family: var(--font-mono); color: {num_color(is_done, is_current)};"
          >
            {num}
          </span>
          <span class="truncate text-[13px] leading-tight" style={label_style(is_done, is_current)}>
            {step.label}
          </span>
        </div>
      </li>
    {/each}
  </ol>
</nav>
