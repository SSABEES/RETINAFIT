<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import LoginButton from '@/components/button/login_button.svelte'
  import AuthInput from '@/components/input/auth_input.svelte'
  import PasswordInput from '@/components/input/password_input.svelte'
  import { PATH } from '@/config/path'
  import { login } from '@/lib/api/auth'
  import { set_selected_admin, set_selected_opt_store } from '@/lib/stores/admin'
  import {
    clear_auto_login_obj,
    load_auto_login_obj,
    save_auto_login_obj,
  } from '@/lib/stores/auto_login'

  let ref_store_id = $state('')
  let ref_password = $state('')
  let ref_auto_login = $state(false)
  let g_error_message = $state('')
  let g_is_loading = $state(false)

  /**
   * 공용 입력 컴포넌트에서 전달한 이벤트에서 실제 input 값을 꺼낸다.
   * @param {Event} local_event
   */
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  /**
   * 아이디 입력값을 상태에 반영하고 기존 에러 메시지를 비운다.
   * @param {Event} local_event
   */
  function on_input_store_id(local_event) {
    ref_store_id = get_input_value(local_event)
    g_error_message = ''
  }

  /**
   * 비밀번호 입력값을 상태에 반영하고 기존 에러 메시지를 비운다.
   * @param {Event} local_event
   */
  function on_input_password(local_event) {
    ref_password = get_input_value(local_event)
    g_error_message = ''
  }

  /**
   * 자동로그인 체크박스 토글을 상태에 반영한다.
   * @param {Event} local_event
   */
  function on_change_auto_login(local_event) {
    ref_auto_login = /** @type {HTMLInputElement} */ (local_event.currentTarget).checked
  }

  /**
   * 로그인 응답의 안경원 정보를 안경사 선택 화면이 쓰는 형태로 변환한다.
   * @param {{ opt_no?: number | string, opt_name?: string, company_tel?: string } | null | undefined} opt_info_obj
   */
  function build_opt_store_obj(opt_info_obj) {
    if (!opt_info_obj?.opt_no) {
      return null
    }

    return {
      id: Number(opt_info_obj.opt_no),
      opt_no: String(opt_info_obj.opt_no),
      name: String(opt_info_obj.opt_name ?? '안경원'),
      tel: String(opt_info_obj.company_tel ?? ''),
      raw_obj: opt_info_obj,
    }
  }

  /**
   * 로그인 응답의 안경사 목록을 안경사 선택 화면이 쓰는 관리자 데이터 형태로 변환한다.
   * @param {Array<Record<string, unknown>>} member_arr
   * @param {{ opt_no: string, name: string, tel: string }} opt_store_obj
   */
  function normalize_member_arr(member_arr, opt_store_obj) {
    return member_arr.map((member_obj, local_index) => ({
      id: Number(member_obj.member_no ?? member_obj.MEMBER_NO ?? local_index + 1),
      member_no: Number(member_obj.member_no ?? member_obj.MEMBER_NO ?? 0),
      name: String(member_obj.member_name ?? member_obj.MEMBER_NAME ?? '안경사'),
      position: String(member_obj.position ?? member_obj.POSITION ?? '안경사'),
      password: '',
      mobile: String(member_obj.mobile ?? member_obj.MOBILE ?? ''),
      opt_no: opt_store_obj.opt_no,
      opt_name: opt_store_obj.name,
      company_tel: opt_store_obj.tel,
      raw_obj: member_obj,
    }))
  }

  /**
   * 로그인 응답으로 안경원/안경사 상태를 채우고 안경사 선택 화면으로 이동한다.
   * 자동로그인 복원 흐름과 일반 로그인 흐름이 공유한다.
   * @param {Record<string, unknown>} login_response_obj
   */
  function apply_login_response(login_response_obj) {
    const local_opt_store_obj = build_opt_store_obj(
      /** @type {any} */ (login_response_obj?.opt_info),
    )

    if (!local_opt_store_obj) {
      throw new Error('로그인 응답에 안경원 정보가 없습니다.')
    }

    const local_member_arr = Array.isArray(login_response_obj?.member_list)
      ? /** @type {Array<Record<string, unknown>>} */ (login_response_obj.member_list)
      : []

    if (local_member_arr.length === 0) {
      throw new Error('로그인 응답에 안경사 정보가 없습니다.')
    }

    const local_admin_arr = normalize_member_arr(local_member_arr, local_opt_store_obj)

    set_selected_opt_store(local_opt_store_obj, local_admin_arr)
    set_selected_admin(local_admin_arr[0])
    navigate(PATH.opticianSelect)
  }

  /**
   * 로그인 폼 제출 시 필수값을 검증하고 로그인 성공 후 안경사 선택 화면으로 이동한다.
   * 자동로그인이 켜져 있으면 토큰과 응답 데이터를 localStorage에 저장한다.
   * @param {SubmitEvent} local_event
   */
  async function on_submit_login(local_event) {
    local_event.preventDefault()

    const local_id = ref_store_id.trim()
    const local_password = ref_password.trim()

    if (!local_id || !local_password) {
      g_error_message = '아이디와 비밀번호를 모두 입력해 주세요.'
      return
    }

    g_is_loading = true
    g_error_message = ''

    try {
      const local_login_response_obj = await login({
        id: local_id,
        password: local_password,
      })

      if (ref_auto_login && local_login_response_obj?.token && local_login_response_obj?.token_no) {
        save_auto_login_obj({
          token: String(local_login_response_obj.token),
          token_no: String(local_login_response_obj.token_no),
          opt_info: /** @type {any} */ (local_login_response_obj.opt_info ?? {}),
          member_list: Array.isArray(local_login_response_obj.member_list)
            ? /** @type {Array<Record<string, unknown>>} */ (local_login_response_obj.member_list)
            : [],
        })
      } else {
        clear_auto_login_obj()
      }

      apply_login_response(local_login_response_obj)
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '로그인 처리 중 오류가 발생했습니다.'
    } finally {
      g_is_loading = false
    }
  }

  /**
   * 저장된 자동로그인 세션이 있으면 토큰과 안경사 상태를 복원하고 안경사 선택 화면으로 보낸다.
   * 복원 데이터에 결함이 있으면 저장본을 비우고 일반 로그인 화면을 그대로 노출한다.
   */
  function try_restore_auto_login() {
    const local_auto_login_obj = load_auto_login_obj()

    if (!local_auto_login_obj?.token || !local_auto_login_obj?.token_no) {
      return
    }

    sessionStorage.setItem('token', String(local_auto_login_obj.token))
    sessionStorage.setItem('token_no', String(local_auto_login_obj.token_no))

    try {
      apply_login_response({
        opt_info: local_auto_login_obj.opt_info,
        member_list: local_auto_login_obj.member_list,
      })
      ref_auto_login = true
    } catch {
      clear_auto_login_obj()
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('token_no')
    }
  }

  onMount(() => {
    try_restore_auto_login()
  })
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-start justify-items-center px-6 pb-8 pt-16 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-[''] tablet-login-section"
    aria-labelledby="login-title"
  >
    <div class="relative z-10 flex w-full max-w-[440px] flex-col items-center tablet-login-panel">
      <div class="mb-8 flex flex-col items-center text-center">
        <img
          class="mb-4 h-auto w-[132px] rounded-xl shadow-2xl shadow-black/20 tablet-login-logo"
          src="/icnos.png"
          alt="RetinaFit"
          width="900"
          height="900"
        />
        <h1 id="login-title" class="m-0 text-3xl font-extrabold tracking-normal text-white">
          로그인
        </h1>
      </div>

      <form
        class="w-full rounded-[26px] border border-white/8 bg-white/12 px-8 py-8 shadow-2xl shadow-black/22 backdrop-blur-md tablet-login-form"
        onsubmit={on_submit_login}
      >
        <div class="grid gap-7">
          <AuthInput
            id="store-id"
            label="아이디"
            value={ref_store_id}
            placeholder="아이디를 입력해 주세요"
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
            placeholder="비밀번호를 입력해 주세요"
            maxlength={30}
            variant="dark"
            disabled={g_is_loading}
            oninput={on_input_password}
          />
        </div>

        <label
          class="mt-6 flex cursor-pointer select-none items-center gap-3 text-base font-semibold text-white/85"
          for="auto-login"
        >
          <input
            id="auto-login"
            class="h-5 w-5 cursor-pointer accent-[#9A1BFF]"
            type="checkbox"
            checked={ref_auto_login}
            disabled={g_is_loading}
            onchange={on_change_auto_login}
          />
          <span>자동 로그인</span>
        </label>

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
      © 2026 Retina. All rights reserved.
    </p>
  </section>
</main>

<style>
  @media (max-width: 1280px), (max-height: 820px) {
    .tablet-login-section {
      padding-top: 3rem;
      padding-bottom: 2rem;
    }

    .tablet-login-panel {
      max-width: 420px;
    }

    .tablet-login-logo {
      width: 120px;
    }

    .tablet-login-form {
      padding: 1.75rem;
    }
  }
</style>
