<script>
  import { onMount } from 'svelte'
  import { ChevronDown, LogOut } from 'lucide-svelte'
  import AuthInput from '@/components/input/auth_input.svelte'
  import PasswordInput from '@/components/input/password_input.svelte'
  import { PATH } from '@/config/path'

  const ADMIN_AUTH_STORAGE_KEY = 'retinal_admin_authenticated'
  const ADMIN_ID = 'retinai1'
  const ADMIN_PASSWORD = '1234'

  /** @type {{ active_key?: string, children?: import('svelte').Snippet }} */
  let { active_key = 'face', children } = $props()

  const g_admin_page_arr = [
    { key: 'face', label: '얼굴형 기준 설정', href: PATH.adminFace },
    { key: 'lens', label: '렌즈조건 설정', href: PATH.adminLens },
    { key: 'glass', label: '안경 정보', href: PATH.adminGlass },
  ]

  let g_admin_page_dropdown_open = $state(false)
  let ref_admin_id = $state('')
  let ref_admin_password = $state('')
  let g_auth_error_message = $state('')
  let g_is_authenticated = $state(false)

  // 세션 저장소의 관리자 인증 상태를 읽어서 로그인 화면과 본문 화면을 전환한다.
  onMount(() => {
    if (typeof sessionStorage === 'undefined') return
    g_is_authenticated = sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true'
  })

  // 입력 요소에서 공통으로 값을 읽어오는 보조 함수다.
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 관리자 아이디 입력값을 상태에 반영하고 에러 메시지를 지운다.
  function on_input_admin_id(local_event) {
    ref_admin_id = get_input_value(local_event)
    g_auth_error_message = ''
  }

  // 관리자 비밀번호 입력값을 상태에 반영하고 에러 메시지를 지운다.
  function on_input_admin_password(local_event) {
    ref_admin_password = get_input_value(local_event)
    g_auth_error_message = ''
  }

  // 관리자 로그인 폼을 검증하고 인증 성공 시 본문 화면으로 전환한다.
  function on_submit_admin_login(local_event) {
    local_event.preventDefault()

    const local_admin_id = ref_admin_id.trim()
    const local_admin_password = ref_admin_password.trim()

    if (!local_admin_id || !local_admin_password) {
      g_auth_error_message = '아이디와 비밀번호를 모두 입력해주세요.'
      return
    }

    if (local_admin_id !== ADMIN_ID || local_admin_password !== ADMIN_PASSWORD) {
      g_auth_error_message = '관리자 계정 정보가 올바르지 않습니다.'
      return
    }

    g_is_authenticated = true
    g_auth_error_message = ''

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true')
    }
  }

  // 관리자 세션을 해제하고 로그인 화면으로 되돌린다.
  function on_click_logout_admin() {
    g_is_authenticated = false
    ref_admin_id = ''
    ref_admin_password = ''
    g_auth_error_message = ''

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    }
  }

  // 관리자 페이지 드롭다운의 열림 상태를 토글한다.
  function on_click_toggle_admin_page_dropdown() {
    g_admin_page_dropdown_open = !g_admin_page_dropdown_open
  }

  // 선택한 관리자 페이지로 이동한다.
  function on_click_move_admin_page(href) {
    g_admin_page_dropdown_open = false
    window.location.href = href
  }
</script>

{#if !g_is_authenticated}
  <main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]">
    <section class="grid h-full place-items-center px-8 py-10">
      <section class="w-full max-w-[460px] rounded-[28px] border border-[#EFE7F2] bg-white p-8 shadow-sm shadow-slate-200/50">
        <div class="mb-8 text-left">
          <p class="m-0 text-sm font-extrabold uppercase tracking-[0.18em] text-[#98A2B3]">
            RETINAL ADMIN
          </p>
          <h1 class="mt-3 mb-0 text-[1.9rem] font-extrabold tracking-[-0.02em] text-zinc-950">
            관리자 로그인
          </h1>
        </div>

        <form class="grid gap-6" onsubmit={on_submit_admin_login}>
          <AuthInput
            id="admin-id"
            label="아이디"
            value={ref_admin_id}
            placeholder="관리자 아이디를 입력해주세요"
            required
            oninput={on_input_admin_id}
          />

          <PasswordInput
            id="admin-password"
            label="비밀번호"
            value={ref_admin_password}
            placeholder="비밀번호를 입력해주세요"
            required
            oninput={on_input_admin_password}
          />

          {#if g_auth_error_message}
            <p
              class="m-0 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-bold text-[#B42318]"
              role="alert"
            >
              {g_auth_error_message}
            </p>
          {/if}

          <button
            class="min-h-14 cursor-pointer rounded-xl border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
            type="submit"
          >
            관리자 로그인
          </button>
        </form>
      </section>
    </section>
  </main>
{:else}
  <main class="app-frame-page overflow-hidden bg-[var(--retinal-page)] text-[var(--retinal-text)]">
    <section class="h-full min-h-0 overflow-y-auto px-8 py-8">
      <div class="grid min-h-full w-full gap-8">
        <div class="flex items-start justify-between gap-6">
          <button
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#4B0055] transition hover:border-[#4B0055] hover:bg-[#F5EAF7]"
            type="button"
            onclick={on_click_logout_admin}
          >
            <LogOut size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>로그아웃</span>
          </button>

          <div class="relative w-[240px] rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
            <p class="mb-2 block text-xs font-extrabold uppercase tracking-[0.14em] text-[#98A2B3]">
              현재 페이지
            </p>

            <button
              class="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[#4B0055] transition hover:border-[#4B0055]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/15"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={g_admin_page_dropdown_open}
              onclick={on_click_toggle_admin_page_dropdown}
            >
              <span>{g_admin_page_arr.find((admin_page_obj) => admin_page_obj.key === active_key)?.label}</span>
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                class={`transition ${g_admin_page_dropdown_open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {#if g_admin_page_dropdown_open}
              <div
                class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                role="listbox"
                aria-label="관리자 페이지 목록"
              >
                {#each g_admin_page_arr as admin_page_obj (admin_page_obj.key)}
                  <button
                    class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                      active_key === admin_page_obj.key
                        ? 'bg-[#F5EAF7] text-[#4B0055]'
                        : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[#4B0055]'
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
