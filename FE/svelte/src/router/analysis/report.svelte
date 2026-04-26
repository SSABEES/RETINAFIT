<script>
  import { onMount } from 'svelte'
  import { Link, navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, Camera, ChevronRight, Ear, ScanFace, Sparkles } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { selected_customer_obj } from '@/lib/stores/customer'
  import {
    get_session,
    get_face_shape_result,
    get_measurement_items,
    hydrate_from_mirror,
  } from '@/lib/stores/capture_session.svelte.js'
  import { compute_evaluations } from '@/lib/measurements/measurement_evaluator.js'
  import { points_to_overlay_line } from '@/lib/measurements/overlay_utils.js'

  /** @typedef {import('@/lib/measurements/template.js').ViewAngle} ViewAngle */

  /** @type {{ key: ViewAngle, label: string, image_caption: string, title: string, measure_title: string, sub_card_title: string }[]} */
  const TAB_DEFS = [
    { key: 'front_no_glasses', label: '정면 (미착용)',  image_caption: '정면 사진 (미착용)',     title: '정면 얼굴 분석',     measure_title: '얼굴 측정값', sub_card_title: '핏 평가' },
    { key: 'front_glasses',    label: '정면 (안경 착용)', image_caption: '정면 사진 (안경 착용)',  title: '정면 안경 착용 분석', measure_title: '안경 측정',   sub_card_title: '프레임 핏 분석' },
    { key: 'left_no_glasses',  label: '왼쪽 측면 (미착용)', image_caption: '왼쪽 측면 사진 (미착용)', title: '왼쪽 측면 분석',    measure_title: '측면 측정',   sub_card_title: '핏 평가' },
    { key: 'left_glasses',     label: '왼쪽 측면 (안경 착용)', image_caption: '왼쪽 측면 사진 (안경 착용)', title: '왼쪽 측면 안경 착용 분석', measure_title: '측면 프레임 측정', sub_card_title: '핏 평가' },
    { key: 'right_no_glasses', label: '오른쪽 측면 (미착용)', image_caption: '오른쪽 측면 사진 (미착용)', title: '오른쪽 측면 분석',  measure_title: '측면 측정',   sub_card_title: '핏 평가' },
    { key: 'right_glasses',    label: '오른쪽 측면 (안경 착용)', image_caption: '오른쪽 측면 사진 (안경 착용)', title: '오른쪽 측면 안경 착용 분석', measure_title: '측면 프레임 측정', sub_card_title: '핏 평가' },
  ]

  const g_session = $derived(get_session())
  const g_face_shape_result = $derived(get_face_shape_result())

  // 세션 캡쳐가 존재하는 탭만 노출. 3장 모드: *_no_glasses 3개. 6장 모드: 6개 모두.
  const g_view_tab_arr = $derived(TAB_DEFS.filter((t) => g_session.captures_obj[t.key]))

  /**
   * 측정값을 표시 문자열로 변환. mm 우선, 없으면 px, 둘 다 없으면 '—'.
   * @param {{ value_mm?: number | null, value_px: number | null }} item
   * @returns {string}
   */
  function format_measure_value(item) {
    if (item.value_mm !== null && item.value_mm !== undefined) {
      return `${item.value_mm.toFixed(1)} mm`
    }
    if (item.value_px !== null && item.value_px !== undefined) {
      return `${Math.round(item.value_px)} px`
    }
    return '—'
  }

  /**
   * 평가 톤 → 텍스트 컬러 클래스 매핑.
   * @param {'emerald' | 'amber' | 'red' | 'slate'} tone
   * @returns {string}
   */
  function eval_tone_class(tone) {
    if (tone === 'emerald') return 'text-emerald-600'
    if (tone === 'amber') return 'text-amber-600'
    if (tone === 'red') return 'text-red-600'
    return 'text-slate-600'
  }

  // 6개 탭 각각의 분석 데이터를 세션에서 동적으로 빌드.
  // measure_arr 의 각 item 은 라벨/값/오버레이 좌표(%) 를 담는다.
  // 미측정 항목은 has_value=false 로 표시되어 템플릿에서 deep-link 처리됨.
  const g_analysis_by_tab_obj = $derived.by(() => {
    /** @type {Record<string, any>} */
    const result = {}
    const evaluations = compute_evaluations(g_session.measurements_obj)
    for (const tab of TAB_DEFS) {
      const capture = g_session.captures_obj[tab.key]
      const items = get_measurement_items(tab.key)
      const measure_arr = items.map((item) => {
        const overlay_line = capture && item.points
          ? points_to_overlay_line(item.points, capture.width, capture.height)
          : null
        return {
          label: item.label,
          item_id: item.item_id,
          value: format_measure_value(item),
          has_value: item.value_px !== null,
          source: item.source,
          note: '',
          tone: item.value_px !== null ? 'text-zinc-950' : 'text-slate-400',
          overlay_arr: overlay_line ? [overlay_line] : [],
        }
      })
      // 이 뷰의 측정값에 의존하는 평가만 sub_measure 로 노출.
      const sub_measure_arr = Object.values(evaluations)
        .filter((ev) => ev.depends_on.some((id) => items.find((it) => it.item_id === id)))
        .map((ev) => ({
          label: ev.label,
          value: ev.value_text,
          tone: eval_tone_class(ev.tone),
          overlay_arr: [],
        }))
      result[tab.key] = {
        image_caption: tab.image_caption,
        image_src: capture?.object_url ?? null,
        title: tab.title,
        measure_title: tab.measure_title,
        sub_card_title: tab.sub_card_title,
        measure_arr,
        sub_measure_arr,
      }
    }
    return result
  })

  const g_face_shape_meta_obj = {
    oval: { label: '계란형', aliases: ['계란형', '타원형', 'oval'] },
    round: { label: '둥근형', aliases: ['둥근형', 'round'] },
    heart: { label: '하트형', aliases: ['하트형', 'heart'] },
    square: { label: '사각형', aliases: ['사각형', 'square'] },
    oblong: { label: '긴형', aliases: ['긴형', '긴 얼굴형', 'oblong'] },
  }

  // 안경테 카탈로그. 각 프레임 이름과 어울리는 얼굴형 키를 매핑한다.
  const g_frame_catalog_arr = [
    { name: '라운드', face_shape_key_arr: ['square', 'oblong'] },
    { name: '오벌', face_shape_key_arr: ['oval', 'round', 'heart', 'square', 'oblong'] },
    { name: '스퀘어', face_shape_key_arr: ['round', 'oval'] },
    { name: '직사각형', face_shape_key_arr: ['round', 'oblong'] },
    { name: '보잉', face_shape_key_arr: ['square', 'heart'] },
    { name: '캣아이', face_shape_key_arr: ['round', 'square'] },
    { name: '브로우라인', face_shape_key_arr: ['oval', 'square'] },
    { name: '기하학', face_shape_key_arr: ['oval', 'round'] },
    { name: '오버사이즈', face_shape_key_arr: ['oblong', 'oval'] },
    { name: '림리스', face_shape_key_arr: ['oval', 'round', 'heart', 'square', 'oblong'] },
  ]

  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '')
      .trim()
      .toLowerCase()

    for (const [face_shape_key, face_shape_meta_obj] of Object.entries(g_face_shape_meta_obj)) {
      if (
        face_shape_meta_obj.aliases.some((alias_value) => alias_value.toLowerCase() === local_value)
      ) {
        return face_shape_key
      }
    }

    return 'oval'
  }

  function normalize_gender_key(gender_value) {
    const local_value = String(gender_value ?? '')
      .trim()
      .toLowerCase()

    if (['0', 'm', 'male', 'man', '남', '남자'].includes(local_value)) {
      return 'man'
    }

    return 'woman'
  }

  function get_face_image_src(face_shape_key, gender_key) {
    const local_gender_key = gender_key === 'man' ? 'man' : 'woman'

    return {
      man: {
        oval: '/face/man/oval_man.png',
        round: '/face/man/round_man.png',
        heart: '/face/man/heart_man.png',
        square: '/face/man/square_man.png',
        oblong: '/face/man/oblong_man.png',
      },
      woman: {
        oval: '/face/woman/oval_woman.png',
        round: '/face/woman/round_woman.png',
        heart: '/face/woman/heart_woman.png',
        square: '/face/woman/square_woman.png',
        oblong: '/face/woman/oblong.png',
      },
    }[local_gender_key][face_shape_key]
  }

  function get_skin_tone_meta(skin_tone_value) {
    const local_value = String(skin_tone_value ?? '')
      .trim()
      .toUpperCase()

    if (local_value === 'COOL' || local_value.includes('쿨')) {
      return {
        label: 'COOL',
        detail: '차가운 톤',
        chips: [
          { label: '실버', tone_class: 'bg-[#A7B0BC]' },
          { label: '블랙', tone_class: 'bg-[#111827]' },
          { label: '블루', tone_class: 'bg-[#4A6CF7]' },
          { label: '퍼플', tone_class: 'bg-[#8B5CF6]' },
        ],
      }
    }

    if (
      local_value === 'NEUTRAL' ||
      local_value.includes('뉴트럴') ||
      local_value.includes('중성')
    ) {
      return {
        label: 'NEUTRAL',
        detail: '중성 톤',
        chips: [
          { label: '모든 색상 가능', tone_class: 'bg-[#64748B]' },
          { label: '고객 선호 반영', tone_class: 'bg-[#9A1BFF]' },
          { label: '균형감 있는 색', tone_class: 'bg-[#94A3B8]' },
          { label: '무난한 선택', tone_class: 'bg-[#C084FC]' },
        ],
      }
    }

    return {
      label: 'WARM',
      detail: '따뜻한 톤',
      chips: [
        { label: '골드', tone_class: 'bg-[#D4A63F]' },
        { label: '브라운', tone_class: 'bg-[#8B5E3C]' },
        { label: '버건디', tone_class: 'bg-[#7A1E3A]' },
        { label: '토트이즈', tone_class: 'bg-[#B86B2C]' },
      ],
    }
  }

  let g_customer_name = $derived(
    $selected_customer_obj?.name
      ? $selected_customer_obj.name.endsWith('님')
        ? $selected_customer_obj.name
        : `${$selected_customer_obj.name}님`
      : '고객님',
  )

  // 얼굴형 우선순위: 고객 객체의 face_shape > 세션 분류 결과 > 기본 'oval'.
  let g_customer_face_shape_key = $derived(
    normalize_face_shape_key(
      $selected_customer_obj?.face_shape ?? g_face_shape_result?.face_shape ?? 'oval',
    ),
  )

  // 현재 고객 얼굴형 키에 어울리는 안경테만 카탈로그에서 추출한다.
  let g_recommended_frame_arr = $derived(
    g_frame_catalog_arr.filter((frame_obj) =>
      frame_obj.face_shape_key_arr.includes(g_customer_face_shape_key),
    ),
  )

  let g_summary_card_arr = $derived([
    {
      title: '얼굴형',
      value: g_face_shape_meta_obj[g_customer_face_shape_key].label,
      image_src: get_face_image_src(
        g_customer_face_shape_key,
        normalize_gender_key($selected_customer_obj?.gender),
      ),
    },
    {
      title: '피부톤 분석',
      value: get_skin_tone_meta($selected_customer_obj?.skin_tone ?? 'WARM').label,
    },
    {
      title: '추천 프레임',
    },
  ])

  // 마운트 시점에 세션 미러 복원 시도. 캡쳐 자체가 메모리 휘발이라
  // 새로고침 후엔 captures_obj 가 비어 가드가 /analysis 로 돌려보낸다.
  onMount(() => {
    hydrate_from_mirror()
  })

  // 세션이 비어 있으면 (직접 URL 진입 등) /analysis 로 리다이렉트.
  $effect(() => {
    if (Object.keys(g_session.captures_obj).length === 0) {
      navigate(PATH.analysis)
    }
  })

  // 활성 탭 — 첫 노출 가능 탭(보통 front_no_glasses 또는 front_glasses) 자동 초기화.
  let ref_active_tab = $state(/** @type {string} */ (''))
  $effect(() => {
    if (!ref_active_tab && g_view_tab_arr.length > 0) {
      ref_active_tab = g_view_tab_arr[0].key
    }
  })
  let g_active_analysis_obj = $derived(
    ref_active_tab ? g_analysis_by_tab_obj[ref_active_tab] : null,
  )

  // 상단 네비게이션 탭을 통해 전환할 메인 뷰 종류 목록.
  const g_main_view_tab_arr = [
    { key: 'summary', label: '얼굴 분석 요약' },
    { key: 'measurements', label: '얼굴 수치' },
  ]

  let ref_main_view = $state('summary')

  // 현재 이미지 위에 오버레이를 표시할 측정 항목의 key (라벨). null이면 아무것도 표시 안 함.
  let ref_selected_measure_key = $state(null)

  // 현재 탭의 모든 측정 항목(주/보조)에서 선택된 key에 해당하는 overlay 배열을 찾는다.
  let g_active_overlay_arr = $derived.by(() => {
    if (!ref_selected_measure_key || !g_active_analysis_obj) return null
    const local_all_measure_arr = [
      ...(g_active_analysis_obj.measure_arr ?? []),
      ...(g_active_analysis_obj.sub_measure_arr ?? []),
    ]
    const local_hit_obj = local_all_measure_arr.find(
      (measure_obj) => measure_obj.label === ref_selected_measure_key,
    )
    return local_hit_obj?.overlay_arr ?? null
  })

  // 사진 각도별 수치 탭을 선택하면 활성 탭을 갱신하고 선택된 측정을 초기화한다.
  function on_click_select_tab(tab_key) {
    ref_active_tab = tab_key
    ref_selected_measure_key = null
  }

  // 상단 네비게이션에서 메인 뷰(요약/수치)를 선택하면 활성 뷰와 선택된 측정을 초기화한다.
  function on_click_select_main_view(view_key) {
    ref_main_view = view_key
    ref_selected_measure_key = null
  }

  // 측정 항목 행 클릭 시 선택을 토글한다. 같은 항목 다시 누르면 해제.
  function on_click_select_measure(measure_label) {
    ref_selected_measure_key = ref_selected_measure_key === measure_label ? null : measure_label
  }
</script>

<main
  class="app-frame-page flex h-full flex-col overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]"
>
  <header
    class="grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <Link
        class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[var(--retinal-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/20"
        href={PATH.analysis}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </Link>
    </div>

    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 분석</h1>

    <div></div>
  </header>

  <div class="flex min-h-0 flex-1 flex-col px-8 py-6">
    <div class="mx-auto flex h-full w-full max-w-[1216px] flex-col gap-6">
      <section
        class="shrink-0 rounded-lg border border-slate-200 bg-white px-8 py-5 shadow-sm shadow-slate-200/50"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{g_customer_name}</h2>

          <div class="flex gap-2" role="tablist" aria-label="얼굴 분석 메인 뷰">
            {#each g_main_view_tab_arr as main_tab_obj (main_tab_obj.key)}
              <button
                class={`min-h-11 cursor-pointer rounded-full border px-6 text-base font-extrabold transition ${
                  ref_main_view === main_tab_obj.key
                    ? 'border-[var(--retinal-primary-600)] bg-[var(--retinal-primary-600)] text-white shadow-lg shadow-purple-950/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--retinal-primary-600)]/40 hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)]'
                }`}
                type="button"
                role="tab"
                aria-selected={ref_main_view === main_tab_obj.key}
                onclick={() => on_click_select_main_view(main_tab_obj.key)}
              >
                {main_tab_obj.label}
              </button>
            {/each}
          </div>
        </div>
      </section>

      <div class="min-h-0 flex-1">
        {#if ref_main_view === 'summary'}
          <section
            class="h-full overflow-y-auto rounded-lg border border-slate-200 bg-white px-8 py-8 shadow-sm shadow-slate-200/50"
          >
            <div class="grid grid-cols-3 gap-6">
              {#each g_summary_card_arr as summary_obj (summary_obj.title)}
                <article
                  class="min-h-[244px] rounded-lg border border-slate-200 bg-white px-6 py-6"
                >
                  <div class="flex items-center gap-2">
                    {#if summary_obj.title === '추천 프레임'}
                      <Sparkles
                        size={21}
                        strokeWidth={2.4}
                        class="text-[var(--retinal-primary-600)]"
                        aria-hidden="true"
                      />
                    {:else if summary_obj.title === '얼굴형'}
                      <ScanFace
                        size={21}
                        strokeWidth={2.4}
                        class="text-[var(--retinal-primary-600)]"
                        aria-hidden="true"
                      />
                    {:else}
                      <Ear
                        size={21}
                        strokeWidth={2.4}
                        class="text-[var(--retinal-primary-600)]"
                        aria-hidden="true"
                      />
                    {/if}
                    <h3 class="m-0 text-xl font-extrabold text-zinc-950">{summary_obj.title}</h3>
                  </div>

                  {#if summary_obj.title === '얼굴형'}
                    <div class="mt-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div class="aspect-[4/5] bg-slate-100">
                        <img
                          class="h-full w-full object-cover object-center"
                          src={summary_obj.image_src}
                          alt={`${summary_obj.value} 얼굴형`}
                        />
                      </div>
                      <div class="px-4 py-3 text-center">
                        <p
                          class="m-0 text-3xl font-extrabold tracking-normal text-[var(--retinal-primary-600)]"
                        >
                          {summary_obj.value}
                        </p>
                      </div>
                    </div>
                  {:else if summary_obj.title === '피부톤 분석'}
                    <div
                      class="mt-7 grid gap-5 rounded-lg border border-slate-200 bg-white px-5 py-5"
                    >
                      <section class="border-b border-slate-100 pb-5">
                        <div class="mb-3 flex items-center gap-2">
                          <span class="h-2.5 w-2.5 rounded-full bg-[var(--retinal-primary-600)]"
                          ></span>
                          <h4 class="m-0 text-base font-extrabold text-zinc-950">피부톤 결과</h4>
                        </div>
                        <p
                          class="m-0 text-4xl font-extrabold tracking-normal text-[var(--retinal-primary-600)]"
                        >
                          {get_skin_tone_meta(summary_obj.value).label}
                        </p>
                      </section>

                      <section>
                        <div class="mb-3 flex items-center gap-2">
                          <span class="h-2.5 w-2.5 rounded-full bg-[var(--retinal-primary-600)]"
                          ></span>
                          <h4 class="m-0 text-base font-extrabold text-zinc-950">
                            안경테 컬러 추천
                          </h4>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          {#each get_skin_tone_meta(summary_obj.value).chips as chip_obj, chip_index (`${chip_obj.label}-${chip_index}`)}
                            <span
                              class={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-white ${chip_obj.tone_class}`}
                            >
                              <span class="h-2.5 w-2.5 rounded-full bg-white/80"></span>
                              {chip_obj.label}
                            </span>
                          {/each}
                        </div>
                      </section>
                    </div>
                  {:else if summary_obj.title === '추천 프레임'}
                    <div class="mt-7 flex flex-wrap gap-2">
                      {#each g_recommended_frame_arr as frame_obj (frame_obj.name)}
                        <span
                          class="inline-flex min-h-11 items-center rounded-lg bg-[var(--retinal-primary-600)] px-4 py-2 text-base font-extrabold text-white"
                        >
                          {frame_obj.name}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          </section>
        {:else if ref_main_view === 'measurements'}
          <section
            class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/50"
          >
            <div class="flex shrink-0 flex-wrap gap-2">
              {#each g_view_tab_arr as tab_obj (tab_obj.key)}
                <button
                  class={`min-h-10 cursor-pointer rounded-full border px-5 text-sm font-extrabold transition ${
                    ref_active_tab === tab_obj.key
                      ? 'border-[var(--retinal-primary-600)] bg-[var(--retinal-primary-600)] text-white shadow-md shadow-purple-950/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--retinal-primary-600)]/40 hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)]'
                  }`}
                  type="button"
                  aria-pressed={ref_active_tab === tab_obj.key}
                  onclick={() => on_click_select_tab(tab_obj.key)}
                >
                  {tab_obj.label}
                </button>
              {/each}
            </div>

            {#if g_active_analysis_obj}
            <div class="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,520px)_1fr] gap-6">
              <figure class="m-0 flex min-h-0 flex-col">
                <div
                  class="relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-lg bg-[#111827] text-slate-500"
                >
                  {#if g_active_analysis_obj.image_src}
                    <img
                      class="h-full w-full object-cover"
                      src={g_active_analysis_obj.image_src}
                      alt={g_active_analysis_obj.image_caption}
                    />
                    {#if g_active_overlay_arr}
                      <svg
                        class="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {#each g_active_overlay_arr as shape_obj, shape_index (shape_index)}
                          {#if shape_obj.type === 'line'}
                            <line
                              x1={shape_obj.x1}
                              y1={shape_obj.y1}
                              x2={shape_obj.x2}
                              y2={shape_obj.y2}
                              stroke="#9A1BFF"
                              stroke-width="3"
                              stroke-linecap="round"
                              vector-effect="non-scaling-stroke"
                            />
                          {:else if shape_obj.type === 'circle'}
                            <circle
                              cx={shape_obj.cx}
                              cy={shape_obj.cy}
                              r={shape_obj.r}
                              fill="#9A1BFF"
                              fill-opacity="0.3"
                              stroke="#9A1BFF"
                              stroke-width="3"
                              vector-effect="non-scaling-stroke"
                            />
                          {:else if shape_obj.type === 'rect'}
                            <rect
                              x={shape_obj.x}
                              y={shape_obj.y}
                              width={shape_obj.width}
                              height={shape_obj.height}
                              fill="#9A1BFF"
                              fill-opacity="0.15"
                              stroke="#9A1BFF"
                              stroke-width="3"
                              vector-effect="non-scaling-stroke"
                            />
                          {/if}
                        {/each}
                      </svg>
                    {/if}
                  {:else}
                    <div class="grid justify-items-center gap-3">
                      <Camera size={48} strokeWidth={1.8} aria-hidden="true" />
                      <p class="m-0 text-sm font-semibold">사진이 없습니다</p>
                    </div>
                  {/if}
                </div>
                <figcaption class="mt-2 shrink-0 text-center text-xs font-bold text-slate-500">
                  {g_active_analysis_obj.image_caption}
                </figcaption>
              </figure>

              <div class="grid min-h-0 content-start gap-3">
                <section>
                  <h2 class="m-0 text-xl font-extrabold text-zinc-950">
                    {g_active_analysis_obj.title}
                  </h2>

                  <div class="mt-2 rounded-lg border border-slate-200 bg-white px-5 py-3">
                    <div class="mb-2 flex items-center gap-2">
                      <span class="h-2 w-2 rounded-full bg-[var(--retinal-primary-600)]"></span>
                      <h3 class="m-0 text-base font-extrabold text-zinc-950">
                        {g_active_analysis_obj.measure_title}
                      </h3>
                    </div>

                    <div class="grid">
                      {#each g_active_analysis_obj.measure_arr as measure_obj, measure_index (`${measure_obj.label}-${measure_index}`)}
                        <div
                          class={`flex min-h-11 w-full items-center justify-between gap-4 rounded-md border-b border-slate-100 px-2 transition last:border-b-0 ${
                            ref_selected_measure_key === measure_obj.label
                              ? 'bg-[var(--retinal-soft-purple)]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            class="flex min-w-0 flex-1 cursor-pointer items-center text-left bg-transparent border-0 p-0"
                            aria-pressed={ref_selected_measure_key === measure_obj.label}
                            onclick={() => on_click_select_measure(measure_obj.label)}
                          >
                            <span class="min-w-0 flex-1 text-sm font-bold text-slate-500">
                              {measure_obj.label}
                            </span>
                          </button>
                          {#if measure_obj.has_value}
                            <span
                              class={`ml-auto flex-none text-right text-base font-extrabold ${measure_obj.tone}`}
                            >
                              {measure_obj.value}
                              {#if measure_obj.note}
                                <span class="ml-1 text-xs font-bold">{measure_obj.note}</span>
                              {/if}
                            </span>
                          {:else}
                            <Link
                              class="ml-auto inline-flex flex-none items-center gap-1 rounded-md border border-[var(--retinal-primary-600)] bg-white px-2.5 py-1 text-xs font-extrabold text-[var(--retinal-primary-700)] transition hover:bg-[var(--retinal-soft-purple)]"
                              href={`${PATH.analysisFaceMeasurement}?item=${measure_obj.item_id}`}
                            >
                              측정하기
                              <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
                            </Link>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </section>

                {#if g_active_analysis_obj.sub_measure_arr}
                  <section class="rounded-lg border border-slate-200 bg-white px-5 py-3">
                    <div class="mb-2 flex items-center gap-2">
                      <span class="h-2 w-2 rounded-full bg-[var(--retinal-primary-600)]"></span>
                      <h3 class="m-0 text-base font-extrabold text-zinc-950">
                        {g_active_analysis_obj.sub_card_title}
                      </h3>
                    </div>

                    <div class="grid">
                      {#each g_active_analysis_obj.sub_measure_arr as measure_obj, measure_index (`${measure_obj.label}-${measure_index}`)}
                        <button
                          type="button"
                          class={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-md border-b border-slate-100 px-2 text-left transition last:border-b-0 ${
                            ref_selected_measure_key === measure_obj.label
                              ? 'bg-[var(--retinal-soft-purple)]'
                              : 'hover:bg-slate-50'
                          }`}
                          aria-pressed={ref_selected_measure_key === measure_obj.label}
                          onclick={() => on_click_select_measure(measure_obj.label)}
                        >
                          <span class="min-w-0 flex-1 text-sm font-bold text-slate-500">
                            {measure_obj.label}
                          </span>
                          <span
                            class={`ml-auto flex-none text-right text-base font-extrabold ${measure_obj.tone}`}
                          >
                            {measure_obj.value}
                          </span>
                        </button>
                      {/each}
                    </div>
                  </section>
                {/if}

                {#if g_active_analysis_obj.highlight_value}
                  <section class="rounded-lg border border-slate-200 bg-white px-5 py-3">
                    <div class="mb-2 flex items-center gap-2">
                      <span class="h-2 w-2 rounded-full bg-[var(--retinal-primary-600)]"></span>
                      <h3 class="m-0 text-base font-extrabold text-zinc-950">
                        {g_active_analysis_obj.sub_card_title}
                      </h3>
                    </div>
                    <div class="grid place-items-center py-1">
                      <p class="m-0 text-4xl font-extrabold text-[var(--retinal-primary-600)]">
                        {g_active_analysis_obj.highlight_value}
                      </p>
                      <p class="m-0 mt-2 text-xs font-bold text-slate-600">
                        {g_active_analysis_obj.highlight_text}
                      </p>
                    </div>
                  </section>
                {/if}
              </div>
            </div>
            {:else}
              <p class="mt-4 text-sm font-semibold text-slate-500">분석 데이터를 준비 중입니다.</p>
            {/if}
          </section>
        {/if}
      </div>

      <div class="grid shrink-0 grid-cols-2 gap-4">
        <Link
          class="grid min-h-16 place-items-center rounded-lg border border-[var(--retinal-border)] bg-white text-lg font-extrabold text-zinc-950 transition hover:border-[var(--retinal-primary-600)] hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/20"
          href={PATH.analysis}
        >
          다시 분석하기
        </Link>
        <Link
          class="grid min-h-16 grid-cols-[1fr_auto] items-center rounded-lg bg-[var(--retinal-primary-600)] px-8 text-center text-lg font-extrabold !text-white transition hover:bg-[var(--retinal-primary-500)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/30"
          href={PATH.analysisLensConsult}
        >
          <span class="text-white">온보딩 진행</span>
          <ChevronRight size={24} strokeWidth={2.5} class="text-white" aria-hidden="true" />
        </Link>
      </div>
    </div>
  </div>
</main>
