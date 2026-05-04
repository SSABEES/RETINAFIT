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
   * 항목 값을 표시용 문자열로 변환한다. mm 우선, 없으면 px, 둘 다 없으면 '—'.
   * @param {MeasurementItem} item
   * @returns {string}
   */
  function format_value(item) {
    if (item.value_mm !== null && item.value_mm !== undefined) {
      return `${item.value_mm.toFixed(1)} mm`
    }
    if (item.value_px !== null && item.value_px !== undefined) {
      return `${Math.round(item.value_px)} px`
    }
    return '—'
  }
</script>

<section
  class="flex flex-col gap-3"
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
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      {#each items_arr as item (item.item_id)}
        {@const is_active = active_item_id === item.item_id}
        {@const has_value = item.value_px !== null}
        <li>
          <div
            class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-[#FFF6EB]"
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
        </li>
      {/each}
    </ul>
  {/if}
</section>
