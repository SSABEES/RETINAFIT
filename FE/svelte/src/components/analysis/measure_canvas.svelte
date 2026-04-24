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

  /** @type {SVGSVGElement | null} */
  let ref_this_svg_el = $state(null)
  /** @type {Point2D | null} */
  let g_pending_first = $state(null)

  // active 가 바뀌면 pending 상태는 초기화 (뷰 전환 등).
  $effect(() => {
    const _active = active_item_id
    g_pending_first = null
  })

  /**
   * SVG 클릭 좌표를 이미지 픽셀 공간으로 변환한다.
   * viewBox 가 imageWidth × imageHeight 로 설정되어 있으면 DOMPoint 변환이 직관적이지만,
   * 단순한 rect 비율 계산으로도 충분하다.
   * @param {MouseEvent} evt
   * @returns {Point2D | null}
   */
  function to_image_px(evt) {
    if (!ref_this_svg_el || !capture) return null
    const rect = ref_this_svg_el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const x = (evt.clientX - rect.left) * (capture.width / rect.width)
    const y = (evt.clientY - rect.top) * (capture.height / rect.height)
    return { x, y }
  }

  /**
   * 캔버스 클릭 — active 항목이 있을 때만 점 수집.
   * 첫 번째 클릭: pending 저장. 두 번째 클릭: 부모에 두 점 전달 + pending 리셋.
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
   * ESC 전역 키 — pending 취소 + active 해제.
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
</script>

{#if capture}
  <div class="relative w-full max-w-[720px]">
    <img
      class="block h-auto w-full select-none"
      src={capture.object_url}
      alt="측정 대상 사진"
      width={capture.width}
      height={capture.height}
      draggable="false"
    />
    <svg
      bind:this={ref_this_svg_el}
      class="absolute inset-0 h-full w-full"
      class:cursor-crosshair={active_item_id}
      class:cursor-default={!active_item_id}
      viewBox="0 0 {capture.width} {capture.height}"
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="측정 캔버스 — 두 점을 클릭해 거리를 잰다"
      tabindex="-1"
      onclick={on_click_canvas}
    >
      {#each items_arr as item (item.item_id)}
        {#if item.points}
          {@const p1 = item.points[0]}
          {@const p2 = item.points[1]}
          {@const is_active = active_item_id === item.item_id}
          {@const stroke = item.source === 'auto' ? '#1f7a3a' : '#ff6f00'}
          {@const dash = item.source === 'auto' ? '6 4' : undefined}
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={stroke}
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
            {item.label}: {Math.round(item.value_px ?? 0)} px
          </text>
        {/if}
      {/each}

      {#if g_pending_first}
        <circle cx={g_pending_first.x} cy={g_pending_first.y} r="8" fill="#ff6f00" />
      {/if}
    </svg>
  </div>
{:else}
  <div
    class="grid aspect-[3/4] w-full max-w-[720px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-400"
  >
    사진이 선택되지 않았습니다
  </div>
{/if}
