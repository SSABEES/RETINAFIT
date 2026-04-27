<script>
  import { onMount } from 'svelte'
  import { ArrowDown, ArrowUp, ChevronDown, Plus, Save, Trash2 } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import {
    create_recommend_option,
    delete_recommend_option,
    get_recommend_option_arr,
    update_recommend_option,
    update_recommend_option_order,
  } from '@/lib/api/admin_recommend_options'

  /**
   * @typedef {{ key: string, label: string }} CategoryMeta
   * @typedef {{
   *   active_key?: string,
   *   page_title?: string,
   *   page_description?: string,
   *   category_meta_arr?: CategoryMeta[],
   * }} RecommendOptionManagerProps
   */

  /** @type {RecommendOptionManagerProps} */
  const g_props = $props()

  let {
    active_key = 'face',
    page_title = '추천 옵션 설정',
    page_description = '',
    category_meta_arr = [],
  } = g_props

  function create_option_form_obj() {
    return {
      option_name: '',
      option_category: category_meta_arr[0]?.key ?? '',
      is_active: true,
    }
  }

  let ref_option_form_obj = $state(create_option_form_obj())
  let ref_option_arr = $state([])
  let ref_option_category_dropdown_open = $state(false)
  let g_feedback_message = $state('')
  let g_error_message = $state('')
  let g_is_loading = $state(false)

  let g_category_name_map_obj = $derived(
    Object.fromEntries(category_meta_arr.map((category_meta_obj) => [category_meta_obj.key, category_meta_obj.label])),
  )

  let g_filtered_option_arr = $derived(
    ref_option_arr
      .filter((option_obj) => category_meta_arr.some((category_meta_obj) => category_meta_obj.key === option_obj.option_category))
      .sort((left_option_obj, right_option_obj) => left_option_obj.display_order - right_option_obj.display_order),
  )

  let g_grouped_option_arr = $derived(
    category_meta_arr.map((category_meta_obj) => ({
      ...category_meta_obj,
      option_arr: g_filtered_option_arr.filter((option_obj) => option_obj.option_category === category_meta_obj.key),
    })),
  )

  // 추천 옵션 응답을 화면에서 바로 수정 가능한 상태 객체로 변환한다.
  function normalize_option_arr(option_arr) {
    return option_arr.map((option_obj) => ({
      option_no: Number(option_obj.option_no ?? 0),
      option_name: String(option_obj.option_name ?? ''),
      option_category: String(option_obj.option_category ?? ''),
      display_order: Number(option_obj.display_order ?? 0),
      is_active: Boolean(option_obj.is_active),
    }))
  }

  // 추천 옵션 목록을 다시 불러온다.
  async function load_option_arr() {
    g_is_loading = true
    g_error_message = ''

    try {
      const local_option_arr = await get_recommend_option_arr()
      ref_option_arr = normalize_option_arr(Array.isArray(local_option_arr) ? local_option_arr : [])
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '추천 옵션 조회 중 오류가 발생했습니다.'
    } finally {
      g_is_loading = false
    }
  }

  // 새 추천 옵션 입력 상태를 초기화한다.
  function reset_option_form() {
    ref_option_form_obj = create_option_form_obj()
    ref_option_category_dropdown_open = false
  }

  // 입력값을 상태에 반영한다.
  function on_input_option_name(local_event) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      option_name: /** @type {HTMLInputElement} */ (local_event.currentTarget).value,
    }
    g_feedback_message = ''
    g_error_message = ''
  }

  // 카테고리 드롭다운을 열고 닫는다.
  function on_click_toggle_option_category_dropdown() {
    ref_option_category_dropdown_open = !ref_option_category_dropdown_open
  }

  // 카테고리를 선택한다.
  function on_click_select_option_category(option_category) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      option_category,
    }
    ref_option_category_dropdown_open = false
    g_feedback_message = ''
    g_error_message = ''
  }

  // 사용 여부를 바꾼다.
  function on_change_option_active(local_event) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      is_active: /** @type {HTMLInputElement} */ (local_event.currentTarget).checked,
    }
    g_feedback_message = ''
    g_error_message = ''
  }

  // 새 추천 옵션을 추가한다.
  async function on_submit_create_option(local_event) {
    local_event.preventDefault()

    const local_option_name = ref_option_form_obj.option_name.trim()
    const local_option_category = ref_option_form_obj.option_category
    const local_group_option_arr = g_filtered_option_arr.filter(
      (option_obj) => option_obj.option_category === local_option_category,
    )

    if (!local_option_name) {
      g_error_message = '옵션명을 입력해 주세요.'
      return
    }

    try {
      await create_recommend_option({
        option_name: local_option_name,
        option_category: local_option_category,
        display_order: local_group_option_arr.length,
        is_active: ref_option_form_obj.is_active,
      })

      g_feedback_message = '추천 옵션을 추가했습니다.'
      reset_option_form()
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '추천 옵션 추가 중 오류가 발생했습니다.'
    }
  }

  // 저장 버튼 클릭 시 현재 행의 옵션명을 수정한다.
  async function on_click_save_option(option_obj) {
    const local_option_name = option_obj.option_name.trim()

    if (!local_option_name) {
      g_error_message = '옵션명은 비워둘 수 없습니다.'
      return
    }

    try {
      await update_recommend_option({
        option_no: option_obj.option_no,
        option_name: local_option_name,
        option_category: option_obj.option_category,
        is_active: option_obj.is_active,
      })

      g_feedback_message = '추천 옵션을 수정했습니다.'
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '추천 옵션 수정 중 오류가 발생했습니다.'
    }
  }

  // 삭제 버튼 클릭 시 추천 옵션을 제거한다.
  async function on_click_delete_option(option_obj) {
    try {
      await delete_recommend_option({
        option_no: option_obj.option_no,
      })

      g_feedback_message = '추천 옵션을 삭제했습니다.'
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '추천 옵션 삭제 중 오류가 발생했습니다.'
    }
  }

  // 표시 순서를 위나 아래로 이동시키고 서버 순서를 함께 갱신한다.
  async function on_click_move_option(option_obj, direction_value) {
    const local_same_category_option_arr = g_filtered_option_arr.filter(
      (filtered_option_obj) => filtered_option_obj.option_category === option_obj.option_category,
    )
    const local_current_index = local_same_category_option_arr.findIndex(
      (filtered_option_obj) => filtered_option_obj.option_no === option_obj.option_no,
    )
    const local_target_index = local_current_index + direction_value

    if (local_current_index < 0 || local_target_index < 0 || local_target_index >= local_same_category_option_arr.length) {
      return
    }

    const local_target_option_obj = local_same_category_option_arr[local_target_index]

    try {
      await Promise.all([
        update_recommend_option_order({
          option_no: option_obj.option_no,
          display_order: local_target_option_obj.display_order,
        }),
        update_recommend_option_order({
          option_no: local_target_option_obj.option_no,
          display_order: option_obj.display_order,
        }),
      ])

      g_feedback_message = '표시 순서를 변경했습니다.'
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error ? local_error.message : '표시 순서 변경 중 오류가 발생했습니다.'
    }
  }

  onMount(() => {
    load_option_arr()
  })
</script>

<AdminLayout {active_key}>
  <section class="grid gap-6">
    <div class="flex items-start justify-between gap-6">
      <div>
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{page_title}</h2>
        {#if page_description}
          <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">{page_description}</p>
        {/if}
      </div>
    </div>

    {#if g_feedback_message}
      <p class="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-left text-base font-bold text-emerald-700">
        {g_feedback_message}
      </p>
    {/if}

    {#if g_error_message}
      <p class="rounded-xl border border-red-100 bg-red-50 px-5 py-3 text-left text-base font-bold text-red-700">
        {g_error_message}
      </p>
    {/if}

    <form
      class="grid gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50 md:grid-cols-[1fr_220px_140px_auto]"
      onsubmit={on_submit_create_option}
    >
      <label class="grid gap-2 text-sm font-extrabold text-slate-500">
        옵션명
        <input
          class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
          type="text"
          value={ref_option_form_obj.option_name}
          placeholder="새 추천 옵션명"
          oninput={on_input_option_name}
        />
      </label>

      <label class="grid gap-2 text-sm font-extrabold text-slate-500">
        카테고리
        <div class="relative">
          <button
            class="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[#4B0055] transition hover:border-[#4B0055]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/15"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={ref_option_category_dropdown_open}
            onclick={on_click_toggle_option_category_dropdown}
          >
            <span>
              {category_meta_arr.find((category_meta_obj) => category_meta_obj.key === ref_option_form_obj.option_category)?.label
                ?? '카테고리 선택'}
            </span>
            <ChevronDown
              size={18}
              strokeWidth={2.4}
              class={`transition ${ref_option_category_dropdown_open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {#if ref_option_category_dropdown_open}
            <div
              class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
              role="listbox"
              aria-label="추천 옵션 카테고리 목록"
            >
              {#each category_meta_arr as category_meta_obj (category_meta_obj.key)}
                <button
                  class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                    ref_option_form_obj.option_category === category_meta_obj.key
                      ? 'bg-[#F5EAF7] text-[#4B0055]'
                      : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[#4B0055]'
                  }`}
                  type="button"
                  role="option"
                  aria-selected={ref_option_form_obj.option_category === category_meta_obj.key}
                  onclick={() => on_click_select_option_category(category_meta_obj.key)}
                >
                  {category_meta_obj.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </label>

      <label class="grid gap-2 text-sm font-extrabold text-slate-500">
        사용 여부
        <span class="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4">
          <input
            class="h-4 w-4 accent-[#4B0055]"
            type="checkbox"
            checked={ref_option_form_obj.is_active}
            onchange={on_change_option_active}
          />
          <span class="text-base font-bold text-zinc-950">활성화</span>
        </span>
      </label>

      <button
        class="mt-[1.7rem] inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#4B0055] px-5 text-sm font-extrabold text-white transition hover:bg-[#65006F]"
        type="submit"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>옵션 추가</span>
      </button>
    </form>

    {#if g_is_loading}
      <div class="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center text-base font-bold text-slate-500 shadow-sm shadow-slate-200/50">
        추천 옵션을 불러오는 중입니다.
      </div>
    {:else}
      <div class="grid gap-6">
        {#each g_grouped_option_arr as category_group_obj (category_group_obj.key)}
          <section class="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50">
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="m-0 text-xl font-extrabold text-zinc-950">{category_group_obj.label}</h3>
                <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">
                  총 {category_group_obj.option_arr.length}개 옵션
                </p>
              </div>
            </div>

            {#if category_group_obj.option_arr.length > 0}
              <div class="mt-6 grid gap-4">
                {#each category_group_obj.option_arr as option_obj, option_index (option_obj.option_no)}
                  <article class="grid gap-4 rounded-2xl border border-[#E9E8F0] bg-[#FAFBFC] px-5 py-5 lg:grid-cols-[1fr_140px_auto] lg:items-center">
                    <div class="grid gap-2">
                      <p class="m-0 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        {g_category_name_map_obj[option_obj.option_category] ?? option_obj.option_category}
                      </p>
                      <input
                        class="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-zinc-950 outline-none transition focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                        type="text"
                        bind:value={option_obj.option_name}
                      />
                    </div>

                    <label class="grid gap-2 text-sm font-extrabold text-slate-500">
                      사용 여부
                      <span class="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4">
                        <input
                          class="h-4 w-4 accent-[#4B0055]"
                          type="checkbox"
                          bind:checked={option_obj.is_active}
                        />
                        <span class="text-base font-bold text-zinc-950">
                          {option_obj.is_active ? '활성화' : '비활성화'}
                        </span>
                      </span>
                    </label>

                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <button
                        class="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-[#4B0055] hover:text-[#4B0055] disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        aria-label={`${option_obj.option_name} 위로 이동`}
                        disabled={option_index === 0}
                        onclick={() => on_click_move_option(option_obj, -1)}
                      >
                        <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <button
                        class="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-[#4B0055] hover:text-[#4B0055] disabled:cursor-not-allowed disabled:opacity-40"
                        type="button"
                        aria-label={`${option_obj.option_name} 아래로 이동`}
                        disabled={option_index === category_group_obj.option_arr.length - 1}
                        onclick={() => on_click_move_option(option_obj, 1)}
                      >
                        <ArrowDown size={18} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <button
                        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-4 text-sm font-extrabold text-white transition hover:bg-[#65006F]"
                        type="button"
                        onclick={() => on_click_save_option(option_obj)}
                      >
                        <Save size={16} strokeWidth={2.3} aria-hidden="true" />
                        <span>저장</span>
                      </button>
                      <button
                        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-sm font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                        type="button"
                        onclick={() => on_click_delete_option(option_obj)}
                      >
                        <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </article>
                {/each}
              </div>
            {:else}
              <div class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-[#FAFBFC] px-6 py-8 text-center text-sm font-bold text-slate-500">
                등록된 추천 옵션이 없습니다.
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </section>
</AdminLayout>
