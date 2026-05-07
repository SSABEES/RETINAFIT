<script>
  import { onMount } from 'svelte'
  import { Link, navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, Glasses, UserRound } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import { PATH } from '@/config/path'
  import { get_admin_visit } from '@/lib/api/visit'
  import { push_error_toast } from '@/lib/stores/toast'

  /** @type {{ visit_no?: string }} */
  let { visit_no = '' } = $props()

  let g_visit_obj = $state(/** @type {any} */ (null))
  let g_is_loading = $state(true)

  /** @typedef {'overview' | 'measurement' | 'lifestyle' | 'fitting' | 'insight'} TabId */
  const TAB_ARR = /** @type {{ id: TabId, label: string }[]} */ ([
    { id: 'overview', label: '분석 요약' },
    { id: 'measurement', label: '측정 상세' },
    { id: 'lifestyle', label: '선택한 생활 패턴' },
    { id: 'fitting', label: 'AR 피팅' },
    { id: 'insight', label: 'AI 인사이트' },
  ])
  let g_active_tab = $state(/** @type {TabId} */ ('overview'))

  const FACE_SHAPE_LABEL_OBJ = {
    oval: '계란형',
    round: '둥근형',
    heart: '하트형',
    square: '사각형',
    oblong: '긴형',
  }

  const SKIN_TONE_LABEL_OBJ = {
    COOL: '쿨톤',
    WARM: '웜톤',
    NEUTRAL: '중성톤',
  }

  const g_test_json = $derived(g_visit_obj?.test_json ?? null)
  const g_opt_recommend_json = $derived(g_visit_obj?.opt_recommend_json ?? null)
  const g_vp_json = $derived(g_visit_obj?.vp_json ?? null)
  const g_report_json = $derived(g_visit_obj?.report_json ?? null)

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

  const g_face_shape_key = $derived(normalize_face_shape_key(g_test_json?.face_shape ?? 'oval'))
  const g_face_shape_label = $derived(FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? '계란형')
  const g_skin_tone_key = $derived(String(g_test_json?.skin_tone?.tone ?? 'NEUTRAL'))
  const g_skin_tone_label = $derived(SKIN_TONE_LABEL_OBJ[g_skin_tone_key] ?? '중성톤')

  // BE 추천 칩 (있을 때만)
  const g_recommended_color_arr = $derived(
    Array.isArray(g_test_json?.skin_tone_recommendations)
      ? g_test_json.skin_tone_recommendations.slice(0, 4)
      : [],
  )
  const g_recommended_frame_arr = $derived(
    Array.isArray(g_test_json?.face_shape_recommendations)
      ? g_test_json.face_shape_recommendations.slice(0, 6)
      : [],
  )

  const g_lens_selection_arr = $derived(
    Array.isArray(g_opt_recommend_json?.selection_arr) ? g_opt_recommend_json.selection_arr : [],
  )

  const g_saved_fitting_arr = $derived(
    Array.isArray(g_vp_json?.fitting_arr) ? g_vp_json.fitting_arr : [],
  )

  // 측정값 (test_json.measurements: { face_width, face_height, pd, ... })
  const g_measurements_obj = $derived(g_test_json?.measurements ?? null)

  // AI 인사이트 추출
  const REPORT_ITEM_KEY_ARR = [
    'face_shape',
    'face_width',
    'face_height',
    'face_ratio',
    'pd',
    'skin_tone',
  ]
  const g_report_bullet_arr = $derived.by(() => {
    if (!g_report_json) return /** @type {string[]} */ ([])
    if (Array.isArray(g_report_json)) return g_report_json.map(String).filter(Boolean)
    if (Array.isArray(g_report_json.summary_arr))
      return g_report_json.summary_arr.map(String).filter(Boolean)
    if (Array.isArray(g_report_json.insight_arr))
      return g_report_json.insight_arr.map(String).filter(Boolean)
    if (Array.isArray(g_report_json.bullet_arr))
      return g_report_json.bullet_arr.map(String).filter(Boolean)
    /** @type {string[]} */
    const local_bullet_arr = []
    const local_summary = g_report_json.summary
    if (typeof local_summary === 'string' && local_summary.trim()) {
      local_bullet_arr.push(local_summary.trim())
    }
    const local_items_obj = g_report_json.items
    if (local_items_obj && typeof local_items_obj === 'object') {
      for (const local_key of REPORT_ITEM_KEY_ARR) {
        const local_value = local_items_obj[local_key]
        if (typeof local_value === 'string' && local_value.trim()) {
          local_bullet_arr.push(local_value.trim())
        }
      }
    }
    return local_bullet_arr
  })

  /** @param {string | null | undefined} dt */
  function format_dt(dt) {
    if (!dt) return '-'
    const local_date = new Date(dt)
    if (Number.isNaN(local_date.getTime())) return '-'
    return local_date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /** @param {number | string | null | undefined} sex */
  function format_sex(sex) {
    return Number(sex) === 1 ? '여' : '남'
  }

  /** @param {{ value_mm?: number | null } | null | undefined} item_obj */
  function format_mm(item_obj) {
    if (!item_obj) return '-'
    const local_value = Number(item_obj.value_mm)
    if (!Number.isFinite(local_value)) return '-'
    return `${local_value.toFixed(1)}mm`
  }

  async function load_visit_detail() {
    g_is_loading = true
    try {
      g_visit_obj = await get_admin_visit({ visit_no })
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '방문 상세 조회에 실패했습니다.',
      )
      g_visit_obj = null
    } finally {
      g_is_loading = false
    }
  }

  onMount(() => {
    void load_visit_detail()
  })
</script>

<AdminLayout active_key="visits">
  <section class="grid gap-4">
    <!-- 상단: 뒤로가기 + 타이틀 + 방문번호/방문일 -->
    <div class="flex items-center justify-between">
      <Link
        href={PATH.adminVisits}
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retina-border)] bg-white px-4 text-sm font-extrabold text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)] hover:bg-[var(--retina-soft-purple)]"
      >
        <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>방문자 목록</span>
      </Link>

      {#if g_visit_obj}
        <p class="m-0 text-sm font-bold text-[var(--retina-text-muted)]">
          방문번호 <span class="text-[var(--retina-primary-700)]">#{g_visit_obj.visit_no}</span>
          · 방문일시 {format_dt(g_visit_obj.create_dt)}
        </p>
      {/if}
    </div>

    <!-- 고객 정보 카드 -->
    {#if g_visit_obj}
      <section
        class="rounded-2xl border border-[var(--retina-border)] bg-white px-7 py-5 shadow-sm"
      >
        <h2 class="m-0 text-xl font-extrabold text-zinc-950">{g_visit_obj.cust_name ?? '-'}</h2>
        <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="m-0 text-[12px] font-bold text-slate-400">성별</p>
            <p class="mt-1 text-sm font-extrabold text-zinc-900">{format_sex(g_visit_obj.sex)}</p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-slate-400">생년월일</p>
            <p class="mt-1 text-sm font-extrabold text-zinc-900">
              {g_visit_obj.birthday || '-'}
            </p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-slate-400">연락처 1</p>
            <p class="mt-1 text-sm font-extrabold text-zinc-900">
              {g_visit_obj.phone_no1 || '-'}
            </p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-slate-400">연락처 2</p>
            <p class="mt-1 text-sm font-extrabold text-zinc-900">
              {g_visit_obj.phone_no2 || '-'}
            </p>
          </div>
        </div>
      </section>
    {/if}

    <!-- 탭 네비 -->
    <nav
      class="flex flex-wrap items-end gap-1 border-b border-[var(--retina-border)]"
      aria-label="방문 상세 섹션"
    >
      {#each TAB_ARR as tab_obj (tab_obj.id)}
        {@const local_is_active = g_active_tab === tab_obj.id}
        <button
          type="button"
          class={`shrink-0 cursor-pointer border-b-2 px-4 py-2.5 text-sm font-extrabold transition ${
            local_is_active
              ? 'border-[var(--retina-primary-700)] text-[var(--retina-primary-700)]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          aria-pressed={local_is_active}
          onclick={() => (g_active_tab = tab_obj.id)}
        >
          {tab_obj.label}
        </button>
      {/each}
    </nav>

    <!-- 탭 컨텐츠 -->
    <div class="rounded-2xl border border-[var(--retina-border)] bg-white px-7 py-6 shadow-sm">
      {#if g_is_loading}
        <p class="m-0 text-center text-sm font-bold text-[var(--retina-text-muted)]">
          상세 데이터 불러오는 중...
        </p>
      {:else if !g_visit_obj}
        <p class="m-0 text-center text-sm font-bold text-[var(--retina-text-muted)]">
          방문 데이터를 찾을 수 없습니다.
        </p>
      {:else if g_active_tab === 'overview'}
        <div class="grid gap-5">
          <!-- 얼굴형/피부톤 박스 -->
          <div class="grid grid-cols-2 gap-3">
            <div
              class="flex flex-col items-center justify-center rounded-[10px] border border-[#FFEDD5] bg-[#FFF7ED] px-4 py-5 text-center"
            >
              <p class="m-0 text-[12px] font-bold text-slate-700">얼굴형</p>
              <p class="m-0 mt-1.5 text-[20px] font-extrabold text-[#F97316]">
                {g_face_shape_label}
              </p>
            </div>
            <div
              class="flex flex-col items-center justify-center rounded-[10px] border border-[#D8E2FF] bg-[#EDF0FF] px-4 py-5 text-center"
            >
              <p class="m-0 text-[12px] font-bold text-slate-700">피부톤</p>
              <p class="m-0 mt-1.5 text-[20px] font-extrabold text-[#1660C7]">
                {g_skin_tone_label}
              </p>
            </div>
          </div>

          <!-- 추천 정보 (있을 때만) -->
          {#if g_recommended_color_arr.length > 0 || g_recommended_frame_arr.length > 0}
            <div class="grid grid-cols-2 gap-5">
              <section>
                <h3 class="m-0 text-[13px] font-extrabold text-slate-800">추천 안경테 컬러</h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  {#if g_recommended_color_arr.length === 0}
                    <span class="text-[13px] text-slate-400">데이터 없음</span>
                  {:else}
                    {#each g_recommended_color_arr as color_obj, color_index (`${color_obj.label}-${color_index}`)}
                      <span
                        class="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700"
                      >
                        {color_obj.label}
                      </span>
                    {/each}
                  {/if}
                </div>
              </section>
              <section>
                <h3 class="m-0 text-[13px] font-extrabold text-slate-800">추천 안경테 모양</h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  {#if g_recommended_frame_arr.length === 0}
                    <span class="text-[13px] text-slate-400">데이터 없음</span>
                  {:else}
                    {#each g_recommended_frame_arr as frame_obj, frame_index (`${frame_obj.name}-${frame_index}`)}
                      <span
                        class={`inline-flex items-center rounded-md border bg-white px-3 py-1.5 text-[13px] font-bold ${
                          frame_obj.priority === 1
                            ? 'border-[#F97316] text-[#F97316]'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {frame_obj.name}
                      </span>
                    {/each}
                  {/if}
                </div>
              </section>
            </div>
          {/if}

          <!-- 사진 -->
          {#if g_visit_obj.main_file}
            <section>
              <h3 class="m-0 text-[13px] font-extrabold text-slate-800">정면 사진</h3>
              <div class="mt-2 inline-block overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100">
                <img
                  src={g_visit_obj.main_file}
                  alt="정면 사진"
                  class="block h-auto max-h-[320px] w-auto object-contain"
                />
              </div>
            </section>
          {/if}
        </div>
      {:else if g_active_tab === 'measurement'}
        <div class="grid gap-3">
          <h3 class="m-0 text-[14px] font-extrabold text-slate-800">측정값</h3>
          {#if !g_measurements_obj}
            <p class="m-0 text-sm font-bold text-slate-400">측정 데이터가 없습니다.</p>
          {:else}
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[11px] font-bold text-slate-500">얼굴 너비</p>
                <p class="m-0 mt-1 text-base font-extrabold text-zinc-900">
                  {format_mm(g_measurements_obj.face_width)}
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[11px] font-bold text-slate-500">얼굴 높이</p>
                <p class="m-0 mt-1 text-base font-extrabold text-zinc-900">
                  {format_mm(g_measurements_obj.face_height)}
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[11px] font-bold text-slate-500">PD (전체)</p>
                <p class="m-0 mt-1 text-base font-extrabold text-zinc-900">
                  {format_mm(g_measurements_obj.pd)}
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[11px] font-bold text-slate-500">우안 PD</p>
                <p class="m-0 mt-1 text-base font-extrabold text-zinc-900">
                  {format_mm(g_measurements_obj.right_pd)}
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[11px] font-bold text-slate-500">좌안 PD</p>
                <p class="m-0 mt-1 text-base font-extrabold text-zinc-900">
                  {format_mm(g_measurements_obj.left_pd)}
                </p>
              </div>
            </div>
          {/if}
        </div>
      {:else if g_active_tab === 'lifestyle'}
        {#if g_lens_selection_arr.length === 0}
          <p class="m-0 text-sm font-bold text-slate-400">선택한 항목이 없습니다.</p>
        {:else}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {#each g_lens_selection_arr as selection_obj, selection_index (selection_index)}
              <div class="rounded-[10px] border border-slate-100 bg-slate-50 px-4 py-3">
                <p class="m-0 text-[13px] font-bold text-slate-500">
                  Q{selection_index + 1}. {selection_obj.question_text}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  {#if (selection_obj.label_arr ?? []).length === 0}
                    <span class="text-[13px] font-semibold text-slate-400">-</span>
                  {:else}
                    {#each selection_obj.label_arr as label_text, label_index (`${selection_index}-${label_index}`)}
                      <span
                        class="inline-flex items-center rounded-md border border-[var(--retina-primary-300)] bg-white px-3 py-1 text-[13px] font-bold text-[var(--retina-primary-700)]"
                      >
                        {label_text}
                      </span>
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else if g_active_tab === 'fitting'}
        {#if g_saved_fitting_arr.length === 0}
          <div class="grid place-items-center gap-3 py-10">
            <Glasses size={36} class="text-slate-300" />
            <p class="m-0 text-sm font-bold text-slate-400">저장된 피팅이 없습니다.</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {#each g_saved_fitting_arr as fitting_obj, fitting_index (fitting_index)}
              {@const local_front = fitting_obj.capture_arr?.[0]}
              <article class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div
                  class="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {#if local_front?.url}
                    <img
                      src={local_front.url}
                      alt={`${fitting_obj.model} 정면`}
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="grid h-full w-full place-items-center text-slate-300">
                      <UserRound size={32} strokeWidth={1.7} />
                    </div>
                  {/if}
                </div>
                <div class="mt-2 flex flex-col">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {fitting_obj.brand || 'BRAND'}
                  </span>
                  <p class="m-0 truncate text-sm font-extrabold text-zinc-900">
                    {fitting_obj.model || '-'}
                  </p>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      {:else if g_active_tab === 'insight'}
        {#if g_report_bullet_arr.length === 0}
          <p class="m-0 text-sm font-bold text-slate-400">아직 생성된 인사이트가 없습니다.</p>
        {:else}
          <ul class="m-0 grid gap-3 p-0 text-[14px] leading-relaxed text-slate-700">
            {#each g_report_bullet_arr as bullet_text, bullet_index (bullet_index)}
              <li class="flex gap-3">
                <span
                  class="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--retina-primary-700)]"
                  aria-hidden="true"
                ></span>
                <span class="whitespace-pre-line">{bullet_text}</span>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  </section>
</AdminLayout>
