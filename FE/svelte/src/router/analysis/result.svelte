<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Glasses, UserRound, UserPlus } from 'lucide-svelte'
  import CustomerCreateModal from '@/components/modal/customer_create_modal.svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { create_customer, search_customer } from '@/lib/api/customers'
  import { create_visit, get_visit, update_visit } from '@/lib/api/visit'
  import { selected_admin_obj, selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast } from '@/lib/stores/toast'
  import {
    selected_customer_obj,
    selected_visit_obj,
    set_selected_customer,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import {
    get_skin_tone_recommendation,
    get_frame_styles_for_face_shape,
  } from '@/lib/recommendations/frame_recommendations.js'
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

  // visit GET 응답을 통째로 보관해 각 섹션 derived 가 여기서 꺼내쓴다.
  let g_visit_obj = $state(/** @type {Record<string, any> | null} */ (null))
  let g_visit_loading = $state(true)

  let ref_customer_create_modal_open = $state(false)

  // 비회원(cust_no = 0) 으로 진입한 경우에만 고객정보등록 버튼을 노출한다.
  const g_is_guest_visit = $derived(Number($selected_customer_obj?.id) === 0)

  // visit_obj.test_json (얼굴 분석 결과 schema_version 3)
  const g_test_json = $derived(g_visit_obj?.test_json ?? null)

  // visit_obj.opt_recommend_json (렌즈 상담 답변)
  const g_opt_recommend_json = $derived(g_visit_obj?.opt_recommend_json ?? null)

  // visit_obj.vp_json (AR 피팅 결과 — fitting_arr 포함)
  const g_vp_json = $derived(g_visit_obj?.vp_json ?? null)

  // visit_obj.report_json (BE 가 생성하는 최종 인사이트)
  const g_report_json = $derived(g_visit_obj?.report_json ?? null)

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
      g_test_json?.face_shape ?? $selected_customer_obj?.face_shape ?? 'oval',
    ),
  )

  const g_face_shape_label = $derived(FACE_SHAPE_LABEL_OBJ[g_face_shape_key] ?? '계란형')

  const g_skin_tone_recommendation_obj = $derived(
    get_skin_tone_recommendation(
      g_test_json?.skin_tone?.tone ?? $selected_customer_obj?.skin_tone ?? 'NEUTRAL',
    ),
  )

  // BE 가 추천 칩 배열을 보내줬으면 그걸 우선 사용, 아니면 FE 로컬 매핑으로 fallback
  const g_recommended_color_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.skin_tone_recommendations)
      ? g_test_json.skin_tone_recommendations
      : []
    if (local_be_arr.length > 0) {
      return local_be_arr.slice(0, 4).map((/** @type {{ label?: string, tone_class?: string }} */ local_chip) => ({
        label: String(local_chip.label ?? ''),
        tone_class:
          local_chip.tone_class ??
          g_skin_tone_recommendation_obj.chip_arr.find(
            (local_default) => local_default.label === local_chip.label,
          )?.tone_class ??
          'bg-slate-300',
      }))
    }
    return g_skin_tone_recommendation_obj.chip_arr.slice(0, 4)
  })

  const g_recommended_frame_arr = $derived.by(() => {
    const local_be_arr = Array.isArray(g_test_json?.face_shape_recommendations)
      ? g_test_json.face_shape_recommendations
      : []
    if (local_be_arr.length > 0) return local_be_arr.slice(0, 6)
    return get_frame_styles_for_face_shape(g_face_shape_key).slice(0, 6)
  })

  // 렌즈 상담 답변 (BE 가 selection_arr 로 저장한다)
  const g_lens_selection_arr = $derived.by(() => {
    const local_arr = Array.isArray(g_opt_recommend_json?.selection_arr)
      ? g_opt_recommend_json.selection_arr
      : []
    return /** @type {{question_text: string, label_arr: string[]}[]} */ (local_arr)
  })

  // AR 피팅 결과 (BE 가 fitting_arr 로 저장한다)
  const g_saved_fitting_arr = $derived.by(() => {
    const local_arr = Array.isArray(g_vp_json?.fitting_arr) ? g_vp_json.fitting_arr : []
    return /** @type {{brand: string, model: string, capture_arr: {label: string, url: string}[]}[]} */ (
      local_arr
    )
  })

  // report_json 의 인사이트 bullet 배열 추출 — summary_arr 또는 insight_arr 또는 string[] 형태 모두 지원
  const g_report_bullet_arr = $derived.by(() => {
    if (!g_report_json) return /** @type {string[]} */ ([])
    if (Array.isArray(g_report_json)) return g_report_json.map(String)
    if (Array.isArray(g_report_json.summary_arr)) return g_report_json.summary_arr.map(String)
    if (Array.isArray(g_report_json.insight_arr)) return g_report_json.insight_arr.map(String)
    if (Array.isArray(g_report_json.bullet_arr)) return g_report_json.bullet_arr.map(String)
    if (typeof g_report_json.summary === 'string') return [g_report_json.summary]
    return /** @type {string[]} */ ([])
  })

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

  function on_click_go_main() {
    navigate(PATH.visitSelect)
  }

  function on_click_open_customer_create_modal() {
    ref_customer_create_modal_open = true
  }

  function on_click_close_customer_create_modal() {
    ref_customer_create_modal_open = false
  }

  /**
   * 비회원 분석 결과를 새로 등록한 고객 정보로 연결한다.
   * 1) create_customer 로 신규 고객 등록 → search_customer 로 새 cust_no 추출
   * 2) 기존 비회원 visit 의 분석 데이터를 GET
   * 3) 새 cust_no 로 create_visit → 새 visit_no 발급
   * 4) 기존 분석 데이터를 새 visit 에 PATCH 로 일괄 저장
   * 5) selected_customer / selected_visit / sessionStorage 모두 갱신
   * @param {{ name: string, gender: string, birth_dt: string, phone1: string, phone2: string }} customer_obj
   */
  async function on_create_customer(customer_obj) {
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    const local_old_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_old_visit_no) || local_old_visit_no <= 0) {
      push_error_toast('연결할 방문 정보가 없습니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    const local_phone1 = customer_obj.phone1.replace(/[^0-9]/g, '')
    const local_phone2 = customer_obj.phone2.replace(/[^0-9]/g, '')
    const local_sex_value = Number(customer_obj.gender)

    try {
      await create_customer({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_name: customer_obj.name,
        phone1: local_phone1,
        phone2: local_phone2,
        birthday: customer_obj.birth_dt,
        sex: local_sex_value,
      })

      const local_search_arr = await search_customer({
        phone_no: local_phone1,
        opt_no: $selected_opt_store_obj.opt_no,
      })
      const local_search_obj_arr = Array.isArray(local_search_arr) ? local_search_arr : []
      const local_new_customer_obj = local_search_obj_arr.find(
        (local_obj) =>
          String(local_obj?.cust_name ?? '').trim() === customer_obj.name.trim() &&
          String(local_obj?.phone1 ?? '').replace(/[^0-9]/g, '') === local_phone1,
      ) ?? local_search_obj_arr[0]
      const local_new_cust_no = Number(local_new_customer_obj?.cust_no)

      if (!Number.isFinite(local_new_cust_no) || local_new_cust_no <= 0) {
        push_error_toast('등록한 고객 정보를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      // 기존 비회원 visit 의 분석/리포트 데이터를 가져온다.
      const local_old_visit_obj = await get_visit({ visit_no: local_old_visit_no })

      // 새 cust_no 로 새 방문을 만든다.
      const local_new_visit_obj = await create_visit({
        opt_no: $selected_opt_store_obj.opt_no,
        cust_no: local_new_cust_no,
        cust_name: customer_obj.name,
        birthday: customer_obj.birth_dt,
        phone_no1: local_phone1,
        phone_no2: local_phone2,
        sex: local_sex_value,
        member_no: $selected_admin_obj?.member_no ?? 0,
      })
      const local_new_visit_no = Number(local_new_visit_obj?.visit_no)

      if (!Number.isFinite(local_new_visit_no) || local_new_visit_no <= 0) {
        push_error_toast('새 방문 정보 생성에 실패했습니다.')
        return
      }

      // 기존 분석/리포트 데이터를 새 visit 에 일괄 PATCH 로 옮긴다.
      const local_patch_body_obj = {
        main_file: local_old_visit_obj?.main_file ?? null,
        test_file_arr: local_old_visit_obj?.test_file_arr ?? null,
        test_json: local_old_visit_obj?.test_json ?? null,
        opt_recommend_json: local_old_visit_obj?.opt_recommend_json ?? null,
        vp_file_arr: local_old_visit_obj?.vp_file_arr ?? null,
        vp_json: local_old_visit_obj?.vp_json ?? null,
        real_vp_json: local_old_visit_obj?.real_vp_json ?? null,
        report_json: local_old_visit_obj?.report_json ?? null,
        test_dt: local_old_visit_obj?.test_dt ?? null,
        vp_dt: local_old_visit_obj?.vp_dt ?? null,
        real_vp_dt: local_old_visit_obj?.real_vp_dt ?? null,
      }

      await update_visit({
        visit_no: local_new_visit_no,
        body: local_patch_body_obj,
      })

      set_selected_customer({
        id: local_new_cust_no,
        name: customer_obj.name,
        phone: local_phone1,
        phone2: local_phone2,
        gender: local_sex_value === 0 ? '남' : '여',
        birth_dt: customer_obj.birth_dt,
        visit_count: 1,
        last_visit_dt: '-',
      })

      set_selected_visit({
        ...local_old_visit_obj,
        ...local_new_visit_obj,
        visit_no: local_new_visit_no,
        cust_no: local_new_cust_no,
        is_new: false,
      })

      sessionStorage.setItem('retinal_visit_no', String(local_new_visit_no))

      ref_customer_create_modal_open = false
      // 새 visit 으로 PATCH 마이그레이션 됐으니 화면 데이터도 그쪽 기준으로 다시 로드.
      await load_visit_data()
    } catch (local_error) {
      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '고객 정보 등록 중 오류가 발생했습니다.',
      )
    }
  }

  // 현재 visit 의 분석/리포트/피팅 데이터를 한 번에 GET 해서 화면을 채운다.
  async function load_visit_data() {
    const local_visit_no = Number($selected_visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no) || local_visit_no <= 0) {
      g_visit_loading = false
      return
    }
    try {
      g_visit_obj = await get_visit({ visit_no: local_visit_no })
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '방문 정보를 불러오지 못했습니다.',
      )
    } finally {
      g_visit_loading = false
    }
  }

  onMount(() => {
    void load_visit_data()
  })
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-zinc-950">
  <Header />

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

      <!-- 2.5 AI 분석 인사이트 (report_json) -->
      <section class="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 class="m-0 text-[13px] font-extrabold text-zinc-900">AI 분석 인사이트</h2>

        {#if g_visit_loading}
          <p class="mt-3 text-[11px] font-semibold text-slate-400">리포트 불러오는 중...</p>
        {:else if g_report_bullet_arr.length === 0}
          <p class="mt-3 text-[11px] font-semibold text-slate-400">
            아직 생성된 인사이트가 없습니다.
          </p>
        {:else}
          <ul class="mt-3 grid gap-2 text-[12px] leading-relaxed text-slate-700">
            {#each g_report_bullet_arr as bullet_text, bullet_index (bullet_index)}
              <li class="flex gap-2">
                <span
                  class="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--retina-primary-300)]"
                  aria-hidden="true"
                ></span>
                <span class="whitespace-pre-line">{bullet_text}</span>
              </li>
            {/each}
          </ul>
        {/if}
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
                  {#if local_front_capture_obj?.url}
                    <img
                      src={local_front_capture_obj.url}
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

      <div class={`grid gap-2 ${g_is_guest_visit ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <button
          type="button"
          onclick={on_click_back}
          class="grid min-h-[42px] cursor-pointer place-items-center rounded-[10px] border border-slate-300 bg-white text-[13px] font-extrabold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        >
          뒤로가기
        </button>
        <button
          type="button"
          onclick={on_click_go_main}
          class="grid min-h-[42px] cursor-pointer place-items-center rounded-[10px] border-0 bg-[var(--retina-primary-300)] text-[13px] font-extrabold text-white shadow-sm transition hover:bg-[var(--retina-primary-400)]"
        >
          메인으로 이동
        </button>
        {#if g_is_guest_visit}
          <button
            type="button"
            onclick={on_click_open_customer_create_modal}
            class="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[var(--retina-primary-600)] bg-white text-[13px] font-extrabold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-bg-1)]"
          >
            <UserPlus size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>고객정보등록하기</span>
          </button>
        {/if}
      </div>
    </div>
  </section>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />
</main>
