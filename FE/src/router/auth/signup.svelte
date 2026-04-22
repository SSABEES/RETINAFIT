<script>
  import { Link } from '@maks11060/svelte5-router'
  import { UserPlus } from 'lucide-svelte'
  import AuthInput from '../../components/input/auth_input.svelte'
  import PasswordInput from '../../components/input/password_input.svelte'
  import { PATH } from '../../config/path'

  let ref_store_name = $state('')
  let ref_business_no = $state('')
  let ref_password = $state('')
  let ref_password_confirm = $state('')
  let ref_admin_name = $state('')
  let ref_admin_position = $state('')
  let ref_admin_password = $state('')
  let g_signup_step = $state('store')
  let g_error_message = $state('')

  // 공용 입력 컴포넌트에서 전달된 이벤트의 실제 input 값을 꺼낸다.
  /** @param {Event} local_event */
  const get_input_value = (local_event) => {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  /** @param {Event} local_event */
  const on_input_store_name = (local_event) => {
    ref_store_name = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_business_no = (local_event) => {
    ref_business_no = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_password = (local_event) => {
    ref_password = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_password_confirm = (local_event) => {
    ref_password_confirm = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_admin_name = (local_event) => {
    ref_admin_name = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_admin_position = (local_event) => {
    ref_admin_position = get_input_value(local_event)
  }

  /** @param {Event} local_event */
  const on_input_admin_password = (local_event) => {
    const local_input = /** @type {HTMLInputElement} */ (local_event.currentTarget)
    const local_password = local_input.value.replace(/\D/g, '').slice(0, 4)

    local_input.value = local_password
    ref_admin_password = local_password
  }

  /** @param {SubmitEvent} local_event */
  const on_submit_store_signup = (local_event) => {
    local_event.preventDefault()

    if (
      !ref_store_name.trim() ||
      !ref_business_no.trim() ||
      !ref_password.trim() ||
      !ref_password_confirm.trim()
    ) {
      g_error_message = '매장명, 사업자 번호, 비밀번호를 모두 입력해주세요.'
      return
    }

    if (ref_password !== ref_password_confirm) {
      g_error_message = '비밀번호가 일치하지 않습니다.'
      return
    }

    g_error_message = ''
    g_signup_step = 'admin'
  }

  /** @param {SubmitEvent} local_event */
  const on_submit_admin_signup = (local_event) => {
    local_event.preventDefault()

    if (!ref_admin_name.trim() || !ref_admin_position.trim() || !ref_admin_password.trim()) {
      g_error_message = '관리자 이름과 직급을 모두 입력해주세요.'
      return
    }

    if (!/^\d{4}$/.test(ref_admin_password)) {
      g_error_message = '관리자 비밀번호는 숫자 4자리로 입력해주세요.'
      return
    }

    g_error_message = ''
  }

  const on_click_prev_store_step = () => {
    g_error_message = ''
    g_signup_step = 'store'
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-center px-6 py-12 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="signup-title"
  >
    <div class="relative z-10 flex w-full max-w-[480px] flex-col items-center">
      <!-- 회원가입 상단 브랜드 로고 영역 -->
      <div class="mb-8 flex flex-col items-center text-center">
        <img
          class="mb-5 h-auto w-[132px] rounded-xl shadow-2xl shadow-black/20"
          src="/icnos.png"
          alt="Retin AI"
          width="900"
          height="900"
        />
        <h1 id="signup-title" class="text-3xl font-extrabold tracking-normal text-white">
          {g_signup_step === 'store' ? '매장 가입' : '관리자 등록'}
        </h1>
      </div>

      {#if g_signup_step === 'store'}
        <!-- 매장 계정 정보 입력 카드 -->
        <form
          class="w-full rounded-[26px] border border-white/8 bg-white/12 px-10 py-10 shadow-2xl shadow-black/22 backdrop-blur-md"
          onsubmit={on_submit_store_signup}
        >
          <div class="grid gap-6">
            <AuthInput
              id="store-name"
              label="매장명"
              value={ref_store_name}
              placeholder="매장명을 입력하세요"
              variant="dark"
              required
              oninput={on_input_store_name}
            />

            <AuthInput
              id="business-no"
              label="사업자 번호"
              value={ref_business_no}
              placeholder="사업자 번호를 입력하세요"
              variant="dark"
              required
              oninput={on_input_business_no}
            />

            <PasswordInput
              id="password"
              label="비밀번호"
              value={ref_password}
              placeholder="비밀번호를 입력하세요"
              variant="dark"
              autocomplete="new-password"
              oninput={on_input_password}
            />

            <PasswordInput
              id="password-confirm"
              label="비밀번호 확인"
              value={ref_password_confirm}
              placeholder="비밀번호를 다시 입력하세요"
              variant="dark"
              autocomplete="new-password"
              oninput={on_input_password_confirm}
            />
          </div>

          {#if g_error_message}
            <p
              class="mt-6 rounded-xl bg-red-50 px-5 py-4 text-base font-semibold text-red-700"
              role="alert"
            >
              {g_error_message}
            </p>
          {/if}

          <button
            class="mt-8 min-h-14 w-full cursor-pointer rounded-xl border-0 bg-[#9A1BFF] text-lg font-bold text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-[#8A12EF] hover:shadow-lg hover:shadow-violet-600/25 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30"
            type="submit"
          >
            <span class="inline-flex items-center justify-center gap-2">
              <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
              <span>관리자 등록으로 이동</span>
            </span>
          </button>

          <p class="mt-7 text-center text-base font-semibold text-white/72">
            이미 계정이 있으신가요?
            <span class="auth-action-link">
              <Link href={PATH.login}>로그인</Link>
            </span>
          </p>
        </form>
      {:else}
        <!-- 관리자 정보 입력 카드 -->
        <form
          class="w-full rounded-[26px] border border-white/8 bg-white/12 px-10 py-10 shadow-2xl shadow-black/22 backdrop-blur-md"
          onsubmit={on_submit_admin_signup}
        >
          <div class="grid gap-6">
            <AuthInput
              id="admin-name"
              label="이름"
              value={ref_admin_name}
              placeholder="관리자 이름을 입력하세요"
              variant="dark"
              required
              oninput={on_input_admin_name}
            />

            <AuthInput
              id="admin-position"
              label="직급"
              value={ref_admin_position}
              placeholder="직급을 입력하세요"
              variant="dark"
              required
              oninput={on_input_admin_position}
            />

            <AuthInput
              id="admin-password"
              label="관리자 비밀번호"
              type="password"
              value={ref_admin_password}
              placeholder="숫자 4자리"
              variant="dark"
              required
              oninput={on_input_admin_password}
            />
          </div>

          {#if g_error_message}
            <p
              class="mt-6 rounded-xl bg-red-50 px-5 py-4 text-base font-semibold text-red-700"
              role="alert"
            >
              {g_error_message}
            </p>
          {/if}

          <button
            class="mt-8 min-h-14 w-full cursor-pointer rounded-xl border-0 bg-[#9A1BFF] text-lg font-bold text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-[#8A12EF] hover:shadow-lg hover:shadow-violet-600/25 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-600/30"
            type="submit"
          >
            <span class="inline-flex items-center justify-center gap-2">
              <UserPlus size={22} strokeWidth={2.4} aria-hidden="true" />
              <span>회원가입 완료</span>
            </span>
          </button>

          <button
            class="mx-auto mt-7 block w-fit cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-white/72 transition hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
            type="button"
            onclick={on_click_prev_store_step}
          >
            매장 정보 다시 입력
          </button>
        </form>
      {/if}
    </div>
  </section>
</main>
