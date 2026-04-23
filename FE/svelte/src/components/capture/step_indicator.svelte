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
   * 행 배경/테두리 색상 스타일을 상태에 따라 반환한다.
   * @param {boolean} is_done
   * @param {boolean} is_current
   * @returns {string}
   */
  function row_style(is_done, is_current) {
    if (is_current) return 'border-color: #4B0055; background: #F5EAF7;'
    if (is_done) return 'border-color: #2E7D32; background: #E8F5E9;'
    return 'border-color: #E5E7EB; background: #ffffff;'
  }

  /**
   * 원형 번호 뱃지의 배경/글자색 스타일을 상태에 따라 반환한다.
   * @param {boolean} is_done
   * @param {boolean} is_current
   * @returns {string}
   */
  function badge_style(is_done, is_current) {
    if (is_current) return 'background: #4B0055; color: #ffffff;'
    if (is_done) return 'background: #2E7D32; color: #ffffff;'
    return 'background: #E5E7EB; color: #64748b;'
  }
</script>

<nav class="flex flex-col gap-2" aria-label="촬영 진행도">
  {#each steps_arr as step, i (step.step_id)}
    {@const is_done = i < current_index}
    {@const is_current = i === current_index}
    <div
      class="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition"
      style={row_style(is_done, is_current)}
      aria-current={is_current ? 'step' : undefined}
    >
      <span
        class="grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-extrabold tabular-nums"
        style={badge_style(is_done, is_current)}
        aria-hidden="true"
      >
        {is_done ? '✓' : i + 1}
      </span>
      <div class="min-w-0 flex-1">
        <div
          class="text-sm font-extrabold"
          style={is_current ? 'color: #4B0055;' : is_done ? 'color: #2E7D32;' : 'color: #111827;'}
        >
          Step {i + 1}
        </div>
        <div class="truncate text-xs font-semibold text-slate-500">{step.label}</div>
      </div>
    </div>
  {/each}
</nav>
