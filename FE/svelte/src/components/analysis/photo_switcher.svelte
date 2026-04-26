<script>
  /**
   * @typedef {import('@/lib/stores/capture_session.svelte.js').CaptureSessionState} CaptureSessionState
   * @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle
   */

  /** @type {{
   *   session?: CaptureSessionState,
   *   view?: ViewAngle,
   *   onview_change?: ((view: ViewAngle) => void) | undefined,
   * }}
   */
  let {
    session,
    view = 'front_no_glasses',
    onview_change = undefined,
  } = $props()

  /** @type {{ id: ViewAngle, label: string }[]} */
  const VIEW_TABS = [
    { id: 'front_no_glasses', label: '정면 (미착용)' },
    { id: 'front_glasses',    label: '정면 (안경)' },
    { id: 'left_no_glasses',  label: '좌측 (미착용)' },
    { id: 'left_glasses',     label: '좌측 (안경)' },
    { id: 'right_no_glasses', label: '우측 (미착용)' },
    { id: 'right_glasses',    label: '우측 (안경)' },
  ]

  // 해당 캡쳐가 세션에 존재하는 탭만 노출. 3장 모드면 *_no_glasses 3개만,
  // 6장 모드면 6개 모두 보인다. (캡쳐 step_id 와 view 키가 동일.)
  const g_visible_tabs_arr = $derived(
    VIEW_TABS.filter((t) => session?.captures_obj?.[t.id] !== undefined),
  )
</script>

<div
  class="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--retinal-border)] bg-white p-1"
  role="tablist"
  aria-label="뷰 전환"
>
  {#each g_visible_tabs_arr as tab (tab.id)}
    {@const is_active = view === tab.id}
    <button
      class="min-h-9 rounded-md border-0 px-4 text-sm font-bold transition"
      class:bg-[var(--retinal-primary-600)]={is_active}
      class:text-white={is_active}
      class:bg-transparent={!is_active}
      class:text-slate-600={!is_active}
      class:hover:bg-[var(--retinal-soft-purple)]={!is_active}
      class:hover:text-[var(--retinal-primary-700)]={!is_active}
      type="button"
      role="tab"
      aria-selected={is_active}
      onclick={() => onview_change?.(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
