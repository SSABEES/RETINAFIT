<script>
  import { onDestroy, onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'

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
    class="fixed inset-0 z-50 bg-black/95"
    role="dialog"
    aria-modal="true"
    aria-label="측정 이미지 확대 보기"
    transition:fade={{ duration: 200 }}
  >
    <!-- 상단 바 -->
    <div
      class="absolute top-0 right-0 left-0 z-30 flex h-14 items-center justify-end bg-black/30 px-4 backdrop-blur-sm"
    >
      <button
        type="button"
        class="rounded px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10"
        onclick={() => onclose?.()}
        aria-label="크게보기 닫기"
      >
        닫기
      </button>
    </div>
  </div>
{/if}
