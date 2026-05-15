<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { UserRound } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import BottomActionBar from '@/components/analysis/bottom_action_bar.svelte'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import { admin_arr } from '@/lib/stores/admin'
  import { update_visit } from '@/lib/api/visit.js'

  // store 가 비어있을 때 화면 검증용으로 노출하는 대체 안경사 목록.
  const PLACEHOLDER_MEMBER_ARR = [
    { id: -101, name: '김안경', position: '원장' },
    { id: -102, name: '이렌즈', position: '실장' },
    { id: -103, name: '박피팅', position: '전문가' },
  ]

  // 안경사 배정 없이 셀프로 진행하는 가상 entry — 항상 맨 앞.
  const SELF_MEMBER_OBJ = { id: 0, name: '셀프 진행', position: '안경사 미선택' }

  /** @type {number | null} */
  let ref_selected_member_id = $state(null)
  let g_is_submitting = $state(false)

  const g_member_arr = $derived([
    SELF_MEMBER_OBJ,
    ...($admin_arr && $admin_arr.length > 0 ? $admin_arr : PLACEHOLDER_MEMBER_ARR),
  ])
  const g_can_confirm = $derived(ref_selected_member_id !== null && !g_is_submitting)
  // 선택한 카드에서 BE 가 기대하는 member_no 추출. 실제 admin_arr 은 member_no 필드를 가짐,
  // placeholder/self entry 는 id 를 그대로 member_no 로 보낸다.
  const g_selected_member_no = $derived.by(() => {
    if (ref_selected_member_id === null) return null
    const local_target = g_member_arr.find((local_m) => local_m.id === ref_selected_member_id)
    if (!local_target) return null
    if (Number.isFinite(local_target.member_no)) return local_target.member_no
    return local_target.id
  })

  // 현재 탭 세션의 visit_no 를 sessionStorage 에서 읽어 PATCH 대상을 결정. real_fitting 과 동일 규칙.
  function get_visit_no() {
    if (typeof sessionStorage === 'undefined') return null
    const local_raw = sessionStorage.getItem('retinal_visit_no')
    if (local_raw) {
      const local_num = Number(local_raw)
      if (Number.isFinite(local_num)) return local_num
    }
    const local_selected_json = sessionStorage.getItem('retinal_selected_visit_obj')
    if (!local_selected_json) return null
    try {
      const local_selected = JSON.parse(local_selected_json)
      const local_num = Number(local_selected?.visit_no)
      return Number.isFinite(local_num) ? local_num : null
    } catch {
      return null
    }
  }

  // 헤더 뒤로가기 — 촬영 페이지로 복귀.
  function on_click_back() {
    if (g_is_submitting) return
    navigate(PATH.analysisRealFitting)
  }

  /**
   * 안경사 카드 단일 선택 토글.
   * @param {number} member_id
   */
  function on_click_select_member(member_id) {
    if (g_is_submitting) return
    ref_selected_member_id = member_id
  }

  // 확정 — visit 에 member_no PATCH 후 최종 리포트로 이동.
  // BE(VisitUpdateRequest.member_no)는 이미 연결됨. 네트워크 오류 등으로 PATCH 가 실패하더라도
  // 사용자 흐름은 막지 않고 result 로 진행한다 (리포트 화면 진입 자체가 더 중요).
  async function on_click_confirm() {
    if (!g_can_confirm) return
    g_is_submitting = true
    try {
      const local_visit_no = get_visit_no()
      if (Number.isFinite(local_visit_no) && g_selected_member_no !== null) {
        try {
          await update_visit({
            visit_no: local_visit_no,
            body: { member_no: g_selected_member_no },
          })
        } catch (patch_err) {
          // 네트워크/검증 오류 등 어떤 에러든 사용자 흐름 막지 않음.
          console.warn('[member_select] member_no PATCH 실패 — 흐름 계속 진행:', patch_err)
        }
      }
      navigate(PATH.analysisResult)
    } finally {
      g_is_submitting = false
    }
  }
</script>

<AnalysisPageLayout current_step={4} bg_class="bg-[var(--retina-bg-1)]" onback={on_click_back}>
  <section class="flex min-h-0 flex-1 flex-col" aria-label="담당 안경사 선택">
    <div
      class="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-[clamp(8px,2svh,16px)] px-[clamp(12px,3svh,32px)] py-[clamp(12px,3svh,28px)]"
    >
      <header class="text-center">
        <h2
          class="m-0 text-[clamp(15px,2.4svh,20px)] font-extrabold text-[var(--retina-text-800)]"
        >
          담당 안경사 선택
        </h2>
        <p
          class="mt-1 text-[clamp(11px,1.7svh,13px)] font-semibold text-[var(--retina-text-600)]"
        >
          이번 상담을 도와줄 담당 안경사를 선택해 주세요.
        </p>
      </header>

      <div
        class="grid flex-1 auto-rows-min grid-cols-2 content-start gap-[clamp(8px,1.8svh,14px)] overflow-y-auto pt-[clamp(12px,3svh,28px)] sm:grid-cols-3 md:grid-cols-4"
      >
        {#each g_member_arr as member_obj (member_obj.id)}
          {@const is_selected = ref_selected_member_id === member_obj.id}
          {@const is_self = member_obj.id === 0}
          <button
            class={`group flex cursor-pointer items-center gap-[clamp(8px,1.6svh,14px)] rounded-xl border-2 px-[clamp(10px,2svh,16px)] py-[clamp(14px,2.8svh,22px)] text-left shadow-[0_4px_10px_rgba(19,25,40,0.04)] transition duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 ${
              is_selected
                ? 'border-[var(--retina-primary-600)] bg-[var(--retina-surface)] shadow-[0_10px_20px_rgba(91,0,107,0.18)]'
                : is_self
                  ? 'border-[var(--retina-primary-200)] bg-[var(--retina-surface)] hover:border-[var(--retina-primary-600)] hover:bg-[var(--retina-bg-1)]'
                  : 'border-[var(--retina-text-200)] bg-[var(--retina-surface)] hover:border-[var(--retina-primary-600)] hover:bg-[var(--retina-bg-1)]'
            }`}
            type="button"
            aria-pressed={is_selected}
            onclick={() => on_click_select_member(member_obj.id)}
          >
            <span
              class={`grid h-[clamp(32px,5svh,42px)] w-[clamp(32px,5svh,42px)] flex-none place-items-center rounded-full transition duration-150 ${
                is_selected
                  ? 'bg-[var(--retina-primary-600)] text-[var(--retina-text-100)] shadow-md shadow-[var(--retina-primary-600)]/25'
                  : 'bg-[var(--retina-bg-1)] text-[var(--retina-primary-600)] group-hover:bg-[var(--retina-primary-600)] group-hover:text-[var(--retina-text-100)]'
              }`}
            >
              <UserRound
                strokeWidth={2.3}
                aria-hidden="true"
                class="h-[clamp(16px,2.6svh,22px)] w-[clamp(16px,2.6svh,22px)]"
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span
                class="block max-w-full truncate font-extrabold leading-tight text-[var(--retina-text)] text-[clamp(13px,2.2svh,17px)]"
              >
                {member_obj.name}
              </span>
              <span
                class="mt-0.5 block max-w-full truncate font-bold leading-tight text-[var(--retina-text-500)] text-[clamp(10px,1.6svh,13px)]"
              >
                {member_obj.position}
              </span>
            </span>
          </button>
        {/each}
      </div>
    </div>

    <BottomActionBar padding_class="px-[clamp(12px,3svh,24px)] py-[clamp(6px,1.5svh,14px)]">
      <div
        class="mx-auto grid w-full max-w-[400px] xl:max-w-[600px] 2xl:max-w-[760px] grid-cols-1 gap-[clamp(8px,2svh,16px)]"
      >
        <button
          type="button"
          disabled={!g_can_confirm}
          onclick={on_click_confirm}
          class="grid cursor-pointer place-items-center rounded-lg border-0 bg-[var(--retina-primary-300)] tracking-tight text-[var(--retina-surface)] shadow-sm transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60 h-[clamp(40px,7.5svh,80px)] text-[clamp(15px,3.6svh,36px)]"
        >
          {g_is_submitting ? '진행 중...' : '최종 리포트 보기'}
        </button>
      </div>
    </BottomActionBar>
  </section>

  <LoadingOverlay open={g_is_submitting} label="최종 리포트 준비 중..." />
</AnalysisPageLayout>
