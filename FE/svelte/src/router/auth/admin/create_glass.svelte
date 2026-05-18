<script>
  import { ChevronDown } from 'lucide-svelte'

  let {
    ref_selected_glasses_no,
    ref_glass_submit_loading,
    ref_glass_delete_loading,
    ref_glass_form_obj,
    ref_glass_img_file_obj,
    ref_glass_3d_file_obj,
    g_glass_preview_url,
    g_glass_dropdown_arr,
    ref_open_glass_dropdown_key,
    g_metric_field_arr,
    on_submit_glass_form,
    on_click_delete_glass,
    on_click_close_glass_editor,
    on_click_toggle_glass_dropdown,
    on_click_select_glass_dropdown,
    on_change_glass_img_file,
    on_change_glass_3d_file,
    get_glass_dropdown_option_value,
    get_glass_dropdown_option_label,
    get_glass_dropdown_selected_label,
  } = $props()

  // S3 URL 또는 key 경로에서 파일명만 추출. 절대 URL/상대 key 모두 지원.
  /** @param {string | null | undefined} url_value */
  function get_filename_from_url(url_value) {
    const local_text = String(url_value ?? '').trim()
    if (!local_text) return ''
    try {
      const local_pathname = new URL(local_text).pathname
      return decodeURIComponent(local_pathname.split('/').pop() ?? '')
    } catch {
      return decodeURIComponent(local_text.split('?')[0].split('/').pop() ?? '')
    }
  }
</script>

<form class="grid gap-4" onsubmit={on_submit_glass_form}>
  <div class="flex items-start justify-between gap-6">
    <h2 class="m-0 text-2xl font-extrabold text-[var(--retina-text-800)]">
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
          {ref_glass_delete_loading ? '비활성화 중..' : '비활성화'}
        </button>
      {/if}

      <button
        class="min-h-12 cursor-pointer rounded-xl border border-[var(--retina-text-200)] bg-white px-5 text-base font-extrabold text-[var(--retina-text-500)] transition hover:border-[var(--retina-text-300)] hover:bg-[var(--retina-bg-1)] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onclick={on_click_close_glass_editor}
        disabled={ref_glass_submit_loading || ref_glass_delete_loading}
      >
        목록으로
      </button>

      <button
        class="min-h-12 cursor-pointer rounded-xl border-0 bg-[var(--retina-primary-300)] px-7 text-base font-extrabold text-white transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={ref_glass_submit_loading || ref_glass_delete_loading}
      >
        {ref_glass_submit_loading
          ? ref_selected_glasses_no
            ? '수정 중..'
            : '등록 중..'
          : ref_selected_glasses_no
            ? '수정 완료'
            : '등록 완료'}
      </button>
    </div>
  </div>

  <section
    class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-5 shadow-sm shadow-slate-200/50"
  >
    <div class="flex justify-end">
      <div
        class="grid min-h-12 grid-cols-2 gap-2 rounded-xl border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] p-1"
      >
        <button
          class={`cursor-pointer rounded-[10px] px-4 text-sm font-extrabold transition ${
            ref_glass_form_obj.is_active
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-transparent text-[var(--retina-text-500)] hover:bg-white hover:text-[var(--retina-text-800)]'
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
              : 'bg-transparent text-[var(--retina-text-500)] hover:bg-white hover:text-[var(--retina-text-800)]'
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
        <span class="text-sm font-extrabold text-[var(--retina-text-500)]"
          >안경 대표 이미지 미리보기</span
        >

        <div
          class="overflow-hidden rounded-[14px] border border-dashed border-[var(--retina-primary-200)] bg-[var(--retina-primary-50)]"
        >
          <div
            class="aspect-[5/3] bg-[linear-gradient(180deg,var(--retina-primary-50)_0%,var(--retina-bg-1)_100%)]"
          >
            <img
              src={g_glass_preview_url}
              alt="안경 대표 이미지 미리보기"
              class="h-full w-full object-cover"
            />
          </div>

          <div class="grid gap-3 border-t border-[var(--retina-text-200)] px-4 py-4">
            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
              대표 이미지 파일
              <div
                class="relative flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-[var(--retina-text-200)] bg-white px-4 py-3 transition focus-within:border-[var(--retina-primary-400)] focus-within:ring-3 focus-within:ring-[var(--retina-primary-400)]/15"
              >
                <input
                  class="absolute inset-0 cursor-pointer opacity-0"
                  type="file"
                  accept="image/*"
                  onchange={on_change_glass_img_file}
                />
                <span
                  class="shrink-0 rounded-lg bg-[var(--retina-primary-50)] px-3 py-2 text-sm font-extrabold text-[var(--retina-primary-600)]"
                >
                  파일 선택
                </span>
                <span
                  class="truncate text-base font-bold text-[var(--retina-text-800)]"
                  title={ref_glass_img_file_obj?.name ??
                    get_filename_from_url(ref_glass_form_obj.glasses_img_url)}
                >
                  {#if ref_glass_img_file_obj}
                    {ref_glass_img_file_obj.name}
                  {:else if ref_glass_form_obj.glasses_img_url}
                    {get_filename_from_url(ref_glass_form_obj.glasses_img_url) ||
                      ref_glass_form_obj.glasses_img_url}
                  {:else}
                    선택된 파일 없음
                  {/if}
                </span>
              </div>
            </label>

            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
              3D 모델 파일
              <div
                class="relative flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-[var(--retina-text-200)] bg-white px-4 py-3 transition focus-within:border-[var(--retina-primary-400)] focus-within:ring-3 focus-within:ring-[var(--retina-primary-400)]/15"
              >
                <input
                  class="absolute inset-0 cursor-pointer opacity-0"
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj,.usdz,.stl,.ply,.3dm"
                  onchange={on_change_glass_3d_file}
                />
                <span
                  class="shrink-0 rounded-lg bg-[var(--retina-primary-50)] px-3 py-2 text-sm font-extrabold text-[var(--retina-primary-600)]"
                >
                  파일 선택
                </span>
                <span
                  class="truncate text-base font-bold text-[var(--retina-text-800)]"
                  title={ref_glass_3d_file_obj?.name ??
                    get_filename_from_url(ref_glass_form_obj.glasses_3d_url)}
                >
                  {#if ref_glass_3d_file_obj}
                    {ref_glass_3d_file_obj.name}
                  {:else if ref_glass_form_obj.glasses_3d_url}
                    {get_filename_from_url(ref_glass_form_obj.glasses_3d_url) ||
                      ref_glass_form_obj.glasses_3d_url}
                  {:else}
                    선택된 파일 없음
                  {/if}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="grid min-w-0 content-start self-start gap-4 md:grid-cols-2">
        <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
          제품명
          <input
            class="min-h-12 min-w-0 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            type="text"
            bind:value={ref_glass_form_obj.glasses_name}
            placeholder="예: 쿠보 01"
            required
          />
        </label>

        <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
          브랜드명
          <input
            class="min-h-12 min-w-0 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            type="text"
            bind:value={ref_glass_form_obj.glasses_brand}
            placeholder="예: 모스콧"
            required
          />
        </label>

        {#each g_glass_dropdown_arr.filter( /** @param {Record<string, any>} dropdown_obj */ (dropdown_obj) => ['category', 'frame_style', 'frame_type'].includes(dropdown_obj.key), ) as dropdown_obj (dropdown_obj.key)}
          <div class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
            {dropdown_obj.label}

            <div class="relative">
              <button
                class="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-3 text-left text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-400)] hover:bg-white"
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
                  class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-[var(--retina-text-200)] bg-white p-2 shadow-[0_18px_40px_rgba(19,25,40,0.12)]"
                >
                  {#each dropdown_obj.option_arr as option_obj (`${dropdown_obj.key}-${get_glass_dropdown_option_value(option_obj)}`)}
                    <button
                      class={`flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition ${
                        ref_glass_form_obj[dropdown_obj.key] ===
                        get_glass_dropdown_option_value(option_obj)
                          ? 'bg-[var(--retina-primary-50)] text-[var(--retina-primary-600)]'
                          : 'bg-white text-[var(--retina-text-500)] hover:bg-[var(--retina-primary-50)] hover:text-[var(--retina-primary-600)]'
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

        <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
          컬러
          <input
            class="min-h-12 min-w-0 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            type="text"
            bind:value={ref_glass_form_obj.color}
            placeholder="예: 블랙"
          />
        </label>

        <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
          모델 코드
          <input
            class="min-h-12 min-w-0 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            type="text"
            bind:value={ref_glass_form_obj.model_code}
            placeholder="예: RB5154"
          />
        </label>

        <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
          가격
          <input
            class="min-h-12 min-w-0 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            type="text"
            bind:value={ref_glass_form_obj.price}
            placeholder="예: 159,000원"
          />
        </label>

        {#if false}
          {#each g_metric_field_arr as metric_obj (metric_obj.key)}
            <label class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
              {metric_obj.label}
              <div
                class="flex items-center rounded-xl border border-[var(--retina-text-200)] bg-white px-4"
              >
                <input
                  class="min-h-12 min-w-0 flex-1 border-0 bg-transparent text-base font-bold text-[var(--retina-text-800)] outline-none"
                  type="number"
                  min="0"
                  bind:value={ref_glass_form_obj[metric_obj.key]}
                  placeholder={metric_obj.placeholder}
                />
                <span class="text-sm font-bold text-[var(--retina-text-400)]">mm</span>
              </div>
            </label>
          {/each}
        {/if}

        <label
          class="grid min-w-0 gap-2 text-sm font-extrabold text-[var(--retina-text-500)] md:col-span-2"
        >
          피팅 메모
          <textarea
            class="min-h-[96px] rounded-xl border border-[var(--retina-text-200)] px-4 py-3 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
            bind:value={ref_glass_form_obj.fit_note}
            placeholder="예: 얼굴 너비 대비 안정적인 비율, 장시간 착용 적합"
          ></textarea>
        </label>
      </div>
    </div>
  </section>
</form>
