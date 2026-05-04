<script>
  import { onMount } from 'svelte'
  import { Eraser, FileText } from 'lucide-svelte'
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
  } from '@/lib/stores/capture_session.svelte.js'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import { EAR_HEIGHT_DIFF_THRESHOLD_MM } from '@/lib/measurements/thresholds.js'
  import Header from '@/components/layout/header.svelte'
  import MeasureCanvas from '@/components/analysis/measure_canvas.svelte'
  import MeasurementList from '@/components/analysis/measurement_list.svelte'
  import PhotoSwitcher from '@/components/analysis/photo_switcher.svelte'
  import ConfirmModal from '@/components/modal/confirm_modal.svelte'

  /**
   * 부호 있는 mm 값을 표시 문자열로 변환. null/undefined 면 '—'.
   * 음수는 U+2212 minus sign 으로 표기 (시각적 일관성).
   * @param {number | null | undefined} value_mm
   * @returns {string}
   */
  function format_signed_mm(value_mm) {
    if (value_mm === null || value_mm === undefined) return '—'
    const sign = value_mm >= 0 ? '' : '−'
    return `${sign}${Math.abs(value_mm).toFixed(1)} mm`
  }

  /** @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle */

  const VIEW_LABELS = {
    front_no_glasses: '정면 (미착용)',
    front_glasses: '정면 (안경)',
    left_no_glasses: '좌측 (미착용)',
    left_glasses: '좌측 (안경)',
    right_no_glasses: '우측 (미착용)',
    right_glasses: '우측 (안경)',
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
    g_view
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

  // 로그아웃 — report.svelte 와 동일 로직: 토큰/자동로그인/admin 선택 모두 비우고 로그인 화면으로.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  // "측정값 초기화" 확인 모달 — 사용자가 동작 의미를 정확히 인지 후 진행하도록 분리.
  let g_show_clear_modal = $state(false)

  // 버튼 클릭은 모달만 띄움. 실제 초기화는 모달의 onconfirm 에서.
  function on_click_clear_all() {
    g_show_clear_modal = true
  }

  // 모달 확인: 수동 측정 항목 제거 + 자동 항목은 캡처 시점 자동값으로 복원.
  function on_confirm_clear() {
    clear_all_measurements()
    g_show_clear_modal = false
  }

  function on_cancel_clear() {
    g_show_clear_modal = false
  }

  // "리포트 보기" — 분석 리포트 화면으로 이동. 측정값은 세션에 그대로 유지.
  function on_click_view_report() {
    navigate(PATH.analysisReport)
  }
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-[var(--retina-text)]">
  <Header onback={on_click_back} onlogout={on_click_logout} />

  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col px-7 pt-2.5 pb-1">
      <h1 class="m-0 text-center text-[18px] font-extrabold tracking-[-0.02em] text-[var(--retina-text)]">
        얼굴 측정
      </h1>

      <!--
        grid-rows-[minmax(0,1fr)] 로 row 가 grid 의 가용 높이를 다 채우게 한다 — 기본 auto rows 는
        item content 따라 변동해서 좌/우 사이즈가 view 별로 흔들렸던 게 root cause. minmax(0,1fr)
        는 충분히 작아질 수도 있고 (overflow 안 깨짐) 가용 공간을 다 채울 수도 있음.
        외곽 (main / 상위 section 의 overflow-hidden + flex-1 체인) 이 viewport 경계 보장.
      -->
      <div class="mx-auto mt-2 grid h-full min-h-0 w-full max-w-[760px] grid-cols-[0.98fr_0.92fr] grid-rows-[minmax(0,1fr)] gap-4 px-1">
        <section class="flex min-h-0 items-center justify-center">
          <!--
            aspect-[3/4] + max-h-full — width 기반 비율 유지, 단 row 가 좁으면 height 캡 내에서 비율
            유지하며 axisflip. content 변동 면역.
          -->
          <div class="flex aspect-[3/4] max-h-full w-full max-w-[348px] overflow-hidden rounded-[14px] bg-slate-100 shadow-[0_8px_20px_rgba(15,23,42,0.07)]">
            <MeasureCanvas
              capture={g_selected_capture}
              items_arr={g_items_arr}
              active_item_id={g_active_item_id}
              onpoints_set={on_points_set}
              oncancel={on_cancel}
            />
          </div>
        </section>

        <section class="flex min-h-0 justify-center">
          <!--
            article 은 cell 의 가용 높이를 끝까지 사용 (h-full + min-h-0). 컨텐츠가 cell 을 넘기면
            overflow-y-auto 로 내부 스크롤. items-center 제거 — 기본 stretch 로 동작해 자연스럽게
            높이 채움. fixed h-[N] 보다 강건: 큰 화면에선 더 길게, 작은 화면에선 viewport 안에 안전.
          -->
          <article class="flex h-full min-h-0 w-full max-w-[368px] flex-col gap-4 overflow-y-auto rounded-[14px] border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_20px_rgba(15,23,42,0.07)]">
          <PhotoSwitcher session={g_session} view={g_view} onview_change={on_view_change} />
          <div class="h-px bg-slate-200"></div>
          <MeasurementList
            items_arr={g_items_arr}
            active_item_id={g_active_item_id}
            view_label={g_view_label}
            onselect={on_select_item}
            onclear={on_clear_item}
          />
          {#if g_view === 'front_no_glasses' && g_face_shape_result?.ear_offsets_obj}
            {@const eo = g_face_shape_result.ear_offsets_obj}
            {@const ear_diff_mm = (eo.right_y_offset_mm !== null && eo.left_y_offset_mm !== null)
              ? Math.abs(eo.right_y_offset_mm - eo.left_y_offset_mm)
              : null}
            {@const ear_diff_flagged = ear_diff_mm !== null && ear_diff_mm >= EAR_HEIGHT_DIFF_THRESHOLD_MM}
            <div class="h-px bg-slate-200"></div>
            <section class="flex flex-col gap-2" aria-label="자동 산출 귀 높이 (참고)">
              <div class="flex items-baseline justify-between">
                <h3 class="m-0 text-[13px] font-extrabold text-slate-800">귀 높이 (자동)</h3>
                <span class="text-xs font-semibold text-slate-500">눈선 기준 ± 편차</span>
              </div>
              <ul class="m-0 flex list-none flex-col gap-1 p-0">
                <li class="flex items-center gap-3 px-3 py-2">
                  <span class="flex-1 truncate text-sm font-semibold text-slate-700">우측 귀 높이</span>
                  <span class="flex-none text-sm font-bold tabular-nums text-[var(--retina-text)]">
                    {format_signed_mm(eo.right_y_offset_mm)}
                  </span>
                  <span class="flex-none rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">자동</span>
                </li>
                <li class="flex items-center gap-3 px-3 py-2">
                  <span class="flex-1 truncate text-sm font-semibold text-slate-700">좌측 귀 높이</span>
                  <span class="flex-none text-sm font-bold tabular-nums text-[var(--retina-text)]">
                    {format_signed_mm(eo.left_y_offset_mm)}
                  </span>
                  <span class="flex-none rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">자동</span>
                </li>
                {#if ear_diff_mm !== null}
                  <li class="mt-1 flex items-center gap-3 border-t border-slate-100 px-3 pt-2">
                    <span class="flex-1 truncate text-sm font-semibold text-slate-600">좌우 차이</span>
                    <span
                      class="flex-none text-sm font-bold tabular-nums"
                      class:text-amber-600={ear_diff_flagged}
                      class:text-emerald-600={!ear_diff_flagged}
                    >
                      {ear_diff_mm.toFixed(1)} mm{ear_diff_flagged ? ' (큼)' : ''}
                    </span>
                  </li>
                {/if}
              </ul>
            </section>
          {/if}
          </article>
        </section>
      </div>
    </div>
  </section>

  <footer class="shrink-0 border-t border-slate-100 bg-white px-7 py-2.5">
    <div class="mx-auto grid w-full max-w-[820px] grid-cols-[260px_minmax(0,520px)] justify-center gap-4">
      <button
        type="button"
        class="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[15px] font-extrabold text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
        onclick={on_click_clear_all}
      >
        <Eraser size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>측정값 초기화</span>
      </button>
      <button
        type="button"
        class="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#F97316] px-6 text-[15px] font-extrabold text-white transition hover:bg-[#EA580C]"
        onclick={on_click_view_report}
      >
        <FileText size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>리포트 보기</span>
      </button>
    </div>
  </footer>

  <ConfirmModal
    open={g_show_clear_modal}
    title="측정값 초기화"
    message="직접 측정한 값은 모두 지워지고, 자동 측정값은 캡처 시점 값으로 복원됩니다."
    cancelLabel="취소"
    confirmLabel="초기화"
    onclose={on_cancel_clear}
    oncancel={on_cancel_clear}
    onconfirm={on_confirm_clear}
  />
</main>
