<script>
  import { Plus, UserRound, X } from 'lucide-svelte'
  import { admin_arr } from '../../lib/stores/admin'

  const metric_arr = [
    { label: '얼굴 너비', min_key: 'face_width_min', max_key: 'face_width_max', unit: 'mm' },
    { label: '얼굴 길이', min_key: 'face_length_min', max_key: 'face_length_max', unit: 'mm' },
    { label: '얼굴 비율', min_key: 'face_ratio_min', max_key: 'face_ratio_max', unit: ':1' },
    { label: '광대 너비', min_key: 'cheek_width_min', max_key: 'cheek_width_max', unit: 'mm' },
    { label: '턱 너비', min_key: 'jaw_width_min', max_key: 'jaw_width_max', unit: 'mm' },
  ]

  const admin_tab_arr = [
    { key: 'face', label: '얼굴형 설정' },
    { key: 'employee', label: '직원 관리' },
  ]

  // face.md의 얼굴형 설명을 기준으로 관리자가 수정할 수 있는 임시 기준값입니다.
  let ref_face_criteria_arr = $state([
    {
      id: 'oval',
      name: '계란형',
      english_nm: 'Oval',
      description: '이마가 약간 넓고 턱이 좁게 좁아지는 형태',
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
      description: '얼굴 폭과 길이가 비슷한 원형',
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
      description: '이마, 광대, 턱 폭이 비슷하고 각진 형태',
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
      description: '이마가 넓고 턱이 뾰족한 형태',
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
      description: '얼굴 길이가 폭보다 긴 형태',
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

  let ref_saved_message = $state('')
  let ref_employee_modal_open = $state(false)
  let ref_employee_name = $state('')
  let ref_employee_position = $state('')
  let ref_employee_password = $state('')
  let ref_active_admin_tab = $state('face')

  function reset_employee_form() {
    ref_employee_name = ''
    ref_employee_position = ''
    ref_employee_password = ''
  }

  function on_click_open_employee_modal() {
    ref_employee_modal_open = true
  }

  function on_click_close_employee_modal() {
    ref_employee_modal_open = false
    reset_employee_form()
  }

  function on_click_select_admin_tab(tab_key) {
    ref_active_admin_tab = tab_key
  }

  /** @param {SubmitEvent} local_event */
  function on_submit_face_criteria(local_event) {
    local_event.preventDefault()
    ref_saved_message = '얼굴형 기준 설정이 임시 저장되었습니다.'
  }

  /** @param {SubmitEvent} local_event */
  function on_submit_employee_create(local_event) {
    local_event.preventDefault()

    const local_next_id = Math.max(...$admin_arr.map((admin_obj) => admin_obj.id)) + 1
    const local_employee_obj = {
      id: local_next_id,
      name: ref_employee_name.trim(),
      position: ref_employee_position.trim(),
      password: ref_employee_password,
    }

    admin_arr.update((local_admin_arr) => [...local_admin_arr, local_employee_obj])
    on_click_close_employee_modal()
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]">
  <section class="h-full overflow-y-auto px-8 py-10">
    <div class="mx-auto max-w-[980px] pb-8">
      <div class="flex items-start justify-between gap-6">
        <div class="text-left">
          <h1 class="m-0 text-3xl font-extrabold text-zinc-950">관리자 페이지</h1>
        </div>
      </div>

      <nav
        class="mt-8 grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-200/40"
        aria-label="관리자 기능"
      >
        {#each admin_tab_arr as tab_obj (tab_obj.key)}
          <button
            class={`min-h-12 cursor-pointer rounded-xl border-0 text-base font-extrabold transition ${
              ref_active_admin_tab === tab_obj.key
                ? 'bg-[#4B0055] text-white shadow-sm shadow-[#4B0055]/20'
                : 'bg-transparent text-slate-500 hover:bg-[#F8F1F8] hover:text-[#4B0055]'
            }`}
            type="button"
            aria-current={ref_active_admin_tab === tab_obj.key ? 'page' : undefined}
            onclick={() => on_click_select_admin_tab(tab_obj.key)}
          >
            {tab_obj.label}
          </button>
        {/each}
      </nav>

      {#if ref_active_admin_tab === 'employee'}
        <section
          class="mt-8 rounded-2xl border border-slate-200 bg-white px-8 py-7 text-left shadow-sm shadow-slate-200/50"
        >
          <div class="flex items-center justify-between gap-6">
            <div>
              <h2 class="m-0 text-2xl font-extrabold text-zinc-950">직원 관리</h2>
            </div>

            <button
              class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-6 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
              type="button"
              onclick={on_click_open_employee_modal}
            >
              <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
              <span>직원 추가</span>
            </button>
          </div>

          <div class="mt-6 grid grid-cols-3 gap-4">
            {#each $admin_arr as admin_obj (admin_obj.id)}
              <article class="rounded-xl border border-slate-200 bg-[#F8F9FB] px-5 py-5">
                <div class="flex items-center gap-3">
                  <div
                    class="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#F5EAF7] text-[#4B0055]"
                  >
                    <UserRound size={22} strokeWidth={2.3} aria-hidden="true" />
                  </div>
                  <div class="min-w-0">
                    <p class="m-0 truncate text-lg font-extrabold text-zinc-950">
                      {admin_obj.name}
                    </p>
                    <p class="m-0 mt-1 truncate text-sm font-bold text-slate-500">
                      {admin_obj.position}
                    </p>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      {#if ref_active_admin_tab === 'face'}
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
                <div>
                  <div class="flex items-center gap-3">
                    <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{face_obj.name}</h2>
                    <span
                      class="rounded-full bg-[#F5EAF7] px-3 py-1 text-sm font-extrabold text-[#4B0055]"
                    >
                      {face_obj.english_nm}
                    </span>
                  </div>
                </div>

                <div class="mt-7 grid grid-cols-3 gap-5">
                  {#each metric_arr as metric_obj (metric_obj.label)}
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
    </div>
  </section>

  {#if ref_employee_modal_open}
    <div
      class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5"
      role="presentation"
      onclick={on_click_close_employee_modal}
    >
      <div
        class="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-black/25"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-create-title"
        tabindex="-1"
        onclick={(local_event) => local_event.stopPropagation()}
        onkeydown={(local_event) => local_event.stopPropagation()}
      >
        <header class="flex min-h-[66px] items-center justify-between bg-[#4B0055] px-7 text-white">
          <h2 id="employee-create-title" class="m-0 text-2xl font-extrabold">직원 추가</h2>
          <button
            class="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            type="button"
            aria-label="직원 추가 닫기"
            onclick={on_click_close_employee_modal}
          >
            <X size={25} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <form class="grid gap-5 px-7 py-6" onsubmit={on_submit_employee_create}>
          <label class="grid gap-2 text-base font-extrabold text-slate-700" for="employee-name">
            <span>이름 <span class="text-[#D92D20]">*</span></span>
            <input
              id="employee-name"
              class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
              type="text"
              bind:value={ref_employee_name}
              placeholder="직원 이름을 입력하세요"
              required
            />
          </label>

          <label class="grid gap-2 text-base font-extrabold text-slate-700" for="employee-position">
            <span>직급 <span class="text-[#D92D20]">*</span></span>
            <input
              id="employee-position"
              class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
              type="text"
              bind:value={ref_employee_position}
              placeholder="직급을 입력하세요"
              required
            />
          </label>

          <label class="grid gap-2 text-base font-extrabold text-slate-700" for="employee-password">
            <span>비밀번호 <span class="text-[#D92D20]">*</span></span>
            <input
              id="employee-password"
              class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
              type="password"
              inputmode="numeric"
              pattern="[0-9]{4}"
              maxlength="4"
              bind:value={ref_employee_password}
              placeholder="숫자 4자리를 설정하세요"
              required
            />
          </label>

          <div class="mt-2 grid grid-cols-2 gap-3">
            <button
              class="min-h-13 cursor-pointer rounded-lg border border-slate-200 bg-white text-lg font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              type="button"
              onclick={on_click_close_employee_modal}
            >
              취소
            </button>
            <button
              class="min-h-13 cursor-pointer rounded-lg border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
              type="submit"
            >
              추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</main>
