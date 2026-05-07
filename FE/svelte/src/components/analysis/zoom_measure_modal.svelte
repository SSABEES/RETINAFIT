<script>
  import { onDestroy, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { X } from 'lucide-svelte'
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
  /** @type {Point2D | null} */
  let g_pending_first = $state(null)

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

  // 모달 닫힘 → pending 첫 점 초기화 (다음 진입 시 깨끗한 상태).
  $effect(() => {
    if (!open) {
      g_pending_first = null
    }
  })

  /**
   * 클릭 좌표를 이미지 픽셀 좌표로 변환한다.
   *
   * SVG 의 getScreenCTM() 으로 viewport → SVG viewBox 좌표계 매트릭스 변환을 사용 — landscape
   * orientation 일 때 모달이 CSS rotate(-90deg) 로 회전되어도 자동 처리. (회전/스케일/translate
   * 어떤 transform 이 걸려도 SVG 가 자기 좌표계로 unproject 해줌.)
   *
   * 카드와 이미지 비율이 정확히 3:4 로 일치하므로 viewBox 좌표는 [0, capture.width/height]
   * 안에 머무름. preserveAspectRatio="none" 으로 정합 유지.
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
    class="zoom-modal-root z-50 flex flex-col bg-white"
    role="dialog"
    aria-modal="true"
    aria-label="측정 이미지 확대 보기"
    transition:fade={{ duration: 180 }}
  >
    <!--
      상단 바 — Header 컴포넌트와 동일 패턴(white + border-b + slate icon button).
      좌측 닫기 / 중앙 PhotoSwitcher / 우측 spacer (대칭 유지).
    -->
    <header
      class="grid h-[52px] shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-slate-200 bg-white px-4"
    >
      <button
        type="button"
        class="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="크게보기 닫기"
        onclick={() => onclose?.()}
      >
        <X size={22} strokeWidth={2.2} aria-hidden="true" />
      </button>

      <div class="mx-auto w-full max-w-[280px]">
        <PhotoSwitcher
          {session}
          {view}
          onview_change={(v) => onview_change?.(v)}
        />
      </div>

      <span class="h-9 w-9" aria-hidden="true"></span>
    </header>

    {#if capture}
      <div class="flex min-h-0 flex-1 flex-col">
        <!--
          이미지 카드 영역 — 카드 자체를 이미지의 자연 비율(3:4) 로 sizing 해 letterbox 가 카드
          안에 생기지 않게 한다. 그래서 SVG 도 'none' 으로 정합 유지(왜곡 없음).
          모달 pre-rotation 사이즈는 width=100vmin, height=100vmax (orientation 무관):
            portrait: modal=100vw×100vh, vw<vh이므로 width=vmin, height=vmax
            landscape rotation: modal=100vh×100vw, vh<vw이므로 width=vmin, height=vmax
          → 카드 가로폭 = min(가로 가용 폭, 세로 가용 높이 × 3/4) 로 모든 viewport 비율 안전.
        -->
        <div class="flex shrink-0 justify-center px-4 pt-4 pb-3">
          <div class="zoom-image-card relative overflow-hidden rounded-[14px] bg-slate-100 shadow-[0_8px_20px_rgba(15,23,42,0.07)]">
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

        <!--
          측정 항목 영역 — flex-1 로 이미지 카드 외 남은 모든 공간(이미지 비율 차이로 생긴
          letterbox 영역 포함) 을 차지. 내부 ul 이 자동 스크롤 처리 (MeasurementList 의
          flex-1 + overflow-y-auto).
        -->
        <section class="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-200 bg-white px-5 pt-4 pb-4">
          <MeasurementList
            {items_arr}
            {active_item_id}
            onselect={(id) => onselect_item?.(id)}
            onclear={(id) => onclear_item?.(id)}
          />
        </section>
      </div>
    {:else}
      <div class="flex min-h-0 flex-1 items-center justify-center text-sm font-semibold text-slate-400">
        사진이 선택되지 않았습니다.
      </div>
    {/if}
  </div>
{/if}

<style>
  /*
   * Default: 모달이 viewport 를 그대로 채움 (portrait orientation — 자연스러운 portrait 레이아웃).
   */
  .zoom-modal-root {
    position: fixed;
    inset: 0;
  }

  /*
   * 이미지 카드 — aspect-ratio 3:4 강제. width 를 min() 으로 직접 지정해 가로/세로 모두 안전.
   *   - 100vmin = 모달 pre-rotation 가로폭 (portrait: 100vw / landscape rotation: 100vh)
   *   - 100vmax = 모달 pre-rotation 세로높이 (portrait: 100vh / landscape rotation: 100vw)
   *   - 가로 가용폭 = 100vmin - 32px (좌우 px-4)
   *   - 세로 가용 영역 (헤더 52 + 상하 padding 28 + 측정 항목 최소 영역 160 차감) → × 3/4
   * 둘 중 작은 값으로 width 결정 → height 는 aspect-ratio 로 자동 산출 (= width × 4/3).
   * 카드 자체 비율이 정확히 3:4 라 안의 <img w-full h-full> 가 늘어남 없이 정합.
   */
  .zoom-image-card {
    aspect-ratio: 3 / 4;
    width: min(calc(100vmin - 32px), calc((100vmax - 240px) * 3 / 4));
    max-width: calc(100vmin - 32px);
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
