<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronDown, LogOut } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { admin_logout } from '@/lib/api/auth'

  /** @type {{ active_key?: string, children?: import('svelte').Snippet }} */
  let { active_key = 'face', children } = $props()

  const g_admin_page_arr = [
    { key: 'face', label: '얼굴형 기준 설정', href: PATH.adminFace },
    { key: 'lens', label: '렌즈조건 설정', href: PATH.adminLens },
    { key: 'glass', label: '안경 정보', href: PATH.adminGlass },
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
    window.location.href = href
  }
</script>

{#if g_is_authenticated}
  <main class="app-frame-page overflow-hidden bg-[var(--retinal-page)] text-[var(--retinal-text)]">
    <section class="h-full min-h-0 overflow-y-auto px-8 py-8">
      <div class="grid min-h-full w-full content-start gap-4">
        <div class="flex items-start justify-between gap-6">
          <button
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-700)] hover:bg-[var(--retinal-soft-purple)]"
            type="button"
            onclick={on_click_logout_admin}
          >
            <LogOut size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>로그아웃</span>
          </button>

          <div
            class="relative w-[240px] rounded-2xl border border-[var(--retinal-border)] bg-white px-4 py-3 shadow-sm shadow-slate-200/40"
          >
            <p
              class="mb-2 block text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--retinal-text-muted)]"
            >
              현재 페이지
            </p>

            <button
              class="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-700)]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-700)]/15"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={g_admin_page_dropdown_open}
              onclick={on_click_toggle_admin_page_dropdown}
            >
              <span>
                {g_admin_page_arr.find((admin_page_obj) => admin_page_obj.key === active_key)?.label}
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
                class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retinal-border)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                role="listbox"
                aria-label="관리자 페이지 목록"
              >
                {#each g_admin_page_arr as admin_page_obj (admin_page_obj.key)}
                  <button
                    class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                      active_key === admin_page_obj.key
                        ? 'bg-[var(--retinal-soft-purple)] text-[var(--retinal-primary-700)]'
                        : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retinal-primary-700)]'
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
        </div>

        {@render children?.()}
      </div>
    </section>
  </main>
{/if}
