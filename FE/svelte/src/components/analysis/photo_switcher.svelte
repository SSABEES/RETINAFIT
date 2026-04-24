<script>
  /**
   * @typedef {import('@/lib/stores/capture_session.svelte.js').CaptureSessionState} CaptureSessionState
   * @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle
   */

  /** @type {{
   *   session?: CaptureSessionState,
   *   view?: ViewAngle,
   *   bare_or_glasses?: 'bare' | 'glasses',
   *   onview_change?: ((view: ViewAngle) => void) | undefined,
   *   onmode_change?: ((mode: 'bare' | 'glasses') => void) | undefined,
   * }}
   */
  let {
    session,
    view = 'front',
    bare_or_glasses = 'bare',
    onview_change = undefined,
    onmode_change = undefined,
  } = $props()

  /** @type {{ id: ViewAngle, label: string }[]} */
  const VIEW_TABS = [
    { id: 'front',         label: '정면' },
    { id: 'left_profile',  label: '좌측' },
    { id: 'right_profile', label: '우측' },
  ]

  // 해당 포즈가 스텝에 존재하는 뷰만 노출. 모든 모드가 3가지 뷰를 다 포함하지만
  // 규칙을 명시적으로 지켜 장래 구성 변경에도 견고하게 한다.
  const g_visible_tabs_arr = $derived(
    VIEW_TABS.filter((t) => session?.steps_arr?.some((s) => s.pose_type === t.id)),
  )
  const g_show_mode_sub = $derived(session?.glasses_mode === 'with_glasses')
</script>

<div class="flex flex-col gap-2">
  <div
    class="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1"
    role="tablist"
    aria-label="뷰 전환"
  >
    {#each g_visible_tabs_arr as tab (tab.id)}
      {@const is_active = view === tab.id}
      <button
        class="min-h-9 rounded-md border-0 px-4 text-sm font-bold transition"
        class:bg-[#4B0055]={is_active}
        class:text-white={is_active}
        class:bg-transparent={!is_active}
        class:text-slate-700={!is_active}
        type="button"
        role="tab"
        aria-selected={is_active}
        onclick={() => onview_change?.(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if g_show_mode_sub}
    <div
      class="inline-flex gap-1 self-start rounded-lg border border-slate-200 bg-white p-0.5"
      role="tablist"
      aria-label="안경 착용 여부"
    >
      {#each [{ id: 'bare', label: '미착용' }, { id: 'glasses', label: '안경 착용' }] as mode (mode.id)}
        {@const is_active = bare_or_glasses === mode.id}
        <button
          class="min-h-8 rounded-md border-0 px-3 text-xs font-bold transition"
          class:bg-slate-900={is_active}
          class:text-white={is_active}
          class:bg-transparent={!is_active}
          class:text-slate-600={!is_active}
          type="button"
          role="tab"
          aria-selected={is_active}
          onclick={() => onmode_change?.(/** @type {'bare' | 'glasses'} */ (mode.id))}
        >
          {mode.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
