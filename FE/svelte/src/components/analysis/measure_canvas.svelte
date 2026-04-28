<script>
  import { onDestroy, onMount } from 'svelte'

  /**
   * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
   * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
   * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
   */

  /** @type {{
   *   capture?: Capture | null,
   *   items_arr?: MeasurementItem[],
   *   active_item_id?: string | null,
   *   onpoints_set?: ((item_id: string, points: [Point2D, Point2D]) => void) | undefined,
   *   oncancel?: (() => void) | undefined,
   * }}
   */
  let {
    capture = null,
    items_arr = [],
    active_item_id = null,
    onpoints_set = undefined,
    oncancel = undefined,
  } = $props()

  /** @type {HTMLButtonElement | null} */
  let ref_this_hit_area_el = $state(null)
  /** @type {Point2D | null} */
  let g_pending_first = $state(null)

  // active가 바뀌면 pending 상태를 초기화한다.
  $effect(() => {
    active_item_id
    g_pending_first = null
  })

  /**
   * 클릭 좌표를 이미지 픽셀 좌표로 변환한다.
   * @param {MouseEvent} evt
   * @returns {Point2D | null}
   */
  function to_image_px(evt) {
    if (!ref_this_hit_area_el || !capture) return null
    const rect = ref_this_hit_area_el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const x = (evt.clientX - rect.left) * (capture.width / rect.width)
    const y = (evt.clientY - rect.top) * (capture.height / rect.height)
    return { x, y }
  }

  /**
   * 클릭 두 번으로 측정 점을 지정한다.
   * @param {MouseEvent} evt
   */
  function on_click_canvas(evt) {
    if (!active_item_id || !capture) return
    const p = to_image_px(evt)
    if (!p) return

    if (!g_pending_first) {
      g_pending_first = p
      return
    }

    onpoints_set?.(active_item_id, [g_pending_first, p])
    g_pending_first = null
  }

  /**
   * ESC 입력 시 현재 측정을 취소한다.
   * @param {KeyboardEvent} evt
   */
  function on_keydown_global(evt) {
    if (evt.key !== 'Escape') return
    g_pending_first = null
    oncancel?.()
  }

  onMount(() => {
    window.addEventListener('keydown', on_keydown_global)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', on_keydown_global)
  })

  /**
   * 측정 결과를 표시 문자열로 바꾼다.
   * @param {MeasurementItem} item
   * @returns {string}
   */
  function format_value(item) {
    if (item.value_mm !== null && item.value_mm !== undefined) {
      return `${item.value_mm.toFixed(1)} mm`
    }

    return `${Math.round(item.value_px ?? 0)} px`
  }
</script>

{#if capture}
  <div
    class="relative mx-auto block max-h-full"
    style="aspect-ratio: {capture.width} / {capture.height}; max-width: min(100%, 720px);"
  >
    <img
      class="block h-full w-full select-none"
      src={capture.object_url}
      alt="측정 대상 사진"
      width={capture.width}
      height={capture.height}
      draggable="false"
    />
    <button
      bind:this={ref_this_hit_area_el}
      class="absolute inset-0 z-10 h-full w-full border-0 bg-transparent p-0"
      class:cursor-crosshair={active_item_id}
      class:cursor-default={!active_item_id}
      aria-label="측정 캔버스에서 두 점을 클릭해 거리를 잽니다"
      type="button"
      onclick={on_click_canvas}
    ></button>
    <svg
      class="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 {capture.width} {capture.height}"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {#each items_arr as item (item.item_id)}
        {#if item.points}
          {@const p1 = item.points[0]}
          {@const p2 = item.points[1]}
          {@const is_active = active_item_id === item.item_id}
          {@const stroke =
            item.source === 'auto'
              ? 'var(--retinal-measure-auto)'
              : 'var(--retinal-measure-manual)'}
          {@const dash = item.source === 'auto' ? '6 4' : undefined}
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            {stroke}
            stroke-width={is_active ? 5 : 3}
            stroke-dasharray={dash}
          />
          <circle cx={p1.x} cy={p1.y} r={is_active ? 8 : 5} fill={stroke} />
          <circle cx={p2.x} cy={p2.y} r={is_active ? 8 : 5} fill={stroke} />
          <text
            x={(p1.x + p2.x) / 2}
            y={(p1.y + p2.y) / 2 - 10}
            fill={stroke}
            font-size="22"
            font-weight="700"
            text-anchor="middle"
          >
            {item.label}: {format_value(item)}
          </text>
        {/if}
      {/each}

      {#if g_pending_first}
        <circle
          cx={g_pending_first.x}
          cy={g_pending_first.y}
          r="8"
          fill="var(--retinal-measure-manual)"
        />
      {/if}
    </svg>
  </div>
{:else}
  <div
    class="mx-auto grid max-h-full place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-400"
    style="aspect-ratio: 3 / 4; max-width: min(100%, 720px);"
  >
    사진이 선택되지 않았습니다.
  </div>
{/if}
