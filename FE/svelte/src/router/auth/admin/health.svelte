<script>
  import { onMount } from 'svelte'
  import {
    Activity,
    CheckCircle2,
    Clock,
    Cloud,
    Database,
    HardDrive,
    RefreshCw,
    XCircle,
  } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import { get_health } from '@/lib/api/health'

  // BE /health 응답 보관 — 첫 로드 + 새로고침 버튼으로 갱신.
  let g_health_obj = $state(/** @type {Record<string, any> | null} */ (null))
  let g_is_loading = $state(false)
  let g_error_message = $state(/** @type {string | null} */ (null))
  let g_last_loaded_at = $state(/** @type {number | null} */ (null))

  // 전체 상태 — DB/S3 모두 'ok' 일 때만 healthy. CloudFront 는 enabled 여부만 보며 비활성도 정상으로 본다.
  const g_is_overall_healthy = $derived.by(() => {
    if (!g_health_obj) return false
    const local_db = String(g_health_obj?.checks?.database ?? '')
    const local_s3 = String(g_health_obj?.checks?.s3 ?? '')
    return local_db === 'ok' && local_s3 === 'ok' && g_health_obj?.status === 'ok'
  })

  const g_db_status_text = $derived(String(g_health_obj?.checks?.database ?? ''))
  const g_s3_status_text = $derived(String(g_health_obj?.checks?.s3 ?? ''))
  const g_cloudfront_obj = $derived(g_health_obj?.checks?.cloudfront ?? null)

  const g_is_db_ok = $derived(g_db_status_text === 'ok')
  const g_is_s3_ok = $derived(g_s3_status_text === 'ok')
  const g_is_cloudfront_ok = $derived(Boolean(g_cloudfront_obj?.enabled))

  // 업타임을 "1시간 23분 45초" 같이 읽기 좋은 형태로 변환. 1시간 미만이면 분/초만.
  const g_uptime_label = $derived.by(() => {
    const local_seconds = Number(g_health_obj?.uptime_seconds ?? 0)
    if (!Number.isFinite(local_seconds) || local_seconds < 0) return '-'
    const local_hours = Math.floor(local_seconds / 3600)
    const local_mins = Math.floor((local_seconds % 3600) / 60)
    const local_secs = local_seconds % 60
    const local_parts = []
    if (local_hours > 0) local_parts.push(`${local_hours}시간`)
    if (local_mins > 0 || local_hours > 0) local_parts.push(`${local_mins}분`)
    local_parts.push(`${local_secs}초`)
    return local_parts.join(' ')
  })

  // JSON viewer 에 보여줄 정렬된 응답 문자열.
  const g_json_text = $derived(g_health_obj ? JSON.stringify(g_health_obj, null, 2) : '')

  const g_last_loaded_label = $derived.by(() => {
    if (!g_last_loaded_at) return '-'
    const local_date = new Date(g_last_loaded_at)
    return `${local_date.getHours().toString().padStart(2, '0')}:${local_date.getMinutes().toString().padStart(2, '0')}:${local_date.getSeconds().toString().padStart(2, '0')}`
  })

  // /health 호출 → 응답 보관. 실패 시 에러 메시지 노출, 이전 응답은 그대로 유지해 화면 깜빡임 최소화.
  async function load_health() {
    if (g_is_loading) return
    g_is_loading = true
    g_error_message = null
    try {
      const local_result_obj = await get_health()
      g_health_obj = local_result_obj
      g_last_loaded_at = Date.now()
    } catch (local_err) {
      g_error_message =
        local_err instanceof Error ? local_err.message : '헬스 체크 호출에 실패했습니다.'
    } finally {
      g_is_loading = false
    }
  }

  function on_click_refresh() {
    void load_health()
  }

  onMount(() => {
    void load_health()
  })
</script>

<AdminLayout active_key="health">
  <section class="grid gap-4">
    <!-- 페이지 헤더 — 좌측에 제목, 우측에 마지막 갱신 시각 + 새로고침 -->
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="m-0 text-2xl font-extrabold text-[var(--retina-text-800)]">헬스 체크</h1>
        <p class="m-0 mt-1 text-sm font-semibold text-[var(--retina-text-500)]">
          서버 · DB · S3 · CloudFront 연결 상태
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-[var(--retina-text-500)]"
          >마지막 갱신: {g_last_loaded_label}</span
        >
        <button
          type="button"
          onclick={on_click_refresh}
          disabled={g_is_loading}
          class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retina-text-200)] bg-white px-4 text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-400)] hover:bg-[var(--retina-primary-50)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            strokeWidth={2.4}
            class={g_is_loading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          <span>새로고침</span>
        </button>
      </div>
    </header>

    <!-- 에러 배너 — 호출 실패 시 노출. 이전 응답이 있으면 그 데이터는 그대로 화면에 유지. -->
    {#if g_error_message}
      <div
        class="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        role="alert"
      >
        {g_error_message}
      </div>
    {/if}

    <!-- 첫 로딩 (응답 없음) — 스켈레톤 안내 -->
    {#if !g_health_obj && g_is_loading}
      <div
        class="grid place-items-center rounded-[14px] border border-[var(--retina-text-200)] bg-white px-6 py-16 text-sm font-semibold text-[var(--retina-text-500)]"
      >
        <span
          class="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--retina-primary-400)] border-t-transparent"
          aria-hidden="true"
        ></span>
        헬스 체크 정보를 불러오는 중...
      </div>
    {:else if g_health_obj}
      <!-- 1행: 전체 상태 카드 (환경 / 업타임 통합) — 좌측엔 상태 아이콘+텍스트, 우측엔 환경/업타임 인라인. -->
      <article
        class="flex flex-col gap-5 rounded-[14px] border border-[var(--retina-text-200)] bg-white px-6 py-5 shadow-[0_4px_10px_rgba(19,25,40,0.04)] md:flex-row md:items-center md:justify-between"
      >
        <div class="flex items-center gap-5">
          <div
            class="grid h-16 w-16 shrink-0 place-items-center rounded-full"
            class:bg-emerald-100={g_is_overall_healthy}
            class:bg-red-100={!g_is_overall_healthy}
          >
            {#if g_is_overall_healthy}
              <CheckCircle2 size={36} strokeWidth={2.4} class="text-emerald-600" />
            {:else}
              <XCircle size={36} strokeWidth={2.4} class="text-red-600" />
            {/if}
          </div>
          <div>
            <p
              class="m-0 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--retina-text-500)]"
            >
              전체 상태
            </p>
            <p
              class="m-0 mt-1 text-3xl font-black"
              class:text-emerald-700={g_is_overall_healthy}
              class:text-red-700={!g_is_overall_healthy}
            >
              {g_health_obj.status ?? '-'}
            </p>
            <p class="m-0 mt-1 text-xs font-semibold text-[var(--retina-text-500)]">
              모든 시스템이 정상적으로 작동 중입니다
            </p>
          </div>
        </div>

        <!-- 환경 / 업타임 — 우측 inline. md 이상에서 가로 정렬, 모바일에선 카드 하단 가로 배치. -->
        <div class="flex flex-wrap items-center gap-4 md:gap-6">
          <div class="flex items-center gap-3">
            <div
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--retina-primary-50)]"
            >
              <Activity size={18} strokeWidth={2.4} class="text-[var(--retina-primary-500)]" />
            </div>
            <div>
              <p
                class="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--retina-text-500)]"
              >
                환경
              </p>
              <p class="m-0 mt-0.5 text-lg font-extrabold text-[var(--retina-text-800)]">
                {g_health_obj.env ?? '-'}
              </p>
            </div>
          </div>
          <div class="h-10 w-px bg-[var(--retina-text-200)]" aria-hidden="true"></div>
          <div class="flex items-center gap-3">
            <div
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--retina-primary-50)]"
            >
              <Clock size={18} strokeWidth={2.4} class="text-[var(--retina-primary-500)]" />
            </div>
            <div>
              <p
                class="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--retina-text-500)]"
              >
                업타임
              </p>
              <p class="m-0 mt-0.5 text-lg font-extrabold text-[var(--retina-text-800)]">
                {g_uptime_label}
              </p>
            </div>
          </div>
        </div>
      </article>

      <!-- 2행: 시스템 상태 (DB / S3 / CloudFront) -->
      <div class="grid gap-4">
        <h2 class="m-0 text-base font-extrabold text-[var(--retina-text-800)]">시스템 상태</h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <!-- Database -->
          <article
            class="flex flex-col gap-3 rounded-[14px] border border-[var(--retina-text-200)] bg-white px-5 py-4 shadow-[0_4px_10px_rgba(19,25,40,0.04)]"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--retina-primary-50)]"
                >
                  <Database
                    size={20}
                    strokeWidth={2.4}
                    class="text-[var(--retina-primary-500)]"
                  />
                </div>
                <p class="m-0 text-base font-extrabold text-[var(--retina-text-800)]">database</p>
              </div>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold"
                class:bg-emerald-100={g_is_db_ok}
                class:text-emerald-700={g_is_db_ok}
                class:bg-red-100={!g_is_db_ok}
                class:text-red-700={!g_is_db_ok}
              >
                {#if g_is_db_ok}
                  <CheckCircle2 size={12} strokeWidth={2.6} aria-hidden="true" />
                {:else}
                  <XCircle size={12} strokeWidth={2.6} aria-hidden="true" />
                {/if}
                <span>{g_is_db_ok ? 'ok' : 'error'}</span>
              </span>
            </div>
            <div class="text-xs font-semibold text-[var(--retina-text-500)]">
              <p class="m-0">
                상태: <span class="font-bold text-[var(--retina-text-700)]">{g_db_status_text || '-'}</span>
              </p>
            </div>
          </article>

          <!-- S3 -->
          <article
            class="flex flex-col gap-3 rounded-[14px] border border-[var(--retina-text-200)] bg-white px-5 py-4 shadow-[0_4px_10px_rgba(19,25,40,0.04)]"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--retina-primary-50)]"
                >
                  <HardDrive
                    size={20}
                    strokeWidth={2.4}
                    class="text-[var(--retina-primary-500)]"
                  />
                </div>
                <p class="m-0 text-base font-extrabold text-[var(--retina-text-800)]">s3</p>
              </div>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold"
                class:bg-emerald-100={g_is_s3_ok}
                class:text-emerald-700={g_is_s3_ok}
                class:bg-red-100={!g_is_s3_ok}
                class:text-red-700={!g_is_s3_ok}
              >
                {#if g_is_s3_ok}
                  <CheckCircle2 size={12} strokeWidth={2.6} aria-hidden="true" />
                {:else}
                  <XCircle size={12} strokeWidth={2.6} aria-hidden="true" />
                {/if}
                <span>{g_is_s3_ok ? 'ok' : 'error'}</span>
              </span>
            </div>
            <div class="text-xs font-semibold text-[var(--retina-text-500)]">
              <p class="m-0">
                상태: <span class="font-bold text-[var(--retina-text-700)]">{g_s3_status_text || '-'}</span>
              </p>
            </div>
          </article>

          <!-- CloudFront -->
          <article
            class="flex flex-col gap-3 rounded-[14px] border border-[var(--retina-text-200)] bg-white px-5 py-4 shadow-[0_4px_10px_rgba(19,25,40,0.04)]"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--retina-primary-50)]"
                >
                  <Cloud size={20} strokeWidth={2.4} class="text-[var(--retina-primary-500)]" />
                </div>
                <p class="m-0 text-base font-extrabold text-[var(--retina-text-800)]">cloudfront</p>
              </div>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold"
                class:bg-emerald-100={g_is_cloudfront_ok}
                class:text-emerald-700={g_is_cloudfront_ok}
                class:bg-slate-100={!g_is_cloudfront_ok}
                class:text-slate-600={!g_is_cloudfront_ok}
              >
                {#if g_is_cloudfront_ok}
                  <CheckCircle2 size={12} strokeWidth={2.6} aria-hidden="true" />
                {:else}
                  <XCircle size={12} strokeWidth={2.6} aria-hidden="true" />
                {/if}
                <span>{g_is_cloudfront_ok ? 'ok' : 'disabled'}</span>
              </span>
            </div>
            <div class="grid gap-1 text-xs font-semibold text-[var(--retina-text-500)]">
              <p class="m-0">
                enabled: <span class="font-bold text-[var(--retina-text-700)]"
                  >{g_cloudfront_obj?.enabled ? 'true' : 'false'}</span
                >
              </p>
              <p class="m-0 truncate">
                domain:
                {#if g_cloudfront_obj?.domain}
                  <a
                    href={`https://${g_cloudfront_obj.domain}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    class="font-bold text-[var(--retina-primary-600)] underline underline-offset-2 hover:text-[var(--retina-primary-700)]"
                  >
                    {g_cloudfront_obj.domain}
                  </a>
                {:else}
                  <span class="font-bold text-[var(--retina-text-700)]">-</span>
                {/if}
              </p>
            </div>
          </article>
        </div>
      </div>

      <!-- 3행: JSON 응답 raw 보기 -->
      <div class="grid gap-2">
        <h2 class="m-0 text-base font-extrabold text-[var(--retina-text-800)]">JSON 응답</h2>
        <pre
          class="m-0 overflow-x-auto rounded-[14px] border border-[var(--retina-text-200)] bg-[var(--retina-text-800)] p-5 text-xs font-medium leading-relaxed text-emerald-200 shadow-[0_4px_10px_rgba(19,25,40,0.04)]"><code
            >{g_json_text}</code
          ></pre>
      </div>
    {/if}
  </section>
</AdminLayout>
