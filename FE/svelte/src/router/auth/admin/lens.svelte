<script>
  import { Plus, X } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'

  let ref_lens_saved_message = $state('')
  let ref_new_lens_group_name = $state('')
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

  // 입력 요소에서 문자열 값을 읽어오는 공통 보조 함수다.
  function get_input_value(local_event) {
    return /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 새 렌즈 카테고리 이름 입력값을 상태에 반영한다.
  function on_input_new_lens_group_name(local_event) {
    ref_new_lens_group_name = get_input_value(local_event)
    ref_lens_saved_message = ''
  }

  // 렌즈 카테고리의 새 옵션 입력값을 해당 그룹에 반영한다.
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
      { id: `lens-group-${Date.now()}`, title: local_group_name, option_arr: [], ref_new_option: '' },
    ]
    ref_new_lens_group_name = ''
    ref_lens_saved_message = '렌즈 카테고리가 추가되었습니다.'
  }

  // 선택한 렌즈 카테고리를 목록에서 삭제한다.
  function on_click_remove_lens_group(group_id) {
    ref_lens_group_arr = ref_lens_group_arr.filter((group_obj) => group_obj.id !== group_id)
    ref_lens_saved_message = '렌즈 카테고리가 제거되었습니다.'
  }

  // 선택한 렌즈 카테고리에 새 옵션을 추가한다.
  function on_click_add_lens_option(group_id) {
    const local_group_obj = ref_lens_group_arr.find((group_obj) => group_obj.id === group_id)
    const local_option_name = local_group_obj?.ref_new_option.trim() ?? ''

    if (!local_option_name) {
      ref_lens_saved_message = '추가할 옵션 이름을 입력해 주세요.'
      return
    }

    ref_lens_group_arr = ref_lens_group_arr.map((group_obj) =>
      group_obj.id === group_id
        ? { ...group_obj, option_arr: [...group_obj.option_arr, local_option_name], ref_new_option: '' }
        : group_obj,
    )
    ref_lens_saved_message = '렌즈 옵션이 추가되었습니다.'
  }

  // 선택한 렌즈 카테고리에서 옵션을 제거한다.
  function on_click_remove_lens_option(group_id, option_name) {
    ref_lens_group_arr = ref_lens_group_arr.map((group_obj) =>
      group_obj.id === group_id
        ? { ...group_obj, option_arr: group_obj.option_arr.filter((saved_option_name) => saved_option_name !== option_name) }
        : group_obj,
    )
    ref_lens_saved_message = '렌즈 옵션이 제거되었습니다.'
  }

  // 렌즈 조건 저장 버튼을 눌렀을 때 완료 메시지를 표시한다.
  function on_submit_lens_group(local_event) {
    local_event.preventDefault()
    ref_lens_saved_message = '렌즈 조건 설정이 임시 저장되었습니다.'
  }
</script>

<AdminLayout active_key="lens">
  <form class="grid gap-6" onsubmit={on_submit_lens_group}>
    <div class="flex items-start justify-between gap-6">
      <h2 class="m-0 text-2xl font-extrabold text-zinc-950">렌즈조건 설정</h2>
      <button
        class="min-h-12 cursor-pointer rounded-xl border-0 bg-[#4B0055] px-7 text-base font-extrabold text-white transition hover:bg-[#65006F]"
        type="submit"
      >
        설정 저장
      </button>
    </div>

    {#if ref_lens_saved_message}
      <p class="rounded-xl border border-[#E9D7FE] bg-[#F9F5FF] px-5 py-3 text-left text-base font-bold text-[#6941C6]">
        {ref_lens_saved_message}
      </p>
    {/if}

    <section class="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50">
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

    <div class="grid gap-6">
      {#each ref_lens_group_arr as lens_group_obj (lens_group_obj.id)}
        <article class="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-left shadow-sm shadow-slate-200/50">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="m-0 text-xl font-extrabold text-zinc-950">{lens_group_obj.title}</h3>
              <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">총 {lens_group_obj.option_arr.length}개 옵션</p>
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
              <span class="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E7D7EE] bg-[#F8F1F8] px-4 py-2 text-sm font-extrabold text-[#4B0055]">
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
              <label class="grid gap-2 text-sm font-extrabold text-slate-500" for={`new-option-${lens_group_obj.id}`}>
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
</AdminLayout>
