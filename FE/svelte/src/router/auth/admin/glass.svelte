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
      label: '프레임 재질',
      option_arr: ['뿔테', '메탈', '합금테', '무테', '혼합'],
    },
    { key: 'material', label: '소재', option_arr: ['아세테이트', '메탈', '티타늄', '혼합'] },
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

  // 안경 등록과 수정에 공통으로 쓰는 기본 입력 상태를 만든다.
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
   * 숫자 입력값을 안경 스펙 저장용 숫자 또는 null로 정리한다.
   * @param {string | number | null | undefined} input_value
   */
  function get_numeric_or_null(input_value) {
    const local_trimmed_value = String(input_value ?? '').trim()

    if (!local_trimmed_value) return null

    const local_number = Number(local_trimmed_value)
    return Number.isFinite(local_number) ? local_number : null
  }

  // 드롭다운 옵션 값을 라벨과 비교 가능한 문자열 값으로 정리한다.
  function get_glass_dropdown_option_value(option_obj) {
    return typeof option_obj === 'string' ? option_obj : option_obj.value
  }

  // 드롭다운 옵션 값을 화면에 보여줄 라벨 문자열로 정리한다.
  function get_glass_dropdown_option_label(option_obj) {
    return typeof option_obj === 'string' ? option_obj : option_obj.label
  }

  // 현재 선택된 드롭다운 값을 화면 표시용 라벨로 변환한다.
  function get_glass_dropdown_selected_label(dropdown_obj, selected_value) {
    const local_option_obj = dropdown_obj.option_arr.find(
      (option_obj) => get_glass_dropdown_option_value(option_obj) === selected_value,
    )

    return local_option_obj
      ? get_glass_dropdown_option_label(local_option_obj)
      : String(selected_value ?? '')
  }

  /**
   * 관리자 안경 API 응답을 현재 화면에서 바로 쓰기 쉬운 형태로 정규화한다.
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

  // 현재 폼 상태를 관리자 안경 등록/수정 API 바디 구조로 변환한다.
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
  let ref_selected_glasses_no = $state(null)
  let ref_glass_editor_open = $state(false)
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

  onMount(() => {
    on_load_admin_glass_arr()
  })

  // 관리자 안경 목록을 최신 상태로 다시 조회한다.
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

  // 현재 편집 폼을 신규 등록 상태로 되돌린다.
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

  // 안경 추가 화면으로 전환한다.
  function on_click_open_glass_create() {
    reset_glass_form()
    ref_glass_editor_open = true
  }

  // 편집 화면을 닫고 목록 화면으로 돌아간다.
  function on_click_close_glass_editor() {
    ref_glass_editor_open = false
    ref_open_glass_dropdown_key = ''
    ref_glass_img_file_obj = null
    ref_glass_3d_file_obj = null
    ref_glass_preview_override_url = ''
    ref_glass_saved_message = ''
    ref_glass_error_message = ''
  }

  // 커스텀 드롭다운의 열림 상태를 전환한다.
  function on_click_toggle_glass_dropdown(dropdown_key) {
    ref_open_glass_dropdown_key = ref_open_glass_dropdown_key === dropdown_key ? '' : dropdown_key
  }

  // 드롭다운에서 고른 값을 폼 상태에 반영한다.
  function on_click_select_glass_dropdown(field_key, option_value) {
    ref_glass_form_obj[field_key] = option_value
    ref_open_glass_dropdown_key = ''
  }

  // 대표 이미지 파일을 선택하면 저장 전 미리보기와 업로드 대상을 갱신한다.
  function on_change_glass_img_file(local_event) {
    const local_file_obj = local_event.currentTarget.files?.[0] ?? null
    ref_glass_img_file_obj = local_file_obj
    ref_glass_preview_override_url = local_file_obj ? URL.createObjectURL(local_file_obj) : ''
  }

  // 3D 파일을 선택하면 저장 시 업로드할 파일 대상을 갱신한다.
  function on_change_glass_3d_file(local_event) {
    ref_glass_3d_file_obj = local_event.currentTarget.files?.[0] ?? null
  }

  // 새 파일이 있으면 presigned URL을 발급받아 직접 업로드하고 등록용 URL을 만든다.
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

  // 선택한 안경 카드 정보를 편집 폼에 채운다.
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
  }

  // 안경 정보를 저장할 때 필요한 파일 업로드를 먼저 끝낸 뒤 등록 또는 수정을 실행한다.
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

  // 현재 편집 중인 안경을 비활성화하고 목록 화면으로 돌아간다.
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
          class="rounded-full bg-[var(--retinal-soft-purple)] px-3 py-1 text-sm font-extrabold text-[var(--retinal-primary-700)]"
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
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            class="grid aspect-[4/3] cursor-pointer place-items-center rounded-2xl border border-dashed border-[#D8C6E0] bg-[#FAF7FC] text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-700)] hover:bg-[#F8F1F8]"
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
                    {glass_obj.is_active ? '활성' : '비활성'}
                  </span>
                </div>
              </div>
            </button>
          {/each}
        </div>
      </section>
    </section>
  {:else}
    <form class="grid gap-4" onsubmit={on_submit_glass_form}>
      <div class="flex items-start justify-between gap-6">
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">
          {ref_selected_glasses_no ? '안경 수정' : '안경 추가'}
        </h2>

        <div class="flex items-center gap-3">
          {#if ref_selected_glasses_no}
            <button
              class="min-h-12 cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-5 text-base font-extrabold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onclick={on_click_delete_glass}
              disabled={ref_glass_delete_loading || ref_glass_submit_loading}
            >
              {ref_glass_delete_loading ? '비활성화 중...' : '비활성화'}
            </button>
          {/if}

          <button
            class="min-h-12 cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-base font-extrabold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onclick={on_click_close_glass_editor}
            disabled={ref_glass_submit_loading || ref_glass_delete_loading}
          >
            목록으로
          </button>

          <button
            class="min-h-12 cursor-pointer rounded-xl border-0 bg-[var(--retinal-primary-700)] px-7 text-base font-extrabold text-white transition hover:bg-[var(--retinal-primary-500)]"
            type="submit"
            disabled={ref_glass_submit_loading || ref_glass_delete_loading}
          >
            {ref_glass_submit_loading
              ? ref_selected_glasses_no
                ? '수정 중...'
                : '등록 중...'
              : ref_selected_glasses_no
                ? '수정 완료'
                : '등록 완료'}
          </button>
        </div>
      </div>

      {#if ref_glass_saved_message}
        <p
          class="rounded-xl border border-[#D6BBFB] bg-[#F8F1FF] px-5 py-3 text-left text-base font-bold text-[#6B21A8]"
        >
          {ref_glass_saved_message}
        </p>
      {/if}

      {#if ref_glass_error_message}
        <p
          class="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-left text-base font-bold text-rose-700"
        >
          {ref_glass_error_message}
        </p>
      {/if}

      <section
        class="rounded-2xl border border-slate-200 bg-white px-8 py-5 shadow-sm shadow-slate-200/50"
      >
        <div class="flex justify-end">
          <div
            class="grid min-h-12 grid-cols-2 gap-2 rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] p-1"
          >
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

        <div class="mt-3 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div class="grid content-start self-start gap-2">
            <span class="text-sm font-extrabold text-slate-500">안경 대표 이미지 미리보기</span>

            <div
              class="overflow-hidden rounded-2xl border border-dashed border-[#D8C6E0] bg-[#FAF7FC]"
            >
              <div class="aspect-[5/3] bg-[linear-gradient(180deg,#F8F1F8_0%,#F3F4F6_100%)]">
                <img
                  src={g_glass_preview_url}
                  alt="안경 대표 이미지 미리보기"
                  class="h-full w-full object-cover"
                />
              </div>

              <div class="grid gap-3 border-t border-[#E8DAEE] px-4 py-4">
                <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
                  대표 이미지 파일
                  <input
                    class="min-h-12 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-zinc-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#F3E8F5] file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-[#4B0055] focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                    type="file"
                    accept="image/*"
                    onchange={on_change_glass_img_file}
                  />
                  <span class="text-xs font-semibold text-slate-400">
                    {ref_glass_img_file_obj?.name ??
                      (ref_glass_form_obj.glasses_img_url
                        ? '기존 이미지 사용 중'
                        : '선택된 파일 없음')}
                  </span>
                </label>

                <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
                  3D 모델 파일
                  <input
                    class="min-h-12 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-zinc-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#F3E8F5] file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-[#4B0055] focus:border-[#4B0055] focus:ring-3 focus:ring-[#4B0055]/12"
                    type="file"
                    accept=".glb,.gltf,.fbx,.obj,.usdz,.stl,.ply,.3dm"
                    onchange={on_change_glass_3d_file}
                  />
                  <span class="text-xs font-semibold text-slate-400">
                    {ref_glass_3d_file_obj?.name ??
                      (ref_glass_form_obj.glasses_3d_url
                        ? '기존 3D 파일 사용 중'
                        : '선택된 파일 없음')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div class="grid min-w-0 content-start self-start gap-4 md:grid-cols-2">
            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              제품명
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
                type="text"
                bind:value={ref_glass_form_obj.glasses_name}
                placeholder="예: 쿠보 01"
                required
              />
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              브랜드명
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
                type="text"
                bind:value={ref_glass_form_obj.glasses_brand}
                placeholder="예: 모스콧"
                required
              />
            </label>

            {#each g_glass_dropdown_arr.filter((dropdown_obj) => ['category', 'frame_style', 'frame_type'].includes(dropdown_obj.key)) as dropdown_obj (dropdown_obj.key)}
              <div class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
                {dropdown_obj.label}

                <div class="relative">
                  <button
                    class="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-[#EFE7F2] bg-[#F8F9FB] px-3 text-left text-sm font-extrabold text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-700)]/35 hover:bg-white"
                    type="button"
                    onclick={() => on_click_toggle_glass_dropdown(dropdown_obj.key)}
                  >
                    <span>
                      {get_glass_dropdown_selected_label(
                        dropdown_obj,
                        ref_glass_form_obj[dropdown_obj.key],
                      )}
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2.4}
                      class={`transition ${ref_open_glass_dropdown_key === dropdown_obj.key ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {#if ref_open_glass_dropdown_key === dropdown_obj.key}
                    <div
                      class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retinal-border)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                    >
                      {#each dropdown_obj.option_arr as option_obj (`${dropdown_obj.key}-${get_glass_dropdown_option_value(option_obj)}`)}
                        <button
                          class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                            ref_glass_form_obj[dropdown_obj.key] ===
                            get_glass_dropdown_option_value(option_obj)
                              ? 'bg-[var(--retinal-soft-purple)] text-[var(--retinal-primary-700)]'
                              : 'bg-white text-slate-600 hover:bg-[#F8F1F8] hover:text-[var(--retinal-primary-700)]'
                          }`}
                          type="button"
                          onclick={() =>
                            on_click_select_glass_dropdown(
                              dropdown_obj.key,
                              get_glass_dropdown_option_value(option_obj),
                            )}
                        >
                          {get_glass_dropdown_option_label(option_obj)}
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
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
                type="text"
                bind:value={ref_glass_form_obj.color}
                placeholder="예: 블랙"
              />
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              모델 코드
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
                type="text"
                bind:value={ref_glass_form_obj.model_code}
                placeholder="예: RB5154"
              />
            </label>

            {#if false}
            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500">
              가격
              <input
                class="min-h-12 min-w-0 rounded-xl border border-slate-200 px-4 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
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
            {/if}

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-slate-500 md:col-span-2">
              피팅 메모
              <textarea
                class="min-h-[96px] rounded-xl border border-slate-200 px-4 py-3 text-base font-bold text-zinc-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--retinal-primary-700)] focus:ring-3 focus:ring-[var(--retinal-primary-700)]/12"
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
