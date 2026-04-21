<script>
  import LoginButton from '../../components/button/login_button.svelte'
  import AuthInput from '../../components/input/auth_input.svelte'
  import PasswordInput from '../../components/input/password_input.svelte'

  let ref_store_id = $state('')
  let ref_staff_id = $state('')
  let ref_password = $state('')
  let g_error_message = $state('')

  /** @param {Event} local_event */
  const get_input_value = (local_event) => {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  /** @param {Event} local_event */
  const on_input_store_id = (local_event) => {
    ref_store_id = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_staff_id = (local_event) => {
    ref_staff_id = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_password = (local_event) => {
    ref_password = get_input_value(local_event)
  }

  /** @param {SubmitEvent} local_event */
  const on_submit_login = (local_event) => {
    local_event.preventDefault()

    if (!ref_store_id.trim() || !ref_staff_id.trim() || !ref_password.trim()) {
      g_error_message = '매장 ID, 직원 ID, 비밀번호를 모두 입력해주세요.'
      return
    }

    g_error_message = ''
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-center px-5 py-10 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="login-title"
  >
    <div class="relative z-10 flex w-full max-w-[364px] flex-col items-center">
      <div class="mb-7 flex flex-col items-center text-center">
        <img
          class="mb-4 h-auto w-[156px] rounded-3xl shadow-2xl shadow-black/20"
          src="/icnos.png"
          alt="Retin AI"
          width="768"
          height="768"
        />
        <h1 id="login-title" class="sr-only">Retin AI 로그인</h1>
        <p class="mt-3 text-base font-medium text-white/58">실시간 AR 안경 피팅 서비스</p>
      </div>

      <form
        class="w-full rounded-3xl border border-white/10 bg-white/12 p-8 shadow-2xl shadow-black/25 backdrop-blur-md"
        onsubmit={on_submit_login}
      >
        <div class="grid gap-5">
          <AuthInput
            id="store-id"
            label="매장 ID"
            value={ref_store_id}
            placeholder="매장 코드를 입력하세요"
            variant="dark"
            required
            oninput={on_input_store_id}
          />

          <AuthInput
            id="staff-id"
            label="직원 ID"
            value={ref_staff_id}
            placeholder="직원 ID를 입력하세요"
            variant="dark"
            required
            oninput={on_input_staff_id}
          />

          <PasswordInput
            id="password"
            label="비밀번호"
            value={ref_password}
            placeholder="비밀번호를 입력하세요"
            variant="dark"
            oninput={on_input_password}
          />
        </div>

        {#if g_error_message}
          <p
            class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            role="alert"
          >
            {g_error_message}
          </p>
        {/if}

        <div class="mt-6">
          <LoginButton type="submit" label="로그인" />
        </div>

        <button
          class="mx-auto mt-6 block w-fit cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-white/72 transition hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
          type="button"
        >
          비밀번호를 잊으셨나요?
        </button>
      </form>

      <p class="mt-8 text-sm font-medium text-white/42">© 2026 RETINA. All rights reserved.</p>
    </div>
  </section>
</main>
