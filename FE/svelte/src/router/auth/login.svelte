<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Check, LockKeyhole, User } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { login } from '@/lib/api/auth'
  import { set_selected_admin, set_selected_opt_store } from '@/lib/stores/admin'
  import {
    clear_auto_login_obj,
    load_auto_login_obj,
    save_auto_login_obj,
  } from '@/lib/stores/auto_login'
  import { push_error_toast } from '@/lib/stores/toast'

  let ref_store_id = $state('')
  let ref_password = $state('')
  let ref_auto_login = $state(false)
  let g_is_loading = $state(false)

  // 양자화 모델 검증용 hidden entry — 로고를 1.5초 안에 7회 누르면 /test 진입
  // (Flutter WebView에서 시작 URL 외 진입로가 없는 환경 대응)
  const g_logo_tap_required = 7
  const g_logo_tap_window_ms = 1500
  let g_logo_tap_count = 0
  let g_logo_tap_reset_timer_id = null

  // 아이디와 비밀번호가 모두 입력되면 로그인 버튼을 활성 색상으로 전환
  let is_active = $derived(ref_store_id.length > 0 && ref_password.length > 0)

  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  function on_input_store_id(local_event) {
    ref_store_id = get_input_value(local_event)
  }

  function on_input_password(local_event) {
    ref_password = get_input_value(local_event)
  }

  function on_change_auto_login(local_event) {
    ref_auto_login = /** @type {HTMLInputElement} */ (local_event.currentTarget).checked
  }

  // 로고 탭 카운터를 증가시키고 임계치 도달 시 /test 로 이동 (양자화 검증용 hidden entry)
  function on_click_logo() {
    g_logo_tap_count += 1

    if (g_logo_tap_reset_timer_id !== null) {
      clearTimeout(g_logo_tap_reset_timer_id)
      g_logo_tap_reset_timer_id = null
    }

    if (g_logo_tap_count >= g_logo_tap_required) {
      g_logo_tap_count = 0
      navigate(PATH.test)
      return
    }

    g_logo_tap_reset_timer_id = setTimeout(() => {
      g_logo_tap_count = 0
      g_logo_tap_reset_timer_id = null
    }, g_logo_tap_window_ms)
  }

  function build_opt_store_obj(opt_info_obj) {
    if (!opt_info_obj?.opt_no) {
      return null
    }

    return {
      id: Number(opt_info_obj.opt_no),
      opt_no: String(opt_info_obj.opt_no),
      name: String(opt_info_obj.opt_name ?? '안경점'),
      tel: String(opt_info_obj.company_tel ?? ''),
      raw_obj: opt_info_obj,
    }
  }

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

  function apply_login_response(login_response_obj) {
    const local_opt_store_obj = build_opt_store_obj(
      /** @type {any} */ (login_response_obj?.opt_info),
    )

    if (!local_opt_store_obj) {
      throw new Error('로그인 응답에 안경점 정보가 없습니다.')
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

  async function on_submit_login(local_event) {
    local_event.preventDefault()

    const local_id = ref_store_id.trim()
    const local_password = ref_password.trim()

    if (!local_id || !local_password) {
      push_error_toast('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    g_is_loading = true

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
      push_error_toast(
        local_error instanceof Error ? local_error.message : '로그인 처리 중 오류가 발생했습니다.',
      )
    } finally {
      g_is_loading = false
    }
  }

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

<main
  class="app-frame-page grid min-h-full grid-rows-[1fr_auto] overflow-hidden bg-[var(--retina-bg-1)] px-6 pt-6 pb-4 text-[var(--retina-text)]"
>
  <section
    class="grid w-full max-w-[460px] justify-self-center self-center"
    aria-labelledby="login-title"
  >
    <form
      class="grid w-full gap-6 rounded-[22px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-14 py-10 shadow-[0_6px_14px_rgba(19,25,40,0.06)]"
      onsubmit={on_submit_login}
    >
      <div class="grid justify-items-center gap-4 text-center">
        <button
          type="button"
          class="m-0 cursor-default border-0 bg-transparent p-0 [-webkit-touch-callout:none]"
          aria-hidden="true"
          tabindex="-1"
          onclick={on_click_logo}
        >
          <img
            class="h-auto w-[248px] select-none"
            src="/logo/LogoHeight.png"
            alt="RetinaFit"
            width="16568"
            height="16568"
            draggable="false"
          />
        </button>
        <h1 id="login-title" class="sr-only">로그인</h1>
      </div>

      <div class="grid gap-3.5">
        <label class="group relative block">
          <span class="sr-only">아이디</span>
          <User
            size={19}
            strokeWidth={1.8}
            class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--retina-text-500)] transition group-focus-within:text-[var(--retina-text-800)]"
            aria-hidden="true"
          />
          <input
            id="store-id"
            class="min-h-14 w-full rounded-[4px] border border-[var(--retina-text-300)] bg-[var(--retina-surface)] pl-12 pr-4 text-base text-[var(--retina-text)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-primary-200)]/30"
            type="text"
            value={ref_store_id}
            placeholder="아이디 (이메일 주소)"
            maxlength="30"
            disabled={g_is_loading}
            required
            oninput={on_input_store_id}
          />
        </label>

        <label class="group relative block">
          <span class="sr-only">비밀번호</span>
          <LockKeyhole
            size={19}
            strokeWidth={1.8}
            class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--retina-text-500)] transition group-focus-within:text-[var(--retina-text-800)]"
            aria-hidden="true"
          />
          <input
            id="password"
            class="min-h-14 w-full rounded-[4px] border border-[var(--retina-text-300)] bg-[var(--retina-surface)] pl-12 pr-4 text-base text-[var(--retina-text)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-primary-200)]/30"
            type="password"
            value={ref_password}
            placeholder="비밀번호"
            maxlength="30"
            disabled={g_is_loading}
            required
            oninput={on_input_password}
          />
        </label>
      </div>

      <button
        class={`min-h-14 w-full cursor-pointer rounded-[8px] border-0 text-[24px] font-bold tracking-[0.18em] text-[var(--retina-text-100)] transition focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--retina-text-300)]/70 disabled:cursor-not-allowed disabled:opacity-60 ${
          is_active
            ? 'bg-[var(--retina-primary-400)] hover:bg-[var(--retina-primary-700)]'
            : 'bg-[var(--retina-bg-2)] hover:bg-[var(--retina-text-600)]'
        }`}
        type="submit"
        disabled={g_is_loading}
      >
        {g_is_loading ? '로그인 중' : '로 그 인'}
      </button>

      <label
        class="mt-1 inline-flex cursor-pointer items-center gap-3 text-base font-medium text-[var(--retina-text-500)]"
        for="auto-login"
      >
        <span
          class={`grid h-7 w-7 place-items-center rounded-full transition ${
            ref_auto_login
              ? 'bg-[var(--retina-primary-300)] text-[var(--retina-text-100)]'
              : 'bg-[var(--retina-bg-2)] text-[var(--retina-text-100)]/60'
          }`}
          aria-hidden="true"
        >
          <Check size={15} strokeWidth={3} />
        </span>
        <input
          id="auto-login"
          class="sr-only"
          type="checkbox"
          checked={ref_auto_login}
          disabled={g_is_loading}
          onchange={on_change_auto_login}
        />
        <span>로그인 유지</span>
      </label>
    </form>
  </section>

  <p
    class="m-0 justify-self-center text-center text-sm font-medium text-[var(--retina-primary-900)]/80"
  >
    © 2026 RETINA Co,Ltd. All rights reserved.
  </p>
</main>

<style>
  @media (max-width: 1280px), (max-height: 820px) {
    form {
      padding: 2rem 1.75rem;
    }
  }

  @media (max-width: 640px) {
    form {
      padding: 1.5rem 1.25rem;
    }
  }
</style>
