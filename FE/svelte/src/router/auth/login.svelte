<script>
  import { navigate } from '@maks11060/svelte5-router'
  import LoginButton from '@/components/button/login_button.svelte'
  import AuthInput from '@/components/input/auth_input.svelte'
  import PasswordInput from '@/components/input/password_input.svelte'
  import { PATH } from '@/config/path'
  import { retina_login } from '@/lib/api/retina'
  import { set_login_select_data } from '@/lib/stores/admin'

  let ref_store_id = $state('')
  let ref_password = $state('')
  let g_error_message = $state('')
  let g_is_loading = $state(false)

  /**
   * 공용 입력 컴포넌트에서 전달된 이벤트의 실제 input 값을 반환한다.
   * @param {Event} local_event
   */
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  /**
   * 매장 ID 입력값을 로그인 폼 상태에 반영하고 에러 메시지를 초기화한다.
   * @param {Event} local_event
   */
  function on_input_store_id(local_event) {
    ref_store_id = get_input_value(local_event)
    g_error_message = ''
  }

  /**
   * 비밀번호 입력값을 로그인 폼 상태에 반영하고 에러 메시지를 초기화한다.
   * @param {Event} local_event
   */
  function on_input_password(local_event) {
    ref_password = get_input_value(local_event)
    g_error_message = ''
  }

  /**
   * 로그인 API의 안경점 목록을 화면에서 사용하는 안경점 선택 데이터로 변환한다.
   * @param {Array<Record<string, unknown>>} opt_arr
   */
  function normalize_opt_store_arr(opt_arr) {
    return opt_arr.map((opt_obj, local_index) => ({
      id: Number(opt_obj.OPT_NO ?? local_index + 1),
      opt_no: String(opt_obj.OPT_NO ?? ''),
      name: String(opt_obj.OPT_NAME ?? opt_obj.COMPANY_NAME ?? '안경점'),
      tel: String(opt_obj.COMPANY_TEL ?? ''),
      raw_obj: opt_obj,
    }))
  }

  /**
   * 로그인 폼 제출 시 필수값을 검증하고 로그인 성공 시 안경점 선택 화면으로 이동한다.
   * @param {SubmitEvent} local_event
   */
  async function on_submit_login(local_event) {
    local_event.preventDefault()

    const local_user_id = ref_store_id.trim()
    const local_password = ref_password.trim()

    if (!local_user_id || !local_password) {
      g_error_message = '아이디와 비밀번호를 모두 입력해주세요.'
      return
    }

    g_is_loading = true
    g_error_message = ''

    try {
      const local_login_result_obj = await retina_login({
        user_id: local_user_id,
        user_passwd: local_password,
      })

      if (local_login_result_obj.result_no !== '0') {
        throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
      }

      const local_opt_store_arr = normalize_opt_store_arr(local_login_result_obj.opt_arr)

      if (local_opt_store_arr.length === 0) {
        throw new Error('선택 가능한 안경점 정보가 없습니다.')
      }

      set_login_select_data(local_opt_store_arr, local_login_result_obj.member_arr)
      navigate(PATH.storeSelect)
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '로그인 처리 중 오류가 발생했습니다.'
    } finally {
      g_is_loading = false
    }
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-start justify-items-center px-6 pt-24 pb-12 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="login-title"
  >
    <div class="relative z-10 flex w-full max-w-[440px] flex-col items-center">
      <div class="mb-10 flex flex-col items-center text-center">
        <img
          class="mb-5 h-auto w-[148px] rounded-xl shadow-2xl shadow-black/20"
          src="/icnos.png"
          alt="Retin AI"
          width="900"
          height="900"
        />
        <h1 id="login-title" class="m-0 text-3xl font-extrabold tracking-normal text-white">
          로그인
        </h1>
      </div>

      <form
        class="w-full rounded-[26px] border border-white/8 bg-white/12 px-10 py-10 shadow-2xl shadow-black/22 backdrop-blur-md"
        onsubmit={on_submit_login}
      >
        <div class="grid gap-7">
          <AuthInput
            id="store-id"
            label="아이디"
            value={ref_store_id}
            placeholder="아이디를 입력하세요"
            maxlength={30}
            variant="dark"
            disabled={g_is_loading}
            required
            oninput={on_input_store_id}
          />

          <PasswordInput
            id="password"
            label="비밀번호"
            value={ref_password}
            placeholder="비밀번호를 입력하세요"
            maxlength={15}
            variant="dark"
            disabled={g_is_loading}
            oninput={on_input_password}
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

        <div class="mt-8">
          <LoginButton
            type="submit"
            label={g_is_loading ? '로그인 중' : '로그인'}
            disabled={g_is_loading}
          />
        </div>
      </form>
    </div>

    <p
      class="absolute bottom-10 left-1/2 z-10 m-0 -translate-x-1/2 text-base font-medium text-white/42"
    >
      © 2026 RETINA. All rights reserved.
    </p>
  </section>
</main>
