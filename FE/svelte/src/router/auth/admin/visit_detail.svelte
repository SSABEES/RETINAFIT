<script>
  import { onMount } from 'svelte'
  import { Link } from '@maks11060/svelte5-router'
  import { ArrowLeft } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import AiInsightPanel from '@/components/analysis/ai_insight_panel.svelte'
  import { PATH } from '@/config/path'
  import { get_admin_visit } from '@/lib/api/visit'
  import { push_error_toast } from '@/lib/stores/toast'

  /** @type {{ visit_no?: string }} */
  let { visit_no = '' } = $props()

  let g_visit_obj = $state(/** @type {any} */ (null))
  let g_is_loading = $state(true)

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
    if (sex === null || sex === undefined || sex === '') return '-'
    const local_num = Number(sex)
    if (local_num === 1) return '여'
    if (local_num === 0) return '남'
    return '-'
  }

  // 어드민 방문자 목록 페이지(visits.svelte) 가 sessionStorage 에 저장한 전체 visit 캐시 키.
  // 캐시 hit 이면 단건 fetch 생략 — 응답이 visit 전체 필드를 포함해 화면 구성에 충분.
  const VISITS_CACHE_KEY = 'retinal_admin_visit_list'

  /** sessionStorage 의 어드민 visit 목록 캐시에서 visit_no 와 일치하는 단건을 찾는다. 없으면 null. */
  function find_visit_in_admin_cache(target_visit_no) {
    const local_cached_text = sessionStorage.getItem(VISITS_CACHE_KEY)
    if (!local_cached_text) return null
    try {
      const local_cached_obj = JSON.parse(local_cached_text)
      if (!Array.isArray(local_cached_obj?.visits)) return null
      const local_target_num = Number(target_visit_no)
      return (
        local_cached_obj.visits.find(
          (local_visit) => Number(local_visit?.visit_no) === local_target_num,
        ) ?? null
      )
    } catch {
      return null
    }
  }

  async function load_visit_detail() {
    const local_cached_visit_obj = find_visit_in_admin_cache(visit_no)
    if (local_cached_visit_obj) {
      g_visit_obj = local_cached_visit_obj
      g_is_loading = false
      return
    }

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
    <!-- 상단: 뒤로가기 + 방문번호/일시 -->
    <div class="flex items-center justify-between">
      <Link
        href={PATH.adminVisits}
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retina-text-200)] bg-white px-4 text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-400)] hover:bg-[var(--retina-primary-50)]"
      >
        <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>방문자 목록</span>
      </Link>

      {#if g_visit_obj}
        <p class="m-0 text-sm font-bold text-[var(--retina-text-500)]">
          방문번호 <span class="text-[var(--retina-primary-600)]">#{g_visit_obj.visit_no}</span>
          · 방문일시 {format_dt(g_visit_obj.create_dt)}
        </p>
      {/if}
    </div>

    <!-- 고객 정보 카드 -->
    {#if g_visit_obj}
      <section class="rounded-[14px] border border-[var(--retina-text-200)] bg-white px-7 py-5 shadow-[0_4px_10px_rgba(19,25,40,0.04)]">
        <h2 class="m-0 text-xl font-extrabold text-[var(--retina-text-800)]">{g_visit_obj.cust_name ?? '-'}</h2>
        <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="m-0 text-[12px] font-bold text-[var(--retina-text-400)]">성별</p>
            <p class="mt-1 text-sm font-extrabold text-[var(--retina-text-800)]">{format_sex(g_visit_obj.sex)}</p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-[var(--retina-text-400)]">생년월일</p>
            <p class="mt-1 text-sm font-extrabold text-[var(--retina-text-800)]">
              {g_visit_obj.birthday || '-'}
            </p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-[var(--retina-text-400)]">연락처 1</p>
            <p class="mt-1 text-sm font-extrabold text-[var(--retina-text-800)]">
              {g_visit_obj.phone_no1 || '-'}
            </p>
          </div>
          <div>
            <p class="m-0 text-[12px] font-bold text-[var(--retina-text-400)]">연락처 2</p>
            <p class="mt-1 text-sm font-extrabold text-[var(--retina-text-800)]">
              {g_visit_obj.phone_no2 || '-'}
            </p>
          </div>
        </div>
      </section>
    {/if}

    <!-- AI 인사이트 — 공유 컴포넌트 (result.svelte 의 insight 탭과 동일). -->
    <AiInsightPanel
      visit_obj={g_visit_obj}
      is_loading={g_is_loading}
      empty_loading_text="상세 데이터 불러오는 중..."
      empty_no_visit_text="방문 데이터를 찾을 수 없습니다."
    />
  </section>
</AdminLayout>
