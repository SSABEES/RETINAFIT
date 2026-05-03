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
  let { session, view = 'front_no_glasses', onview_change = undefined } = $props()

  /** @type {{ id: ViewAngle, label: string }[]} */
  const NO_GLASSES_TABS = [
    { id: 'front_no_glasses', label: '정면' },
    { id: 'left_no_glasses', label: '좌측' },
    { id: 'right_no_glasses', label: '우측' },
  ]

  /** @type {{ id: ViewAngle, label: string }[]} */
  const GLASSES_TABS = [
    { id: 'front_glasses', label: '정면' },
    { id: 'left_glasses', label: '좌측' },
    { id: 'right_glasses', label: '우측' },
  ]

  // 두 줄 구조 — 미착용 / 착용 행을 미리 분리. 6장 모두 들어와도 깨지지 않는 고정 레이아웃.
  // 각 행 안에서는 캡쳐가 존재하는 항목만 active 가능 (없으면 disabled 처리).
</script>

<div class="flex flex-col gap-2" role="tablist" aria-label="뷰 전환">
  <div class="flex items-center gap-2">
    <span class="w-12 flex-none text-[11px] font-bold text-slate-500">미착용</span>
    <div class="flex flex-1 gap-1 rounded-[10px] bg-slate-100 p-1">
      {#each NO_GLASSES_TABS as tab (tab.id)}
        {@const is_active = view === tab.id}
        {@const has_capture = session?.captures_obj?.[tab.id] !== undefined}
        <button
          class="min-h-9 flex-1 rounded-[8px] border-0 px-2 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
          class:bg-[#F97316]={is_active}
          class:text-white={is_active}
          class:bg-transparent={!is_active}
          class:text-slate-600={!is_active && has_capture}
          class:text-slate-400={!has_capture}
          class:hover:bg-[#FFF6EB]={!is_active && has_capture}
          class:hover:text-[#F97316]={!is_active && has_capture}
          type="button"
          role="tab"
          aria-selected={is_active}
          disabled={!has_capture}
          onclick={() => has_capture && onview_change?.(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>
  <div class="flex items-center gap-2">
    <span class="w-12 flex-none text-[11px] font-bold text-slate-500">착용</span>
    <div class="flex flex-1 gap-1 rounded-[10px] bg-slate-100 p-1">
      {#each GLASSES_TABS as tab (tab.id)}
        {@const is_active = view === tab.id}
        {@const has_capture = session?.captures_obj?.[tab.id] !== undefined}
        <button
          class="min-h-9 flex-1 rounded-[8px] border-0 px-2 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
          class:bg-[#F97316]={is_active}
          class:text-white={is_active}
          class:bg-transparent={!is_active}
          class:text-slate-600={!is_active && has_capture}
          class:text-slate-400={!has_capture}
          class:hover:bg-[#FFF6EB]={!is_active && has_capture}
          class:hover:text-[#F97316]={!is_active && has_capture}
          type="button"
          role="tab"
          aria-selected={is_active}
          disabled={!has_capture}
          onclick={() => has_capture && onview_change?.(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>
</div>
