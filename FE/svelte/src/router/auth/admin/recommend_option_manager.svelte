<script>
  import { onMount } from 'svelte'
  import { ChevronDown, GripVertical, Plus, Save, Trash2 } from 'lucide-svelte'
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

  let {
    active_key = 'lens',
    page_title = '추천 옵션 설정',
    page_description = '',
    category_meta_arr = [],
  } = /** @type {RecommendOptionManagerProps} */ ($props())

  let g_has_category = $derived(category_meta_arr.length > 0)

  function get_default_option_category() {
    return category_meta_arr[0]?.key ?? ''
  }

  function create_option_form_obj() {
    return {
      option_name: '',
      option_category: get_default_option_category(),
      is_active: true,
    }
  }

  let ref_option_form_obj = $state(create_option_form_obj())
  let ref_option_arr = $state([])
  let ref_option_category_dropdown_open = $state(false)
  let g_feedback_message = $state('')
  let g_error_message = $state('')
  let g_is_loading = $state(false)
  let g_toast_message = $state('')
  let g_toast_variant = $state('success')
  let g_toast_timer = null
  let ref_drag_option_no = $state(null)
  let ref_drag_over_option_no = $state(null)

  let g_filtered_option_arr = $derived(
    ref_option_arr
      .filter((option_obj) =>
        g_has_category
          ? category_meta_arr.some(
              (category_meta_obj) => category_meta_obj.key === option_obj.option_category,
            )
          : true,
      )
      .sort(
        (left_option_obj, right_option_obj) =>
          left_option_obj.display_order - right_option_obj.display_order,
      ),
  )

  let g_grouped_option_arr = $derived(
    g_has_category
      ? category_meta_arr.map((category_meta_obj) => ({
          ...category_meta_obj,
          option_arr: g_filtered_option_arr.filter(
            (option_obj) => option_obj.option_category === category_meta_obj.key,
          ),
        }))
      : [
          {
            key: 'all',
            label: '옵션 목록',
            option_arr: g_filtered_option_arr,
          },
        ],
  )

  function normalize_option_arr(option_arr) {
    return option_arr.map((option_obj) => ({
      option_no: Number(option_obj.option_no ?? 0),
      option_name: String(option_obj.option_name ?? ''),
      option_category: String(option_obj.option_category ?? ''),
      display_order: Number(option_obj.display_order ?? 0),
      is_active: Boolean(option_obj.is_active),
    }))
  }

  function show_toast(message, variant = 'success') {
    g_toast_message = message
    g_toast_variant = variant

    if (g_toast_timer) {
      clearTimeout(g_toast_timer)
    }

    g_toast_timer = setTimeout(() => {
      g_toast_message = ''
      g_toast_timer = null
    }, 2200)
  }

  async function load_option_arr() {
    g_is_loading = true
    g_error_message = ''

    try {
      const local_option_arr = await get_recommend_option_arr()
      ref_option_arr = normalize_option_arr(Array.isArray(local_option_arr) ? local_option_arr : [])
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '추천 옵션 조회 중 오류가 발생했습니다.'
      show_toast(g_error_message, 'error')
    } finally {
      g_is_loading = false
    }
  }

  function reset_option_form() {
    ref_option_form_obj = create_option_form_obj()
    ref_option_category_dropdown_open = false
  }

  function on_input_option_name(local_event) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      option_name: /** @type {HTMLInputElement} */ (local_event.currentTarget).value,
    }
    g_feedback_message = ''
    g_error_message = ''
  }

  function on_click_toggle_option_category_dropdown() {
    ref_option_category_dropdown_open = !ref_option_category_dropdown_open
  }

  function on_click_select_option_category(option_category) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      option_category,
    }
    ref_option_category_dropdown_open = false
    g_feedback_message = ''
    g_error_message = ''
  }

  function on_change_option_active(local_event) {
    ref_option_form_obj = {
      ...ref_option_form_obj,
      is_active: /** @type {HTMLInputElement} */ (local_event.currentTarget).checked,
    }
    g_feedback_message = ''
    g_error_message = ''
  }

  async function on_submit_create_option(local_event) {
    local_event.preventDefault()

    const local_option_name = ref_option_form_obj.option_name.trim()
    const local_option_category = g_has_category ? ref_option_form_obj.option_category : ''
    const local_group_option_arr = g_filtered_option_arr.filter((option_obj) =>
      g_has_category ? option_obj.option_category === local_option_category : true,
    )

    if (!local_option_name) {
      g_error_message = '옵션명을 입력해 주세요.'
      show_toast(g_error_message, 'error')
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
      show_toast(g_feedback_message)
      reset_option_form()
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '추천 옵션 추가 중 오류가 발생했습니다.'
      show_toast(g_error_message, 'error')
    }
  }

  async function on_click_save_option(option_obj) {
    const local_option_name = option_obj.option_name.trim()

    if (!local_option_name) {
      g_error_message = '옵션명은 비워둘 수 없습니다.'
      show_toast(g_error_message, 'error')
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
      show_toast(g_feedback_message)
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '추천 옵션 수정 중 오류가 발생했습니다.'
      show_toast(g_error_message, 'error')
    }
  }

  async function on_click_delete_option(option_obj) {
    try {
      await delete_recommend_option({
        option_no: option_obj.option_no,
      })

      g_feedback_message = '추천 옵션을 삭제했습니다.'
      show_toast(g_feedback_message)
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '추천 옵션 삭제 중 오류가 발생했습니다.'
      show_toast(g_error_message, 'error')
    }
  }

  function on_dragstart_option(option_obj) {
    ref_drag_option_no = option_obj.option_no
    ref_drag_over_option_no = option_obj.option_no
  }

  function on_dragenter_option(option_obj) {
    ref_drag_over_option_no = option_obj.option_no
  }

  function on_dragover_option(local_event, option_obj) {
    local_event.preventDefault()
    ref_drag_over_option_no = option_obj.option_no
  }

  function reset_drag_option_state() {
    ref_drag_option_no = null
    ref_drag_over_option_no = null
  }

  async function on_drop_option(target_option_obj) {
    const local_drag_option_no = ref_drag_option_no

    if (!local_drag_option_no || local_drag_option_no === target_option_obj.option_no) {
      reset_drag_option_state()
      return
    }

    const local_same_group_option_arr = g_filtered_option_arr.filter((filtered_option_obj) =>
      g_has_category
        ? filtered_option_obj.option_category === target_option_obj.option_category
        : true,
    )
    const local_drag_index = local_same_group_option_arr.findIndex(
      (filtered_option_obj) => filtered_option_obj.option_no === local_drag_option_no,
    )
    const local_target_index = local_same_group_option_arr.findIndex(
      (filtered_option_obj) => filtered_option_obj.option_no === target_option_obj.option_no,
    )

    if (local_drag_index < 0 || local_target_index < 0) {
      reset_drag_option_state()
      return
    }

    const local_reordered_option_arr = [...local_same_group_option_arr]
    const [local_drag_option_obj] = local_reordered_option_arr.splice(local_drag_index, 1)
    local_reordered_option_arr.splice(local_target_index, 0, local_drag_option_obj)

    try {
      await Promise.all(
        local_reordered_option_arr.map((option_obj, option_index) =>
          update_recommend_option_order({
            option_no: option_obj.option_no,
            display_order: option_index,
          }),
        ),
      )

      g_feedback_message = '표시 순서를 변경했습니다.'
      show_toast(g_feedback_message)
      await load_option_arr()
    } catch (local_error) {
      g_error_message =
        local_error instanceof Error
          ? local_error.message
          : '표시 순서 변경 중 오류가 발생했습니다.'
      show_toast(g_error_message, 'error')
    } finally {
      reset_drag_option_state()
    }
  }

  onMount(() => {
    load_option_arr()
  })
</script>

<AdminLayout {active_key}>
  <section class="grid gap-6">
    {#if g_toast_message}
      <div class="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
        <div
          class={`rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] ${
            g_toast_variant === 'error' ? 'bg-[#B42318]' : 'bg-[#4B0055]'
          }`}
        >
          {g_toast_message}
        </div>
      </div>
    {/if}

    <div class="flex items-start justify-between gap-6">
      <div>
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{page_title}</h2>
        {#if page_description}
          <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">{page_description}</p>
        {/if}
      </div>
    </div>

    <form
      class={`grid gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50 ${
        g_has_category ? 'md:grid-cols-[1fr_220px_140px_auto]' : 'md:grid-cols-[1fr_140px_auto]'
      }`}
      onsubmit={on_submit_create_option}
    >
      <label class="grid gap-2 text-sm font-extrabold text-slate-500">
        옵션명
        <input
          class="min-h-12 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
          type="text"
          value={ref_option_form_obj.option_name}
          placeholder="추천 옵션명"
          oninput={on_input_option_name}
        />
      </label>

      {#if g_has_category}
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
                {category_meta_arr.find(
                  (category_meta_obj) =>
                    category_meta_obj.key === ref_option_form_obj.option_category,
                )?.label ?? '카테고리 선택'}
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
      {/if}

      <label class="grid gap-2 text-sm font-extrabold text-slate-500">
        사용 여부
        <span class="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4">
          <input
            class="h-4 w-4 accent-[#4B0055]"
            type="checkbox"
            checked={ref_option_form_obj.is_active}
            onchange={on_change_option_active}
          />
          <span class="text-base font-bold text-zinc-950">활성</span>
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
      <div
        class="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center text-base font-bold text-slate-500 shadow-sm shadow-slate-200/50"
      >
        추천 옵션을 불러오는 중입니다.
      </div>
    {:else}
      <div class="grid gap-6">
        {#each g_grouped_option_arr as category_group_obj (category_group_obj.key)}
          <section
            class="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="m-0 text-xl font-extrabold text-zinc-950">{category_group_obj.label}</h3>
                <p class="mb-0 mt-2 text-sm font-semibold text-slate-500">
                  총 {category_group_obj.option_arr.length}개 옵션
                </p>
              </div>
            </div>

            {#if category_group_obj.option_arr.length > 0}
              <div class="mt-6 grid gap-4">
                {#each category_group_obj.option_arr as option_obj (option_obj.option_no)}
                  <article
                    class={`grid gap-4 rounded-2xl border px-5 py-5 transition lg:grid-cols-[auto_1fr_140px_auto] lg:items-center ${
                      ref_drag_over_option_no === option_obj.option_no
                        ? 'border-[#4B0055] bg-[#F8F1F8]'
                        : 'border-[#E9E8F0] bg-[#FAFBFC]'
                    }`}
                    draggable="true"
                    ondragstart={() => on_dragstart_option(option_obj)}
                    ondragenter={() => on_dragenter_option(option_obj)}
                    ondragover={(local_event) => on_dragover_option(local_event, option_obj)}
                    ondrop={() => on_drop_option(option_obj)}
                    ondragend={reset_drag_option_state}
                  >
                    <div
                      class="grid place-items-center self-stretch rounded-xl border border-[#EFE7F2] bg-white px-3 text-slate-400"
                    >
                      <GripVertical size={18} strokeWidth={2.2} aria-hidden="true" />
                    </div>

                    <div class="grid gap-2">
                      <input
                        class="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold text-zinc-950 outline-none transition focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                        type="text"
                        bind:value={option_obj.option_name}
                      />
                    </div>

                    <label class="grid text-sm font-extrabold text-slate-500">
                      <span
                        class="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4"
                      >
                        <input
                          class="h-4 w-4 accent-[#4B0055]"
                          type="checkbox"
                          bind:checked={option_obj.is_active}
                        />
                        <span class="text-base font-bold text-zinc-950">
                          {option_obj.is_active ? '활성' : '비활성화'}
                        </span>
                      </span>
                    </label>

                    <div class="flex flex-wrap items-center justify-end gap-2">
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
              <div
                class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-[#FAFBFC] px-6 py-8 text-center text-sm font-bold text-slate-500"
              >
                등록된 추천 옵션이 없습니다.
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </section>
</AdminLayout>
