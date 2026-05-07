<script>
  import { onMount } from 'svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import { get_all_visits } from '@/lib/api/visit'
  import { push_error_toast } from '@/lib/stores/toast'

  /**
   * @typedef {{
   *   visit_no: number,
   *   cust_no: number,
   *   cust_name: string,
   *   phone1: string,
   *   phone2: string,
   *   birthday: string,
   *   sex: number,
   *   test_dt: string | null,
   *   vp_dt: string | null,
   *   real_vp_dt: string | null,
   *   create_dt: string,
   *   update_dt: string | null,
   *   member_no: number,
   *   member_name: string,
   *   opt_no: number,
   *   opt_name: string,
   * }} VisitObj
   */

  /** @type {VisitObj[]} */
  let g_visit_arr = $state([])
  let g_is_loading = $state(true)

  /** @param {string | null | undefined} dt */
  function format_dt(dt) {
    if (!dt) return '-'
    const local_date_obj = new Date(dt)
    if (Number.isNaN(local_date_obj.getTime())) return '-'
    return local_date_obj.toLocaleString('ko-KR', {
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

  /** @param {VisitObj} visit_obj */
  function get_status_label(visit_obj) {
    if (visit_obj.real_vp_dt) return { text: '실착 완료', class: 'bg-[#DCFCE7] text-[#15803D]' }
    if (visit_obj.vp_dt) return { text: '피팅 완료', class: 'bg-[#E0E7FF] text-[#4338CA]' }
    if (visit_obj.test_dt) return { text: '얼굴분석 완료', class: 'bg-[#FFF4E5] text-[#C2410C]' }
    return { text: '진행 중', class: 'bg-[#F1F5F9] text-[#475569]' }
  }

  async function load_all_visits() {
    g_is_loading = true
    try {
      const local_result = await get_all_visits()
      const local_arr = Array.isArray(local_result?.visits)
        ? local_result.visits
        : Array.isArray(local_result)
          ? local_result
          : []
      g_visit_arr = local_arr
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '방문자 정보 조회에 실패했습니다.',
      )
      g_visit_arr = []
    } finally {
      g_is_loading = false
    }
  }

  onMount(() => {
    void load_all_visits()
  })
</script>

<AdminLayout active_key="visits">
  <section class="grid gap-4">
    <!-- 상단 카운트 -->
    <div class="flex items-center justify-between">
      <h2 class="m-0 text-xl font-extrabold text-[var(--retina-text)]">방문자 정보</h2>
      <p class="m-0 text-sm font-bold text-[var(--retina-text-muted)]">
        총 <span class="text-[var(--retina-primary-700)]">{g_visit_arr.length}건</span>
      </p>
    </div>

    <!-- 리스트 영역 -->
    <div class="overflow-hidden rounded-2xl border border-[var(--retina-border)] bg-white shadow-sm">
      {#if g_is_loading}
        <p class="m-0 px-6 py-10 text-center text-sm font-bold text-[var(--retina-text-muted)]">
          방문자 정보 불러오는 중...
        </p>
      {:else if g_visit_arr.length === 0}
        <p class="m-0 px-6 py-10 text-center text-sm font-bold text-[var(--retina-text-muted)]">
          방문 이력이 없습니다.
        </p>
      {:else}
        <!-- 헤더 -->
        <div
          class="grid grid-cols-[80px_1fr_1fr_1fr_1.5fr_1fr_1fr] items-center gap-4 border-b border-[var(--retina-border)] bg-[#F8F9FB] px-6 py-3 text-[12px] font-extrabold text-[var(--retina-text-muted)]"
        >
          <span>방문번호</span>
          <span>고객명</span>
          <span>성별</span>
          <span>연락처</span>
          <span>방문일시</span>
          <span>안경사</span>
          <span>상태</span>
        </div>

        <!-- 행 -->
        <ul class="m-0 divide-y divide-slate-100 p-0">
          {#each g_visit_arr as visit_obj (visit_obj.visit_no)}
            {@const local_status = get_status_label(visit_obj)}
            <li
              class="grid grid-cols-[80px_1fr_1fr_1fr_1.5fr_1fr_1fr] items-center gap-4 px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-[#F8F9FB]"
            >
              <span class="text-[12px] font-bold text-slate-400">#{visit_obj.visit_no}</span>
              <span class="truncate text-base font-extrabold text-zinc-900">
                {visit_obj.cust_name ?? '-'}
              </span>
              <span>{format_sex(visit_obj.sex)}</span>
              <span class="truncate">{visit_obj.phone1 ?? '-'}</span>
              <span class="truncate text-[13px] text-slate-500">
                {format_dt(visit_obj.create_dt)}
              </span>
              <span class="truncate">{visit_obj.member_name ?? '-'}</span>
              <span>
                <span
                  class={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${local_status.class}`}
                >
                  {local_status.text}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</AdminLayout>
