<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Glasses, UserRound } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { selected_customer_obj } from '@/lib/stores/customer'
  import {
    get_session,
    get_face_shape_result,
    hydrate_from_mirror,
  } from '@/lib/stores/capture_session.svelte.js'
  import {
    get_skin_tone_recommendation,
    get_frame_styles_for_face_shape,
  } from '@/lib/recommendations/frame_recommendations.js'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

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

  const g_session = $derived(get_session())
  const g_face_shape_result = $derived(get_face_shape_result())

  // sessionStorage 에서 복원되는 lens_consult 응답
  let g_lens_selection_arr = $state(/** @type {{question_text: string, label_arr: string[]}[]} */ ([]))
  // sessionStorage 에서 복원되는 AR 피팅 결과 (안경별 정면/좌측/우측 이미지)
  let g_saved_fitting_arr = $state(
    /** @type {{brand: string, model: string, capture_arr: {label: string, src: string}[]}[]} */ ([]),
  )

  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '').trim().toLowerCase()
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

  const g_customer_name_label = $derived.by(() => {
    const local_name = $selected_customer_obj?.name?.trim()
    if (!local_name) return '고객'
    return local_name.endsWith('님') ? local_name : `${local_name}님`
  })

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

  const g_recommended_color_arr = $derived(
    g_skin_tone_recommendation_obj.chip_arr.slice(0, 4),
  )
  const g_recommended_frame_arr = $derived(
    get_frame_styles_for_face_shape(g_face_shape_key).slice(0, 6),
  )

  // 고객 정보 표시용 (없는 값은 '-' 처리)
  const g_customer_phone = $derived($selected_customer_obj?.phone ?? '-')
  const g_customer_age_label = $derived.by(() => {
    if ($selected_customer_obj?.age) return String($selected_customer_obj.age)
    const local_birth_dt = String($selected_customer_obj?.birth_dt ?? '').trim()
    const local_birth_year_match = local_birth_dt.match(/\d{4}/)
    if (!local_birth_year_match) return '-'
    return `${new Date().getFullYear() - Number(local_birth_year_match[0]) + 1}세`
  })
  const g_visit_dt_label = $derived.by(() => {
    const local_visit_dt = String($selected_customer_obj?.last_visit_dt ?? '').trim()
    if (!local_visit_dt || local_visit_dt === '-') {
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date())
    }
    const local_date = new Date(local_visit_dt)
    if (Number.isNaN(local_date.getTime())) return local_visit_dt
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(local_date)
  })

  function on_click_back() {
    window.history.back()
  }

  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  function on_click_go_dashboard() {
    navigate(PATH.users)
  }

  function safe_parse(json_text) {
    if (!json_text) return null
    try {
      return JSON.parse(json_text)
    } catch {
      return null
    }
  }

  onMount(() => {
    hydrate_from_mirror()

    if (typeof sessionStorage === 'undefined') return

    const local_lens_raw = sessionStorage.getItem('retinal_lens_selections')
    const local_lens_arr = safe_parse(local_lens_raw)
    if (Array.isArray(local_lens_arr)) {
      g_lens_selection_arr = local_lens_arr
    }

    const local_fitting_raw = sessionStorage.getItem('retinal_saved_fittings')
    const local_fitting_arr = safe_parse(local_fitting_raw)
    if (Array.isArray(local_fitting_arr)) {
      g_saved_fitting_arr = local_fitting_arr
    }
  })
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-zinc-950">
  <Header onback={on_click_back} onlogout={on_click_logout} />

  <section class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--retina-text-100)] px-6 py-4">
    <div class="mx-auto flex w-full max-w-[940px] flex-col gap-3 pb-6">
      <h1 class="m-0 text-center text-[18px] font-extrabold tracking-[-0.02em] text-zinc-950">
        {g_customer_name_label}의 최종 분석 리포트
      </h1>

      <!-- 1. 고객 정보 -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">고객 정보</h2>
        <div class="mt-3 grid grid-cols-4 gap-3">
          <div>
            <p class="m-0 text-[10px] font-bold text-slate-400">고객명</p>
            <p class="mt-0.5 text-[13px] font-extrabold text-zinc-900">{g_customer_name_label}</p>
          </div>
          <div>
            <p class="m-0 text-[10px] font-bold text-slate-400">연령</p>
            <p class="mt-0.5 text-[13px] font-extrabold text-zinc-900">{g_customer_age_label}</p>
          </div>
          <div>
            <p class="m-0 text-[10px] font-bold text-slate-400">연락처</p>
            <p class="mt-0.5 text-[13px] font-extrabold text-zinc-900">{g_customer_phone}</p>
          </div>
          <div>
            <p class="m-0 text-[10px] font-bold text-slate-400">방문일</p>
            <p class="mt-0.5 text-[13px] font-extrabold text-zinc-900">{g_visit_dt_label}</p>
          </div>
        </div>
      </section>

      <!-- 2. 얼굴 분석 결과 -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">얼굴 분석 결과</h2>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <div
            class="rounded-[10px] border border-[#F3E2CC] bg-[var(--retina-bg-1)] px-3 py-2 text-center"
          >
            <p class="m-0 text-[11px] font-bold text-slate-700">얼굴형</p>
            <p class="mt-1 text-[14px] font-extrabold text-[var(--retina-primary-400)]">
              {g_face_shape_label}
            </p>
          </div>
          <div class="rounded-[10px] border border-[#CFD7F7] bg-[#EEF2FF] px-3 py-2 text-center">
            <p class="m-0 text-[11px] font-bold text-slate-700">피부톤</p>
            <p class="mt-1 text-[13px] font-black leading-tight text-[#1660C7]">
              {g_skin_tone_recommendation_obj.label}
              <span class="block text-[10px] font-bold">
                {SKIN_TONE_DESCRIPTION_OBJ[g_skin_tone_recommendation_obj.key] ?? '중성 톤'}
              </span>
            </p>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <h3 class="m-0 text-[11px] font-extrabold text-slate-700">추천 안경테 컬러</h3>
            <div class="mt-1.5 grid grid-cols-2 gap-1.5">
              {#each g_recommended_color_arr as color_obj (`${color_obj.label}-${color_obj.tone_class}`)}
                <div
                  class="flex min-h-[36px] items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-2.5"
                >
                  <span class={`h-3 w-5 shrink-0 rounded-full ${color_obj.tone_class}`}></span>
                  <span class="truncate text-[11px] font-bold text-slate-600">{color_obj.label}</span>
                </div>
              {/each}
            </div>
          </div>

          <div>
            <h3 class="m-0 text-[11px] font-extrabold text-slate-700">추천 안경테 모양</h3>
            <div class="mt-1.5 grid grid-cols-3 gap-1.5">
              {#each g_recommended_frame_arr as frame_obj (`${frame_obj.name}-${frame_obj.priority}`)}
                <div
                  class={`flex min-h-[36px] items-center justify-center rounded-[8px] border px-2 text-center text-[11px] font-extrabold ${
                    frame_obj.priority === 1
                      ? 'border-[var(--retina-primary-300)] bg-[var(--retina-bg-1)] text-[var(--retina-primary-400)]'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  {frame_obj.name}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </section>

      <!-- 3. 선택한 생활 패턴 -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">선택한 생활 패턴</h2>

        {#if g_lens_selection_arr.length === 0}
          <p class="mt-3 text-[11px] font-semibold text-slate-400">선택한 항목이 없습니다.</p>
        {:else}
          <div class="mt-3 grid grid-cols-2 gap-2">
            {#each g_lens_selection_arr as selection_obj, selection_index (selection_index)}
              <div class="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-2">
                <p class="m-0 text-[11px] font-bold text-slate-500">
                  Q{selection_index + 1}. {selection_obj.question_text}
                </p>
                <div class="mt-1.5 flex flex-wrap gap-1">
                  {#if selection_obj.label_arr.length === 0}
                    <span class="text-[11px] font-semibold text-slate-400">-</span>
                  {:else}
                    {#each selection_obj.label_arr as label_text, label_index (`${selection_index}-${label_index}`)}
                      <span
                        class="inline-flex items-center rounded-md border border-[var(--retina-primary-300)] bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--retina-primary-400)]"
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
      </section>

      <!-- 4. AR 피팅 결과 (정면 사진만, 한 행에 3개씩 격자 배치) -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">AR 피팅 결과</h2>

        {#if g_saved_fitting_arr.length === 0}
          <div class="mt-3 grid place-items-center gap-2 rounded-[10px] bg-slate-50 py-8">
            <Glasses size={28} class="text-slate-300" />
            <p class="m-0 text-[11px] font-bold text-slate-400">저장된 피팅이 없습니다.</p>
          </div>
        {:else}
          <div class="mt-3 grid grid-cols-3 gap-3">
            {#each g_saved_fitting_arr as fitting_obj, fitting_index (fitting_index)}
              {@const local_front_capture_obj = fitting_obj.capture_arr?.[0]}
              <article class="rounded-[10px] border border-slate-100 bg-slate-50 p-2">
                <div
                  class="relative aspect-[3/4] w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white"
                >
                  {#if local_front_capture_obj?.src}
                    <img
                      src={local_front_capture_obj.src}
                      alt={`${fitting_obj.model} 정면`}
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="grid h-full w-full place-items-center text-slate-300">
                      <UserRound size={24} strokeWidth={1.7} />
                    </div>
                  {/if}
                </div>
                <div class="mt-1.5 flex flex-col">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {fitting_obj.brand || 'BRAND'}
                  </span>
                  <p class="m-0 truncate text-[12px] font-extrabold text-zinc-900">
                    {fitting_obj.model || '-'}
                  </p>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>

      <!-- 5. 최종 결론 -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">최종 결론</h2>

        <ul class="mt-3 grid gap-2 text-[12px] leading-relaxed text-slate-700">
          <li class="flex gap-2">
            <span
              class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--retina-primary-300)]"
              aria-hidden="true"
            ></span>
            <span>
              {g_face_shape_label} 얼굴형과 {g_skin_tone_recommendation_obj.label} 피부톤에 맞춰
              <strong class="font-extrabold text-[var(--retina-primary-400)]">웜한 톤의 라운드/보스턴 프레임</strong>이
              가장 잘 어울립니다.
            </span>
          </li>
          <li class="flex gap-2">
            <span
              class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--retina-primary-300)]"
              aria-hidden="true"
            ></span>
            <span>
              생활 패턴 분석 결과 실내 사무 환경 사용 비중이 높아
              <strong class="font-extrabold text-[var(--retina-primary-400)]">블루라이트 차단 + 김서림 방지 코팅</strong>을
              권장합니다.
            </span>
          </li>
          <li class="flex gap-2">
            <span
              class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--retina-primary-300)]"
              aria-hidden="true"
            ></span>
            <span>
              AR 피팅으로 시도하신 안경 중
              <strong class="font-extrabold text-[var(--retina-primary-400)]">프레임 폭과 광대 너비 비율이 가장 균형 잡힌 모델</strong>을
              우선 고려해 보세요.
            </span>
          </li>
        </ul>
      </section>

      <p
        class="m-0 px-1 text-center text-[10px] font-medium leading-relaxed text-slate-400"
      >
        본 리포트는 AI 기반 얼굴 분석 결과를 토대로 자동 생성되었으며, 참고용 추천 자료입니다.
        실제 시야·착용감·도수 등은 개인차가 있을 수 있으니
        <span class="font-bold text-[var(--retina-primary-400)]">자세한 사항은 전문 안경사와 상담해 주세요.</span>
      </p>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={on_click_back}
          class="grid min-h-[42px] cursor-pointer place-items-center rounded-[10px] border border-slate-300 bg-white text-[13px] font-extrabold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        >
          뒤로가기
        </button>
        <button
          type="button"
          onclick={on_click_go_dashboard}
          class="grid min-h-[42px] cursor-pointer place-items-center rounded-[10px] border-0 bg-[var(--retina-primary-300)] text-[13px] font-extrabold text-white shadow-sm transition hover:bg-[var(--retina-primary-400)]"
        >
          대시보드로 이동
        </button>
      </div>
    </div>
  </section>
</main>
