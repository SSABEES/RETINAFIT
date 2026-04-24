<script>
  import { onMount } from 'svelte'
  import { ChevronDown } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import { get_all_glasses } from '@/lib/api/glasses'

  const g_glass_dropdown_arr = [
    { key: 'category', label: '카테고리', option_arr: ['안경', '선글라스', '스포츠'] },
    { key: 'frame_style', label: '프레임 스타일', option_arr: ['풀프레임', '하프프레임', '무테프레임'] },
    { key: 'frame_type', label: '프레임 타입', option_arr: ['뿔테', '메탈', '하금테', '무테', '혼합'] },
    { key: 'material', label: '소재', option_arr: ['아세테이트', '메탈', '티타늄', '혼합'] },
  ]

  const g_metric_field_arr = [
    { key: 'frame_width', label: '프레임 전체 너비', placeholder: '142' },
    { key: 'lens_width', label: '렌즈 너비', placeholder: '52' },
    { key: 'bridge_width', label: '브릿지 너비', placeholder: '18' },
    { key: 'lens_height', label: '렌즈 높이', placeholder: '42' },
    { key: 'temple_length', label: '템플 길이', placeholder: '145' },
  ]

  function create_glass_form() {
    return {
      glasses_name: '',
      glasses_brand: '',
      glasses_img_file: null,
      glasses_img_name: '',
      is_active: true,
      category: '안경',
      frame_style: '풀프레임',
      frame_type: '뿔테',
      material: '아세테이트',
      color: '',
      model_code: '',
      price: '',
      frame_width: '',
      lens_width: '',
      bridge_width: '',
      lens_height: '',
      temple_length: '',
      fit_note: '',
    }
  }

  let ref_glass_saved_message = $state('')
  let ref_glass_list_arr = $state([])
  let ref_selected_glass_id = $state('')
  let ref_glass_editor_open = $state(false)
  let ref_open_glass_dropdown_key = $state('')
  let ref_glass_img_preview_url = $state('')
  let ref_glass_form_obj = $state(create_glass_form())

  onMount(async () => {
    try {
      ref_glass_list_arr = await get_all_glasses()
    } catch {
      ref_glass_list_arr = []
    }
  })

  function reset_glass_form() {
    if (ref_glass_img_preview_url?.startsWith('blob:')) {
      URL.revokeObjectURL(ref_glass_img_preview_url)
    }

    ref_selected_glass_id = ''
    ref_open_glass_dropdown_key = ''
    ref_glass_img_preview_url = ''
    ref_glass_form_obj = create_glass_form()
    ref_glass_saved_message = ''
  }

  function on_click_open_glass_create() {
    reset_glass_form()
    ref_glass_editor_open = true
  }

  function on_click_close_glass_editor() {
    ref_glass_editor_open = false
    ref_open_glass_dropdown_key = ''
    ref_glass_saved_message = ''
  }

  function on_click_toggle_glass_dropdown(dropdown_key) {
    ref_open_glass_dropdown_key = ref_open_glass_dropdown_key === dropdown_key ? '' : dropdown_key
  }

  function on_click_select_glass_dropdown(field_key, option_value) {
    ref_glass_form_obj[field_key] = option_value
    ref_open_glass_dropdown_key = ''
  }

  function on_change_glass_image_file(local_event) {
    const local_file = /** @type {HTMLInputElement} */ (local_event.currentTarget).files?.[0] ?? null

    if (!local_file) {
      if (ref_glass_img_preview_url?.startsWith('blob:')) {
        URL.revokeObjectURL(ref_glass_img_preview_url)
      }
      ref_glass_img_preview_url = ''
      ref_glass_form_obj.glasses_img_file = null
      ref_glass_form_obj.glasses_img_name = ''
      return
    }

    const local_allowed_type_arr = ['image/jpeg', 'image/png']
    if (!local_allowed_type_arr.includes(local_file.type)) {
      ref_glass_saved_message = '대표 이미지는 JPG 또는 PNG 파일만 선택할 수 있습니다.'
      return
    }

    if (ref_glass_img_preview_url?.startsWith('blob:')) {
      URL.revokeObjectURL(ref_glass_img_preview_url)
    }

    ref_glass_img_preview_url = URL.createObjectURL(local_file)
    ref_glass_form_obj.glasses_img_file = local_file
    ref_glass_form_obj.glasses_img_name = local_file.name
    ref_glass_saved_message = ''
  }

  function on_click_edit_glass(glass_obj) {
    ref_selected_glass_id = glass_obj.id
    ref_glass_editor_open = true
    ref_open_glass_dropdown_key = ''
    ref_glass_form_obj = {
      ...create_glass_form(),
      glasses_name: glass_obj.model ?? '',
      glasses_brand: glass_obj.brand ?? '',
      glasses_img_name: glass_obj.model ? `${glass_obj.model}.png` : '',
      category: glass_obj.category ?? '안경',
      frame_style: glass_obj.frame_style ?? '풀프레임',
      frame_type: glass_obj.frame_type ?? '뿔테',
      material: glass_obj.material ?? '아세테이트',
      price: glass_obj.price ?? '',
    }
    ref_glass_img_preview_url = glass_obj.img_url ?? ''
    ref_glass_saved_message = `${glass_obj.brand ?? ''} ${glass_obj.model ?? ''} 정보를 불러왔습니다.`
  }

  function get_glass_payload_obj() {
    return {
      id: ref_selected_glass_id || `glass-${Date.now()}`,
      brand: ref_glass_form_obj.glasses_brand.trim(),
      model: ref_glass_form_obj.glasses_name.trim(),
      price: ref_glass_form_obj.price.trim(),
      frame_type: ref_glass_form_obj.frame_type,
      frame_style: ref_glass_form_obj.frame_style,
      material: ref_glass_form_obj.material,
      category: ref_glass_form_obj.category,
      img_url: ref_glass_img_preview_url || 'https://placehold.co/640x480/F5EAF7/AA83B4?text=GLASS',
    }
  }

  function on_submit_glass_form(local_event) {
    local_event.preventDefault()

    if (!ref_glass_img_preview_url) {
      ref_glass_saved_message = '대표 이미지를 먼저 선택해주세요.'
      return
    }

    const local_glass_obj = get_glass_payload_obj()
    const local_exist_index = ref_glass_list_arr.findIndex((glass_obj) => glass_obj.id === local_glass_obj.id)

    if (local_exist_index >= 0) {
      ref_glass_list_arr = ref_glass_list_arr.map((glass_obj, glass_index) =>
        glass_index === local_exist_index ? { ...glass_obj, ...local_glass_obj } : glass_obj,
      )
      ref_glass_saved_message = '안경 정보를 수정했습니다.'
      return
    }

    ref_glass_list_arr = [local_glass_obj, ...ref_glass_list_arr]
    ref_selected_glass_id = local_glass_obj.id
    ref_glass_saved_message = '안경 정보를 추가했습니다.'
  }
</script>

<AdminLayout active_key="glass">
  {#if !ref_glass_editor_open}
    <section class="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50">
      <div class="flex items-center justify-between gap-4">
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">안경 정보</h2>
        <span class="rounded-full bg-[#F5EAF7] px-3 py-1 text-sm font-extrabold text-[#4B0055]">
          총 {ref_glass_list_arr.length}개
        </span>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <button
          class="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border border-dashed border-[#D8C6E0] bg-[#FAF7FC] text-[#4B0055] transition hover:border-[#4B0055] hover:bg-[#F8F1F8]"
          type="button"
          onclick={on_click_open_glass_create}
        >
          <div class="grid justify-items-center gap-3">
            <span class="grid h-16 w-16 place-items-center rounded-full bg-white text-4xl font-light shadow-sm">+</span>
            <span class="text-base font-extrabold">안경 추가</span>
          </div>
        </button>

        {#each ref_glass_list_arr as glass_obj (glass_obj.id)}
          <button
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-[#D8C6E0] hover:shadow-sm"
            type="button"
            onclick={() => on_click_edit_glass(glass_obj)}
          >
            <div class="aspect-[4/3] bg-[#F7F1F9]">
              <img
                src={glass_obj.img_url}
                alt={`${glass_obj.brand} ${glass_obj.model}`}
                class="h-full w-full object-cover"
              />
            </div>
            <div class="px-5 py-4">
              <p class="m-0 text-lg font-extrabold text-zinc-950">{glass_obj.model}</p>
              <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">{glass_obj.brand}</p>
            </div>
          </button>
        {/each}
      </div>
    </section>
  {:else}
    <form class="grid gap-6" onsubmit={on_submit_glass_form}>
      <div class="flex items-start justify-between gap-6">
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">
          {ref_selected_glass_id ? '안경 수정' : '안경 추가'}
        </h2>

        <div class="flex items-center gap-3">
          <button
            class="min-h-12 cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-base font-extrabold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onclick={on_click_close_glass_editor}
          >
            목록으로
          </button>

          <button
            class="min-h-12 cursor-pointer rounded-xl border-0 bg-[#4B0055] px-7 text-base font-extrabold text-white transition hover:bg-[#65006F]"
            type="submit"
          >
            {ref_selected_glass_id ? '수정 저장' : '등록 저장'}
          </button>
        </div>
      </div>

      {#if ref_glass_saved_message}
        <p class="rounded-xl border border-[#D6BBFB] bg-[#F8F1FF] px-5 py-3 text-left text-base font-bold text-[#6B21A8]">
          {ref_glass_saved_message}
        </p>
      {/if}

      <section class="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm shadow-slate-200/50">
        <div class="flex justify-end">
          <div class="grid min-h-12 grid-cols-2 gap-2 rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] p-1">
            <button
              class={`cursor-pointer rounded-[10px] px-4 text-sm font-extrabold transition ${
                ref_glass_form_obj.is_active
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-transparent text-slate-500 hover:bg-white hover:text-zinc-950'
              }`}
              type="button"
              onclick={() => on_click_select_glass_dropdown('is_active', true)}
            >
              활성화
            </button>

            <button
              class={`cursor-pointer rounded-[10px] px-4 text-sm font-extrabold transition ${
                !ref_glass_form_obj.is_active
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-transparent text-slate-500 hover:bg-white hover:text-zinc-950'
              }`}
              type="button"
              onclick={() => on_click_select_glass_dropdown('is_active', false)}
            >
              비활성화
            </button>
          </div>
        </div>

        <div class="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div class="grid content-start gap-2">
            <span class="text-sm font-extrabold text-slate-500">안경 대표 이미지 파일</span>

            <div class="overflow-hidden rounded-2xl border border-dashed border-[#D8C6E0] bg-[#FAF7FC]">
              <div class="aspect-[4/3] bg-[linear-gradient(180deg,#F8F1F8_0%,#F3F4F6_100%)]">
                {#if ref_glass_img_preview_url}
                  <img
                    src={ref_glass_img_preview_url}
                    alt="선택한 안경 대표 이미지"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class="grid h-full place-items-center px-6 text-center">
                    <div>
                      <p class="m-0 text-sm font-extrabold text-[#4B0055]">4:3 이미지 영역</p>
                      <p class="mt-2 mb-0 text-sm font-semibold text-slate-500">
                        JPG 또는 PNG 파일을 올리면 여기에 표시됩니다.
                      </p>
                    </div>
                  </div>
                {/if}
              </div>

              <div class="border-t border-[#E8DAEE] px-4 py-4">
                <input
                  class="block min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-zinc-950 outline-none file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#4B0055] file:px-4 file:py-2 file:text-sm file:font-extrabold file:text-white hover:file:bg-[#65006F]"
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onchange={on_change_glass_image_file}
                />
              </div>
            </div>
          </div>

          <div class="grid min-w-0 gap-5 md:grid-cols-2">
            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500 md:col-span-2">
              제품명
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                type="text"
                bind:value={ref_glass_form_obj.glasses_name}
                placeholder="예: 쿠보 01"
                required
              />
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500 md:col-span-2">
              브랜드명
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                type="text"
                bind:value={ref_glass_form_obj.glasses_brand}
                placeholder="예: 젠틀몬스터"
                required
              />
            </label>

            {#each g_glass_dropdown_arr as dropdown_obj (dropdown_obj.key)}
              <div class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
                {dropdown_obj.label}

                <div class="relative">
                  <button
                    class="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[#4B0055] transition hover:border-[#4B0055]/35 hover:bg-white"
                    type="button"
                    onclick={() => on_click_toggle_glass_dropdown(dropdown_obj.key)}
                  >
                    <span>{ref_glass_form_obj[dropdown_obj.key]}</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2.4}
                      class={`transition ${ref_open_glass_dropdown_key === dropdown_obj.key ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {#if ref_open_glass_dropdown_key === dropdown_obj.key}
                    <div class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                      {#each dropdown_obj.option_arr as option_name}
                        <button
                          class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                            ref_glass_form_obj[dropdown_obj.key] === option_name
                              ? 'bg-[#F5EAF7] text-[#4B0055]'
                              : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[#4B0055]'
                          }`}
                          type="button"
                          onclick={() => on_click_select_glass_dropdown(dropdown_obj.key, option_name)}
                        >
                          {option_name}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              컬러
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                type="text"
                bind:value={ref_glass_form_obj.color}
                placeholder="예: 블랙"
              />
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              모델 코드
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                type="text"
                bind:value={ref_glass_form_obj.model_code}
                placeholder="예: RB5154"
              />
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              가격
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                type="text"
                bind:value={ref_glass_form_obj.price}
                placeholder="예: 159,000원"
              />
            </label>

            {#each g_metric_field_arr as metric_obj (metric_obj.key)}
              <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
                {metric_obj.label}
                <div class="flex items-center rounded-xl border border-slate-200 bg-white px-4">
                  <input
                    class="min-h-12 min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-zinc-950 outline-none"
                    type="number"
                    min="0"
                    bind:value={ref_glass_form_obj[metric_obj.key]}
                    placeholder={metric_obj.placeholder}
                  />
                  <span class="text-sm font-bold text-slate-400">mm</span>
                </div>
              </label>
            {/each}

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500 md:col-span-2">
              피팅 메모
              <textarea
                class="min-h-[120px] rounded-xl border border-slate-200 px-4 py-3 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                bind:value={ref_glass_form_obj.fit_note}
                placeholder="예: 얼굴 너비 대비 안정적인 비율, 장시간 착용 적합"
              ></textarea>
            </label>
          </div>
        </div>
      </section>
    </form>
  {/if}
</AdminLayout>
