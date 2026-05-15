<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronDown, LogOut } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { admin_logout } from '@/lib/api/auth'

  /** @type {{ active_key?: string, children?: import('svelte').Snippet }} */
  let { active_key = 'lens', children } = $props()

  // 얼굴형 기준 설정(face)은 일단 메뉴에서 제외. 페이지/라우트는 보존되어 있음.
  const g_admin_page_arr = [
    { key: 'health', label: '헬스 체크', href: PATH.adminHealth },
    { key: 'lens', label: '렌즈조건 설정', href: PATH.adminLens },
    { key: 'glass', label: '안경 정보', href: PATH.adminGlass },
    { key: 'visits', label: '방문자 정보', href: PATH.adminVisits },
  ]

  let g_admin_page_dropdown_open = $state(false)
  let g_is_authenticated = $state(false)

  // admin_token 없으면 관리자 로그인 페이지로 보내고, 있으면 본문을 표시함
  onMount(() => {
    if (typeof sessionStorage === 'undefined') return

    if (!sessionStorage.getItem('admin_token')) {
      navigate(PATH.adminLogin)
      return
    }

    g_is_authenticated = true
  })

  // 관리자 토큰 삭제 후 로그인 페이지로 이동
  function on_click_logout_admin() {
    admin_logout()
    g_is_authenticated = false
    navigate(PATH.adminLogin)
  }

  // 페이지 드롭다운 열기/닫기
  function on_click_toggle_admin_page_dropdown() {
    g_admin_page_dropdown_open = !g_admin_page_dropdown_open
  }

  // 다른 관리자 페이지로 이동
  function on_click_move_admin_page(href) {
    g_admin_page_dropdown_open = false
    navigate(href)
  }
</script>

{#if g_is_authenticated}
  <main
    class="app-frame-page flex min-h-screen flex-col bg-[var(--retina-page)] pt-0 text-[var(--retina-text)]"
    style="padding-top: 0"
  >
    <section class="min-h-0 flex-1 px-4 pb-3 pt-2 sm:px-6 md:px-8 md:pb-4 md:pt-2 xl:px-12 2xl:px-16">
      <div class="grid min-h-full w-full content-start gap-4">
        <div class="flex items-start justify-between gap-6">
          <div
            class="relative w-[240px] rounded-[14px] border border-[var(--retina-text-200)] bg-white px-4 py-3 shadow-[0_4px_10px_rgba(19,25,40,0.04)]"
          >
            <p
              class="mb-2 block text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--retina-text-500)]"
            >
              현재 페이지
            </p>

            <button
              class="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-[10px] border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-3 text-left text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-400)] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-400)]/20"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={g_admin_page_dropdown_open}
              onclick={on_click_toggle_admin_page_dropdown}
            >
              <span>
                {g_admin_page_arr.find((admin_page_obj) => admin_page_obj.key === active_key)
                  ?.label}
              </span>
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                class={`transition ${g_admin_page_dropdown_open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {#if g_admin_page_dropdown_open}
              <div
                class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-[14px] border border-[var(--retina-text-200)] bg-white p-2 shadow-[0_18px_40px_rgba(19,25,40,0.12)]"
                role="listbox"
                aria-label="관리자 페이지 목록"
              >
                {#each g_admin_page_arr as admin_page_obj (admin_page_obj.key)}
                  <button
                    class={`flex min-h-11 w-full cursor-pointer items-center rounded-[10px] px-3 text-sm font-extrabold transition ${
                      active_key === admin_page_obj.key
                        ? 'bg-[var(--retina-primary-50)] text-[var(--retina-primary-600)]'
                        : 'bg-white text-[var(--retina-text-500)] hover:bg-[var(--retina-primary-50)] hover:text-[var(--retina-primary-600)]'
                    }`}
                    type="button"
                    role="option"
                    aria-selected={active_key === admin_page_obj.key}
                    onclick={() => on_click_move_admin_page(admin_page_obj.href)}
                  >
                    {admin_page_obj.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <button
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--retina-text-200)] bg-white px-4 text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-400)] hover:bg-[var(--retina-primary-50)]"
            type="button"
            onclick={on_click_logout_admin}
          >
            <LogOut size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>

        {@render children?.()}
      </div>
    </section>
  </main>
{/if}
