<script>
  import { ArrowLeft, RotateCcw } from 'lucide-svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path.js'
  import {
    get_session,
    get_face_shape_result,
    get_measurement_items,
    get_active_item_id,
    set_active_item_id,
    set_item_points,
    clear_item_points,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'
  import ResultHeader from '@/components/analysis/result_header.svelte'
  import MeasureCanvas from '@/components/analysis/measure_canvas.svelte'
  import MeasurementList from '@/components/analysis/measurement_list.svelte'
  import PhotoSwitcher from '@/components/analysis/photo_switcher.svelte'

  /** @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle */

  const g_session = $derived(get_session())
  const g_face_shape_result = $derived(get_face_shape_result())
  const g_active_item_id = $derived(get_active_item_id())

  let g_view = $state(/** @type {ViewAngle} */ ('front'))
  let g_bare_or_glasses = $state(/** @type {'bare' | 'glasses'} */ ('bare'))

  // 세션이 비어 있으면 (직접 URL 진입 등) /analysis 로 리다이렉트.
  $effect(() => {
    if (Object.keys(g_session.captures_obj).length === 0) {
      navigate(PATH.analysis)
    }
  })

  // 현재 뷰 + 안경 모드에 해당하는 Capture 를 선택한다.
  // 규칙: view === 'front' 이면 g_bare_or_glasses 반영, 측면은 항상 bare (프로필에서 모드 구분 UI 비노출 예정).
  const g_view_label = $derived({
    front: '정면',
    left_profile: '좌측',
    right_profile: '우측',
  }[g_view])

  const g_selected_capture = $derived(pick_capture(g_view, g_bare_or_glasses))

  /**
   * 현재 세션에서 뷰/모드에 맞는 Capture 하나를 선택한다.
   * with_glasses 모드에서는 bare/glasses 둘 다 있음, no_glasses 모드에서는 bare 만 존재.
   * glasses 를 요청했는데 해당 캡쳐가 없으면 bare 로 fallback.
   * @param {ViewAngle} view
   * @param {'bare' | 'glasses'} mode
   */
  function pick_capture(view, mode) {
    const suffix_arr = mode === 'glasses' ? ['_glasses', '_bare'] : ['_bare', '_glasses']
    const prefix = { front: 'front', left_profile: 'left', right_profile: 'right' }[view]
    for (const suffix of suffix_arr) {
      const cap = g_session.captures_obj[`${prefix}${suffix}`]
      if (cap) return cap
    }
    return null
  }

  const g_items_arr = $derived(get_measurement_items(g_view))

  // 뷰 변경 시 active/pending 해제 (active 해제는 setter 가 처리, pending 은 measure_canvas 의 effect 처리).
  $effect(() => {
    const _v = g_view
    set_active_item_id(null)
  })

  /** @param {string} item_id */
  function on_select_item(item_id) {
    set_active_item_id(item_id)
  }

  /** @param {string} item_id */
  function on_clear_item(item_id) {
    clear_item_points(item_id)
  }

  /**
   * @param {string} item_id
   * @param {[{x: number, y: number}, {x: number, y: number}]} points
   */
  function on_points_set(item_id, points) {
    set_item_points(item_id, points)
  }

  // 캔버스 ESC → active 해제.
  function on_cancel() {
    set_active_item_id(null)
  }

  /** @param {ViewAngle} v */
  function on_view_change(v) {
    g_view = v
  }

  /** @param {'bare' | 'glasses'} m */
  function on_mode_change(m) {
    g_bare_or_glasses = m
  }

  // 뒤로가기: 캡쳐 화면으로 복귀.
  function on_click_back() {
    navigate(PATH.analysis)
  }

  // "처음부터": 세션 리셋 + 캡쳐 화면으로 이동.
  function on_click_restart() {
    reset_session()
    navigate(PATH.analysis)
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055]"
        type="button"
        onclick={on_click_back}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 측정</h1>
    <div class="flex justify-end">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-zinc-900 transition hover:bg-slate-50"
        type="button"
        onclick={on_click_restart}
      >
        <RotateCcw size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>처음부터</span>
      </button>
    </div>
  </header>

  <section class="h-[calc(100%-72px)] overflow-y-auto px-8 py-6">
    <div class="mx-auto flex max-w-[1216px] flex-col gap-4">
      <ResultHeader result={g_face_shape_result} />

      <div class="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div class="flex flex-col gap-3">
          <MeasureCanvas
            capture={g_selected_capture}
            items_arr={g_items_arr}
            active_item_id={g_active_item_id}
            onpoints_set={on_points_set}
            oncancel={on_cancel}
          />
          <PhotoSwitcher
            session={g_session}
            view={g_view}
            bare_or_glasses={g_bare_or_glasses}
            onview_change={on_view_change}
            onmode_change={on_mode_change}
          />
        </div>
        <MeasurementList
          items_arr={g_items_arr}
          active_item_id={g_active_item_id}
          view_label={g_view_label}
          onselect={on_select_item}
          onclear={on_clear_item}
        />
      </div>
    </div>
  </section>
</main>
