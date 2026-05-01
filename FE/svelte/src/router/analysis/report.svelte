<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'
  import Header from '@/components/layout/header.svelte'
  import { selected_customer_obj } from '@/lib/stores/customer'
  import {
    get_session,
    get_face_shape_result,
    hydrate_from_mirror,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import { save_face_analysis } from '@/lib/api/analysis.js'
  import {
    get_skin_tone_recommendation,
    get_frame_styles_for_face_shape,
  } from '@/lib/recommendations/frame_recommendations.js'

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

  onMount(() => {
    hydrate_from_mirror()
  })

  $effect(() => {
    if (Object.keys(g_session.captures_obj).length === 0) {
      navigate(PATH.analysis)
    }
  })

  const g_customer_name = $derived.by(() => {
    const name = $selected_customer_obj?.name?.trim()
    if (!name) return '고객'
    return name.endsWith('님') ? name : `${name}님`
  })

  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '').trim().toLowerCase()
    if (local_value.includes('round') || local_value.includes('둥근')) return 'round'
    if (local_value.includes('heart') || local_value.includes('triangle') || local_value.includes('하트')) return 'heart'
    if (local_value.includes('square') || local_value.includes('사각')) return 'square'
    if (local_value.includes('oblong') || local_value.includes('long') || local_value.includes('긴')) return 'oblong'
    return 'oval'
  }

  const g_face_shape_key = $derived(
    normalize_face_shape_key($selected_customer_obj?.face_shape ?? g_face_shape_result?.face_shape ?? 'oval'),
  )

  const g_face_shape_label = $derived(FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? '계란형')

  const g_skin_tone_recommendation_obj = $derived(
    get_skin_tone_recommendation(
      g_face_shape_result?.skin_tone?.tone ?? $selected_customer_obj?.skin_tone ?? 'NEUTRAL',
    ),
  )

  const g_recommended_color_arr = $derived(g_skin_tone_recommendation_obj.chip_arr.slice(0, 4))
  const g_recommended_frame_arr = $derived(get_frame_styles_for_face_shape(g_face_shape_key).slice(0, 6))
  const g_color_placeholder_count = $derived(Math.max(0, 4 - g_recommended_color_arr.length))

  const g_photo_src = $derived(
    g_session.captures_obj.front_no_glasses?.object_url
      ?? g_session.captures_obj.front_glasses?.object_url
      ?? null,
  )

  function on_click_back() {
    reset_session()
    navigate(PATH.analysis)
  }

  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  function on_click_retry() {
    reset_session()
    navigate(PATH.analysis)
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

  function build_test_json() {
    return {
      schema_version: 1,
      glasses_mode: g_session.glasses_mode,
      face_shape: g_face_shape_result,
      scale: g_session.scale,
      measurements: g_session.measurements_obj,
      captures_meta: Object.fromEntries(
        Object.entries(g_session.captures_obj).map(([key, capture_obj]) => [
          key,
          {
            width: capture_obj.width,
            height: capture_obj.height,
            captured_at: capture_obj.captured_at,
          },
        ]),
      ),
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
      await save_face_analysis(visit_no, {
        main_file: '',
        test_file_arr: [],
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

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-[var(--retina-text)]">
  <Header onback={on_click_back} onlogout={on_click_logout} />

  <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col px-7 pt-2.5 pb-1">
      <h1 class="m-0 text-center text-[18px] font-extrabold tracking-[-0.02em] text-zinc-950">
        {g_customer_name}의 얼굴 분석 결과
      </h1>

      <div class="mx-auto mt-2 grid min-h-0 h-full w-full max-w-[760px] grid-cols-[0.98fr_0.92fr] gap-4 px-1">
        <section class="flex min-h-0 items-center justify-center">
          <div class="flex h-full max-h-[458px] w-full max-w-[348px] overflow-hidden rounded-[14px] bg-slate-100 shadow-sm">
            {#if g_photo_src}
              <img class="h-full w-full object-cover" src={g_photo_src} alt={`${g_customer_name} 얼굴 사진`} />
            {:else}
              <div class="grid h-full w-full place-items-center text-sm font-bold text-slate-400">
                촬영 사진이 없습니다
              </div>
            {/if}
          </div>
        </section>

        <section class="flex min-h-0 items-center justify-center">
          <article class="flex h-full max-h-[458px] w-full max-w-[368px] flex-col rounded-[14px] border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_20px_rgba(15,23,42,0.07)]">
            <div class="grid grid-cols-2 gap-2.5">
              <div class="rounded-[10px] border border-[#F3E2CC] bg-[#FFF6EB] px-4 py-2.5 text-center">
                <p class="m-0 text-[12px] font-bold text-slate-700">얼굴형</p>
                <p class="m-0 mt-2.5 text-[14px] font-extrabold text-[#F97316]">{g_face_shape_label}</p>
              </div>
              <div class="rounded-[10px] border border-[#CFD7F7] bg-[#EEF2FF] px-4 py-2.5 text-center">
                <p class="m-0 text-[12px] font-bold text-slate-700">피부톤</p>
                <p class="m-0 mt-1.5 text-[13px] font-black leading-snug text-[#1660C7]">
                  {g_skin_tone_recommendation_obj.label}
                  <br />
                  {SKIN_TONE_DESCRIPTION_OBJ[g_skin_tone_recommendation_obj.key] ?? '중성 톤'}
                </p>
              </div>
            </div>

            <div class="my-4 h-px bg-slate-200"></div>

            <section class="flex-1">
              <h2 class="m-0 text-center text-[13px] font-extrabold text-slate-800">추천 안경테 컬러</h2>
              <div class="mt-2.5 grid grid-cols-2 gap-2">
                {#each g_recommended_color_arr as color_obj (`${color_obj.label}-${color_obj.tone_class}`)}
                  <div class="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-center shadow-sm shadow-slate-100">
                    <div class={`h-[12px] w-[24px] rounded-full ${color_obj.tone_class}`}></div>
                    <p class="m-0 text-[12px] font-bold text-slate-500">{color_obj.label}</p>
                  </div>
                {/each}
                {#each Array.from({ length: g_color_placeholder_count }) as _, index (`placeholder-${index}`)}
                  <div class="min-h-[52px] rounded-[10px] border border-transparent bg-transparent"></div>
                {/each}
              </div>
            </section>

            <div class="my-4 h-px bg-slate-200"></div>

            <section class="flex-1">
              <h2 class="m-0 text-center text-[13px] font-extrabold text-slate-800">추천 안경테 모양</h2>
              <div class="mt-2.5 grid grid-cols-3 gap-1.5">
                {#each g_recommended_frame_arr as frame_obj (`${frame_obj.name}-${frame_obj.priority}`)}
                  <div
                    class={`flex min-h-[38px] items-center justify-center rounded-[10px] border px-3 py-1 text-center text-[11px] font-extrabold ${
                      frame_obj.priority === 1
                        ? 'border-[#F97316] bg-[#FFF7ED] text-[#F97316]'
                        : 'border-slate-200 bg-[#F8FAFC] text-slate-400'
                    }`}
                  >
                    {frame_obj.name}
                  </div>
                {/each}
              </div>
            </section>
          </article>
        </section>
      </div>
    </div>

    <div class="shrink-0 border-t border-slate-100 px-7 py-2.5">
      {#if g_submit_error}
        <p class="m-0 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
          {g_submit_error}
        </p>
      {/if}

      <div class="mx-auto grid w-full max-w-[820px] grid-cols-[260px_minmax(0,520px)] justify-center gap-4">
        <button
          type="button"
          class="grid min-h-[46px] cursor-pointer place-items-center rounded-xl border border-slate-300 bg-white text-[15px] font-extrabold text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
          onclick={on_click_retry}
        >
          재분석
        </button>
        <button
          type="button"
          class="grid min-h-[46px] cursor-pointer place-items-center rounded-xl border-0 bg-[#F97316] px-6 text-[15px] font-extrabold text-white transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={g_is_submitting}
          onclick={on_click_continue}
        >
          {g_is_submitting ? '분석 결과 저장 중...' : '생활 패턴 분석하고 피팅 추천받기'}
        </button>
      </div>
    </div>
  </section>
</main>
