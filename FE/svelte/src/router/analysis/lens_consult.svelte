<script>
  import { onMount } from 'svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { ensure_session_auth_tokens } from '@/lib/api/session_auth'
  import { get_recommend_option_arr } from '@/lib/api/recommend_options'
  import { save_visit_recommend } from '@/lib/api/visit'
  import { selected_customer_obj } from '@/lib/stores/customer'

  // 질문 = option_category, 답변 = { option_no, option_name } 으로 매핑된다.
  let g_question_arr = $state([])
  let g_options_loading = $state(true)
  let g_options_error = $state('')
  let g_loading = $state(false)
  let g_error = $state('')
  // key = 질문 텍스트, value = 선택된 option_no 배열
  let ref_selected_obj = $state({})

  const g_customer_name = $derived.by(() => {
    const local_name = $selected_customer_obj?.name?.trim()
    if (!local_name) return '고객'
    return local_name.endsWith('님') ? local_name : `${local_name} 고객님`
  })

  function normalize_option_obj(option_obj) {
    return {
      option_no: Number(option_obj.option_no ?? 0),
      option_name: String(option_obj.option_name ?? ''),
      option_category: String(option_obj.option_category ?? ''),
      display_order: Number(option_obj.display_order ?? 0),
      is_active: Boolean(option_obj.is_active),
    }
  }

  // 슬라이더 UI 로 표시할 마지막 질문(스마트폰·모니터·TV 시청 시간) 식별 키워드
  const g_slider_question_keyword_arr = ['스마트폰', '모니터', 'TV', '보는 시간']

  function is_slider_question_text(question_text) {
    const local_text = String(question_text ?? '')
    return (
      local_text.includes('보는 시간') ||
      (local_text.includes('스마트폰') && local_text.includes('TV'))
    )
  }

  // 추천 옵션 목록을 질문(category) 단위로 그룹핑한다.
  function build_question_arr_from_option_arr(option_arr) {
    const local_grouped_obj = {}

    for (const option_obj of option_arr) {
      if (!option_obj.is_active) continue
      if (!option_obj.option_category) continue

      const local_key = option_obj.option_category

      if (!local_grouped_obj[local_key]) {
        local_grouped_obj[local_key] = {
          question_text: local_key,
          answer_arr: [],
        }
      }

      local_grouped_obj[local_key].answer_arr.push(option_obj)
    }

    const local_question_arr = Object.values(local_grouped_obj).map((question_obj) => ({
      ...question_obj,
      is_slider: is_slider_question_text(question_obj.question_text),
      answer_arr: question_obj.answer_arr.sort(
        (left_obj, right_obj) => left_obj.display_order - right_obj.display_order,
      ),
    }))

    // 관리자 화면에서 지정한 순서를 그대로 따른다.
    // 각 질문의 첫 답변 display_order(= 그 질문의 글로벌 시작 위치)로 정렬한다.
    return local_question_arr.sort((left_question_obj, right_question_obj) => {
      const local_left_min =
        left_question_obj.answer_arr[0]?.display_order ?? Number.MAX_SAFE_INTEGER
      const local_right_min =
        right_question_obj.answer_arr[0]?.display_order ?? Number.MAX_SAFE_INTEGER
      return local_left_min - local_right_min
    })
  }

  function get_slider_selected_index(question_obj) {
    const local_selected_arr = ref_selected_obj[question_obj.question_text] ?? []
    if (local_selected_arr.length === 0) return -1
    const local_selected_no = local_selected_arr[0]
    return question_obj.answer_arr.findIndex(
      (answer_obj) => answer_obj.option_no === local_selected_no,
    )
  }

  function on_input_slider_answer(question_obj, local_event) {
    const local_index = Number(/** @type {HTMLInputElement} */ (local_event.currentTarget).value)
    const local_answer_obj = question_obj.answer_arr[local_index]
    if (!local_answer_obj) return

    ref_selected_obj = {
      ...ref_selected_obj,
      [question_obj.question_text]: [local_answer_obj.option_no],
    }
  }

  function init_selected_obj(question_arr) {
    const local_selected_obj = {}
    for (const question_obj of question_arr) {
      local_selected_obj[question_obj.question_text] = []
    }
    ref_selected_obj = local_selected_obj
  }

  // 현재 탭 세션에서 방문 번호를 읽어 추천 옵션 저장 대상 방문을 결정한다.
  function get_visit_no() {
    if (typeof sessionStorage === 'undefined') {
      return null
    }

    const local_visit_no = sessionStorage.getItem('retinal_visit_no')
    if (local_visit_no) {
      const local_number = Number(local_visit_no)
      if (Number.isFinite(local_number)) {
        return local_number
      }
    }

    const local_selected_visit_json = sessionStorage.getItem('retinal_selected_visit_obj')
    if (!local_selected_visit_json) {
      return null
    }

    try {
      const local_selected_visit_obj = JSON.parse(local_selected_visit_json)
      const local_number = Number(local_selected_visit_obj?.visit_no)
      return Number.isFinite(local_number) ? local_number : null
    } catch {
      return null
    }
  }

  function is_selected(question_text, option_no) {
    return ref_selected_obj[question_text]?.includes(option_no) ?? false
  }

  // 답변 칩 클릭 시 같은 값은 해제하고 없던 값은 선택 목록에 추가한다 (질문별 다중 선택).
  function on_click_toggle_answer(question_text, option_no) {
    const local_selected_arr = ref_selected_obj[question_text] ?? []

    if (local_selected_arr.includes(option_no)) {
      ref_selected_obj = {
        ...ref_selected_obj,
        [question_text]: local_selected_arr.filter(
          (local_no) => local_no !== option_no,
        ),
      }
      return
    }

    ref_selected_obj = {
      ...ref_selected_obj,
      [question_text]: [...local_selected_arr, option_no],
    }
  }

  // 선택한 추천 옵션을 방문 데이터에 저장한 뒤 AR 피팅 화면으로 이동한다.
  async function on_click_submit() {
    if (g_loading) return
    g_loading = true
    g_error = ''

    try {
      if (!ensure_session_auth_tokens()) {
        throw new Error('로그인 토큰 정보가 없습니다. 다시 로그인해주세요.')
      }

      const local_visit_no = get_visit_no()

      if (local_visit_no === null) {
        throw new Error('방문 정보가 없어 추천 옵션을 저장할 수 없습니다.')
      }

      await save_visit_recommend({
        visit_no: local_visit_no,
        opt_recommend_json: ref_selected_obj,
      })

      // result.svelte 에서 보여주기 위해 선택한 질문/답변 라벨을 sessionStorage 에 저장한다.
      const local_lens_selection_arr = g_question_arr.map((local_question_obj) => {
        const local_selected_no_arr =
          ref_selected_obj[local_question_obj.question_text] ?? []
        const local_label_arr = local_selected_no_arr
          .map((local_no) => {
            const local_answer_obj = local_question_obj.answer_arr.find(
              (local_obj) => local_obj.option_no === local_no,
            )
            return local_answer_obj?.option_name ?? ''
          })
          .filter(Boolean)

        return {
          question_text: local_question_obj.question_text,
          label_arr: local_label_arr,
        }
      })
      sessionStorage.setItem(
        'retinal_lens_selections',
        JSON.stringify(local_lens_selection_arr),
      )

      window.location.href = PATH.analysisArFitting
    } catch (local_err) {
      g_error = local_err.message ?? '조건 저장에 실패했습니다.'
      g_loading = false
    }
  }

  onMount(() => {
    if (!ensure_session_auth_tokens()) {
      g_options_error = '로그인 토큰 정보가 없습니다. 다시 로그인해주세요.'
      g_options_loading = false
      return
    }

    get_recommend_option_arr()
      .then((local_option_arr) => {
        const local_normalized_arr = (Array.isArray(local_option_arr) ? local_option_arr : []).map(
          normalize_option_obj,
        )
        const local_question_arr = build_question_arr_from_option_arr(local_normalized_arr)

        g_question_arr = local_question_arr
        init_selected_obj(local_question_arr)
      })
      .catch((local_err) => {
        g_options_error = local_err.message ?? '옵션을 불러오지 못했습니다.'
      })
      .finally(() => {
        g_options_loading = false
      })
  })
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-zinc-950">
  <Header />

  <section class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--retina-text-100)] ">
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 pt-3 pb-2">
      <div class="text-center">
        <h1 class="m-0 text-[18px] font-extrabold tracking-[-0.02em] text-zinc-950">
          {g_customer_name}의 생활패턴
        </h1>
        <p class="m-0 mt-1 text-[12px] font-semibold text-slate-500">
          고객님이 안경을 착용하는 평소의 생활 환경을 알려주세요. (중복 선택 가능)
        </p>
      </div>

      <div class="mx-auto mt-3 w-full max-w-[820px]">
        {#if g_options_loading}
          <div class="grid place-items-center py-12">
            <span
              class="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--retina-primary-300)] border-t-transparent"
              aria-label="옵션 로딩 중"
            ></span>
          </div>
        {:else if g_options_error}
          <p
            class="mx-auto max-w-[640px] rounded-xl bg-red-50 px-5 py-3 text-center text-xs font-bold text-red-600"
            role="alert"
          >
            {g_options_error}
          </p>
        {:else if g_question_arr.length === 0}
          <p
            class="mx-auto max-w-[640px] rounded-xl bg-slate-50 px-5 py-3 text-center text-xs font-bold text-slate-500"
          >
            등록된 질문이 없습니다.
          </p>
        {:else}
          <div class="rounded-[16px] border border-slate-200 bg-white px-6 py-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
            {#each g_question_arr as question_obj, question_index (question_obj.question_text)}
              <section class={`text-left ${question_index === 0 ? '' : 'mt-3 border-t border-slate-100 pt-3'}`}>
                <h2 class="m-0 text-left text-[13px] font-extrabold text-zinc-950">
                  Q{question_index + 1}. {question_obj.question_text}
                </h2>

                {#if question_obj.is_slider && question_obj.answer_arr.length > 0}
                  {@const local_max_index = question_obj.answer_arr.length - 1}
                  {@const local_selected_index = get_slider_selected_index(question_obj)}
                  {@const local_value_index = local_selected_index < 0 ? 0 : local_selected_index}
                  {@const local_progress_pct =
                    local_max_index === 0 ? 100 : (local_value_index / local_max_index) * 100}
                  <div class="mt-3 px-2">
                    <div class="relative h-4 rounded-full bg-[var(--retina-primary-100)]">
                      <div
                        class="absolute left-0 top-0 h-full rounded-full bg-[var(--retina-primary-300)] transition-[width] duration-150"
                        style={`width: ${local_progress_pct}%`}
                      ></div>
                      <input
                        class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                        type="range"
                        min="0"
                        max={local_max_index}
                        step="1"
                        value={local_value_index}
                        aria-label={question_obj.question_text}
                        oninput={(local_event) => on_input_slider_answer(question_obj, local_event)}
                      />
                      <span
                        class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_2px_6px_rgba(249,115,22,0.45)] transition"
                        style={`left: ${local_progress_pct}%`}
                        aria-hidden="true"
                      ></span>
                    </div>
                    <div class="mt-2 flex justify-between text-[11px] font-bold text-slate-500">
                      {#each question_obj.answer_arr as answer_obj, answer_index (answer_obj.option_no)}
                        <span
                          class={answer_index === local_selected_index
                            ? 'text-[var(--retina-primary-300)]'
                            : 'text-slate-500'}
                        >
                          {answer_obj.option_name}
                        </span>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="mt-2 flex flex-wrap justify-start gap-1.5">
                    {#each question_obj.answer_arr as answer_obj (answer_obj.option_no)}
                      {@const local_active = is_selected(question_obj.question_text, answer_obj.option_no)}
                      <button
                        class={`inline-flex min-h-8 cursor-pointer items-center rounded-lg border px-4 text-[12px] font-bold transition ${
                          local_active
                            ? 'border-[var(--retina-primary-300)] bg-white text-[var(--retina-primary-300)] shadow-[0_3px_8px_rgba(249,115,22,0.18)]'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-[var(--retina-primary-300)]/60 hover:text-[var(--retina-primary-300)]'
                        }`}
                        type="button"
                        aria-pressed={local_active}
                        onclick={() =>
                          on_click_toggle_answer(question_obj.question_text, answer_obj.option_no)}
                      >
                        {answer_obj.option_name}
                      </button>
                    {/each}
                  </div>
                {/if}
              </section>
            {/each}
          </div>
        {/if}

        {#if g_error}
          <p
            class="mt-3 rounded-xl bg-red-50 px-5 py-3 text-center text-xs font-bold text-red-600"
            role="alert"
          >
            {g_error}
          </p>
        {/if}
      </div>
    </div>

    <div class="shrink-0 px-7 py-2.5">
      <div class="mx-auto w-full max-w-[820px]">
        <button
          class="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-0 bg-[var(--retina-primary-300)] px-5 text-[15px] font-extrabold text-white transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={g_loading}
          onclick={on_click_submit}
        >
          {#if g_loading}
            <span
              class="h-4 w-4 animate-spin rounded-full border-[2.5px] border-white border-t-transparent"
              aria-hidden="true"
            ></span>
            <span>저장 중...</span>
          {:else}
            <span>AR 피팅하기</span>
          {/if}
        </button>
      </div>
    </div>
  </section>
</main>
