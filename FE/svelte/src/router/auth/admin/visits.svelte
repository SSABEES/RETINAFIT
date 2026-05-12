<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import { PATH } from '@/config/path'
  import { get_admin_all_visits } from '@/lib/api/visit'
  import { push_error_toast } from '@/lib/stores/toast'

  // 페이지당 행 수. BE 가 page 파라미터를 지원하지 않아 FE 슬라이스로 처리.
  const PAGE_SIZE = 20

  // 전체 방문자 목록 sessionStorage 캐시 키. 한 세션 동안만 유지 — 탭 닫으면 자동 폐기.
  // 캐시가 있으면 마운트 시 API 호출 생략하고 화면을 즉시 채운다 (뒤로가기 등 재진입 빠르게).
  const VISITS_CACHE_KEY = 'retinal_admin_visit_list'

  /**
   * BE /api/v1/admin/visits 응답 스키마.
   * @typedef {{
   *   visit_no: number,
   *   opt_no: number,
   *   cust_no: number,
   *   cust_name: string,
   *   birthday: string,
   *   phone_no1: string,
   *   phone_no2: string,
   *   sex: number,
   *   member_no: number,
   *   main_file: string | null,
   *   test_file_arr: string[] | null,
   *   test_json: Record<string, unknown> | null,
   *   opt_recommend_json: Record<string, unknown> | null,
   *   vp_file_arr: string[] | null,
   *   vp_json: Record<string, unknown> | null,
   *   real_vp_json: Record<string, unknown> | null,
   *   report_json: Record<string, unknown> | null,
   *   create_dt: string,
   *   test_dt: string | null,
   *   vp_dt: string | null,
   *   real_vp_dt: string | null,
   *   update_dt: string | null,
   * }} VisitObj
   */

  /** @type {VisitObj[]} */
  let g_visit_arr = $state([])
  let g_total = $state(0)
  let g_is_loading = $state(true)
  let g_page = $state(1)

  // 페이지 슬라이스 + 총 페이지 수 (전체 데이터를 한 번에 받아 FE 에서 자른다.)
  const g_total_pages = $derived(Math.max(1, Math.ceil(g_visit_arr.length / PAGE_SIZE)))
  const g_paginated_arr = $derived(g_visit_arr.slice((g_page - 1) * PAGE_SIZE, g_page * PAGE_SIZE))
  const g_page_start_index = $derived(g_visit_arr.length === 0 ? 0 : (g_page - 1) * PAGE_SIZE + 1)
  const g_page_end_index = $derived(Math.min(g_page * PAGE_SIZE, g_visit_arr.length))

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

  // sessionStorage 에서 캐시된 방문자 목록을 꺼내 화면 상태로 복원. 형태가 깨졌으면 제거하고 false 반환.
  function try_restore_from_cache() {
    const local_cached_text = sessionStorage.getItem(VISITS_CACHE_KEY)
    if (!local_cached_text) return false
    try {
      const local_cached_obj = JSON.parse(local_cached_text)
      if (!Array.isArray(local_cached_obj?.visits)) {
        sessionStorage.removeItem(VISITS_CACHE_KEY)
        return false
      }
      g_visit_arr = local_cached_obj.visits
      g_total = Number(local_cached_obj.total ?? local_cached_obj.visits.length)
      g_page = 1
      return true
    } catch {
      sessionStorage.removeItem(VISITS_CACHE_KEY)
      return false
    }
  }

  async function load_all_visits() {
    // 1) 세션 캐시가 있으면 그걸로 즉시 채우고 API 호출은 생략 (뒤로가기 시 재로딩 방지).
    if (try_restore_from_cache()) {
      g_is_loading = false
      return
    }

    // 2) 캐시 미스 — API 호출 후 결과를 세션 캐시에 저장.
    g_is_loading = true
    try {
      const local_result = await get_admin_all_visits()
      const local_visit_arr = Array.isArray(local_result?.visits) ? local_result.visits : []
      const local_total = Number(local_result?.total ?? local_visit_arr.length)
      g_visit_arr = local_visit_arr
      g_total = local_total
      // 전체 데이터 갱신 시 1페이지로 리셋. 새 응답이 짧아 현재 page 가 범위 밖일 수 있음.
      g_page = 1
      try {
        sessionStorage.setItem(
          VISITS_CACHE_KEY,
          JSON.stringify({ visits: local_visit_arr, total: local_total }),
        )
      } catch {
        // QuotaExceeded 등 — 캐시는 베스트 에포트, 실패해도 화면 동작에는 영향 없음.
      }
    } catch (local_err) {
      push_error_toast(
        local_err instanceof Error ? local_err.message : '방문자 정보 조회에 실패했습니다.',
      )
      g_visit_arr = []
      g_total = 0
      g_page = 1
    } finally {
      g_is_loading = false
    }
  }

  // 행 클릭 시 방문 상세 페이지로 이동.
  /** @param {number | string} visit_no */
  function on_click_row(visit_no) {
    navigate(PATH.adminVisitDetail(visit_no))
  }

  /** @param {number} page */
  function go_to_page(page) {
    g_page = Math.max(1, Math.min(g_total_pages, page))
  }

  // 표시할 페이지 번호 windowing — 현재 페이지 양옆 2개씩 (최대 5개) 보여준다.
  const g_visible_page_arr = $derived.by(() => {
    const local_max_visible = 5
    const local_half = Math.floor(local_max_visible / 2)
    let local_start = Math.max(1, g_page - local_half)
    let local_end = Math.min(g_total_pages, local_start + local_max_visible - 1)
    local_start = Math.max(1, local_end - local_max_visible + 1)
    /** @type {number[]} */
    const local_arr = []
    for (let i = local_start; i <= local_end; i++) local_arr.push(i)
    return local_arr
  })

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
        {#if g_visit_arr.length > 0}
          <span class="text-[var(--retina-primary-600)]"
            >{g_page_start_index}-{g_page_end_index}</span
          >
          / 총 <span class="text-[var(--retina-primary-600)]">{g_total}건</span>
        {:else}
          총 <span class="text-[var(--retina-primary-600)]">{g_total}건</span>
        {/if}
      </p>
    </div>

    <!-- 리스트 영역 -->
    <div
      class="overflow-hidden rounded-2xl border border-[var(--retina-text-200)] bg-white shadow-sm"
    >
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
          class="grid grid-cols-[80px_1fr_1fr_1fr_1.4fr_1fr_1fr_1fr] items-center gap-4 border-b border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-6 py-3 text-[12px] font-extrabold text-[var(--retina-text-muted)]"
        >
          <span>방문번호</span>
          <span>고객명</span>
          <span>성별</span>
          <span>연락처</span>
          <span>방문일시</span>
          <span>안경원번호</span>
          <span>안경사번호</span>
          <span>상태</span>
        </div>

        <!-- 행 (button: 클릭 시 상세로 이동) -->
        <ul class="m-0 divide-y divide-[var(--retina-text-100)] p-0">
          {#each g_paginated_arr as visit_obj (visit_obj.visit_no)}
            {@const local_status = get_status_label(visit_obj)}
            <li class="m-0 p-0">
              <button
                type="button"
                class="grid w-full cursor-pointer grid-cols-[80px_1fr_1fr_1fr_1.4fr_1fr_1fr_1fr] items-center gap-4 border-0 bg-transparent px-6 py-4 text-left text-sm font-semibold text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] focus-visible:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--retina-primary-400)]/30"
                onclick={() => on_click_row(visit_obj.visit_no)}
                aria-label={`${visit_obj.cust_name ?? ''} 방문 상세 보기`}
              >
                <span class="text-[12px] font-bold text-[var(--retina-text-400)]"
                  >#{visit_obj.visit_no}</span
                >
                <span class="truncate text-base font-extrabold text-[var(--retina-text-800)]">
                  {visit_obj.cust_name ?? '-'}
                </span>
                <span>{format_sex(visit_obj.sex)}</span>
                <span class="truncate">{visit_obj.phone_no1 ?? '-'}</span>
                <span class="truncate text-[13px] text-[var(--retina-text-500)]">
                  {format_dt(visit_obj.create_dt)}
                </span>
                <span class="text-[13px] text-[var(--retina-text-500)]"
                  >#{visit_obj.opt_no ?? '-'}</span
                >
                <span class="text-[13px] text-[var(--retina-text-500)]"
                  >#{visit_obj.member_no ?? '-'}</span
                >
                <span>
                  <span
                    class={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${local_status.class}`}
                  >
                    {local_status.text}
                  </span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- 페이지네이션 컨트롤 -->
    {#if g_visit_arr.length > 0 && g_total_pages > 1}
      <nav class="flex items-center justify-center gap-1.5" aria-label="페이지 이동">
        <button
          type="button"
          class="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[var(--retina-text-200)] bg-white text-[var(--retina-text-500)] transition hover:border-[var(--retina-primary-400)] hover:text-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--retina-text-200)] disabled:hover:text-[var(--retina-text-500)]"
          disabled={g_page === 1}
          onclick={() => go_to_page(g_page - 1)}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>

        {#each g_visible_page_arr as page_num (page_num)}
          <button
            type="button"
            class={`grid h-9 min-w-9 cursor-pointer place-items-center rounded-lg border px-3 text-sm font-extrabold transition ${
              page_num === g_page
                ? 'border-[var(--retina-primary-400)] bg-[var(--retina-primary-400)] text-white'
                : 'border-[var(--retina-text-200)] bg-white text-[var(--retina-text-500)] hover:border-[var(--retina-primary-400)] hover:text-[var(--retina-primary-600)]'
            }`}
            aria-current={page_num === g_page ? 'page' : undefined}
            onclick={() => go_to_page(page_num)}
          >
            {page_num}
          </button>
        {/each}

        <button
          type="button"
          class="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[var(--retina-text-200)] bg-white text-[var(--retina-text-500)] transition hover:border-[var(--retina-primary-400)] hover:text-[var(--retina-primary-600)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--retina-text-200)] disabled:hover:text-[var(--retina-text-500)]"
          disabled={g_page === g_total_pages}
          onclick={() => go_to_page(g_page + 1)}
          aria-label="다음 페이지"
        >
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </nav>
    {/if}
  </section>
</AdminLayout>
