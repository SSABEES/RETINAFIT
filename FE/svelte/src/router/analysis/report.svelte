<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'
  import { clear_visit_session_data, selected_customer_obj } from '@/lib/stores/customer'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import {
    get_session,
    get_face_shape_result,
    hydrate_from_mirror,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'
  import { save_face_analysis, upload_captures_to_s3 } from '@/lib/api/analysis.js'
  import {
    get_skin_tone_recommendation,
    get_frame_styles_for_face_shape,
    get_chip_text_class,
  } from '@/lib/recommendations/frame_recommendations.js'

  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'

  const g_session = $derived(get_session())
  const g_face_shape_result = $derived(get_face_shape_result())

  const FACE_SHAPE_LABEL_OBJ = {
    oval: '계란형',
    round: '둥근형',
    heart: '하트형',
    square: '사각형',
    oblong: '긴형',
  }

  const SKIN_TONE_DESCRIPTION_OBJ = {
    COOL: '차가운 톤',
    WARM: '따뜻한 톤',
    NEUTRAL: '중성 톤',
  }

  let g_is_submitting = $state(false)
  let g_submit_error = $state('')
  // 로그아웃처럼 PATH.analysis 가 아닌 곳으로 명시적으로 이동할 때, captures 비움 → /analysis 리다이렉트
  // 의 reactive race 를 막는다. (true 면 아래 effect 는 자기 navigate 를 보류한다.)
  let g_is_navigating_away = $state(false)

  onMount(() => {
    hydrate_from_mirror()
  })

  $effect(() => {
    if (g_is_navigating_away) return
    if (Object.keys(g_session.captures_obj).length === 0) {
      navigate(PATH.analysis)
    }
  })

  // visit_select 의 GUEST_CUST_NAME('비회원') 그대로 표시하면 "비회원님" 이 돼 어색하므로 '고객님' 으로 대체.
  const g_customer_name = $derived.by(() => {
    const name = $selected_customer_obj?.name?.trim()
    if (!name || name === '비회원') return '고객님'
    return name.endsWith('님') ? name : `${name}님`
  })

  /** @param {unknown} face_shape_value */
  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '')
      .trim()
      .toLowerCase()
    if (local_value.includes('round') || local_value.includes('둥근')) return 'round'
    if (
      local_value.includes('heart') ||
      local_value.includes('triangle') ||
      local_value.includes('하트')
    )
      return 'heart'
    if (local_value.includes('square') || local_value.includes('사각')) return 'square'
    if (
      local_value.includes('oblong') ||
      local_value.includes('long') ||
      local_value.includes('긴')
    )
      return 'oblong'
    return 'oval'
  }

  const g_face_shape_key = $derived(
    normalize_face_shape_key(
      $selected_customer_obj?.face_shape ?? g_face_shape_result?.face_shape ?? 'oval',
    ),
  )

  const g_face_shape_label = $derived(FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? '계란형')

  const g_skin_tone_recommendation_obj = $derived(
    get_skin_tone_recommendation(
      g_face_shape_result?.skin_tone?.tone ?? $selected_customer_obj?.skin_tone ?? 'NEUTRAL',
    ),
  )

  const g_recommended_color_arr = $derived(g_skin_tone_recommendation_obj.chip_arr.slice(0, 4))
  const g_recommended_frame_arr = $derived(
    get_frame_styles_for_face_shape(g_face_shape_key).slice(0, 3),
  )

  const g_photo_src = $derived(
    g_session.captures_obj.front_no_glasses?.object_url ??
      g_session.captures_obj.front_glasses?.object_url ??
      null,
  )

  function on_click_back() {
    reset_session()
    navigate(PATH.analysis)
  }

  function on_click_retry() {
    reset_session()
    navigate(PATH.analysis)
  }

  // 로그아웃 — header.svelte 기본 로직과 동일하지만, capture/visit 비움이 page-local effect 의
  // /analysis 리다이렉트와 레이스하지 않도록 g_is_navigating_away 플래그를 먼저 켠다.
  function on_click_logout() {
    g_is_navigating_away = true
    reset_session()
    clear_visit_session_data()
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  function get_visit_no() {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem('retinal_visit_no')
    if (raw) {
      const visit_no = Number(raw)
      if (Number.isFinite(visit_no)) return visit_no
    }

    const selected_visit_raw = sessionStorage.getItem('retinal_selected_visit_obj')
    if (!selected_visit_raw) return null

    try {
      const selected_visit_obj = JSON.parse(selected_visit_raw)
      const visit_no = Number(selected_visit_obj?.visit_no)
      return Number.isFinite(visit_no) ? visit_no : null
    } catch {
      return null
    }
  }

  /**
   * measurements_obj 의 한 항목을 schema_version 3 의 { value_mm, value_px, source } 형태로 변환
   * @param {{ value_mm?: number | null, value_px?: number | null, source?: string } | null | undefined} item_obj
   */
  function pick_measurement_value(item_obj) {
    if (!item_obj) return null
    return {
      value_mm: item_obj.value_mm ?? null,
      value_px: item_obj.value_px ?? null,
      source: item_obj.source ?? 'auto',
    }
  }

  function build_test_json() {
    const local_face_shape_value = g_face_shape_result?.face_shape ?? g_face_shape_key
    const local_skin_tone_obj = g_face_shape_result?.skin_tone ?? null
    const local_face_shape_recommendation_arr =
      get_frame_styles_for_face_shape(local_face_shape_value)
    const local_skin_tone_recommendation_arr = g_skin_tone_recommendation_obj.chip_arr.map(
      (local_chip_obj) => ({ label: local_chip_obj.label }),
    )
    const local_measurements_obj = g_session.measurements_obj ?? {}
    const local_face_width_obj = pick_measurement_value(local_measurements_obj.face_width)
    const local_face_height_obj = pick_measurement_value(local_measurements_obj.face_height)
    const local_face_ratio_value =
      local_face_height_obj?.value_mm && local_face_width_obj?.value_mm
        ? Number((local_face_height_obj.value_mm / local_face_width_obj.value_mm).toFixed(3))
        : null

    // 측정 항목별 두 점의 픽셀 좌표를 함께 저장 — result.svelte 에서 BE 사진 위에 라인을
    // 다시 그릴 수 있게 하기 위함. 좌표는 unmirrored(원본 캡쳐) 공간 기준.
    /** @type {Record<string, [{x: number, y: number}, {x: number, y: number}]>} */
    const local_points_obj = {}
    for (const [local_id, local_item] of Object.entries(local_measurements_obj)) {
      const local_points = local_item?.points ?? null
      if (Array.isArray(local_points) && local_points.length === 2) {
        local_points_obj[local_id] = [
          { x: local_points[0].x, y: local_points[0].y },
          { x: local_points[1].x, y: local_points[1].y },
        ]
      }
    }

    // BE 사진은 정면 미착용 캡쳐의 mirrored blob — viewBox 기준이 되는 원본 dimensions 를 함께 보존.
    const local_front_capture = g_session.captures_obj?.front_no_glasses ?? null
    const local_image_dims_obj = local_front_capture
      ? { width: local_front_capture.width, height: local_front_capture.height }
      : null

    return {
      schema_version: 3,
      face_shape: local_face_shape_value,
      face_shape_recommendations: local_face_shape_recommendation_arr,
      skin_tone: local_skin_tone_obj,
      skin_tone_recommendations: local_skin_tone_recommendation_arr,
      asymmetry_score: g_face_shape_result?.asymmetry?.score ?? null,
      measurements: {
        face_width: local_face_width_obj,
        face_height: local_face_height_obj,
        pd: pick_measurement_value(local_measurements_obj.pd),
        right_pd: pick_measurement_value(local_measurements_obj.right_pd),
        left_pd: pick_measurement_value(local_measurements_obj.left_pd),
      },
      measurement_points_obj: local_points_obj,
      image_dims_obj: local_image_dims_obj,
      face_ratio: local_face_ratio_value,
      scale: g_session.scale,
    }
  }

  async function on_click_continue() {
    if (g_is_submitting) return
    g_submit_error = ''

    const visit_no = get_visit_no()
    if (visit_no === null) {
      g_submit_error = '방문 정보가 없어 분석 결과를 저장할 수 없습니다.'
      return
    }

    g_is_submitting = true
    try {
      // 1) 미착용 정면/좌측/우측 캡쳐를 S3 에 업로드해 object_key 를 받아온다.
      const local_key_map = await upload_captures_to_s3(visit_no, g_session.captures_obj)
      const local_front_key = local_key_map.front_no_glasses ?? ''
      const local_left_key = local_key_map.left_no_glasses ?? ''
      const local_right_key = local_key_map.right_no_glasses ?? ''
      const local_test_file_arr = [local_front_key, local_left_key, local_right_key].filter(Boolean)

      // 2) 받은 키를 main_file / test_file_arr 에 채워 BE PATCH 한다.
      await save_face_analysis(visit_no, {
        main_file: local_front_key,
        test_file_arr: local_test_file_arr,
        test_json: build_test_json(),
      })
      navigate(PATH.analysisLensConsult)
    } catch (err) {
      g_submit_error = err instanceof Error ? err.message : '저장에 실패했습니다.'
    } finally {
      g_is_submitting = false
    }
  }
</script>

<AnalysisPageLayout
  current_step={2}
  bg_class="bg-white text-[var(--retina-text)]"
  onback={on_click_back}
  onlogout={on_click_logout}
>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col justify-center px-7 pt-2.5 pb-1">
      <h1 class="m-0 text-center text-[18px] font-extrabold tracking-[-0.02em] text-zinc-950">
        {g_customer_name}의 얼굴 분석 결과
      </h1>

      <div
        class="mx-auto mt-2 grid w-fit px-1"
        style="grid-template-columns: 360px 300px; gap: 40px;"
      >
        <!-- 왼쪽: 촬영 사진 — 카메라와 동일한 3:4 비율, max-w-[360px] -->
        <div class="aspect-[3/4] w-[360px] overflow-hidden rounded-[14px] bg-slate-100 shadow-sm">
          {#if g_photo_src}
            <img
              class="h-full w-full object-cover"
              src={g_photo_src}
              alt={`${g_customer_name} 얼굴 사진`}
            />
          {:else}
            <div class="grid h-full w-full place-items-center text-sm font-bold text-slate-400">
              촬영 사진이 없습니다
            </div>
          {/if}
        </div>

        <!-- 오른쪽: 분석 결과 카드 — flex-col 균등 배분 -->
        <article
          class="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
        >
          <div class="grid shrink-0 grid-cols-2 gap-3">
            <div class="rounded-[8px] border border-[#FFEDD5] bg-[#FFF7ED] px-3 py-2 text-center">
              <p class="m-0 text-[12px] font-bold text-slate-700">얼굴형</p>
              <p class="m-0 mt-1 text-[13px] font-bold text-[#F97316]">
                {g_face_shape_label}
              </p>
            </div>
            <div class="rounded-[8px] border border-[#D8E2FF] bg-[#EDF0FF] px-3 py-2 text-center">
              <p class="m-0 text-[12px] font-bold text-slate-700">피부톤</p>
              <p class="m-0 mt-1 text-[13px] font-bold leading-tight text-[#1660C7]">
                {g_skin_tone_recommendation_obj.label}
                <br />
                {SKIN_TONE_DESCRIPTION_OBJ[g_skin_tone_recommendation_obj.key] ?? '중성 톤'}
              </p>
            </div>
          </div>

          <div class="my-3 h-px shrink-0 bg-slate-200"></div>

          <section class="flex min-h-0 flex-1 flex-col">
            <h2 class="m-0 shrink-0 text-center text-[13px] font-extrabold text-slate-800">
              추천 컬러
            </h2>
            <!--
              기본 4개 슬롯 (2×2) 고정 — 데이터가 없어도 그리드 자리는 예약되지만 chip 시각화는
              노출하지 않아 레이아웃은 일정하면서도 빈 chip 잔재가 안 보인다.
            -->
            <div class="mt-2 grid grid-cols-2 gap-3" style="grid-template-rows: repeat(2, 64px)">
              {#each Array.from({ length: 4 }) as _, color_index (color_index)}
                {@const local_color_obj = g_recommended_color_arr[color_index]}
                {#if local_color_obj}
                  <div
                    class={`flex items-center justify-center rounded-[10px] border border-black/5 px-3 py-2 text-center shadow-sm ${local_color_obj.tone_class}`}
                  >
                    <p class={`m-0 text-[14px] font-black ${get_chip_text_class(local_color_obj)}`}>
                      {local_color_obj.label}
                    </p>
                  </div>
                {:else}
                  <div aria-hidden="true"></div>
                {/if}
              {/each}
            </div>
          </section>

          <div class="my-3 h-px shrink-0 bg-slate-200"></div>

          <section class="flex min-h-0 flex-1 flex-col">
            <h2 class="m-0 shrink-0 text-center text-[13px] font-extrabold text-slate-800">
              추천 안경테 모양
            </h2>
            <div class="mt-2 grid grid-cols-3 gap-2">
              {#each g_recommended_frame_arr as frame_obj (`${frame_obj.name}-${frame_obj.priority}`)}
                <div
                  class={`flex items-center justify-center rounded-[6px] border bg-white px-3 py-1.5 text-center text-[15px] font-bold ${
                    frame_obj.priority === 1
                      ? 'border-[#F97316] text-[#F97316]'
                      : 'border-slate-300 text-slate-500'
                  }`}
                >
                  {frame_obj.name}
                </div>
              {/each}
            </div>
          </section>
        </article>
      </div>
    </div>

    <div class="shrink-0">
      <div class="h-px w-full bg-slate-200"></div>
      <div class="px-4 py-3">
        {#if g_submit_error}
          <p
            class="m-0 mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            role="alert"
          >
            {g_submit_error}
          </p>
        {/if}

        <div class="grid w-full grid-cols-[2fr_3fr] gap-4">
          <button
            type="button"
            class="h-[64px] cursor-pointer rounded-lg border border-slate-300 bg-white text-[22px] font-black text-black transition hover:border-slate-400 hover:text-slate-700"
            onclick={on_click_retry}
          >
            재분석
          </button>
          <button
            type="button"
            class="h-[64px] cursor-pointer rounded-lg border-0 bg-[#F97316] text-[26px] font-black tracking-tight text-black transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={g_is_submitting}
            onclick={on_click_continue}
          >
            {g_is_submitting ? '분석 결과 저장 중...' : '생활 패턴 분석하고 피팅 추천받기'}
          </button>
        </div>
      </div>
    </div>
  </section>

  <LoadingOverlay open={g_is_submitting} label="분석 결과 저장 중..." />
</AnalysisPageLayout>
