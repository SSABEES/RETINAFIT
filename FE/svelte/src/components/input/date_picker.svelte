<script>
  import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-svelte'

  /**
   * @typedef {object} DatePickerProps
   * @property {string} [id]
   * @property {string} [value]              YYYY-MM-DD 형식
   * @property {string} [placeholder]
   * @property {boolean} [disabled]
   * @property {boolean} [required]
   * @property {(value: string) => void} [onchange]
   * @property {number} [min_year]
   * @property {number} [max_year]
   * @property {string} [aria_label]
   */

  /** @type {DatePickerProps} */
  let {
    id = undefined,
    value = '',
    placeholder = '날짜 선택',
    disabled = false,
    required = false,
    onchange = undefined,
    min_year = 1920,
    max_year = new Date().getFullYear(),
    aria_label = '날짜 선택',
  } = $props()

  const WEEKDAY_LABEL_ARR = ['일', '월', '화', '수', '목', '금', '토']
  const MONTH_LABEL_ARR = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ]

  let g_open = $state(false)
  let ref_root = $state(/** @type {HTMLDivElement | null} */ (null))

  // YYYY-MM-DD 문자열을 {year, month(0-11), day} 객체로 분해한다.
  function parse_value(value_str) {
    const local_match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value_str ?? '')
    if (!local_match) return null
    return {
      year: Number(local_match[1]),
      month: Number(local_match[2]) - 1,
      day: Number(local_match[3]),
    }
  }

  // 연/월/일 숫자를 YYYY-MM-DD 문자열로 만든다.
  function format_value(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const g_today_obj = new Date()
  const g_today_yyyymmdd = format_value(
    g_today_obj.getFullYear(),
    g_today_obj.getMonth(),
    g_today_obj.getDate(),
  )

  let g_view_year = $state(parse_value(value)?.year ?? g_today_obj.getFullYear())
  let g_view_month = $state(parse_value(value)?.month ?? g_today_obj.getMonth())

  // 외부에서 value 가 바뀌면 보고 있는 달도 그 위치로 동기화한다.
  $effect(() => {
    const local_parsed_obj = parse_value(value)
    if (local_parsed_obj) {
      g_view_year = local_parsed_obj.year
      g_view_month = local_parsed_obj.month
    }
  })

  // 연도 셀렉트 옵션 (최신부터 오래된 순).
  let g_year_arr = $derived(
    Array.from({ length: max_year - min_year + 1 }, (_, idx) => max_year - idx),
  )

  // 현재 보고 있는 달 기준 6주 x 7일(=42칸) 그리드 데이터.
  let g_day_cell_arr = $derived.by(() => {
    const local_first_day_obj = new Date(g_view_year, g_view_month, 1)
    const local_first_weekday = local_first_day_obj.getDay()
    const local_grid_start_obj = new Date(g_view_year, g_view_month, 1 - local_first_weekday)
    const local_selected_obj = parse_value(value)

    return Array.from({ length: 42 }, (_, local_index) => {
      const local_date_obj = new Date(
        local_grid_start_obj.getFullYear(),
        local_grid_start_obj.getMonth(),
        local_grid_start_obj.getDate() + local_index,
      )
      const local_year = local_date_obj.getFullYear()
      const local_month = local_date_obj.getMonth()
      const local_day = local_date_obj.getDate()
      const local_value = format_value(local_year, local_month, local_day)

      return {
        year: local_year,
        month: local_month,
        day: local_day,
        weekday: local_date_obj.getDay(),
        is_current_month: local_month === g_view_month,
        is_today: local_value === g_today_yyyymmdd,
        is_selected:
          !!local_selected_obj &&
          local_selected_obj.year === local_year &&
          local_selected_obj.month === local_month &&
          local_selected_obj.day === local_day,
        value: local_value,
      }
    })
  })

  let g_display_label = $derived.by(() => {
    const local_parsed_obj = parse_value(value)
    if (!local_parsed_obj) return placeholder
    return format_value(local_parsed_obj.year, local_parsed_obj.month, local_parsed_obj.day)
  })

  let g_has_value = $derived(parse_value(value) !== null)
  let g_is_prev_disabled = $derived(g_view_year <= min_year && g_view_month === 0)
  let g_is_next_disabled = $derived(g_view_year >= max_year && g_view_month === 11)

  function on_click_toggle_open() {
    if (disabled) return
    g_open = !g_open
  }

  function on_click_prev_month() {
    if (g_is_prev_disabled) return
    if (g_view_month === 0) {
      g_view_year -= 1
      g_view_month = 11
      return
    }
    g_view_month -= 1
  }

  function on_click_next_month() {
    if (g_is_next_disabled) return
    if (g_view_month === 11) {
      g_view_year += 1
      g_view_month = 0
      return
    }
    g_view_month += 1
  }

  function on_change_year(local_event) {
    g_view_year = Number(/** @type {HTMLSelectElement} */ (local_event.currentTarget).value)
  }

  function on_change_month(local_event) {
    g_view_month = Number(/** @type {HTMLSelectElement} */ (local_event.currentTarget).value)
  }

  // 다른 달 칸을 누르면 그 달로 이동까지 함께 처리한다.
  function on_click_select_day(cell_obj) {
    if (!cell_obj.is_current_month) {
      g_view_year = cell_obj.year
      g_view_month = cell_obj.month
    }
    onchange?.(cell_obj.value)
    g_open = false
  }

  // 입력기 외부를 누르면 popover 를 닫는다.
  function on_pointerdown_window(local_event) {
    if (!g_open || !ref_root) return
    if (!ref_root.contains(/** @type {Node} */ (local_event.target))) {
      g_open = false
    }
  }

  function on_keydown_window(local_event) {
    if (g_open && local_event.key === 'Escape') {
      g_open = false
    }
  }

  $effect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pointerdown', on_pointerdown_window)
    window.addEventListener('keydown', on_keydown_window)
    return () => {
      window.removeEventListener('pointerdown', on_pointerdown_window)
      window.removeEventListener('keydown', on_keydown_window)
    }
  })
</script>

<div bind:this={ref_root} class="relative">
  <button
    {id}
    type="button"
    class={`flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:bg-[var(--retina-text-200)]/40 ${
      g_has_value ? 'text-[var(--retina-text-800)]' : 'text-[var(--retina-text-500)]'
    } ${
      g_open
        ? 'border-[var(--retina-text-800)] bg-[var(--retina-bg-1)]/40'
        : 'border-[var(--retina-text-300)] bg-[var(--retina-surface)] hover:bg-[var(--retina-bg-1)]/30'
    }`}
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={g_open}
    aria-label={aria_label}
    aria-required={required ? 'true' : undefined}
    onclick={on_click_toggle_open}
  >
    <span class="truncate">{g_display_label}</span>
    <CalendarDays
      size={16}
      strokeWidth={2.2}
      class="shrink-0 text-[var(--retina-text-500)]"
      aria-hidden="true"
    />
  </button>

  {#if g_open}
    <div
      class="absolute right-0 top-[calc(100%+4px)] z-30 grid w-[280px] gap-1.5 rounded-lg border border-[var(--retina-text-200)] bg-[var(--retina-surface)] p-2.5 shadow-[0_12px_30px_rgba(19,25,40,0.12)]"
      role="dialog"
      aria-label={aria_label}
    >
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="이전 달"
          disabled={g_is_prev_disabled}
          onclick={on_click_prev_month}
        >
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>

        <div class="flex flex-1 items-center justify-center gap-1.5">
          <select
            class="cursor-pointer rounded-md border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-2 py-1 text-xs font-extrabold text-[var(--retina-text-800)] outline-none transition hover:bg-[var(--retina-bg-1)]/40 focus:border-[var(--retina-text-800)]"
            value={g_view_year}
            aria-label="연도 선택"
            onchange={on_change_year}
          >
            {#each g_year_arr as year_value (year_value)}
              <option value={year_value}>{year_value}년</option>
            {/each}
          </select>
          <select
            class="cursor-pointer rounded-md border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-2 py-1 text-xs font-extrabold text-[var(--retina-text-800)] outline-none transition hover:bg-[var(--retina-bg-1)]/40 focus:border-[var(--retina-text-800)]"
            value={g_view_month}
            aria-label="월 선택"
            onchange={on_change_month}
          >
            {#each MONTH_LABEL_ARR as month_label, month_index (month_index)}
              <option value={month_index}>{month_label}</option>
            {/each}
          </select>
        </div>

        <button
          type="button"
          class="grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="다음 달"
          disabled={g_is_next_disabled}
          onclick={on_click_next_month}
        >
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <div class="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold">
        {#each WEEKDAY_LABEL_ARR as weekday_label, weekday_index (weekday_index)}
          <span
            class={weekday_index === 0
              ? 'text-[#dc2626]'
              : weekday_index === 6
                ? 'text-[#1660C7]'
                : 'text-[var(--retina-text-500)]'}
          >
            {weekday_label}
          </span>
        {/each}
      </div>

      <div class="grid grid-cols-7 gap-0.5">
        {#each g_day_cell_arr as cell_obj, cell_index (cell_index)}
          <button
            type="button"
            class={`grid h-8 w-full cursor-pointer place-items-center rounded-md border-0 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--retina-primary-600)]/60 ${
              cell_obj.is_selected
                ? 'bg-[var(--retina-primary-600)] text-white'
                : cell_obj.is_today
                  ? 'border border-[var(--retina-primary-600)]/60 bg-[var(--retina-bg-1)] text-[var(--retina-primary-700)]'
                  : cell_obj.is_current_month
                    ? `bg-transparent hover:bg-[var(--retina-bg-1)]/60 ${
                        cell_obj.weekday === 0
                          ? 'text-[#dc2626]'
                          : cell_obj.weekday === 6
                            ? 'text-[#1660C7]'
                            : 'text-[var(--retina-text-800)]'
                      }`
                    : 'bg-transparent text-[var(--retina-text-300)] hover:bg-[var(--retina-bg-1)]/40'
            }`}
            onclick={() => on_click_select_day(cell_obj)}
          >
            {cell_obj.day}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
