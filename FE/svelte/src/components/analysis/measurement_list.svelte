<script>
  import { X } from 'lucide-svelte'

  /**
   * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
   */

  /** @type {{
   *   items_arr?: MeasurementItem[],
   *   active_item_id?: string | null,
   *   onselect?: ((item_id: string) => void) | undefined,
   *   onclear?: ((item_id: string) => void) | undefined,
   *   view_label?: string,
   * }}
   */
  let {
    items_arr = [],
    active_item_id = null,
    onselect = undefined,
    onclear = undefined,
    view_label = '',
  } = $props()

  /**
   * 항목 행 클릭 — 활성 전환을 부모로 위임.
   * @param {string} item_id
   */
  function on_click_row(item_id) {
    onselect?.(item_id)
  }

  /**
   * × 버튼 클릭 — 측정값 지우기를 부모로 위임. 이벤트 버블링 방지.
   * @param {MouseEvent} evt
   * @param {string} item_id
   */
  function on_click_clear(evt, item_id) {
    evt.stopPropagation()
    onclear?.(item_id)
  }

  /**
   * 항목 값을 표시용 문자열로 변환한다. kind 분기 — distance: mm/px, angle: 부호 있는 °.
   * @param {MeasurementItem} item
   * @returns {string}
   */
  function format_value(item) {
    if (item.kind === 'angle') {
      const v = item.value_deg_corrected ?? item.value_deg_raw
      if (v === null || v === undefined) return '—'
      const sign = v >= 0 ? '+' : ''
      return `${sign}${v.toFixed(1)}°`
    }
    if (item.value_mm !== null && item.value_mm !== undefined) {
      return `${item.value_mm.toFixed(1)} mm`
    }
    if (item.value_px !== null && item.value_px !== undefined) {
      return `${Math.round(item.value_px)} px`
    }
    return '—'
  }

  /**
   * 각도 항목의 보조 텍스트 — 보정에 쓰인 image_tilt 값 표기. 보정 없으면 빈 문자열.
   * @param {MeasurementItem} item
   * @returns {string}
   */
  function format_correction_note(item) {
    if (item.kind !== 'angle') return ''
    if (item.value_deg_raw === null || item.value_deg_raw === undefined) return ''
    const tilt = item.head_image_tilt_deg_used
    if (tilt === null || tilt === undefined) return '보정 없음'
    const sign = tilt >= 0 ? '+' : ''
    return `머리 기울기 ${sign}${tilt.toFixed(1)}° 보정`
  }

  /**
   * 측정값이 채워졌는지 — kind 별로 다른 필드 검사.
   * @param {MeasurementItem} item
   * @returns {boolean}
   */
  function has_value_of(item) {
    if (item.kind === 'angle') {
      return item.value_deg_raw !== null && item.value_deg_raw !== undefined
    }
    return item.value_px !== null && item.value_px !== undefined
  }
</script>

<!--
  flex-1 min-h-0 overflow-hidden — flex-col 부모(face_measurement 의 scroll wrapper) 안에서 가용
  높이를 끝까지 흡수. 헤더(측정 항목 + view_label) 는 컴포넌트 상단 고정, ul 만 내부에서 스크롤.
  컴포넌트가 다른 곳에서 쓰여도 flex 부모 밖에선 flex-1 이 무시되므로 안전.
-->
<section
  class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
  aria-label="측정 항목 리스트"
>
  <div class="flex items-baseline justify-between">
    <h3 class="m-0 text-[13px] font-extrabold text-slate-800">측정 항목</h3>
    {#if view_label}
      <span class="text-xs font-semibold text-slate-500">{view_label}</span>
    {/if}
  </div>

  {#if items_arr.length === 0}
    <p class="m-0 text-xs font-semibold text-slate-500">이 뷰에 정의된 측정 항목이 없습니다.</p>
  {:else}
    <ul class="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto p-0">
      {#each items_arr as item (item.item_id)}
        {@const is_active = active_item_id === item.item_id}
        {@const has_value = has_value_of(item)}
        {@const correction_note = format_correction_note(item)}
        <li>
          <div
            class="flex w-full cursor-pointer flex-col gap-1 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-[#FFF6EB]"
            class:bg-[#FFF6EB]={is_active}
            role="button"
            tabindex="0"
            aria-pressed={is_active}
            onclick={() => on_click_row(item.item_id)}
            onkeydown={(evt) => {
              if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault()
                on_click_row(item.item_id)
              }
            }}
          >
            <div class="flex w-full items-center gap-3">
              <span
                class="grid h-4 w-4 flex-none place-items-center rounded-full border border-slate-400"
                class:border-[#F97316]={is_active}
                aria-hidden="true"
              >
                {#if is_active}
                  <span class="h-2 w-2 rounded-full bg-[#F97316]"></span>
                {/if}
              </span>
              <span class="flex-1 truncate text-sm font-semibold text-slate-700">{item.label}</span>
              <span
                class="flex-none text-sm font-bold tabular-nums"
                class:text-[var(--retina-text)]={has_value}
                class:text-slate-400={!has_value}
              >
                {format_value(item)}
              </span>
              <span
                class="flex-none rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                class:bg-emerald-100={item.source === 'auto'}
                class:text-emerald-800={item.source === 'auto'}
                class:bg-amber-100={item.source === 'manual'}
                class:text-amber-800={item.source === 'manual'}
              >
                {item.source === 'auto' ? '자동' : '수동'}
              </span>
              {#if has_value}
                <button
                  class="grid h-6 w-6 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-red-100 hover:text-red-700"
                  type="button"
                  aria-label="{item.label} 측정값 지우기"
                  onclick={(evt) => on_click_clear(evt, item.item_id)}
                >
                  <X size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
              {/if}
            </div>
            {#if has_value && correction_note}
              <span class="pl-7 text-[11px] font-medium text-slate-500">{correction_note}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
