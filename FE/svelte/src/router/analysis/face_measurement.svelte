<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Eraser, FileText, RotateCcw } from 'lucide-svelte'
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
    clear_all_measurements,
    pick_capture_for_view,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'
  import ResultHeader from '@/components/analysis/result_header.svelte'
  import MeasureCanvas from '@/components/analysis/measure_canvas.svelte'
  import MeasurementList from '@/components/analysis/measurement_list.svelte'
  import PhotoSwitcher from '@/components/analysis/photo_switcher.svelte'

  /** @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle */

  const VIEW_LABELS = {
    front_no_glasses: '정면 (미착용)',
    front_glasses:    '정면 (안경)',
    left_no_glasses:  '좌측 (미착용)',
    left_glasses:     '좌측 (안경)',
    right_no_glasses: '우측 (미착용)',
    right_glasses:    '우측 (안경)',
  }

  const g_session = $derived(get_session())
  const g_face_shape_result = $derived(get_face_shape_result())
  const g_active_item_id = $derived(get_active_item_id())

  let g_view = $state(/** @type {ViewAngle} */ ('front_no_glasses'))

  // 세션이 비어 있으면 (직접 URL 진입 등) /analysis 로 리다이렉트.
  $effect(() => {
    if (Object.keys(g_session.captures_obj).length === 0) {
      navigate(PATH.analysis)
    }
  })

  // 마운트 시점에 query param ?item=xxx 가 있으면 해당 항목을 자동 활성화.
  // 리포트의 "측정하기" 버튼 deep-link 진입 동선을 지원한다.
  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const initial_item = params.get('item')
    if (initial_item) set_active_item_id(initial_item)
  })

  const g_view_label = $derived(VIEW_LABELS[g_view])
  const g_selected_capture = $derived(pick_capture_for_view(g_view))
  const g_items_arr = $derived(get_measurement_items(g_view))

  // 뷰 변경 시 active 해제 (캔버스의 pending 상태도 measure_canvas 의 effect 가 함께 정리).
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

  function on_click_back() {
    navigate(PATH.analysis)
  }

  // "측정값 모두 지우기" — 캡쳐는 유지하고 measurements_obj 만 초기화 (자동 항목은 다시 채워짐).
  function on_click_clear_all() {
    clear_all_measurements()
  }

  // "리포트 보기" — 분석 리포트 화면으로 이동. 측정값은 세션에 그대로 유지.
  function on_click_view_report() {
    navigate(PATH.analysisReport)
  }

  // "처음부터" — 세션 전체 리셋 후 캡쳐 화면으로.
  function on_click_restart() {
    reset_session()
    navigate(PATH.analysis)
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--retinal-border)] bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 text-base font-bold text-slate-600 transition hover:text-[var(--retinal-primary-700)]"
        type="button"
        onclick={on_click_back}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 측정</h1>
    <div class="flex items-center justify-end gap-2">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retinal-border)] bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        type="button"
        onclick={on_click_clear_all}
      >
        <Eraser size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>측정값 모두 지우기</span>
      </button>
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[var(--retinal-primary-600)] px-3 text-sm font-bold text-white transition hover:bg-[var(--retinal-primary-700)]"
        type="button"
        onclick={on_click_view_report}
      >
        <FileText size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>리포트 보기</span>
      </button>
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retinal-border)] bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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
            onview_change={on_view_change}
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
