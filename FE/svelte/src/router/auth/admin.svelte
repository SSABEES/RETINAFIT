<script>
  import { onMount } from 'svelte'
  import { ChevronDown, LogOut, Plus, X } from 'lucide-svelte'
  import AuthInput from '@/components/input/auth_input.svelte'
  import PasswordInput from '@/components/input/password_input.svelte'

  const ADMIN_AUTH_STORAGE_KEY = 'retinal_admin_authenticated'
  const ADMIN_ID = 'retinai1'
  const ADMIN_PASSWORD = '1234'

  const g_metric_arr = [
    { label: '얼굴 너비', min_key: 'face_width_min', max_key: 'face_width_max', unit: 'mm' },
    { label: '얼굴 길이', min_key: 'face_length_min', max_key: 'face_length_max', unit: 'mm' },
    { label: '얼굴 비율', min_key: 'face_ratio_min', max_key: 'face_ratio_max', unit: ':1' },
    { label: '광대 너비', min_key: 'cheek_width_min', max_key: 'cheek_width_max', unit: 'mm' },
    { label: '턱 너비', min_key: 'jaw_width_min', max_key: 'jaw_width_max', unit: 'mm' },
  ]

  const g_admin_page_arr = [
    { key: 'face', label: '얼굴형 기준 설정' },
    { key: 'lens', label: '렌즈조건 설정' },
  ]

  let ref_face_criteria_arr = $state([
    {
      id: 'oval',
      name: '계란형',
      english_nm: 'Oval',
      criteria_obj: {
        face_width_min: 130,
        face_width_max: 155,
        face_length_min: 180,
        face_length_max: 215,
        face_ratio_min: 1.25,
        face_ratio_max: 1.45,
        cheek_width_min: 128,
        cheek_width_max: 150,
        jaw_width_min: 105,
        jaw_width_max: 132,
      },
    },
    {
      id: 'round',
      name: '둥근형',
      english_nm: 'Round',
      criteria_obj: {
        face_width_min: 135,
        face_width_max: 165,
        face_length_min: 145,
        face_length_max: 175,
        face_ratio_min: 0.95,
        face_ratio_max: 1.15,
        cheek_width_min: 132,
        cheek_width_max: 162,
        jaw_width_min: 118,
        jaw_width_max: 148,
      },
    },
    {
      id: 'square',
      name: '사각형',
      english_nm: 'Square',
      criteria_obj: {
        face_width_min: 140,
        face_width_max: 170,
        face_length_min: 155,
        face_length_max: 190,
        face_ratio_min: 1.05,
        face_ratio_max: 1.25,
        cheek_width_min: 136,
        cheek_width_max: 168,
        jaw_width_min: 130,
        jaw_width_max: 165,
      },
    },
    {
      id: 'heart',
      name: '하트형',
      english_nm: 'Heart',
      criteria_obj: {
        face_width_min: 135,
        face_width_max: 165,
        face_length_min: 165,
        face_length_max: 205,
        face_ratio_min: 1.15,
        face_ratio_max: 1.4,
        cheek_width_min: 135,
        cheek_width_max: 165,
        jaw_width_min: 95,
        jaw_width_max: 125,
      },
    },
    {
      id: 'oblong',
      name: '긴형',
      english_nm: 'Oblong',
      criteria_obj: {
        face_width_min: 120,
        face_width_max: 150,
        face_length_min: 195,
        face_length_max: 235,
        face_ratio_min: 1.45,
        face_ratio_max: 1.75,
        cheek_width_min: 118,
        cheek_width_max: 148,
        jaw_width_min: 105,
        jaw_width_max: 135,
      },
    },
  ])

  let ref_lens_group_arr = $state([
    {
      id: 'lens_type',
      title: '렌즈 종류',
      option_arr: ['단초점', '다초점', '누진다초점', '비구면'],
      ref_new_option: '',
    },
    {
      id: 'coating',
      title: '코팅',
      option_arr: ['블루라이트 차단', '자외선 차단', '반사방지', '발수코팅'],
      ref_new_option: '',
    },
    {
      id: 'usage',
      title: '주 사용 환경',
      option_arr: ['사무·PC', '운전', '야외활동', '독서'],
      ref_new_option: '',
    },
    {
      id: 'material',
      title: '렌즈 소재',
      option_arr: ['일반', '초박형', '고굴절'],
      ref_new_option: '',
    },
  ])

  let ref_saved_message = $state('')
  let ref_lens_saved_message = $state('')
  let ref_selected_admin_page = $state('face')
  let g_admin_page_dropdown_open = $state(false)

  let ref_admin_id = $state('')
  let ref_admin_password = $state('')
  let ref_new_lens_group_name = $state('')
  let g_auth_error_message = $state('')
  let g_is_authenticated = $state(false)

  onMount(() => {
    if (typeof sessionStorage === 'undefined') {
      return
    }

    g_is_authenticated = sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true'
  })

  /**
   * 입력 이벤트에서 문자열 값을 안전하게 꺼낸다.
   * @param {Event} local_event
   */
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 관리자 로그인 아이디 입력값을 상태에 반영한다.
  function on_input_admin_id(local_event) {
    ref_admin_id = get_input_value(local_event)
    g_auth_error_message = ''
  }

  // 관리자 로그인 비밀번호 입력값을 상태에 반영한다.
  function on_input_admin_password(local_event) {
    ref_admin_password = get_input_value(local_event)
    g_auth_error_message = ''
  }

  /**
   * 고정 관리자 계정으로 로그인 검증을 수행하고 성공 시 관리자 화면을 연다.
   * @param {SubmitEvent} local_event
   */
  function on_submit_admin_login(local_event) {
    local_event.preventDefault()

    const local_admin_id = ref_admin_id.trim()
    const local_admin_password = ref_admin_password.trim()

    if (!local_admin_id || !local_admin_password) {
      g_auth_error_message = '아이디와 비밀번호를 모두 입력해 주세요.'
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

  // 관리자 인증 상태를 해제하고 로그인 입력값을 초기화한다.
  function on_click_logout_admin() {
    g_is_authenticated = false
    ref_admin_id = ''
    ref_admin_password = ''
    g_auth_error_message = ''

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    }
  }

  // 관리자 페이지 드롭다운 열림 상태를 전환한다.
  function on_click_toggle_admin_page_dropdown() {
    g_admin_page_dropdown_open = !g_admin_page_dropdown_open
  }

  // 관리자 페이지 항목을 선택하고 드롭다운을 닫는다.
  function on_click_select_admin_page(page_key) {
    ref_selected_admin_page = page_key
    g_admin_page_dropdown_open = false
    ref_saved_message = ''
    ref_lens_saved_message = ''
  }

  /**
   * 얼굴형 기준 설정 저장 메시지를 표시한다.
   * @param {SubmitEvent} local_event
   */
  function on_submit_face_criteria(local_event) {
    local_event.preventDefault()
    ref_saved_message = '얼굴형 기준 설정이 임시 저장되었습니다.'
  }

  // 새 렌즈 카테고리 입력값을 상태에 반영한다.
  function on_input_new_lens_group_name(local_event) {
    ref_new_lens_group_name = get_input_value(local_event)
    ref_lens_saved_message = ''
  }

  // 특정 렌즈 카테고리의 새 옵션 입력값을 상태에 반영한다.
  function on_input_new_lens_option(local_event, group_id) {
    const local_option_value = get_input_value(local_event)

    ref_lens_group_arr = ref_lens_group_arr.map((group_obj) =>
      group_obj.id === group_id ? { ...group_obj, ref_new_option: local_option_value } : group_obj,
    )
    ref_lens_saved_message = ''
  }

  // 새 렌즈 카테고리를 목록에 추가한다.
  function on_click_add_lens_group() {
    const local_group_name = ref_new_lens_group_name.trim()

    if (!local_group_name) {
      ref_lens_saved_message = '추가할 카테고리 이름을 입력해 주세요.'
      return
    }

    ref_lens_group_arr = [
      ...ref_lens_group_arr,
      {
        id: `lens-group-${Date.now()}`,
        title: local_group_name,
        option_arr: [],
        ref_new_option: '',
      },
    ]
    ref_new_lens_group_name = ''
    ref_lens_saved_message = '렌즈 카테고리가 추가되었습니다.'
  }

  // 선택한 렌즈 카테고리를 목록에서 제거한다.
  function on_click_remove_lens_group(group_id) {
    ref_lens_group_arr = ref_lens_group_arr.filter((group_obj) => group_obj.id !== group_id)
    ref_lens_saved_message = '렌즈 카테고리가 제거되었습니다.'
  }

  // 특정 렌즈 카테고리에 새 옵션을 추가한다.
  function on_click_add_lens_option(group_id) {
    const local_group_obj = ref_lens_group_arr.find((group_obj) => group_obj.id === group_id)
    const local_option_name = local_group_obj?.ref_new_option.trim() ?? ''

    if (!local_option_name) {
      ref_lens_saved_message = '추가할 옵션 이름을 입력해 주세요.'
      return
    }

    ref_lens_group_arr = ref_lens_group_arr.map((group_obj) =>
      group_obj.id === group_id
        ? {
            ...group_obj,
            option_arr: [...group_obj.option_arr, local_option_name],
            ref_new_option: '',
          }
        : group_obj,
    )
    ref_lens_saved_message = '렌즈 옵션이 추가되었습니다.'
  }

  // 특정 렌즈 카테고리에서 선택한 옵션을 제거한다.
  function on_click_remove_lens_option(group_id, option_name) {
    ref_lens_group_arr = ref_lens_group_arr.map((group_obj) =>
      group_obj.id === group_id
        ? {
            ...group_obj,
            option_arr: group_obj.option_arr.filter((saved_option_name) => saved_option_name !== option_name),
          }
        : group_obj,
    )
    ref_lens_saved_message = '렌즈 옵션이 제거되었습니다.'
  }

  /**
   * 렌즈 조건 설정 저장 메시지를 표시한다.
   * @param {SubmitEvent} local_event
   */
  function on_submit_lens_group(local_event) {
    local_event.preventDefault()
    ref_lens_saved_message = '렌즈 조건 설정이 임시 저장되었습니다.'
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
            placeholder="관리자 아이디를 입력해 주세요"
            required
            oninput={on_input_admin_id}
          />

          <PasswordInput
            id="admin-password"
            label="비밀번호"
            value={ref_admin_password}
            placeholder="비밀번호를 입력해 주세요"
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
  <main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]">
    <section class="h-full overflow-y-auto px-8 py-10">
      <div class="mx-auto max-w-[1040px] pb-8">
        <div class="flex justify-start">
          <button
            class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-base font-extrabold text-[#4B0055] transition hover:border-[#4B0055] hover:bg-[#F5EAF7]"
            type="button"
            onclick={on_click_logout_admin}
          >
            <LogOut size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>

        <div class="mt-6 flex items-end justify-between gap-6">
          <div class="text-left">
            <p class="m-0 text-sm font-extrabold uppercase tracking-[0.18em] text-[#98A2B3]">
              RETINAL ADMIN
            </p>
            <h1 class="mt-3 mb-0 text-3xl font-extrabold text-zinc-950">관리자 페이지</h1>
          </div>

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
              <span>
                {g_admin_page_arr.find((admin_page_obj) => admin_page_obj.key === ref_selected_admin_page)
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
                class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                role="listbox"
                aria-label="관리자 페이지 목록"
              >
                {#each g_admin_page_arr as admin_page_obj (admin_page_obj.key)}
                  <button
                    class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                      ref_selected_admin_page === admin_page_obj.key
                        ? 'bg-[#F5EAF7] text-[#4B0055]'
                        : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[#4B0055]'
                    }`}
                    type="button"
                    role="option"
                    aria-selected={ref_selected_admin_page === admin_page_obj.key}
                    onclick={() => on_click_select_admin_page(admin_page_obj.key)}
                  >
                    {admin_page_obj.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        {#if ref_selected_admin_page === 'face'}
          <form class="mt-8" onsubmit={on_submit_face_criteria}>
            <div class="flex items-start justify-between gap-6">
              <div class="text-left">
                <h2 class="m-0 text-2xl font-extrabold text-zinc-950">얼굴형 기준 설정</h2>
              </div>

              <button
                class="min-h-12 cursor-pointer rounded-xl border-0 bg-[#4B0055] px-7 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
                type="submit"
              >
                기준 저장
              </button>
            </div>

            {#if ref_saved_message}
              <p
                class="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-left text-base font-bold text-emerald-700"
              >
                {ref_saved_message}
              </p>
            {/if}

            <div class="mt-9 grid gap-7">
              {#each ref_face_criteria_arr as face_obj (face_obj.id)}
                <article
                  class="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-left shadow-sm shadow-slate-200/50"
                >
                  <div class="flex items-center gap-3">
                    <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{face_obj.name}</h2>
                    <span
                      class="rounded-full bg-[#F5EAF7] px-3 py-1 text-sm font-extrabold text-[#4B0055]"
                    >
                      {face_obj.english_nm}
                    </span>
                  </div>

                  <div class="mt-7 grid gap-5 lg:grid-cols-3">
                    {#each g_metric_arr as metric_obj (metric_obj.label)}
                      <fieldset class="m-0 rounded-xl border border-slate-200 p-5">
                        <legend class="px-2 text-base font-extrabold text-slate-700">
                          {metric_obj.label}
                        </legend>

                        <div class="mt-3 grid gap-4">
                          <label class="grid gap-2 text-sm font-bold text-slate-500">
                            최소
                            <div
                              class="flex items-center rounded-lg border border-slate-200 bg-white px-3"
                            >
                              <input
                                class="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-lg font-extrabold text-zinc-950 outline-none"
                                type="number"
                                step={metric_obj.unit === ':1' ? '0.01' : '1'}
                                bind:value={face_obj.criteria_obj[metric_obj.min_key]}
                              />
                              <span class="text-sm font-bold text-slate-400">{metric_obj.unit}</span>
                            </div>
                          </label>

                          <label class="grid gap-2 text-sm font-bold text-slate-500">
                            최대
                            <div
                              class="flex items-center rounded-lg border border-slate-200 bg-white px-3"
                            >
                              <input
                                class="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-lg font-extrabold text-zinc-950 outline-none"
                                type="number"
                                step={metric_obj.unit === ':1' ? '0.01' : '1'}
                                bind:value={face_obj.criteria_obj[metric_obj.max_key]}
                              />
                              <span class="text-sm font-bold text-slate-400">{metric_obj.unit}</span>
                            </div>
                          </label>
                        </div>
                      </fieldset>
                    {/each}
                  </div>
                </article>
              {/each}
            </div>
          </form>
        {/if}

        {#if ref_selected_admin_page === 'lens'}
          <form class="mt-8" onsubmit={on_submit_lens_group}>
            <div class="flex items-start justify-between gap-6">
              <div class="text-left">
                <h2 class="m-0 text-2xl font-extrabold text-zinc-950">렌즈조건 설정</h2>
                <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">
                  렌즈 조건 선택 페이지에 표시할 카테고리와 옵션을 관리합니다.
                </p>
              </div>

              <button
                class="min-h-12 cursor-pointer rounded-xl border-0 bg-[#4B0055] px-7 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
                type="submit"
              >
                설정 저장
              </button>
            </div>

            {#if ref_lens_saved_message}
              <p
                class="mt-5 rounded-xl border border-[#E9D7FE] bg-[#F9F5FF] px-5 py-3 text-left text-base font-bold text-[#6941C6]"
              >
                {ref_lens_saved_message}
              </p>
            {/if}

            <section class="mt-8 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50">
              <div class="flex items-end gap-3">
                <div class="min-w-0 flex-1">
                  <label class="grid gap-2 text-sm font-extrabold text-slate-500" for="new-lens-group">
                    새 카테고리
                    <input
                      id="new-lens-group"
                      class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                      type="text"
                      value={ref_new_lens_group_name}
                      placeholder="예: 렌즈 기능"
                      oninput={on_input_new_lens_group_name}
                    />
                  </label>
                </div>

                <button
                  class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-5 text-sm font-extrabold text-white transition hover:bg-[#65006F]"
                  type="button"
                  onclick={on_click_add_lens_group}
                >
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  <span>카테고리 추가</span>
                </button>
              </div>
            </section>

            <div class="mt-8 grid gap-6">
              {#each ref_lens_group_arr as lens_group_obj (lens_group_obj.id)}
                <article
                  class="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-left shadow-sm shadow-slate-200/50"
                >
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <h3 class="m-0 text-xl font-extrabold text-zinc-950">{lens_group_obj.title}</h3>
                      <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">
                        총 {lens_group_obj.option_arr.length}개 옵션
                      </p>
                    </div>

                    <button
                      class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-sm font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                      type="button"
                      onclick={() => on_click_remove_lens_group(lens_group_obj.id)}
                    >
                      <X size={15} strokeWidth={2.5} aria-hidden="true" />
                      <span>카테고리 삭제</span>
                    </button>
                  </div>

                  <div class="mt-6 flex flex-wrap gap-3">
                    {#each lens_group_obj.option_arr as option_name, option_index (`${lens_group_obj.id}-${option_index}`)}
                      <span
                        class="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E7D7EE] bg-[#F8F1F8] px-4 py-2 text-sm font-extrabold text-[#4B0055]"
                      >
                        <span>{option_name}</span>
                        <button
                          class="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#7A5C85] transition hover:bg-white hover:text-[#B42318]"
                          type="button"
                          aria-label={`${option_name} 삭제`}
                          onclick={() => on_click_remove_lens_option(lens_group_obj.id, option_name)}
                        >
                          <X size={14} strokeWidth={2.5} aria-hidden="true" />
                        </button>
                      </span>
                    {/each}
                  </div>

                  <div class="mt-6 flex items-end gap-3">
                    <div class="min-w-0 flex-1">
                      <label
                        class="grid gap-2 text-sm font-extrabold text-slate-500"
                        for={`new-option-${lens_group_obj.id}`}
                      >
                        새 옵션
                        <input
                          id={`new-option-${lens_group_obj.id}`}
                          class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                          type="text"
                          value={lens_group_obj.ref_new_option}
                          placeholder="추가할 옵션명을 입력해 주세요"
                          oninput={(local_event) => on_input_new_lens_option(local_event, lens_group_obj.id)}
                        />
                      </label>
                    </div>

                    <button
                      class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-5 text-sm font-extrabold text-white transition hover:bg-[#65006F]"
                      type="button"
                      onclick={() => on_click_add_lens_option(lens_group_obj.id)}
                    >
                      <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                      <span>옵션 추가</span>
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          </form>
        {/if}
      </div>
    </section>
  </main>
{/if}
