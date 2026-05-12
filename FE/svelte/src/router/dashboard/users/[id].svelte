<script>
  import { navigate } from '@maks11060/svelte5-router'
  import {
    CalendarDays,
    ChevronRight,
    CircleCheck,
    Phone,
    ScanFace,
    UserRound,
  } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import ConfirmModal from '@/components/modal/confirm_modal.svelte'
  import { PATH } from '@/config/path'
  import { get_visit_list, create_visit } from '@/lib/api/visit'
  import {
    selected_customer_obj,
    set_selected_visit,
  } from '@/lib/stores/customer'
  import { selected_admin_obj, selected_opt_store_obj } from '@/lib/stores/admin'
  import { push_error_toast } from '@/lib/stores/toast'
  import { get_customer_by_id } from '@/router/dashboard/users/user_data'

  /** @type {{ id?: string }} */
  let { id = '1' } = $props()

  // 고객 목록에서 선택해 진입했다면 store 의 selection 을 사용. 직접 URL 로 들어왔다면 mock fallback.
  const g_customer_obj = $derived(
    Number($selected_customer_obj?.id) === Number(id)
      ? $selected_customer_obj
      : get_customer_by_id(id),
  )

  /** @type {Array<Record<string, any>>} */
  let g_visit_arr = $state([])
  let g_visit_loading = $state(true)
  let g_is_creating_visit = $state(false)
  // 얼굴분석 미이수 상태에서 생활패턴/피팅을 시작하려 할 때 띄우는 안내 모달.
  // 확인 시 얼굴분석 단계부터 강제로 진행하도록 유도.
  let g_face_required_modal_open = $state(false)
  // 얼굴분석은 했지만 생활패턴 미이수 상태에서 피팅을 시작하려 할 때 띄우는 안내 모달.
  // 확인 시 생활패턴 단계부터 강제로 진행하도록 유도.
  let g_lifestyle_required_modal_open = $state(false)

  // 방문 이력 화면에 노출할 visit 만 필터 — 얼굴분석/생활패턴/AR피팅/실착용 중 하나라도 있어야 노출.
  // 4개 단계 모두 미진행인 빈 visit (예: create 직후 아무 데이터도 없는 방문) 은 숨긴다.
  const g_visible_visit_arr = $derived(
    g_visit_arr.filter(
      (local_visit) =>
        local_visit?.test_dt ||
        local_visit?.opt_recommend_json ||
        local_visit?.vp_dt ||
        local_visit?.real_vp_dt,
    ),
  )

  // 가장 최근 방문 — 분석 / 피팅 완료 상태 chip 표시 기준 (전체 visit_arr 기준 그대로).
  const g_recent_visit_obj = $derived(g_visit_arr[0] ?? null)

  // 단계별 가장 최근 진행 일자 — 방문 이력 전체(최신순) 에서 해당 단계 데이터가 있는 첫 visit 의 dt.
  // null 이면 해당 단계는 아직 미진행.
  const g_face_recent_dt = $derived.by(() => {
    for (const local_visit of g_visit_arr) {
      if (local_visit?.test_dt) return local_visit.test_dt
    }
    return null
  })
  const g_lifestyle_recent_dt = $derived.by(() => {
    for (const local_visit of g_visit_arr) {
      if (local_visit?.opt_recommend_json) {
        return (
          local_visit.opt_recommend_json?.saved_at ??
          local_visit.update_dt ??
          local_visit.test_dt ??
          local_visit.create_dt ??
          null
        )
      }
    }
    return null
  })
  const g_fitting_recent_dt = $derived.by(() => {
    for (const local_visit of g_visit_arr) {
      if (local_visit?.vp_dt) return local_visit.vp_dt
    }
    return null
  })

  // 단계별 완료 여부 (전체 이력 기준) — 생활패턴/피팅 진입 가능 여부 판단에 사용.
  const g_face_done = $derived(Boolean(g_face_recent_dt))
  const g_lifestyle_done = $derived(Boolean(g_lifestyle_recent_dt))
  const g_fitting_done = $derived(Boolean(g_fitting_recent_dt))

  // 단계별 완료 여부 (데이터 있는 최근 방문 기준) — 버튼 상태 chip 표시에만 사용.
  // 빈 방문(얼굴분석 진입 후 완료 없이 뒤로간 경우)은 g_visible_visit_arr 에서 걸러지므로
  // 상태 chip 이 이전 방문의 완료 결과를 그대로 유지한다.
  const g_face_recent_done = $derived(Boolean(g_visible_visit_arr[0]?.test_dt))
  const g_lifestyle_recent_done = $derived(Boolean(g_visible_visit_arr[0]?.opt_recommend_json))
  const g_fitting_recent_done = $derived(Boolean(g_visible_visit_arr[0]?.vp_dt))

  /**
   * 고객 상세에서 단계별 시작 버튼 정보. target_path 는 추후 단계별 직진입 경로로 분리 예정.
   * 지금은 모두 /analysis 로 묶여 있어 새 visit 생성 후 첫 단계부터 진행한다.
   * @typedef {{ key: 'face' | 'lifestyle' | 'fitting', label: string, description: string, icon_active: string, icon_default: string, target_path: string }} StepInfo
   */
  /** @type {StepInfo[]} */
  const STEP_INFO_ARR = [
    {
      key: 'face',
      label: '얼굴분석',
      description: '얼굴형 / 피부톤 / 측정',
      icon_active: '/icons/Property 1=Face, Property 2=Active.png',
      icon_default: '/icons/Property 1=Face, Property 2=Default.png',
      target_path: PATH.analysis,
    },
    {
      key: 'lifestyle',
      label: '생활패턴',
      description: '렌즈 상담 질문',
      icon_active: '/icons/Property 1=Life, Property 2=Active.png',
      icon_default: '/icons/Property 1=Life, Property 2=Default.png',
      target_path: PATH.analysisLensConsult,
    },
    {
      key: 'fitting',
      label: '피팅시작',
      description: 'AR / 실제 안경 피팅',
      icon_active: '/icons/Property 1=Fitting, Property 2=Default.png',
      icon_default: '/icons/Property 1=Fitting, Property 2=Default.png',
      target_path: PATH.analysisArFitting,
    },
  ]


  /** @param {StepInfo['key']} step_key */
  function is_step_done(step_key) {
    if (step_key === 'face') return g_face_recent_done
    if (step_key === 'lifestyle') return g_lifestyle_recent_done
    if (step_key === 'fitting') return g_fitting_recent_done
    return false
  }

  /** @param {StepInfo['key']} step_key */
  function get_step_recent_dt(step_key) {
    if (step_key === 'face') return g_face_recent_dt
    if (step_key === 'lifestyle') return g_lifestyle_recent_dt
    if (step_key === 'fitting') return g_fitting_recent_dt
    return null
  }

  // 생년월일에서 만 나이 계산.
  const g_age_label = $derived.by(() => {
    const local_birth_dt = String(g_customer_obj?.birth_dt ?? '').trim()
    const local_year_match = local_birth_dt.match(/\d{4}/)
    if (!local_year_match) return null
    const local_age = new Date().getFullYear() - Number(local_year_match[0]) + 1
    return Number.isFinite(local_age) ? `${local_age}세` : null
  })

  /** @param {string | number | Date | null | undefined} value */
  function format_dt(value) {
    if (!value) return '-'
    const local_date = new Date(value)
    if (Number.isNaN(local_date.getTime())) return '-'
    return local_date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // 고객 상세 진입 시 방문 이력 전체 로드 (최신순). 첫 항목이 최근 방문.
  async function load_visit_arr() {
    g_visit_loading = true
    try {
      const local_result_obj = await get_visit_list({ cust_no: id })
      const local_visit_arr = Array.isArray(local_result_obj?.visits)
        ? local_result_obj.visits
        : []
      g_visit_arr = local_visit_arr
      if (local_visit_arr[0]) {
        set_selected_visit(local_visit_arr[0])
      }
    } catch {
      g_visit_arr = []
    } finally {
      g_visit_loading = false
    }
  }

  // 단계 시작 버튼 클릭.
  // - 얼굴분석: 항상 새 방문 생성 (재분석 포함).
  // - 생활패턴/피팅: 새 방문 생성 없이 가장 최근 방문을 그대로 사용 (기존 데이터 보존).
  /** @param {StepInfo} step_obj */
  async function on_click_start_step(step_obj) {
    if (g_is_creating_visit) return

    // 얼굴분석 이력이 없는 고객은 생활패턴/피팅 단계로 바로 진입할 수 없다.
    if ((step_obj.key === 'lifestyle' || step_obj.key === 'fitting') && !g_face_done) {
      g_face_required_modal_open = true
      return
    }

    // 얼굴분석은 했지만 생활패턴이 없는 경우, 피팅으로 바로 진입할 수 없다.
    if (step_obj.key === 'fitting' && !g_lifestyle_done) {
      g_lifestyle_required_modal_open = true
      return
    }

    const local_customer_obj = g_customer_obj
    if (!local_customer_obj) {
      push_error_toast('고객 정보를 찾을 수 없습니다.')
      return
    }
    if (!$selected_opt_store_obj?.opt_no) {
      push_error_toast('선택한 안경원 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    // 생활패턴/피팅: 최근 방문을 그대로 사용 — 새 방문 생성 없이 바로 진입.
    if (step_obj.key === 'lifestyle' || step_obj.key === 'fitting') {
      const local_recent_visit = g_visit_arr[0]
      if (!local_recent_visit?.visit_no) {
        push_error_toast('최근 방문 정보를 찾을 수 없습니다.')
        return
      }
      set_selected_visit(local_recent_visit)
      sessionStorage.setItem('retinal_visit_no', String(local_recent_visit.visit_no))
      sessionStorage.removeItem('retinal_lens_selections')
      sessionStorage.removeItem('retinal_saved_fittings')
      sessionStorage.setItem('retinal_detail_return_path', PATH.userDetail(id))
      navigate(step_obj.target_path)
      return
    }

    // 얼굴분석: 항상 새 방문 생성.
    g_is_creating_visit = true
    try {
      const local_result_obj = await create_visit({
        opt_no: $selected_opt_store_obj.opt_no,
        member_no: $selected_admin_obj?.member_no ?? 0,
        cust_no: local_customer_obj.id,
        cust_name: local_customer_obj.name,
        birthday: local_customer_obj.birth_dt ?? '',
        phone_no1: local_customer_obj.phone ?? '',
        phone_no2: local_customer_obj.phone2 ?? '',
        sex: local_customer_obj.gender === '여' ? 1 : 0,
      })
      const local_visit_no = Number(local_result_obj?.visit_no)
      if (!Number.isFinite(local_visit_no)) {
        push_error_toast('방문 정보 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      set_selected_visit({
        ...local_result_obj,
        visit_no: local_visit_no,
        test_dt: null,
        vp_dt: null,
        real_vp_dt: null,
        update_dt: null,
        is_new: true,
      })
      sessionStorage.setItem('retinal_visit_no', String(local_visit_no))
      sessionStorage.removeItem('retinal_lens_selections')
      sessionStorage.removeItem('retinal_saved_fittings')
      sessionStorage.setItem('retinal_detail_return_path', PATH.userDetail(id))
      navigate(step_obj.target_path)
    } catch (local_error) {
      push_error_toast(
        local_error instanceof Error
          ? local_error.message
          : '방문 정보 생성 중 오류가 발생했습니다.',
      )
    } finally {
      g_is_creating_visit = false
    }
  }

  // 방문 이력 행 클릭 — 해당 visit 을 선택 상태로 만들고 result 페이지(최종 리포트) 로 이동.
  /** @param {Record<string, any>} visit_obj */
  function on_click_open_visit(visit_obj) {
    const local_visit_no = Number(visit_obj?.visit_no)
    if (!Number.isFinite(local_visit_no)) return
    set_selected_visit(visit_obj)
    sessionStorage.setItem('retinal_visit_no', String(local_visit_no))
    navigate(PATH.analysisResult)
  }

  function on_click_back() {
    navigate(PATH.users)
  }

  // 모달 닫기 — 현재 화면 유지.
  function on_cancel_face_required() {
    g_face_required_modal_open = false
  }

  // 모달 확인 — 얼굴분석 단계로 강제 진행. 가드는 face key 일 땐 통과하므로 재호출 안전.
  function on_confirm_face_required() {
    g_face_required_modal_open = false
    const local_face_step_obj = STEP_INFO_ARR.find((local_step) => local_step.key === 'face')
    if (local_face_step_obj) void on_click_start_step(local_face_step_obj)
  }

  // lifestyle required 모달 닫기.
  function on_cancel_lifestyle_required() {
    g_lifestyle_required_modal_open = false
  }

  // lifestyle 모달 확인 — 생활패턴 단계로 강제 진행. 가드는 fitting 일 때만 걸리므로 재호출 안전.
  function on_confirm_lifestyle_required() {
    g_lifestyle_required_modal_open = false
    const local_lifestyle_step_obj = STEP_INFO_ARR.find(
      (local_step) => local_step.key === 'lifestyle',
    )
    if (local_lifestyle_step_obj) void on_click_start_step(local_lifestyle_step_obj)
  }

  $effect(() => {
    void load_visit_arr()
  })
</script>

<Header onback={on_click_back} />

<main
  class="app-frame-page flex min-h-screen flex-col bg-[var(--retina-text-100)] text-zinc-950"
>
  <section class="px-[clamp(12px,3svh,24px)] py-[clamp(8px,2svh,20px)]">
    <div class="mx-auto flex w-full max-w-[944px] flex-col gap-[clamp(8px,2svh,16px)]">
      <!-- 1) 프로필 카드 -->
      <article
        class="flex flex-col rounded-2xl border border-[var(--retina-text-200)] bg-white shadow-sm sm:flex-row sm:items-center sm:justify-between gap-[clamp(10px,2svh,18px)] p-[clamp(12px,2.5svh,22px)]"
      >
        <div class="flex items-center gap-[clamp(10px,2svh,18px)]">
          <div
            class="grid shrink-0 place-items-center rounded-full bg-[var(--retina-primary-100)] text-[var(--retina-primary-600)] h-[clamp(44px,8svh,72px)] w-[clamp(44px,8svh,72px)]"
            aria-hidden="true"
          >
            <UserRound size={32} strokeWidth={2} />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="m-0 truncate font-extrabold leading-tight text-zinc-950 text-[clamp(16px,3svh,24px)]">
                {g_customer_obj?.name ?? '고객'}
              </h1>
              <span
                class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-extrabold text-slate-600 text-[clamp(9px,1.5svh,12px)]"
              >
                {g_customer_obj?.gender ?? '-'}
              </span>
              {#if g_age_label}
                <span
                  class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-extrabold text-slate-600 text-[clamp(9px,1.5svh,12px)]"
                >
                  {g_age_label}
                </span>
              {/if}
            </div>
            <div
              class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold text-slate-600 text-[clamp(10px,1.7svh,14px)]"
            >
              <span class="inline-flex items-center gap-1.5">
                <Phone size={14} strokeWidth={2.1} aria-hidden="true" />
                {g_customer_obj?.phone || '-'}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" />
                {g_customer_obj?.birth_dt || '-'}
              </span>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-[clamp(10px,2svh,18px)] sm:border-l sm:border-slate-200 sm:pl-5">
          <div class="text-right">
            <p class="m-0 font-bold tracking-wide text-slate-500 uppercase text-[clamp(9px,1.4svh,12px)]">
              총 방문
            </p>
            <p class="m-0 font-extrabold text-[var(--retina-primary-600)] text-[clamp(18px,3.5svh,26px)]">
              {g_visible_visit_arr.length}<span class="ml-0.5 font-extrabold text-[clamp(10px,1.7svh,15px)]">회</span>
            </p>
          </div>
          <div class="h-10 w-px bg-slate-200" aria-hidden="true"></div>
          <div class="text-right">
            <p class="m-0 font-bold tracking-wide text-slate-500 uppercase text-[clamp(9px,1.4svh,12px)]">
              최근 방문
            </p>
            <p class="m-0 font-extrabold text-zinc-950 text-[clamp(11px,2svh,16px)]">
              {format_dt(g_recent_visit_obj?.create_dt ?? g_recent_visit_obj?.test_dt)}
            </p>
          </div>
        </div>
      </article>

      <!-- 2) 단계별 시작 버튼 — 얼굴분석 / 생활패턴 / 피팅 (현재는 모두 새 분석 플로우로 진입). -->
      <div class="grid grid-cols-1 gap-[clamp(8px,2svh,14px)] sm:grid-cols-3">
        {#each STEP_INFO_ARR as step_obj (step_obj.key)}
          {@const local_done = is_step_done(step_obj.key)}
          {@const local_recent_dt = get_step_recent_dt(step_obj.key)}
          <button
            type="button"
            onclick={() => on_click_start_step(step_obj)}
            disabled={g_is_creating_visit}
            class="group relative flex flex-col rounded-2xl border border-[var(--retina-text-200)] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--retina-primary-600)] hover:shadow-[0_8px_20px_rgba(91,0,107,0.10)] disabled:cursor-not-allowed disabled:opacity-60 gap-[clamp(6px,1.5svh,12px)] px-[clamp(12px,2.5svh,22px)] py-[clamp(10px,2svh,18px)]"
            aria-label={`${step_obj.label} 시작`}
          >
            <div class="flex items-center gap-[clamp(8px,2svh,18px)]">
              <img
                src={local_done ? step_obj.icon_active : step_obj.icon_default}
                alt=""
                aria-hidden="true"
                class="shrink-0 h-[clamp(40px,8svh,72px)] w-[clamp(40px,8svh,72px)]"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h2 class="m-0 font-extrabold text-zinc-950 text-[clamp(12px,2.2svh,18px)]">
                    {step_obj.label}
                  </h2>
                  {#if step_obj.key !== 'fitting'}
                    <span
                      class={`inline-flex items-center rounded-full px-2 py-0.5 font-extrabold text-[clamp(9px,1.4svh,12px)] ${
                        local_done
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {local_done ? '완료' : '미진행'}
                    </span>
                  {/if}
                </div>
                <p class="m-0 mt-1 truncate font-semibold text-slate-500 text-[clamp(10px,1.6svh,13px)]">
                  {step_obj.description}
                </p>
              </div>
              <ChevronRight
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
                class="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--retina-primary-600)]"
              />
            </div>
            <div
              class="border-t border-slate-100 pt-2 font-semibold text-slate-500 text-[clamp(9px,1.5svh,12px)]"
            >
              {#if local_recent_dt}
                <span class="flex items-center gap-1.5">
                  <CalendarDays size={12} strokeWidth={2.2} aria-hidden="true" />
                  최근 진행: {format_dt(local_recent_dt)}
                </span>
              {:else}
                <span class="text-slate-400">진행 이력 없음</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>

      <!-- 3) 방문 이력 -->
      <section
        class="flex flex-col rounded-2xl border border-[var(--retina-text-200)] bg-white shadow-sm"
      >
        <header class="border-b border-slate-100 px-[clamp(12px,2.5svh,22px)] py-[clamp(8px,1.8svh,14px)]">
          <h2 class="m-0 font-extrabold text-zinc-950 text-[clamp(12px,2.2svh,18px)]">방문 이력</h2>
        </header>

        {#if g_visit_loading}
          <div class="text-center font-semibold text-slate-400 px-[clamp(12px,2.5svh,22px)] py-[clamp(20px,5svh,48px)] text-[clamp(11px,1.9svh,14px)]">
            불러오는 중...
          </div>
        {:else if g_visible_visit_arr.length === 0}
          <div
            class="flex flex-col items-center justify-center gap-2 text-center text-slate-400 px-[clamp(12px,2.5svh,22px)] py-[clamp(24px,6svh,56px)]"
          >
            <ScanFace size={28} strokeWidth={1.8} aria-hidden="true" />
            <p class="m-0 font-semibold text-[clamp(11px,1.9svh,14px)]">아직 방문 이력이 없습니다.</p>
          </div>
        {:else}
          <ul class="m-0 grid list-none gap-0 p-0">
            {#each g_visible_visit_arr as visit_obj, visit_index (visit_obj.visit_no ?? visit_index)}
              {@const local_has_face = Boolean(visit_obj.test_dt)}
              {@const local_has_lifestyle = Boolean(visit_obj.opt_recommend_json)}
              {@const local_has_vp = Boolean(visit_obj.vp_dt)}
              {@const local_has_real_vp = Boolean(visit_obj.real_vp_dt)}
              <li class={visit_index > 0 ? 'border-t border-slate-100' : ''}>
                <button
                  type="button"
                  onclick={() => on_click_open_visit(visit_obj)}
                  class="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent text-left transition hover:bg-slate-50 gap-[clamp(8px,2svh,16px)] px-[clamp(12px,2.5svh,22px)] py-[clamp(8px,1.8svh,14px)]"
                >
                  <div class="flex min-w-0 items-center gap-[clamp(8px,2svh,16px)]">
                    <div
                      class="grid shrink-0 place-items-center rounded-full bg-[var(--retina-primary-100)] text-[var(--retina-primary-600)] h-[clamp(28px,5svh,44px)] w-[clamp(28px,5svh,44px)]"
                    >
                      <span class="font-extrabold text-[clamp(10px,1.7svh,14px)]">
                        {g_visible_visit_arr.length - visit_index}
                      </span>
                    </div>
                    <div class="min-w-0">
                      <p class="m-0 font-extrabold text-zinc-950 text-[clamp(11px,2svh,16px)]">
                        {format_dt(visit_obj.create_dt ?? visit_obj.test_dt)}
                      </p>
                      <div
                        class="mt-1 flex flex-wrap items-center gap-1.5 font-extrabold text-[clamp(9px,1.5svh,12px)]"
                      >
                        <span
                          class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            local_has_face
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {#if local_has_face}
                            <CircleCheck size={10} strokeWidth={3} aria-hidden="true" />
                          {/if}
                          얼굴 분석
                        </span>
                        <span
                          class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            local_has_lifestyle
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {#if local_has_lifestyle}
                            <CircleCheck size={10} strokeWidth={3} aria-hidden="true" />
                          {/if}
                          생활 패턴
                        </span>
                        <span
                          class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            local_has_vp
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {#if local_has_vp}
                            <CircleCheck size={10} strokeWidth={3} aria-hidden="true" />
                          {/if}
                          AR 피팅
                        </span>
                        <span
                          class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            local_has_real_vp
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {#if local_has_real_vp}
                            <CircleCheck size={10} strokeWidth={3} aria-hidden="true" />
                          {/if}
                          실 착용
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden="true"
                    class="shrink-0 text-slate-300"
                  />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  </section>

  <LoadingOverlay
    open={g_visit_loading || g_is_creating_visit}
    label={g_is_creating_visit ? '새 방문 정보 생성 중...' : '고객 정보 불러오는 중...'}
  />

  <ConfirmModal
    open={g_face_required_modal_open}
    title="얼굴분석이 먼저 필요해요"
    message={'얼굴분석 진행 이력이 없습니다.\n생활패턴·피팅 단계는 얼굴분석 결과를 기반으로 진행됩니다.\n얼굴분석부터 진행해 주세요.'}
    cancelLabel="닫기"
    confirmLabel="얼굴분석부터 진행하기"
    onclose={on_cancel_face_required}
    oncancel={on_cancel_face_required}
    onconfirm={on_confirm_face_required}
  />

  <ConfirmModal
    open={g_lifestyle_required_modal_open}
    title="생활패턴이 먼저 필요해요"
    message={'생활패턴 진행 이력이 없습니다.\n피팅 단계는 생활패턴 정보를 기반으로 진행됩니다.\n생활패턴부터 진행해 주세요.'}
    cancelLabel="닫기"
    confirmLabel="생활패턴부터 진행하기"
    onclose={on_cancel_lifestyle_required}
    oncancel={on_cancel_lifestyle_required}
    onconfirm={on_confirm_lifestyle_required}
  />
</main>
