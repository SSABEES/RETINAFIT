<script>
  // AI 인사이트 패널 — visit_obj 를 받아 측정값 카드 + 게이지바 + AI 멘트를 종합 리포트로 그린다.
  // result.svelte (안경사 화면) 의 insight 탭 / visit_detail.svelte (어드민) 양쪽에서 동일하게 사용.
  import {
    Sparkles,
    Ruler,
    Eye,
    Scale,
    Smile,
    Glasses,
    Palette,
    Sun,
    Snowflake,
    CircleDashed,
  } from 'lucide-svelte'
  import {
    get_skin_tone_recommendation,
    get_chip_text_class,
    SKIN_TONE_FRAME_COLOR_MAP,
  } from '@/lib/recommendations/frame_recommendations.js'

  /**
   * @typedef {object} AiInsightPanelProps
   * @property {any | null} visit_obj                                  BE 방문 단건 응답 (test_json / report_json 포함)
   * @property {boolean} [is_loading]                                  fetch 중 여부 (true 면 로딩 안내만 노출)
   * @property {string} [empty_loading_text]                           로딩 안내 문구
   * @property {string} [empty_no_visit_text]                          visit_obj 가 null 일 때 안내 문구
   */

  /**
   * compute_range_position 의 반환 형상. 게이지바/카드 snippet 파라미터 타입으로 재사용.
   * @typedef {object} RangePositionObj
   * @property {number} value_pct
   * @property {number} normal_left_pct
   * @property {number} normal_right_pct
   * @property {boolean} is_in_normal
   * @property {boolean} is_below
   * @property {boolean} is_above
   * @property {string} visible_min_label
   * @property {string} visible_max_label
   */

  /** @type {AiInsightPanelProps} */
  let {
    visit_obj = null,
    is_loading = false,
    empty_loading_text = '리포트 불러오는 중...',
    empty_no_visit_text = '방문 데이터를 찾을 수 없습니다.',
  } = $props()

  const FACE_SHAPE_LABEL_OBJ = {
    oval: '계란형',
    round: '둥근형',
    heart: '하트형',
    square: '사각형',
    oblong: '긴형',
  }

  // 얼굴형별 한 줄 스타일 추천 멘트 — 이미지 아래 캡션으로 노출.
  const FACE_SHAPE_TIP_OBJ = {
    oval: '어떤 스타일도 잘 어울려요!',
    round: '각진 프레임으로 또렷한 인상을 살려보세요!',
    heart: '라운드 프레임이 부드럽게 어울려요!',
    square: '둥근 프레임으로 부드러움을 더해보세요!',
    oblong: '와이드한 프레임으로 균형을 잡아보세요!',
  }

  const g_test_json = $derived(visit_obj?.test_json ?? null)
  const g_report_json = $derived(visit_obj?.report_json ?? null)

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

  const g_face_shape_raw = $derived(g_test_json?.face_shape ?? null)
  const g_face_shape_key = $derived(
    g_face_shape_raw ? normalize_face_shape_key(g_face_shape_raw) : null,
  )
  const g_face_shape_label = $derived(
    g_face_shape_key ? (FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? null) : null,
  )
  const g_face_shape_tip = $derived(
    g_face_shape_key ? (FACE_SHAPE_TIP_OBJ[g_face_shape_key] ?? null) : null,
  )

  // 성별 + 얼굴형에 맞는 마네킹 이미지 경로 (/public/face/{man|woman}).
  // visit_obj.sex 가 0=남 / 1=여 (visits.svelte 의 format_sex 와 동일 규칙).
  // woman/oblong 만 파일명이 oblong.png (다른 woman 항목은 *_woman.png 접미사).
  const g_face_shape_image_src = $derived.by(() => {
    if (!g_face_shape_key) return null
    const local_is_woman = Number(visit_obj?.sex) === 1
    if (local_is_woman) {
      return g_face_shape_key === 'oblong'
        ? '/face/woman/oblong.png'
        : `/face/woman/${g_face_shape_key}_woman.png`
    }
    return `/face/man/${g_face_shape_key}_man.png`
  })

  const g_skin_tone_raw = $derived(g_test_json?.skin_tone?.tone ?? null)
  const g_skin_tone_recommendation_obj = $derived(
    g_skin_tone_raw ? get_skin_tone_recommendation(g_skin_tone_raw) : null,
  )

  // 피부톤 키(WARM / COOL / NEUTRAL) 별 아이콘 + 톤 컬러 매핑 — 라벨 위에 시각적 단서로 노출.
  // text_class 는 detail(따뜻한 톤/차가운 톤/중성 톤) 멘트 컬러에 사용.
  const SKIN_TONE_VISUAL_OBJ = {
    WARM: { icon: Sun, ring_class: 'bg-[#FFF4E1] text-[#F59E0B]', text_class: 'text-[#F59E0B]' },
    COOL: {
      icon: Snowflake,
      ring_class: 'bg-[#E0F2FE] text-[#0284C7]',
      text_class: 'text-[#0284C7]',
    },
    NEUTRAL: {
      icon: CircleDashed,
      ring_class: 'bg-[#F1F5F9] text-[#64748B]',
      text_class: 'text-[#64748B]',
    },
  }
  const g_skin_tone_visual_obj = $derived.by(() => {
    const local_key = g_skin_tone_recommendation_obj?.key
    return local_key ? (SKIN_TONE_VISUAL_OBJ[local_key] ?? null) : null
  })

  // 라벨 → tone_class 글로벌 lookup (모든 톤의 칩 합집합) — BE 가 라벨만 보내도 색이 입혀지도록.
  // Object.keys 는 string[] 로 좁혀져 Record<SkinToneKey, ...> 인덱싱이 막히므로 Object.values 로 칩 배열만 직접 순회.
  const LABEL_TO_TONE_CLASS_OBJ = (() => {
    /** @type {Record<string, string>} */
    const local_obj = {}
    for (const local_chip_arr of Object.values(SKIN_TONE_FRAME_COLOR_MAP)) {
      for (const local_chip of local_chip_arr) {
        local_obj[local_chip.label] = local_chip.tone_class
      }
    }
    return local_obj
  })()

  const g_recommended_color_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.skin_tone_recommendations)
      ? g_test_json.skin_tone_recommendations
      : []
    if (local_be_arr.length === 0) return []
    return local_be_arr
      .slice(0, 4)
      .map((/** @type {{ label?: string, tone_class?: string }} */ local_chip) => {
        const local_label = String(local_chip.label ?? '')
        return {
          label: local_label,
          tone_class:
            local_chip.tone_class ?? LABEL_TO_TONE_CLASS_OBJ[local_label] ?? 'bg-slate-300',
        }
      })
  })

  const g_recommended_frame_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.face_shape_recommendations)
      ? g_test_json.face_shape_recommendations
      : []
    return local_be_arr.length > 0 ? local_be_arr.slice(0, 6) : []
  })
  const g_priority_one_frame_arr = $derived(
    g_recommended_frame_arr.filter(
      (/** @type {{ priority?: number, name?: string }} */ local_obj) => local_obj.priority === 1,
    ),
  )

  // ── 측정 요약 / 좌우 대칭 / PD 상세 ──

  /** mm 값을 소수 첫째자리로 포맷. 값 없으면 '-'. @param {unknown} value_mm */
  function format_mm_label(value_mm) {
    const local_num = Number(value_mm)
    return Number.isFinite(local_num) ? `${local_num.toFixed(1)} mm` : '-'
  }

  const g_face_width_label = $derived(
    format_mm_label(g_test_json?.measurements?.face_width?.value_mm),
  )
  const g_face_height_label = $derived(
    format_mm_label(g_test_json?.measurements?.face_height?.value_mm),
  )
  const g_pd_label = $derived(format_mm_label(g_test_json?.measurements?.pd?.value_mm))
  const g_left_pd_label = $derived(format_mm_label(g_test_json?.measurements?.left_pd?.value_mm))
  const g_right_pd_label = $derived(format_mm_label(g_test_json?.measurements?.right_pd?.value_mm))

  const g_face_ratio_label = $derived.by(() => {
    const local_value = Number(g_test_json?.face_ratio)
    return Number.isFinite(local_value) ? local_value.toFixed(2) : '-'
  })

  const g_pd_diff_label = $derived.by(() => {
    const local_left = Number(g_test_json?.measurements?.left_pd?.value_mm)
    const local_right = Number(g_test_json?.measurements?.right_pd?.value_mm)
    if (!Number.isFinite(local_left) || !Number.isFinite(local_right)) return '-'
    return `${Math.abs(local_left - local_right).toFixed(2)} mm`
  })

  const g_asymmetry_label = $derived.by(() => {
    const local_value = Number(g_test_json?.asymmetry_score)
    return Number.isFinite(local_value) ? local_value.toFixed(0) : '-'
  })
  const g_asymmetry_hint = $derived.by(() => {
    const local_value = Number(g_test_json?.asymmetry_score)
    if (!Number.isFinite(local_value)) return '측정값이 없습니다.'
    if (local_value <= 20) return '좌우 대칭이 매우 잘 맞습니다.'
    if (local_value <= 50) return '좌우 대칭이 양호한 편입니다.'
    return '약간의 좌우 비대칭이 있어요.'
  })
  // 비대칭 등급별 안경 피팅 권장 멘트 — 좌우 대칭 분석 섹션 하단에 한 줄 표시.
  const g_asymmetry_fitting_tip = $derived.by(() => {
    const local_value = Number(g_test_json?.asymmetry_score)
    if (!Number.isFinite(local_value)) return null
    if (local_value <= 20) return '표준 피팅 그대로 진행하셔도 좋아요.'
    if (local_value <= 50) return '코받침 위치를 가볍게 미세 조정하면 더 안정적이에요.'
    return '코받침·템플 좌우 비대칭 조정을 권장드려요.'
  })

  // AI 종합 의견 — summary1/summary2 두 줄로 분리되어 들어옴 (구 스키마는 summary 한 필드).
  // 레거시 호환: summary1/summary2 가 비어있고 summary 만 있으면 summary 를 summary1 에 채워 표시.
  const g_report_summary1_text = $derived.by(() => {
    const local_value = g_report_json?.summary1
    if (typeof local_value === 'string' && local_value.trim()) return local_value.trim()
    const local_legacy = g_report_json?.summary
    return typeof local_legacy === 'string' && local_legacy.trim() ? local_legacy.trim() : null
  })
  const g_report_summary2_text = $derived.by(() => {
    const local_value = g_report_json?.summary2
    return typeof local_value === 'string' && local_value.trim() ? local_value.trim() : null
  })
  // hero 섹션 노출 여부 — 둘 중 하나라도 있으면 노출.
  const g_has_report_summary = $derived(Boolean(g_report_summary1_text || g_report_summary2_text))
  /**
   * 측정값 게이지바 시각화 기준값.
   * - visible_*: 게이지바 좌우 끝 (한국 성인 일반 범위).
   * - normal_*: 적정 구간 (보라색 영역).
   * 의료적 기준이 아닌 시연용 통계 범위. 추후 BE/AI 가 정밀 기준을 응답에 실어주면 그쪽 우선.
   */
  const MEASUREMENT_RANGE_OBJ = {
    face_width: {
      visible_min: 110,
      visible_max: 160,
      normal_min: 130,
      normal_max: 145,
      unit: 'mm',
      decimal: 0,
    },
    face_height: {
      visible_min: 150,
      visible_max: 210,
      normal_min: 170,
      normal_max: 195,
      unit: 'mm',
      decimal: 0,
    },
    face_ratio: {
      visible_min: 1.0,
      visible_max: 1.6,
      normal_min: 1.3,
      normal_max: 1.5,
      unit: '',
      decimal: 1,
    },
    pd: {
      visible_min: 50,
      visible_max: 75,
      normal_min: 58,
      normal_max: 68,
      unit: 'mm',
      decimal: 0,
    },
    half_pd: {
      visible_min: 25,
      visible_max: 40,
      normal_min: 28,
      normal_max: 35,
      unit: 'mm',
      decimal: 0,
    },
    pd_diff: {
      visible_min: 0,
      visible_max: 5,
      normal_min: 0,
      normal_max: 2,
      unit: 'mm',
      decimal: 0,
    },
    asymmetry: {
      visible_min: 0,
      visible_max: 100,
      normal_min: 0,
      normal_max: 20,
      unit: '',
      decimal: 0,
    },
  }

  /**
   * 값을 게이지바 위치(%) 와 정상 범위 영역(%) 으로 환산.
   * @param {unknown} value
   * @param {{ visible_min:number, visible_max:number, normal_min:number, normal_max:number, unit:string, decimal:number }} range_def
   */
  function compute_range_position(value, range_def) {
    const local_value = Number(value)
    if (!Number.isFinite(local_value) || !range_def) return null
    const local_total = range_def.visible_max - range_def.visible_min
    if (local_total <= 0) return null
    const local_raw_pct = ((local_value - range_def.visible_min) / local_total) * 100
    const local_unit_text = range_def.unit ? ` ${range_def.unit}` : ''
    return {
      value_pct: Math.max(0, Math.min(100, local_raw_pct)),
      normal_left_pct: Math.max(
        0,
        ((range_def.normal_min - range_def.visible_min) / local_total) * 100,
      ),
      normal_right_pct: Math.min(
        100,
        ((range_def.normal_max - range_def.visible_min) / local_total) * 100,
      ),
      is_in_normal: local_value >= range_def.normal_min && local_value <= range_def.normal_max,
      is_below: local_value < range_def.normal_min,
      is_above: local_value > range_def.normal_max,
      visible_min_label: `${range_def.visible_min.toFixed(range_def.decimal)}${local_unit_text}`,
      visible_max_label: `${range_def.visible_max.toFixed(range_def.decimal)}${local_unit_text}`,
    }
  }

  const g_face_width_range = $derived(
    compute_range_position(
      g_test_json?.measurements?.face_width?.value_mm,
      MEASUREMENT_RANGE_OBJ.face_width,
    ),
  )
  const g_face_height_range = $derived(
    compute_range_position(
      g_test_json?.measurements?.face_height?.value_mm,
      MEASUREMENT_RANGE_OBJ.face_height,
    ),
  )
  const g_face_ratio_range = $derived(
    compute_range_position(g_test_json?.face_ratio, MEASUREMENT_RANGE_OBJ.face_ratio),
  )
  const g_pd_range = $derived(
    compute_range_position(g_test_json?.measurements?.pd?.value_mm, MEASUREMENT_RANGE_OBJ.pd),
  )
  const g_left_pd_range = $derived(
    compute_range_position(
      g_test_json?.measurements?.left_pd?.value_mm,
      MEASUREMENT_RANGE_OBJ.half_pd,
    ),
  )
  const g_right_pd_range = $derived(
    compute_range_position(
      g_test_json?.measurements?.right_pd?.value_mm,
      MEASUREMENT_RANGE_OBJ.half_pd,
    ),
  )
  const g_pd_diff_value = $derived.by(() => {
    const local_left = Number(g_test_json?.measurements?.left_pd?.value_mm)
    const local_right = Number(g_test_json?.measurements?.right_pd?.value_mm)
    if (!Number.isFinite(local_left) || !Number.isFinite(local_right)) return null
    return Math.abs(local_left - local_right)
  })
  const g_pd_diff_range = $derived(
    compute_range_position(g_pd_diff_value, MEASUREMENT_RANGE_OBJ.pd_diff),
  )
  const g_asymmetry_range = $derived(
    compute_range_position(g_test_json?.asymmetry_score, MEASUREMENT_RANGE_OBJ.asymmetry),
  )
</script>

{#snippet range_gauge(/** @type {RangePositionObj | null} */ range_obj)}
  {#if range_obj}
    <div class="relative h-2.5 w-full rounded-full bg-slate-200">
      <!-- 정상 범위 영역 -->
      <div
        class="absolute inset-y-0 rounded-full bg-[var(--retina-primary-300)]/70"
        style="left: {range_obj.normal_left_pct}%; right: {100 - range_obj.normal_right_pct}%"
      ></div>
      <!-- 사용자 값 마커 -->
      <div
        class="absolute top-1/2 h-5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--retina-primary-600)] shadow-[0_2px_5px_rgba(91,0,107,0.45)] ring-2 ring-white"
        style="left: {range_obj.value_pct}%"
      ></div>
    </div>
    <div class="mt-1.5 flex justify-between text-[10px] font-bold text-slate-400">
      <span>{range_obj.visible_min_label}</span>
      <span>{range_obj.visible_max_label}</span>
    </div>
  {/if}
{/snippet}

{#snippet measurement_card(
  /** @type {string} */ label_text,
  /** @type {string} */ value_label,
  /** @type {RangePositionObj | null} */ range_obj,
)}
  <article class="rounded-[10px] bg-slate-50 px-4 py-4">
    <div class="flex items-baseline justify-between gap-2">
      <p class="m-0 text-[12px] font-bold text-slate-500">{label_text}</p>
      {#if range_obj}
        <span
          class={`text-[11px] font-extrabold ${
            range_obj.is_in_normal
              ? 'text-emerald-600'
              : range_obj.is_below
                ? 'text-sky-600'
                : 'text-amber-600'
          }`}
        >
          {range_obj.is_in_normal ? '적정' : range_obj.is_below ? '낮음' : '높음'}
        </span>
      {/if}
    </div>
    <p class="m-0 mt-1.5 text-[24px] font-extrabold leading-none text-zinc-900">{value_label}</p>

    {#if range_obj}
      <div class="mt-4">{@render range_gauge(range_obj)}</div>
    {/if}
  </article>
{/snippet}

{#if is_loading}
  <section class="rounded-[14px] border border-slate-200 bg-white px-7 py-6 shadow-sm">
    <p class="m-0 text-[14px] font-semibold text-slate-400">{empty_loading_text}</p>
  </section>
{:else if !visit_obj}
  <section class="rounded-[14px] border border-slate-200 bg-white px-7 py-6 shadow-sm">
    <p class="m-0 text-[14px] font-semibold text-slate-400">{empty_no_visit_text}</p>
  </section>
{:else}
  <!--
    이전엔 test_json/report_json 둘 다 없으면 empty 안내만 띄웠지만, 양식 자체는 null-safe 라
    데이터 없어도 빈칸(`-` 등) 으로 그대로 노출 — 사용자가 양식 구성을 늘 확인할 수 있다.
  -->
  <!--
    통합 시트 — 모든 섹션을 하나의 큰 카드로 묶고, 섹션 간 경계는 옅은 가로선(border-b)으로,
    같은 행 내 컬럼 분리는 세로선(divide-x)으로만 표시. 개별 섹션의 border/shadow 제거.
  -->
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <!-- 1) AI 종합 의견 hero — 헤더(아이콘 + 텍스트) 한 행, 그 아래 summary1 / summary2 두 줄. -->
    {#if g_has_report_summary}
      <div
        class="border-b border-slate-100 bg-gradient-to-br from-[var(--retina-primary-50)] to-[var(--retina-primary-100)] px-6 py-4"
      >
        <header class="flex items-center gap-2">
          <Sparkles
            size={16}
            strokeWidth={2.2}
            class="text-[var(--retina-primary-600)]"
            aria-hidden="true"
          />
          <h2 class="m-0 text-[16px] font-extrabold text-zinc-900">AI 종합 의견</h2>
        </header>
        <div class="mt-2 flex flex-col gap-1">
          {#if g_report_summary1_text}
            <p class="pl-3 m-0 text-[18px] font-extrabold leading-relaxed text-zinc-900 whitespace-pre-line">
              {g_report_summary1_text.replace('. ', '.\n')}
            </p>
          {/if}
          {#if g_report_summary2_text}
            <p class="pl-3 m-0 text-[14px] font-semibold leading-relaxed text-zinc-800 whitespace-pre-line">
              {g_report_summary2_text.replace('. ', '.\n')}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!--
      2) 얼굴형 / 피부톤 / [추천 프레임 + 추천 컬러] — 3 컬럼.
      마지막 컬럼은 위(추천 프레임)/아래(추천 컬러) 절반씩 차지하는 합쳐진 한 칸.
    -->
    <div class="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
      <div class="flex flex-col px-6 py-4">
        <div class="flex items-center gap-2">
          <span
            class="grid h-7 w-7 place-items-center text-[var(--retina-primary-600)]"
            aria-hidden="true"
          >
            <Smile size={15} strokeWidth={2.2} />
          </span>
          <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">얼굴형</h3>
        </div>
        {#if g_face_shape_image_src}
          <div class="mt-3 flex flex-1 items-center justify-center">
            <img
              src={g_face_shape_image_src}
              alt={`${g_face_shape_label ?? ''} 얼굴형 예시`}
              class="max-h-[220px] w-auto object-contain"
              draggable="false"
            />
          </div>
        {/if}
        <p class="m-0 mt-3 text-center text-[20px] font-extrabold text-zinc-900">
          {g_face_shape_label ?? '-'}
        </p>
        {#if g_face_shape_tip}
          <p
            class="m-0 mt-2 text-center text-[12px] font-semibold leading-snug text-[var(--retina-primary-600)]"
          >
            {g_face_shape_tip}
          </p>
        {/if}
      </div>

      <div class="flex flex-col px-6 py-4">
        <div class="flex items-center gap-2">
          <span
            class="grid h-7 w-7 place-items-center text-[var(--retina-primary-600)]"
            aria-hidden="true"
          >
            <Sparkles size={14} strokeWidth={2.2} />
          </span>
          <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">피부 톤</h3>
        </div>
        {#if g_skin_tone_visual_obj}
          {@const SkinToneIcon = g_skin_tone_visual_obj.icon}
          <div class="mt-3 flex flex-1 items-center justify-center">
            <span
              class={`grid h-[160px] w-[160px] place-items-center rounded-full ${g_skin_tone_visual_obj.ring_class}`}
              aria-hidden="true"
            >
              <SkinToneIcon size={84} strokeWidth={1.8} />
            </span>
          </div>
        {/if}
        <p class="m-0 mt-3 text-center text-[20px] font-extrabold text-zinc-900">
          {g_skin_tone_recommendation_obj?.label ?? '-'}
        </p>
        {#if g_skin_tone_recommendation_obj?.detail}
          <p
            class={`m-0 mt-2 text-center text-[12px] font-semibold leading-snug ${g_skin_tone_visual_obj?.text_class ?? 'text-[var(--retina-primary-600)]'}`}
          >
            {g_skin_tone_recommendation_obj.detail}
          </p>
        {/if}
      </div>

      <!-- 추천 프레임(상) + 추천 컬러(하) 한 컬럼 — 가운데 가로 구분선으로 분리. -->
      <div class="flex flex-col divide-y divide-slate-100">
        <div class="flex flex-1 flex-col px-6 py-4">
          <div class="flex items-center gap-2">
            <span
              class="grid h-7 w-7 place-items-center text-[var(--retina-primary-600)]"
              aria-hidden="true"
            >
              <Glasses size={14} strokeWidth={2.2} />
            </span>
            <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">추천 프레임</h3>
          </div>
          {#if g_priority_one_frame_arr.length === 0}
            <div class="mt-3 grid flex-1 place-items-center text-[13px] font-bold text-slate-400">
              -
            </div>
          {:else}
            <div class="mt-3 grid flex-1 grid-cols-2 grid-rows-2 gap-2">
              {#each Array.from({ length: 4 }) as _, local_frame_index (local_frame_index)}
                {@const local_frame_obj = g_priority_one_frame_arr[local_frame_index]}
                {#if local_frame_obj}
                  <div
                    class="flex items-center justify-center rounded-[10px] border-2 border-[#F97316] bg-white px-2 text-center"
                  >
                    <span class="text-[14px] font-black text-[#F97316]">{local_frame_obj.name}</span
                    >
                  </div>
                {:else}
                  <div aria-hidden="true"></div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex flex-1 flex-col px-6 py-4">
          <div class="flex items-center gap-2">
            <span
              class="grid h-7 w-7 place-items-center text-[var(--retina-primary-600)]"
              aria-hidden="true"
            >
              <Palette size={14} strokeWidth={2.2} />
            </span>
            <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">추천 컬러</h3>
          </div>
          {#if g_recommended_color_arr.length === 0}
            <div class="mt-3 grid flex-1 place-items-center text-[13px] font-bold text-slate-400">
              -
            </div>
          {:else}
            <div class="mt-3 grid flex-1 grid-cols-2 grid-rows-2 gap-2">
              {#each Array.from({ length: 4 }) as _, local_color_index (local_color_index)}
                {@const local_color_obj = g_recommended_color_arr[local_color_index]}
                {#if local_color_obj}
                  <div
                    class={`flex items-center justify-center rounded-[10px] border border-black/5 px-2 text-center ${local_color_obj.gradient_class ?? local_color_obj.tone_class}`}
                  >
                    <span class={`text-[14px] font-black ${get_chip_text_class(local_color_obj)}`}>
                      {local_color_obj.label}
                    </span>
                  </div>
                {:else}
                  <div aria-hidden="true"></div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 3) 측정 요약 -->
    <div class="border-b border-slate-100 px-6 py-5">
      <header class="flex items-center gap-2">
        <Ruler
          size={16}
          strokeWidth={2.2}
          class="text-[var(--retina-primary-600)]"
          aria-hidden="true"
        />
        <h2 class="m-0 text-[16px] font-extrabold text-zinc-900">측정 요약</h2>
      </header>
      <div class="mt-3 grid grid-cols-4 gap-3">
        {@render measurement_card('얼굴 너비', g_face_width_label, g_face_width_range)}
        {@render measurement_card('얼굴 길이', g_face_height_label, g_face_height_range)}
        {@render measurement_card('길이 / 너비 비율', g_face_ratio_label, g_face_ratio_range)}
        {@render measurement_card('PD (동공 거리)', g_pd_label, g_pd_range)}
      </div>
    </div>

    <!-- 4) 좌우 대칭 / PD 상세 — divide-x 로 컬럼 분리. -->
    <div class="grid grid-cols-2 divide-x divide-slate-100">
      <div class="px-6 py-4">
        <header class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Scale
              size={15}
              strokeWidth={2.2}
              class="text-[var(--retina-primary-600)]"
              aria-hidden="true"
            />
            <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">좌우 대칭 분석</h3>
          </div>
          {#if g_asymmetry_range}
            <span
              class={`text-[10px] font-extrabold ${g_asymmetry_range.is_in_normal ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {g_asymmetry_range.is_in_normal ? '매우 양호' : '비대칭 주의'}
            </span>
          {/if}
        </header>

        <div class="mt-3 pl-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="text-[28px] font-extrabold text-[var(--retina-primary-600)]"
            >{g_asymmetry_label}</span
          >
          <span class="text-[12px] font-bold text-slate-400">/ 100</span>
          <span class="ml-1 text-[12px] font-semibold text-slate-500">{g_asymmetry_hint}</span>
        </div>

        <div class="mt-3 pl-3">{@render range_gauge(g_asymmetry_range)}</div>

        {#if g_asymmetry_fitting_tip}
          <div
            class="mt-4 ml-3 flex items-start gap-2 rounded-lg bg-[var(--retina-bg-1)] px-3 py-2.5"
          >
            <Glasses
              size={14}
              strokeWidth={2.2}
              class="mt-0.5 shrink-0 text-[var(--retina-primary-600)]"
              aria-hidden="true"
            />
            <p class="m-0 text-[12px] font-semibold leading-snug text-[var(--retina-primary-600)]">
              {g_asymmetry_fitting_tip}
            </p>
          </div>
        {/if}
      </div>

      <div class="px-6 py-4">
        <header class="flex items-center gap-2">
          <Eye
            size={15}
            strokeWidth={2.2}
            class="text-[var(--retina-primary-600)]"
            aria-hidden="true"
          />
          <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">PD 상세 정보</h3>
        </header>

        <div class="mt-3 pl-3 flex flex-col gap-3">
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">좌측 PD</span>
              <span class="text-[14px] font-extrabold text-zinc-900">{g_left_pd_label}</span>
            </div>
            <div class="mt-1.5">{@render range_gauge(g_left_pd_range)}</div>
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">우측 PD</span>
              <span class="text-[14px] font-extrabold text-zinc-900">{g_right_pd_label}</span>
            </div>
            <div class="mt-1.5">{@render range_gauge(g_right_pd_range)}</div>
          </div>
          <div class="border-t border-slate-100 pt-3">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">좌우 차이</span>
              <span class="flex items-baseline gap-1.5">
                <span class="text-[14px] font-extrabold text-[var(--retina-primary-600)]"
                  >{g_pd_diff_label}</span
                >
                {#if g_pd_diff_range}
                  <span
                    class={`text-[10px] font-extrabold ${g_pd_diff_range.is_in_normal ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {g_pd_diff_range.is_in_normal ? '적정' : '차이 있음'}
                  </span>
                {/if}
              </span>
            </div>
            <div class="mt-1.5">{@render range_gauge(g_pd_diff_range)}</div>
          </div>
        </div>
      </div>
    </div>

    <!--
      5) OH 상세 정보 — Optical Height (렌즈 하단 → 동공 중심 수직거리). 추후 측정값 들어올
      자리를 미리 예약해 두는 placeholder 섹션. 데이터 연결 시 좌측 OH / 우측 OH / 좌우 차이를
      PD 상세와 동일 패턴(라벨 + 값 + range_gauge)으로 채우면 된다.
    -->
    <div class="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
      <div class="px-6 py-4">
        <header class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Ruler
              size={15}
              strokeWidth={2.2}
              class="text-[var(--retina-primary-600)]"
              aria-hidden="true"
            />
            <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">OH 상세 정보</h3>
          </div>
          <span class="text-[10px] font-extrabold text-slate-400">측정 예정</span>
        </header>

        <div class="mt-3 pl-3 flex flex-col gap-3">
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">좌측 OH</span>
              <span class="text-[14px] font-extrabold text-slate-300">-</span>
            </div>
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">우측 OH</span>
              <span class="text-[14px] font-extrabold text-slate-300">-</span>
            </div>
          </div>
          <div class="border-t border-slate-100 pt-3">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-bold text-slate-500">좌우 차이</span>
              <span class="text-[14px] font-extrabold text-slate-300">-</span>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4">
        <!-- 우측은 OH 보조 영역 — 추후 등급/안내 멘트 등이 들어갈 자리. -->
        <header class="flex items-center gap-2">
          <Sparkles
            size={15}
            strokeWidth={2.2}
            class="text-[var(--retina-primary-600)]"
            aria-hidden="true"
          />
          <h3 class="m-0 text-[16px] font-extrabold text-zinc-900">OH 분석 안내</h3>
        </header>
        <div
          class="mt-3 ml-3 flex h-[120px] items-center justify-center rounded-lg bg-slate-50 px-3 text-center"
        >
          <p class="m-0 text-[12px] font-semibold leading-relaxed text-slate-400">
            OH(Optical Height) 측정값이 준비되면<br />
            이 영역에 분석 결과가 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  </section>
{/if}
