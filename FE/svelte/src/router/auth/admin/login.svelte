<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import AuthInput from '@/components/input/auth_input.svelte'
  import PasswordInput from '@/components/input/password_input.svelte'
  import { PATH } from '@/config/path'
  import { admin_login } from '@/lib/api/auth'

  let ref_admin_id = $state('')
  let ref_admin_password = $state('')
  let g_error_message = $state('')
  let g_is_loading = $state(false)

  // 이미 로그인 상태면 관리자 메인으로 보냄
  onMount(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem('admin_token')) {
      navigate(PATH.adminFace)
    }
  })

  // 입력 컴포넌트의 이벤트에서 실제 값 꺼내기
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 아이디 입력 반영
  function on_input_admin_id(local_event) {
    ref_admin_id = get_input_value(local_event)
    g_error_message = ''
  }

  // 비밀번호 입력 반영
  function on_input_admin_password(local_event) {
    ref_admin_password = get_input_value(local_event)
    g_error_message = ''
  }

  /**
   * 관리자 로그인 폼 제출 시 BE 검증을 거쳐 admin_token 저장 후 관리자 메인으로 이동함
   * @param {SubmitEvent} local_event
   */
  async function on_submit_admin_login(local_event) {
    local_event.preventDefault()

    const local_id = ref_admin_id.trim()
    const local_password = ref_admin_password.trim()

    if (!local_id || !local_password) {
      g_error_message = '아이디와 비밀번호를 모두 입력해 주세요.'
      return
    }

    g_is_loading = true
    g_error_message = ''

    try {
      await admin_login({ id: local_id, password: local_password })
      navigate(PATH.adminFace)
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '관리자 로그인 처리 중 오류가 발생했습니다.'
    } finally {
      g_is_loading = false
    }
  }
</script>

<main class="app-frame-page overflow-hidden bg-[var(--retinal-page)] text-[var(--retinal-text)]">
  <section class="grid h-full place-items-center px-8 py-10">
    <section
      class="w-full max-w-[460px] rounded-[28px] border border-[#EFE7F2] bg-white p-8 shadow-sm shadow-slate-200/50"
    >
      <div class="mb-8 text-left">
        <p
          class="m-0 text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--retinal-text-muted)]"
        >
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
          disabled={g_is_loading}
          required
          oninput={on_input_admin_id}
        />

        <PasswordInput
          id="admin-password"
          label="비밀번호"
          value={ref_admin_password}
          placeholder="비밀번호를 입력해주세요"
          disabled={g_is_loading}
          required
          oninput={on_input_admin_password}
        />

        {#if g_error_message}
          <p
            class="m-0 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-bold text-[#B42318]"
            role="alert"
          >
            {g_error_message}
          </p>
        {/if}

        <button
          class="min-h-14 cursor-pointer rounded-xl border-0 bg-[var(--retinal-primary-700)] text-lg font-extrabold text-white transition hover:bg-[var(--retinal-primary-500)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-700)]/30 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={g_is_loading}
        >
          {g_is_loading ? '로그인 중' : '관리자 로그인'}
        </button>
      </form>
    </section>
  </section>
</main>
