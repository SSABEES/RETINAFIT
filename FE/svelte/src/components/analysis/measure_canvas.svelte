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
    // image 가 mirrored display 라 클릭한 시각 위치 x 를 unmirrored 좌표계로 변환해서 저장.
    // (저장된 measurement_points_obj 는 mediapipe 의 unmirrored 좌표계와 일관 유지.)
    const visual_x = (evt.clientX - rect.left) * (capture.width / rect.width)
    const y = (evt.clientY - rect.top) * (capture.height / rect.height)
    return { x: capture.width - visual_x, y }
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

  // 활성 항목만 오버레이 표시 — 측정 항목 전체를 한꺼번에 그리면 가독성/정확도 둘 다 떨어짐.
  // 사용자가 측정 리스트에서 항목을 선택하면 그 항목만 사진 위에 표시.
  const g_active_item = $derived(
    items_arr.find((it) => it.item_id === active_item_id && it.points) ?? null,
  )

  // capture.object_url 은 capture_shell 에서 좌우 반전(미러)된 display 용 URL.
  // 측정 좌표(measurement_points_obj)는 unmirrored 좌표계라 둘이 정합 안 됨 → 좌우 어긋남.
  // image 는 mirrored 유지(사용자 거울 view) + 좌표만 mirror 변환해서 매칭.
  // x → width - x 로 변환하여 mirrored display 의 좌표계로 만든다.
  function mirror_x(x) {
    return capture ? capture.width - x : x
  }
</script>

{#if capture}
  <!--
    aspect-ratio 를 capture.width/height 가 아닌 고정 3/4 로 강제. video_to_blob 가 모든 캡처를
    480×640 으로 정규화하지만 (capture_utils.js), 어떤 이유로 단계별로 dimensions 가 일치하지
    않더라도 display 측에서 사이즈 일관성을 보장하는 방어막. SVG viewBox 는 capture.width/height
    그대로 사용하고 preserveAspectRatio="none" 로 stretch — img 와 같이 stretch 되므로 좌표 정합 유지.
  -->
  <div
    class="relative mx-auto block h-full max-h-full"
    style="aspect-ratio: 3 / 4; max-width: min(100%, 720px);"
  >
    <img
      class="absolute inset-0 block h-full w-full select-none"
      src={capture.object_url}
      alt="측정 대상 사진"
      draggable="false"
    />
    <button
      bind:this={ref_this_hit_area_el}
      class="absolute inset-0 z-10 border-0 bg-transparent p-0"
      class:cursor-crosshair={active_item_id}
      class:cursor-default={!active_item_id}
      aria-label="측정 캔버스에서 두 점을 클릭해 거리를 잽니다"
      type="button"
      onclick={on_click_canvas}
    ></button>
    <svg
      class="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 {capture.width} {capture.height}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {#if g_active_item}
        {@const p1 = g_active_item.points[0]}
        {@const p2 = g_active_item.points[1]}
        {@const x1 = mirror_x(p1.x)}
        {@const x2 = mirror_x(p2.x)}
        {@const dash = g_active_item.source === 'auto' ? '8 6' : undefined}
        <!-- 가독성을 위한 흰색 외곽선 (paint-order 로 stroke 먼저, fill 나중) -->
        <line
          {x1}
          y1={p1.y}
          {x2}
          y2={p2.y}
          stroke="white"
          stroke-width="9"
          stroke-linecap="round"
          stroke-dasharray={dash}
          opacity="0.85"
        />
        <line
          {x1}
          y1={p1.y}
          {x2}
          y2={p2.y}
          stroke="#F97316"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray={dash}
        />
        <circle cx={x1} cy={p1.y} r="10" fill="#F97316" stroke="white" stroke-width="3" />
        <circle cx={x2} cy={p2.y} r="10" fill="#F97316" stroke="white" stroke-width="3" />
        <text
          x={(x1 + x2) / 2}
          y={(p1.y + p2.y) / 2 - 14}
          font-size="24"
          font-weight="800"
          text-anchor="middle"
          paint-order="stroke fill"
          stroke="white"
          stroke-width="5"
          stroke-linejoin="round"
          fill="#F97316"
        >
          {g_active_item.label}: {format_value(g_active_item)}
        </text>
      {/if}

      {#if g_pending_first}
        <circle
          cx={mirror_x(g_pending_first.x)}
          cy={g_pending_first.y}
          r="10"
          fill="#F97316"
          stroke="white"
          stroke-width="3"
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
