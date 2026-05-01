<script>
  import { onMount } from 'svelte'
  import { ChevronDown } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import {
    create_admin_glasses,
    delete_admin_glasses,
    get_admin_glasses_3d_presigned_url,
    get_admin_glasses_arr,
    get_admin_glasses_img_presigned_url,
    get_uploaded_file_url,
    upload_admin_glasses_file,
    update_admin_glasses,
  } from '@/lib/api/admin_glasses'

  /**
   * @typedef {{ label: string, value: string }} GlassDropdownOption
   * @typedef {{ key: string, label: string, option_arr: Array<string | GlassDropdownOption> }} GlassDropdown
   */

  /** @type {GlassDropdown[]} */
  const g_glass_dropdown_arr = [
    { key: 'category', label: '카테고리', option_arr: ['안경', '선글라스', '스포츠'] },
    {
      key: 'frame_style',
      label: '프레임 스타일',
      option_arr: ['풀프레임', '하프프레임', '무테프레임'],
    },
    {
      key: 'frame_type',
      label: '프레임 타입',
      option_arr: ['뿔테', '메탈', '티타늄', '무테', '혼합'],
    },
    { key: 'material', label: '재질', option_arr: ['아세테이트', '메탈', '티타늄', '혼합'] },
  ]

  const g_metric_field_arr = [
    { key: 'frame_width', label: '프레임 전체 너비', placeholder: '142' },
    { key: 'lens_width', label: '렌즈 너비', placeholder: '52' },
    { key: 'bridge_width', label: '브리지 너비', placeholder: '18' },
    { key: 'lens_height', label: '렌즈 높이', placeholder: '42' },
    { key: 'temple_length', label: '템플 길이', placeholder: '145' },
  ]

  const g_glass_placeholder_image_url = 'https://placehold.co/640x480/F5EAF7/AA83B4?text=GLASS'
  const g_frame_style_option_arr = [
    { label: '라운드', value: 'round' },
    { label: '오벌', value: 'oval' },
    { label: '스퀘어', value: 'square' },
    { label: '직사각형', value: 'rectangle' },
    { label: '보잉', value: 'aviator' },
    { label: '캣아이', value: 'cat_eye' },
    { label: '브로우라인', value: 'browline' },
    { label: '기하학', value: 'geometric' },
    { label: '오버사이즈', value: 'oversized' },
    { label: '림리스', value: 'rimless' },
  ]

  g_glass_dropdown_arr[1].option_arr = g_frame_style_option_arr

  // ??뉕펾 ?源낆쨯????륁젟???⑤벏???곗쨮 ?怨뺣뮉 疫꿸퀡????낆젾 ?怨밴묶??筌띾슢諭??
  function create_glass_form() {
    return {
      glasses_name: '',
      glasses_brand: '레티나',
      glasses_img_url: '',
      glasses_3d_url: '',
      is_active: true,
      category: '안경',
      frame_style: 'round',
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

  /**
   * ??ъ쁽 ??낆젾揶쏅?????뉕펾 ??쎈읃 ???關????ъ쁽 ?癒?뮉 null嚥??類ｂ봺??뺣뼄.
   * @param {string | number | null | undefined} input_value
   */
  function get_numeric_or_null(input_value) {
    const local_trimmed_value = String(input_value ?? '').trim()

    if (!local_trimmed_value) return null

    const local_number = Number(local_trimmed_value)
    return Number.isFinite(local_number) ? local_number : null
  }

  // ??뺚댘??쇱뒲 ????揶쏅?????곌볼????쑨??揶쎛?館釉??얜챷???揶쏅??앮에??類ｂ봺??뺣뼄.
  function get_glass_dropdown_option_value(option_obj) {
    return typeof option_obj === 'string' ? option_obj : option_obj.value
  }

  // ??뺚댘??쇱뒲 ????揶쏅????遺얇늺??癰귣똻肉т빳???곌볼 ?얜챷???以??類ｂ봺??뺣뼄.
  function get_glass_dropdown_option_label(option_obj) {
    return typeof option_obj === 'string' ? option_obj : option_obj.label
  }

  // ?袁⑹삺 ?醫뤾문????뺚댘??쇱뒲 揶쏅????遺얇늺 ??뽯뻻????곌볼嚥?癰궰??묐립??
  function get_glass_dropdown_selected_label(dropdown_obj, selected_value) {
    const local_option_obj = dropdown_obj.option_arr.find(
      (option_obj) => get_glass_dropdown_option_value(option_obj) === selected_value,
    )

    return local_option_obj
      ? get_glass_dropdown_option_label(local_option_obj)
      : String(selected_value ?? '')
  }

  // ??뉕펾 筌롫??揶쏅????귐딅뮞??獄쏄퀣? ??곌볼嚥?癰궰??묐립??
  function get_glass_meta_label(dropdown_key, selected_value) {
    const local_dropdown_obj = g_glass_dropdown_arr.find(
      (dropdown_obj) => dropdown_obj.key === dropdown_key,
    )

    if (!local_dropdown_obj) {
      return String(selected_value ?? '')
    }

    return get_glass_dropdown_selected_label(local_dropdown_obj, selected_value)
  }

  /**
   * ?온?귐딆쁽 ??뉕펾 API ?臾먮뼗???袁⑹삺 ?遺얇늺?癒?퐣 獄쏅뗀以??怨뚮┛ ?????類κ묶嚥??類?뇣?酉釉??
   * @param {Record<string, any>} glass_obj
   */
  function normalize_admin_glass_obj(glass_obj) {
    const local_spec_obj = glass_obj.glasses_spec_json ?? {}

    return {
      glasses_no: glass_obj.glasses_no,
      glasses_name: glass_obj.glasses_name ?? '',
      glasses_brand: glass_obj.glasses_brand ?? '',
      glasses_img_url: glass_obj.glasses_img_url ?? '',
      glasses_3d_url: glass_obj.glasses_3d_url ?? '',
      is_active: Boolean(glass_obj.is_active),
      created_at: glass_obj.created_at ?? '',
      category: local_spec_obj.category ?? '안경',
      frame_style: local_spec_obj.frame_style ?? 'round',
      frame_type: local_spec_obj.frame_type ?? '뿔테',
      material: local_spec_obj.material ?? '아세테이트',
      color: local_spec_obj.color ?? '',
      model_code: local_spec_obj.model_code ?? '',
      price: local_spec_obj.price ?? '',
      frame_width: local_spec_obj.frame_width ?? '',
      lens_width: local_spec_obj.lens_width ?? '',
      bridge_width: local_spec_obj.bridge_width ?? '',
      lens_height: local_spec_obj.lens_height ?? '',
      temple_length: local_spec_obj.temple_length ?? '',
      fit_note: local_spec_obj.fit_note ?? '',
    }
  }

  // ?袁⑹삺 ???怨밴묶???온?귐딆쁽 ??뉕펾 ?源낆쨯/??륁젟 API 獄쏅뗀逾??닌듼쒏에?癰궰??묐립??
  function get_admin_glass_payload_obj() {
    return {
      glasses_name: ref_glass_form_obj.glasses_name.trim(),
      glasses_brand: ref_glass_form_obj.glasses_brand.trim(),
      glasses_img_url: ref_glass_form_obj.glasses_img_url.trim(),
      glasses_3d_url: ref_glass_form_obj.glasses_3d_url.trim(),
      glasses_spec_json: {
        category: ref_glass_form_obj.category,
        frame_style: ref_glass_form_obj.frame_style,
        frame_type: ref_glass_form_obj.frame_type,
        material: ref_glass_form_obj.material,
        color: ref_glass_form_obj.color.trim(),
        model_code: ref_glass_form_obj.model_code.trim(),
        price: ref_glass_form_obj.price.trim(),
        frame_width: get_numeric_or_null(ref_glass_form_obj.frame_width),
        lens_width: get_numeric_or_null(ref_glass_form_obj.lens_width),
        bridge_width: get_numeric_or_null(ref_glass_form_obj.bridge_width),
        lens_height: get_numeric_or_null(ref_glass_form_obj.lens_height),
        temple_length: get_numeric_or_null(ref_glass_form_obj.temple_length),
        fit_note: ref_glass_form_obj.fit_note.trim(),
      },
      is_active: ref_glass_form_obj.is_active,
    }
  }

  let ref_glass_saved_message = $state('')
  let ref_glass_error_message = $state('')
  let ref_glass_list_loading = $state(false)
  let ref_glass_submit_loading = $state(false)
  let ref_glass_delete_loading = $state(false)
  let ref_glass_list_arr = $state([])
  let ref_glass_list_category_filter = $state('all')
  let ref_glass_list_frame_style_filter = $state('all')
  let ref_glass_list_material_filter = $state('all')
  let ref_selected_glasses_no = $state(null)
  let ref_glass_editor_open = $state(false)
  let ref_glass_editor_component = $state(null)
  let ref_glass_editor_component_promise = $state(null)
  let ref_open_glass_dropdown_key = $state('')
  let ref_glass_form_obj = $state(create_glass_form())
  let ref_glass_img_file_obj = $state(/** @type {File | null} */ (null))
  let ref_glass_3d_file_obj = $state(/** @type {File | null} */ (null))
  let ref_glass_preview_override_url = $state('')

  let g_glass_preview_url = $derived(
    ref_glass_preview_override_url ||
      ref_glass_form_obj.glasses_img_url.trim() ||
      g_glass_placeholder_image_url,
  )
  let g_filtered_glass_list_arr = $derived(
    ref_glass_list_arr.filter((local_glass_obj) => {
      const local_is_category_match =
        ref_glass_list_category_filter === 'all' ||
        local_glass_obj.category === ref_glass_list_category_filter
      const local_is_frame_style_match =
        ref_glass_list_frame_style_filter === 'all' ||
        local_glass_obj.frame_style === ref_glass_list_frame_style_filter
      const local_is_material_match =
        ref_glass_list_material_filter === 'all' ||
        local_glass_obj.material === ref_glass_list_material_filter

      return local_is_category_match && local_is_frame_style_match && local_is_material_match
    }),
  )

  onMount(() => {
    on_load_admin_glass_arr()
  })

  async function ensure_glass_editor_component() {
    if (ref_glass_editor_component) {
      return ref_glass_editor_component
    }

    if (!ref_glass_editor_component_promise) {
      ref_glass_editor_component_promise = import('@/router/auth/admin/create_glass.svelte')
        .then((local_module) => {
          ref_glass_editor_component = local_module.default
          return local_module.default
        })
        .catch((local_error) => {
          ref_glass_editor_component_promise = null
          throw local_error
        })
    }

    return ref_glass_editor_component_promise
  }

  // ?온?귐딆쁽 ??뉕펾 筌뤴뫖以??筌ㅼ뮇???怨밴묶嚥???쇰뻻 鈺곌퀬???뺣뼄.
  async function on_load_admin_glass_arr() {
    ref_glass_list_loading = true
    ref_glass_error_message = ''

    try {
      const local_glass_arr = await get_admin_glasses_arr()
      ref_glass_list_arr = [...(local_glass_arr ?? [])]
        .map(normalize_admin_glass_obj)
        .sort(
          (local_left_glass_obj, local_right_glass_obj) =>
            new Date(local_right_glass_obj.created_at || 0).getTime() -
            new Date(local_left_glass_obj.created_at || 0).getTime(),
        )
    } catch (local_error) {
      ref_glass_list_arr = []
      ref_glass_error_message =
        local_error instanceof Error ? local_error.message : '안경 목록을 불러오지 못했습니다.'
    } finally {
      ref_glass_list_loading = false
    }
  }

  // ?袁⑹삺 ?紐꾩춿 ??깆뱽 ?醫됲뇣 ?源낆쨯 ?怨밴묶嚥???롫즼?깃퀡??
  function reset_glass_form() {
    ref_selected_glasses_no = null
    ref_open_glass_dropdown_key = ''
    ref_glass_form_obj = create_glass_form()
    ref_glass_img_file_obj = null
    ref_glass_3d_file_obj = null
    ref_glass_preview_override_url = ''
    ref_glass_saved_message = ''
    ref_glass_error_message = ''
  }

  // ??뉕펾 ?곕떽? ?遺얇늺??곗쨮 ?袁れ넎??뺣뼄.
  function on_click_open_glass_create() {
    reset_glass_form()
    ref_glass_editor_open = true
    void ensure_glass_editor_component()
  }

  // ?紐꾩춿 ?遺얇늺????ろ?筌뤴뫖以??遺얇늺??곗쨮 ???툡揶쏄쑬??
  function on_click_close_glass_editor() {
    ref_glass_editor_open = false
    ref_open_glass_dropdown_key = ''
    ref_glass_img_file_obj = null
    ref_glass_3d_file_obj = null
    ref_glass_preview_override_url = ''
    ref_glass_saved_message = ''
    ref_glass_error_message = ''
  }

  // ?뚣끉??? ??뺚댘??쇱뒲???????怨밴묶???袁れ넎??뺣뼄.
  function on_click_toggle_glass_dropdown(dropdown_key) {
    ref_open_glass_dropdown_key = ref_open_glass_dropdown_key === dropdown_key ? '' : dropdown_key
  }

  // ??뺚댘??쇱뒲?癒?퐣 ?⑥쥓??揶쏅??????怨밴묶??獄쏆꼷???뺣뼄.
  function on_click_select_glass_dropdown(field_key, option_value) {
    if (field_key === 'list_category_filter') {
      ref_glass_list_category_filter = option_value
      ref_open_glass_dropdown_key = ''
      return
    }

    if (field_key === 'list_frame_style_filter') {
      ref_glass_list_frame_style_filter = option_value
      ref_open_glass_dropdown_key = ''
      return
    }

    if (field_key === 'list_material_filter') {
      ref_glass_list_material_filter = option_value
      ref_open_glass_dropdown_key = ''
      return
    }

    ref_glass_form_obj[field_key] = option_value
    ref_open_glass_dropdown_key = ''
  }

  // ???????筌왖 ???뵬???醫뤾문??롢늺 ??????沃섎챶?곮퉪?용┛?? ??낆쨮?????怨몄뱽 揶쏄퉮???뺣뼄.
  function on_change_glass_img_file(local_event) {
    const local_file_obj = local_event.currentTarget.files?.[0] ?? null
    ref_glass_img_file_obj = local_file_obj
    ref_glass_preview_override_url = local_file_obj ? URL.createObjectURL(local_file_obj) : ''
  }

  // 3D ???뵬???醫뤾문??롢늺 ????????낆쨮??쀫막 ???뵬 ???怨몄뱽 揶쏄퉮???뺣뼄.
  function on_change_glass_3d_file(local_event) {
    ref_glass_3d_file_obj = local_event.currentTarget.files?.[0] ?? null
  }

  // ?????뵬????됱몵筌?presigned URL??獄쏆뮄?믦쳸?녿툡 筌욊낯????낆쨮??쀫릭???源낆쨯??URL??筌띾슢諭??
  async function upload_glass_asset_if_needed() {
    let local_glasses_img_url = ref_glass_form_obj.glasses_img_url.trim()
    let local_glasses_3d_url = ref_glass_form_obj.glasses_3d_url.trim()

    if (ref_glass_img_file_obj) {
      const local_img_presigned_url = await get_admin_glasses_img_presigned_url()
      await upload_admin_glasses_file(local_img_presigned_url, ref_glass_img_file_obj)
      local_glasses_img_url = get_uploaded_file_url(local_img_presigned_url)
    }

    if (ref_glass_3d_file_obj) {
      const local_3d_presigned_url = await get_admin_glasses_3d_presigned_url()
      await upload_admin_glasses_file(local_3d_presigned_url, ref_glass_3d_file_obj)
      local_glasses_3d_url = get_uploaded_file_url(local_3d_presigned_url)
    }

    return {
      glasses_img_url: local_glasses_img_url,
      glasses_3d_url: local_glasses_3d_url,
    }
  }

  // ?醫뤾문????뉕펾 燁삳?諭??類ｋ궖???紐꾩춿 ??깅퓠 筌?쑴???
  function on_click_edit_glass(glass_obj) {
    ref_selected_glasses_no = glass_obj.glasses_no
    ref_glass_editor_open = true
    ref_open_glass_dropdown_key = ''
    ref_glass_img_file_obj = null
    ref_glass_3d_file_obj = null
    ref_glass_preview_override_url = ''
    ref_glass_form_obj = {
      ...create_glass_form(),
      glasses_name: glass_obj.glasses_name ?? '',
      glasses_brand: glass_obj.glasses_brand ?? '',
      glasses_img_url: glass_obj.glasses_img_url ?? '',
      glasses_3d_url: glass_obj.glasses_3d_url ?? '',
      is_active: glass_obj.is_active ?? true,
      category: glass_obj.category ?? '안경',
      frame_style: glass_obj.frame_style ?? 'round',
      frame_type: glass_obj.frame_type ?? '뿔테',
      material: glass_obj.material ?? '아세테이트',
      color: glass_obj.color ?? '',
      model_code: glass_obj.model_code ?? '',
      price: glass_obj.price ?? '',
      frame_width:
        glass_obj.frame_width === null || glass_obj.frame_width === undefined
          ? ''
          : String(glass_obj.frame_width),
      lens_width:
        glass_obj.lens_width === null || glass_obj.lens_width === undefined
          ? ''
          : String(glass_obj.lens_width),
      bridge_width:
        glass_obj.bridge_width === null || glass_obj.bridge_width === undefined
          ? ''
          : String(glass_obj.bridge_width),
      lens_height:
        glass_obj.lens_height === null || glass_obj.lens_height === undefined
          ? ''
          : String(glass_obj.lens_height),
      temple_length:
        glass_obj.temple_length === null || glass_obj.temple_length === undefined
          ? ''
          : String(glass_obj.temple_length),
      fit_note: glass_obj.fit_note ?? '',
    }
    ref_glass_saved_message = ''
    ref_glass_error_message = ''
    void ensure_glass_editor_component()
  }

  // ??뉕펾 ?類ｋ궖?????館釉????袁⑹뒄?????뵬 ??낆쨮??? ?믪눘? ??멸땋 ???源낆쨯 ?癒?뮉 ??륁젟????쎈뻬??뺣뼄.
  async function on_submit_glass_form(local_event) {
    local_event.preventDefault()

    if (!ref_glass_form_obj.glasses_img_url.trim() && !ref_glass_img_file_obj) {
      ref_glass_error_message = '대표 이미지를 선택해 주세요.'
      ref_glass_saved_message = ''
      return
    }

    ref_glass_submit_loading = true
    ref_glass_error_message = ''
    ref_glass_saved_message = ''

    try {
      const local_uploaded_asset_obj = await upload_glass_asset_if_needed()

      ref_glass_form_obj.glasses_img_url = local_uploaded_asset_obj.glasses_img_url
      ref_glass_form_obj.glasses_3d_url = local_uploaded_asset_obj.glasses_3d_url

      const local_glass_payload_obj = get_admin_glass_payload_obj()

      const local_is_edit_mode = Boolean(ref_selected_glasses_no)

      if (local_is_edit_mode) {
        await update_admin_glasses({
          glasses_no: ref_selected_glasses_no,
          ...local_glass_payload_obj,
        })
        ref_glass_saved_message = '안경 정보를 수정했습니다.'
      } else {
        const local_created_glass_obj = await create_admin_glasses(local_glass_payload_obj)
        ref_selected_glasses_no = local_created_glass_obj?.glasses_no ?? null
        ref_glass_saved_message = '안경 정보를 등록했습니다.'
      }

      ref_glass_img_file_obj = null
      ref_glass_3d_file_obj = null
      ref_glass_preview_override_url = ''
      await on_load_admin_glass_arr()

      if (!local_is_edit_mode) {
        on_click_close_glass_editor()
      }
    } catch (local_error) {
      ref_glass_error_message =
        local_error instanceof Error ? local_error.message : '안경 저장에 실패했습니다.'
    } finally {
      ref_glass_submit_loading = false
    }
  }

  // ?袁⑹삺 ?紐꾩춿 餓λ쵐????뉕펾????쑵??源딆넅??랁?筌뤴뫖以??遺얇늺??곗쨮 ???툡揶쏄쑬??
  async function on_click_delete_glass() {
    if (!ref_selected_glasses_no) return

    ref_glass_delete_loading = true
    ref_glass_error_message = ''
    ref_glass_saved_message = ''

    try {
      await delete_admin_glasses({ glasses_no: ref_selected_glasses_no })
      await on_load_admin_glass_arr()
      on_click_close_glass_editor()
    } catch (local_error) {
      ref_glass_error_message =
        local_error instanceof Error ? local_error.message : '안경 비활성화에 실패했습니다.'
    } finally {
      ref_glass_delete_loading = false
    }
  }
</script>

<AdminLayout active_key="glass">
  {#if !ref_glass_editor_open}
    <section class="grid gap-4">
      <div class="flex items-center justify-between gap-4">
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">안경 정보</h2>
        <span
          class="rounded-full bg-[var(--retina-soft-purple)] px-3 py-1 text-sm font-extrabold text-[var(--retina-primary-700)]"
        >
          총 {ref_glass_list_arr.length}개
        </span>
      </div>

      {#if ref_glass_error_message}
        <p
          class="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-left text-sm font-bold text-rose-700"
        >
          {ref_glass_error_message}
        </p>
      {/if}

      <section
        class="rounded-2xl border border-slate-200 bg-white px-8 py-5 shadow-sm shadow-slate-200/50"
      >
        <div class="grid gap-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-slate-500">카테고리</span>
              <div class="relative">
                <button
                  class="flex min-h-11 min-w-36 cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)]/35 hover:bg-white"
                  type="button"
                  onclick={() => on_click_toggle_glass_dropdown('list_category_filter')}
                >
                  <span>
                    {ref_glass_list_category_filter === 'all'
                      ? '전체'
                      : get_glass_meta_label('category', ref_glass_list_category_filter)}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2.4}
                    class={`transition ${ref_open_glass_dropdown_key === 'list_category_filter' ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {#if ref_open_glass_dropdown_key === 'list_category_filter'}
                  <div
                    class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retina-border)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                  >
                    <button
                      class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                        ref_glass_list_category_filter === 'all'
                          ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                          : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                      }`}
                      type="button"
                      onclick={() => on_click_select_glass_dropdown('list_category_filter', 'all')}
                    >
                      전체
                    </button>

                    {#each g_glass_dropdown_arr[0].option_arr as category_option (`category-filter-${category_option}`)}
                      <button
                        class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                          ref_glass_list_category_filter === category_option
                            ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                            : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                        }`}
                        type="button"
                        onclick={() =>
                          on_click_select_glass_dropdown('list_category_filter', category_option)}
                      >
                        {category_option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <span class="ml-3 text-sm font-bold text-slate-500">프레임 스타일</span>
              <div class="relative">
                <button
                  class="flex min-h-11 min-w-40 cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)]/35 hover:bg-white"
                  type="button"
                  onclick={() => on_click_toggle_glass_dropdown('list_frame_style_filter')}
                >
                  <span>
                    {ref_glass_list_frame_style_filter === 'all'
                      ? '전체'
                      : get_glass_meta_label('frame_style', ref_glass_list_frame_style_filter)}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2.4}
                    class={`transition ${ref_open_glass_dropdown_key === 'list_frame_style_filter' ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {#if ref_open_glass_dropdown_key === 'list_frame_style_filter'}
                  <div
                    class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retina-border)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                  >
                    <button
                      class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                        ref_glass_list_frame_style_filter === 'all'
                          ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                          : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                      }`}
                      type="button"
                      onclick={() => on_click_select_glass_dropdown('list_frame_style_filter', 'all')}
                    >
                      전체
                    </button>

                    {#each g_frame_style_option_arr as frame_style_option (`frame-style-filter-${frame_style_option.value}`)}
                      <button
                        class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                          ref_glass_list_frame_style_filter === frame_style_option.value
                            ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                            : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                        }`}
                        type="button"
                        onclick={() =>
                          on_click_select_glass_dropdown(
                            'list_frame_style_filter',
                            frame_style_option.value,
                          )}
                      >
                        {frame_style_option.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <span class="ml-3 text-sm font-bold text-slate-500">재질</span>
              <div class="relative">
                <button
                  class="flex min-h-11 min-w-36 cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)]/35 hover:bg-white"
                  type="button"
                  onclick={() => on_click_toggle_glass_dropdown('list_material_filter')}
                >
                  <span>
                    {ref_glass_list_material_filter === 'all'
                      ? '전체'
                      : get_glass_meta_label('material', ref_glass_list_material_filter)}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2.4}
                    class={`transition ${ref_open_glass_dropdown_key === 'list_material_filter' ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {#if ref_open_glass_dropdown_key === 'list_material_filter'}
                  <div
                    class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retina-border)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                  >
                    <button
                      class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                        ref_glass_list_material_filter === 'all'
                          ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                          : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                      }`}
                      type="button"
                      onclick={() => on_click_select_glass_dropdown('list_material_filter', 'all')}
                    >
                      전체
                    </button>

                    {#each g_glass_dropdown_arr[3].option_arr as material_option (`material-filter-${material_option}`)}
                      <button
                        class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                          ref_glass_list_material_filter === material_option
                            ? 'bg-[var(--retina-soft-purple)] text-[var(--retina-primary-700)]'
                            : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retina-primary-700)]'
                        }`}
                        type="button"
                        onclick={() =>
                          on_click_select_glass_dropdown('list_material_filter', material_option)}
                      >
                        {material_option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <button
              class="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[#D8C6E0] bg-[#FAF7FC] px-4 text-sm font-extrabold text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)] hover:bg-[#F8F1F8]"
              type="button"
              onclick={on_click_open_glass_create}
            >
              안경 추가
            </button>
          </div>

          {#if ref_glass_list_loading}
            <div
              class="grid min-h-40 place-items-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-center text-sm font-bold text-slate-500"
            >
              안경 목록을 불러오는 중입니다.
            </div>
          {:else if g_filtered_glass_list_arr.length === 0}
            <div
              class="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-bold text-slate-500"
            >
              등록된 안경이 없습니다.
            </div>
          {:else}
            <div class="grid gap-3">
              {#each g_filtered_glass_list_arr as glass_obj (glass_obj.glasses_no)}
                <button
                  class="grid cursor-pointer grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-left transition hover:border-[#D8C6E0] hover:shadow-sm"
                  type="button"
                  onclick={() => on_click_edit_glass(glass_obj)}
                >
                  <div class="h-28 w-28 overflow-hidden rounded-xl bg-[#F7F1F9]">
                    <img
                      src={glass_obj.glasses_img_url || g_glass_placeholder_image_url}
                      alt={`${glass_obj.glasses_brand} ${glass_obj.glasses_name}`}
                      class="h-full w-full object-cover"
                    />
                  </div>

                  <div class="grid min-w-0 gap-3.5">
                    <div class="min-w-0">
                      <p class="m-0 truncate text-xl font-extrabold text-zinc-950">
                        {glass_obj.glasses_name}
                      </p>
                      <p class="mb-0 mt-1.5 truncate text-base font-semibold text-slate-500">
                        {glass_obj.glasses_brand || '브랜드 없음'}
                      </p>
                    </div>

                    <div class="flex flex-wrap gap-2.5">
                      <span class="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-bold text-slate-600">
                        {get_glass_meta_label('category', glass_obj.category)}
                      </span>
                      <span class="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-bold text-slate-600">
                        {get_glass_meta_label('frame_style', glass_obj.frame_style)}
                      </span>
                      <span class="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-bold text-slate-600">
                        {get_glass_meta_label('frame_type', glass_obj.frame_type)}
                      </span>
                      {#if glass_obj.model_code}
                        <span class="rounded-full bg-[#F5EAF7] px-3.5 py-1.5 text-sm font-bold text-[#7B3F8A]">
                          {glass_obj.model_code}
                        </span>
                      {/if}
                      {#if glass_obj.color}
                        <span class="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-bold text-slate-600">
                          {glass_obj.color}
                        </span>
                      {/if}
                    </div>

                    {#if glass_obj.fit_note}
                      <p class="m-0 line-clamp-2 text-base font-medium leading-6 text-slate-500">
                        {glass_obj.fit_note}
                      </p>
                    {/if}
                  </div>

                  <div class="grid justify-items-end">
                    <span
                      class={`rounded-full px-3 py-1.5 text-sm font-extrabold ${
                        glass_obj.is_active
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {glass_obj.is_active ? '활성' : '비활성화'}
                    </span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}

          {#if false}
          <button
            class="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border border-dashed border-[#D8C6E0] bg-[#FAF7FC] text-[var(--retina-primary-700)] transition hover:border-[var(--retina-primary-700)] hover:bg-[#F8F1F8]"
            type="button"
            onclick={on_click_open_glass_create}
          >
            <div class="grid justify-items-center gap-3">
              <span
                class="grid h-16 w-16 place-items-center rounded-full bg-white text-4xl font-light shadow-sm"
                >+</span
              >
              <span class="text-base font-extrabold">안경 추가</span>
            </div>
          </button>

          {#if ref_glass_list_loading}
            <div
              class="grid aspect-[4/3] place-items-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-center text-sm font-bold text-slate-500"
            >
              안경 목록을 불러오는 중입니다.
            </div>
          {/if}

          {#each ref_glass_list_arr as glass_obj (glass_obj.glasses_no)}
            <button
              class="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-[#D8C6E0] hover:shadow-sm"
              type="button"
              onclick={() => on_click_edit_glass(glass_obj)}
            >
              <div class="aspect-[4/3] bg-[#F7F1F9]">
                <img
                  src={glass_obj.glasses_img_url || g_glass_placeholder_image_url}
                  alt={`${glass_obj.glasses_brand} ${glass_obj.glasses_name}`}
                  class="h-full w-full object-cover"
                />
              </div>
              <div class="px-5 py-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="m-0 truncate text-lg font-extrabold text-zinc-950">
                      {glass_obj.glasses_name}
                    </p>
                    <p class="mb-0 mt-2 truncate text-sm font-semibold text-slate-500">
                      {glass_obj.glasses_brand}
                    </p>
                  </div>

                  <span
                    class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                      glass_obj.is_active
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {glass_obj.is_active ? '활성' : '비활성화'}
                  </span>
                </div>
              </div>
            </button>
          {/each}
          {/if}
        </div>
      </section>
    </section>
  {:else}
    {#await ensure_glass_editor_component()}
      <section
        class="grid min-h-40 place-items-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-center text-sm font-bold text-slate-500"
      >
        안경 편집 화면을 불러오는 중입니다.
      </section>
    {:then local_glass_editor_component}
      {@const GlassEditorComponent = local_glass_editor_component}
      <GlassEditorComponent
        {ref_selected_glasses_no}
        {ref_glass_submit_loading}
        {ref_glass_delete_loading}
        {ref_glass_saved_message}
        {ref_glass_error_message}
        {ref_glass_form_obj}
        {ref_glass_img_file_obj}
        {ref_glass_3d_file_obj}
        {g_glass_preview_url}
        {g_glass_dropdown_arr}
        {ref_open_glass_dropdown_key}
        {g_metric_field_arr}
        {on_submit_glass_form}
        {on_click_delete_glass}
        {on_click_close_glass_editor}
        {on_click_toggle_glass_dropdown}
        {on_click_select_glass_dropdown}
        {on_change_glass_img_file}
        {on_change_glass_3d_file}
        {get_glass_dropdown_option_value}
        {get_glass_dropdown_option_label}
        {get_glass_dropdown_selected_label}
      />
    {:catch}
      <section
        class="grid min-h-40 place-items-center rounded-2xl border border-rose-200 bg-rose-50 px-6 text-center text-sm font-bold text-rose-700"
      >
        안경 편집 화면을 불러오지 못했습니다.
      </section>
    {/await}
  {/if}
</AdminLayout>
