<script>
  import { onDestroy, onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import PhotoSwitcher from '@/components/analysis/photo_switcher.svelte'
  import MeasurementList from '@/components/analysis/measurement_list.svelte'
  import { is_aruco_overlay_enabled } from '@/lib/measurements/aruco_debug_overlay.svelte.js'

  /**
   * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
   * @typedef {import('@/lib/stores/capture_session.svelte.js').CaptureSessionState} CaptureSessionState
   * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
   * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
   * @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle
   */

  /** @type {{
   *   open?: boolean,
   *   capture?: Capture | null,
   *   items_arr?: MeasurementItem[],
   *   active_item_id?: string | null,
   *   view?: ViewAngle,
   *   session?: CaptureSessionState,
   *   onpoints_set?: ((item_id: string, points: [Point2D, Point2D]) => void) | undefined,
   *   onselect_item?: ((item_id: string) => void) | undefined,
   *   onclear_item?: ((item_id: string) => void) | undefined,
   *   onview_change?: ((view: ViewAngle) => void) | undefined,
   *   onclose?: (() => void) | undefined,
   * }}
   */
  let {
    open = false,
    capture = null,
    items_arr = [],
    active_item_id = null,
    view = 'front_no_glasses',
    session,
    onpoints_set = undefined,
    onselect_item = undefined,
    onclear_item = undefined,
    onview_change = undefined,
    onclose = undefined,
  } = $props()

  /** @type {SVGSVGElement | null} */
  let ref_this_svg_el = $state(null)
  let g_list_open = $state(false)
  /** @type {Point2D | null} */
  let g_pending_first = $state(null)

  /**
   * 항목 클릭 — 부모로 위임하고 sheet 자동 닫음.
   * @param {string} item_id
   */
  function on_select_item_local(item_id) {
    onselect_item?.(item_id)
    g_list_open = false
  }

  // active 가 바뀌면 pending 초기화 — 가로 캔버스와 동일 패턴.
  $effect(() => {
    active_item_id
    g_pending_first = null
  })

  // view 가 바뀌면 pending 폐기 — spec 3.3 view 변경 동작.
  $effect(() => {
    view
    g_pending_first = null
  })

  // 모달 닫힘 → 로컬 상태 폐기 (다음 진입 시 깨끗한 상태). pending 첫 점 + bottom sheet 모두 초기화.
  $effect(() => {
    if (!open) {
      g_pending_first = null
      g_list_open = false
    }
  })

  /**
   * 클릭 좌표를 이미지 픽셀 좌표로 변환한다.
   *
   * SVG 의 getScreenCTM() 으로 viewport → SVG viewBox 좌표계 매트릭스 변환을 사용 — landscape
   * orientation 일 때 모달이 CSS rotate(90deg) 로 회전되어도 자동 처리. (회전/스케일/translate
   * 어떤 transform 이 걸려도 SVG 가 자기 좌표계로 unproject 해줌.)
   *
   * capture.object_url 이 미러링 표시이므로 최종 결과의 x 만 mirror_x 로 unmirror.
   * @param {MouseEvent} evt
   * @returns {Point2D | null}
   */
  function to_image_px(evt) {
    if (!ref_this_svg_el || !capture) return null
    const ctm = ref_this_svg_el.getScreenCTM()
    if (!ctm) return null
    const pt = ref_this_svg_el.createSVGPoint()
    pt.x = evt.clientX
    pt.y = evt.clientY
    const local = pt.matrixTransform(ctm.inverse())
    return { x: capture.width - local.x, y: local.y }
  }

  /**
   * 두 번 클릭으로 측정 점을 지정한다.
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
   * mirrored display 의 x 좌표 변환.
   * @param {number} x
   */
  function mirror_x(x) {
    return capture ? capture.width - x : x
  }

  const g_active_is_angle = $derived(
    items_arr.find((it) => it.item_id === active_item_id)?.kind === 'angle',
  )

  const g_active_item = $derived(
    items_arr.find((it) => it.item_id === active_item_id && it.points) ?? null,
  )

  const g_show_aruco_overlay = $derived(is_aruco_overlay_enabled())
  const g_aruco_marker = $derived(capture?.marker ?? null)

  /**
   * ESC 키 → 모달 닫기.
   * @param {KeyboardEvent} evt
   */
  function on_keydown_global(evt) {
    if (!open) return
    if (evt.key !== 'Escape') return
    onclose?.()
  }

  onMount(() => {
    window.addEventListener('keydown', on_keydown_global)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', on_keydown_global)
  })
</script>

{#if open}
  <div
    class="zoom-modal-root z-50 bg-black/95"
    role="dialog"
    aria-modal="true"
    aria-label="측정 이미지 확대 보기"
    transition:fade={{ duration: 200 }}
  >
    <!-- 상단 바: 좌측 PhotoSwitcher + 우측 닫기 -->
    <div
      class="absolute top-0 right-0 left-0 z-30 flex h-14 items-center justify-between gap-4 bg-black/30 px-4 backdrop-blur-sm"
    >
      <div class="flex-1 max-w-[360px]">
        <PhotoSwitcher
          {session}
          {view}
          onview_change={(v) => onview_change?.(v)}
        />
      </div>
      <button
        type="button"
        class="rounded px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10"
        onclick={() => onclose?.()}
        aria-label="크게보기 닫기"
      >
        닫기
      </button>
    </div>

    <!-- 측정 캔버스 영역 — 상단 바 높이(h-14 = 56px) 빼고 화면 채움. portrait 3:4 fit. -->
    {#if capture}
      <div class="absolute top-14 right-0 bottom-0 left-0 grid place-items-center px-2 pb-2">
        <div
          class="relative h-full max-h-full"
          style="aspect-ratio: 3 / 4;"
        >
          <img
            class="absolute inset-0 block h-full w-full select-none"
            src={capture.object_url}
            alt="측정 대상 사진"
            draggable="false"
          />
          <button
            class="absolute inset-0 z-10 border-0 bg-transparent p-0"
            class:cursor-crosshair={active_item_id}
            class:cursor-default={!active_item_id}
            aria-label="측정 캔버스에서 두 점을 클릭해 거리를 잽니다"
            type="button"
            onclick={on_click_canvas}
          ></button>
          <svg
            bind:this={ref_this_svg_el}
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
              <line {x1} y1={p1.y} {x2} y2={p2.y} stroke="white" stroke-width="5" stroke-linecap="round" stroke-dasharray={dash} opacity="0.85" />
              <line {x1} y1={p1.y} {x2} y2={p2.y} stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-dasharray={dash} />
              <circle cx={x1} cy={p1.y} r="5" fill="#F97316" stroke="white" stroke-width="1.5" />
              <circle cx={x2} cy={p2.y} r="5" fill="#F97316" stroke="white" stroke-width="1.5" />
            {/if}

            {#if g_show_aruco_overlay && g_aruco_marker}
              <polygon
                points={g_aruco_marker.corners.map((c) => `${mirror_x(c.x)},${c.y}`).join(' ')}
                fill="rgba(0,200,83,0.15)"
                stroke="#00c853"
                stroke-width="3"
              />
              <text
                x={mirror_x(g_aruco_marker.corners[0].x)}
                y={g_aruco_marker.corners[0].y - 6}
                fill="#00c853"
                font-size="20"
                font-weight="700"
              >
                ID {g_aruco_marker.id} z={g_aruco_marker.translation[2].toFixed(0)}mm
              </text>
            {/if}

            {#if g_pending_first}
              {#if g_active_is_angle}
                <line
                  x1={mirror_x(g_pending_first.x)}
                  y1={g_pending_first.y - 80}
                  x2={mirror_x(g_pending_first.x)}
                  y2={g_pending_first.y + 80}
                  stroke="white"
                  stroke-width="3"
                  stroke-dasharray="6 6"
                  opacity="0.85"
                />
              {/if}
              <circle
                cx={mirror_x(g_pending_first.x)}
                cy={g_pending_first.y}
                r="5"
                fill="#F97316"
                stroke="white"
                stroke-width="1.5"
              />
            {/if}
          </svg>
        </div>
      </div>
    {:else}
      <!-- capture 가 null 이면 안내 placeholder -->
      <div class="absolute top-14 right-0 bottom-0 left-0 grid place-items-center text-sm font-semibold text-slate-300">
        사진이 선택되지 않았습니다.
      </div>
    {/if}

    <!-- 우하단 floating 토글 버튼 -->
    <button
      type="button"
      class="absolute right-4 bottom-4 z-40 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-lg transition hover:bg-slate-50"
      onclick={() => (g_list_open = !g_list_open)}
      aria-expanded={g_list_open}
    >
      {g_list_open ? '측정 항목 접기' : '측정 항목 펼치기'}
    </button>

    <!-- bottom sheet — 열렸을 때만 렌더, 슬라이드 업 200ms -->
    {#if g_list_open}
      <div
        class="absolute right-0 bottom-0 left-0 z-30 max-h-[50vh] overflow-y-auto rounded-t-2xl bg-white px-5 pt-4 pb-20 shadow-[0_-8px_24px_rgba(0,0,0,0.2)]"
        aria-label="측정 항목 리스트"
        transition:fly={{ y: 200, duration: 200 }}
      >
        <MeasurementList
          {items_arr}
          {active_item_id}
          onselect={on_select_item_local}
          onclear={(id) => onclear_item?.(id)}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  /*
   * Default: 모달이 viewport 를 그대로 채움 (portrait orientation 디바이스용 — 자연스러운 portrait 레이아웃).
   */
  .zoom-modal-root {
    position: fixed;
    inset: 0;
  }

  /*
   * Landscape orientation: 모달은 portrait 좌표계 그대로 그리되 -90deg (counterclockwise) 회전해 표시.
   * 가로 모니터를 portrait 디바이스로 시뮬레이션 — PC 디버깅 + 가로 태블릿 세로 사용 모두 커버.
   *
   * 좌표 변환 (반시계 90deg):
   *   - element pre-transform 크기: width=100vh (모니터 height), height=100vw (모니터 width)
   *   - rotate(-90deg) about (0,0): (x, y) → (y, -x), rectangle (0, -W) ~ (H, 0)
   *   - translate(0, 100vh): rectangle (0, 0) ~ (H, W) — viewport 정확히 덮음
   *     (100vh 는 viewport 높이 = pre-transform W, 즉 element 가로 폭)
   *   - 클릭 좌표는 SVG getScreenCTM 으로 자동 unproject (to_image_px 참조)
   */
  @media (orientation: landscape) {
    .zoom-modal-root {
      inset: auto;
      top: 0;
      left: 0;
      width: 100vh;
      height: 100vw;
      transform-origin: top left;
      transform: translate(0, 100vh) rotate(-90deg);
    }
  }
</style>
