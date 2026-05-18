<script>
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import { navigate } from '@maks11060/svelte5-router'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { ensure_session_auth_tokens } from '@/lib/api/session_auth'
  import { get_recommend_option_arr } from '@/lib/api/recommend_options'
  import { save_visit_recommend } from '@/lib/api/visit'
  import { selected_customer_obj } from '@/lib/stores/customer'
  import { push_error_toast } from '@/lib/stores/toast'
  import { trigger_visit_list_reload } from '@/lib/stores/visit_list_reload'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import BottomActionBar from '@/components/analysis/bottom_action_bar.svelte'

  /**
   * @typedef {{
   *   option_no: number,
   *   option_name: string,
   *   option_category: string,
   *   display_order: number,
   *   is_active: boolean,
   * }} OptionObj
   *
   * @typedef {{
   *   question_text: string,
   *   answer_arr: OptionObj[],
   *   is_slider: boolean,
   * }} QuestionObj
   */

  // 질문 = option_category, 답변 = { option_no, option_name } 으로 매핑된다.
  let g_question_arr = $state(/** @type {QuestionObj[]} */ ([]))
  let g_options_loading = $state(true)
  let g_loading = $state(false)
  // key = 질문 텍스트, value = 선택된 option_no 배열. 칩 질문은 다중 선택, 슬라이더 질문은 단일 값.
  let ref_selected_obj = $state(/** @type {Record<string, number[]>} */ ({}))

  // 위저드 진행 상태 — 한 번에 질문 1개만 노출한다.
  let g_current_index = $state(0)
  // 질문 전환 슬라이드 방향: 1=다음(오른쪽에서 진입), -1=이전(왼쪽에서 진입).
  let g_direction = $state(1)

  const g_total_count = $derived(g_question_arr.length)
  const g_current_question_obj = $derived(g_question_arr[g_current_index] ?? null)
  const g_is_last_question = $derived(g_total_count > 0 && g_current_index >= g_total_count - 1)
  const g_is_first_question = $derived(g_current_index <= 0)

  // 현재 질문에 선택된 답변이 하나라도 있는지 — '다음으로' 버튼 활성화 조건.
  const g_has_current_selection = $derived.by(() => {
    if (!g_current_question_obj) return false
    return (ref_selected_obj[g_current_question_obj.question_text]?.length ?? 0) > 0
  })

  const g_customer_name = $derived.by(() => {
    const local_name = $selected_customer_obj?.name?.trim()
    // 비회원/게스트 방문은 이름 자리를 비워 "고객의 생활패턴" 으로 표시.
    if (!local_name || local_name === '비회원') return '고객'
    return local_name.endsWith('님') ? local_name : `${local_name} 고객님`
  })

  /** @param {Record<string, unknown>} option_obj */
  function normalize_option_obj(option_obj) {
    return {
      option_no: Number(option_obj.option_no ?? 0),
      option_name: String(option_obj.option_name ?? ''),
      option_category: String(option_obj.option_category ?? ''),
      display_order: Number(option_obj.display_order ?? 0),
      is_active: Boolean(option_obj.is_active),
    }
  }

  /**
   * 슬라이더 UI 로 표시할 질문(스마트폰·모니터·TV 시청 시간) 인지 텍스트로 판별한다.
   * @param {unknown} question_text
   */
  function is_slider_question_text(question_text) {
    const local_text = String(question_text ?? '')
    return (
      local_text.includes('보는 시간') ||
      (local_text.includes('스마트폰') && local_text.includes('TV'))
    )
  }

  /**
   * 추천 옵션 목록을 질문(category) 단위로 그룹핑한다.
   * @param {OptionObj[]} option_arr
   * @returns {QuestionObj[]}
   */
  function build_question_arr_from_option_arr(option_arr) {
    /** @type {Record<string, { question_text: string, answer_arr: OptionObj[] }>} */
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

  // 슬라이더 질문에서 현재 선택된 답변의 인덱스를 구한다 (없으면 -1).
  /** @param {QuestionObj} question_obj */
  function get_slider_selected_index(question_obj) {
    const local_selected_arr = ref_selected_obj[question_obj.question_text] ?? []
    if (local_selected_arr.length === 0) return -1
    const local_selected_no = local_selected_arr[0]
    return question_obj.answer_arr.findIndex(
      (answer_obj) => answer_obj.option_no === local_selected_no,
    )
  }

  // 슬라이더 질문은 단일 선택 UI 라 "선택 없음" 상태가 어색하므로 첫 번째 답변을 기본 선택값으로 채운다.
  /** @param {QuestionObj[]} question_arr */
  function init_selected_obj(question_arr) {
    /** @type {Record<string, number[]>} */
    const local_selected_obj = {}
    for (const question_obj of question_arr) {
      const local_first_answer_obj = question_obj.answer_arr?.[0]
      local_selected_obj[question_obj.question_text] =
        question_obj.is_slider && local_first_answer_obj ? [local_first_answer_obj.option_no] : []
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

  /**
   * 해당 질문에서 특정 답변이 선택돼 있는지 여부.
   * @param {string} question_text
   * @param {number} option_no
   */
  function is_selected(question_text, option_no) {
    return ref_selected_obj[question_text]?.includes(option_no) ?? false
  }

  // 슬라이더 질문은 단일 값 — 기존 선택을 덮어쓴다.
  /**
   * @param {string} question_text
   * @param {number} option_no
   */
  function set_single_answer(question_text, option_no) {
    ref_selected_obj = { ...ref_selected_obj, [question_text]: [option_no] }
  }

  // 칩 답변 다중 선택 토글 — 이미 선택돼 있으면 해제, 아니면 추가한다.
  /**
   * @param {string} question_text
   * @param {number} option_no
   */
  function toggle_answer(question_text, option_no) {
    const local_current_arr = ref_selected_obj[question_text] ?? []
    const local_next_arr = local_current_arr.includes(option_no)
      ? local_current_arr.filter((local_no) => local_no !== option_no)
      : [...local_current_arr, option_no]
    ref_selected_obj = { ...ref_selected_obj, [question_text]: local_next_arr }
  }

  // 다음 질문으로 즉시 이동한다 (정방향 슬라이드).
  function go_to_next_question() {
    g_direction = 1
    g_current_index = Math.min(g_current_index + 1, g_total_count - 1)
  }

  // 칩 답변 클릭 — 다중 선택 토글만 한다. 질문 전환은 '다음으로' 버튼으로만 이뤄진다.
  /**
   * @param {QuestionObj} question_obj
   * @param {number} option_no
   */
  function on_click_chip_answer(question_obj, option_no) {
    if (g_loading) return
    toggle_answer(question_obj.question_text, option_no)
  }

  // 슬라이더 드래그 중 — 값(선택 답변)을 실시간으로 갱신해 thumb/진행바가 따라오게 한다.
  /**
   * @param {QuestionObj} question_obj
   * @param {Event} local_event
   */
  function on_input_slider_answer(question_obj, local_event) {
    const local_index = Number(/** @type {HTMLInputElement} */ (local_event.currentTarget).value)
    const local_answer_obj = question_obj.answer_arr[local_index]
    if (!local_answer_obj) return
    set_single_answer(question_obj.question_text, local_answer_obj.option_no)
  }

  // 이전 질문으로 — 역방향으로 슬라이드한다.
  function on_click_prev_question() {
    if (g_is_first_question) return
    g_direction = -1
    g_current_index -= 1
  }

  // 다음으로 — 선택한 답변을 그대로 두고 다음 질문으로 이동한다.
  function on_click_next_question() {
    if (g_loading || g_is_last_question) return
    go_to_next_question()
  }

  // 현재 질문을 답변 없이 건너뛰고 다음 질문으로 이동한다.
  function on_click_skip_question() {
    if (g_loading || g_is_last_question) return
    go_to_next_question()
  }

  let g_is_from_detail = $state(false)

  // 헤더 뒤로가기 — 페이지 단위 이동 (위저드 내 '이전' 버튼과는 별개).
  function on_click_back() {
    const local_return_path = sessionStorage.getItem('retinal_detail_return_path')
    if (local_return_path) {
      sessionStorage.removeItem('retinal_detail_return_path')
      navigate(local_return_path)
      return
    }
    window.history.back()
  }

  // 선택한 추천 옵션을 방문 데이터에 저장한 뒤 AR 피팅 화면으로 이동한다.
  async function on_click_submit() {
    if (g_loading) return
    g_loading = true

    try {
      if (!ensure_session_auth_tokens()) {
        throw new Error('로그인 토큰 정보가 없습니다. 다시 로그인해주세요.')
      }

      const local_visit_no = get_visit_no()

      if (local_visit_no === null) {
        throw new Error('방문 정보가 없어 추천 옵션을 저장할 수 없습니다.')
      }

      // result.svelte 에서 표시할 수 있도록 질문/답변 라벨까지 함께 PATCH 한다.
      const local_lens_selection_arr = g_question_arr.map((local_question_obj) => {
        const local_selected_no_arr = ref_selected_obj[local_question_obj.question_text] ?? []
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

      await save_visit_recommend({
        visit_no: local_visit_no,
        opt_recommend_json: {
          selection_obj: ref_selected_obj,
          selection_arr: local_lens_selection_arr,
          saved_at: new Date().toISOString(),
        },
      })

      const local_return_path = sessionStorage.getItem('retinal_detail_return_path')
      if (local_return_path) {
        sessionStorage.removeItem('retinal_detail_return_path')
        trigger_visit_list_reload()
        navigate(local_return_path)
      } else {
        navigate(PATH.analysisArFitting)
      }
    } catch (local_err) {
      const local_message =
        local_err instanceof Error ? local_err.message : '조건 저장에 실패했습니다.'
      push_error_toast(local_message)
      g_loading = false
    }
  }

  onMount(() => {
    g_is_from_detail = Boolean(sessionStorage.getItem('retinal_detail_return_path'))

    if (!ensure_session_auth_tokens()) {
      push_error_toast('로그인 토큰 정보가 없습니다. 다시 로그인해주세요.')
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
        // 위저드는 항상 첫 질문부터 시작.
        g_current_index = 0
        g_direction = 1
      })
      .catch((local_err) => {
        push_error_toast(local_err.message ?? '옵션을 불러오지 못했습니다.')
      })
      .finally(() => {
        g_options_loading = false
      })
  })
</script>

<AnalysisPageLayout
  current_step={2}
  bg_class="bg-[var(--retina-text-100)] text-zinc-950"
  fit_viewport={true}
  onback={on_click_back}
>
  <section class="flex min-h-0 flex-1 flex-col">
    <!-- 헤더: 제목 + 안내 -->
    <div class="shrink-0 text-center px-[clamp(12px,3svh,40px)] pt-[clamp(6px,1.6svh,20px)]">
      <h1
        class="m-0 font-extrabold tracking-[-0.02em] text-zinc-950 text-[clamp(14px,3.1svh,34px)]"
      >
        {g_customer_name}의 생활패턴
      </h1>
      <p class="m-0 font-semibold text-slate-500 text-[clamp(10px,2svh,20px)]">
        안경을 착용하는 평소 생활 환경을 알려주세요. 해당하는 답을 모두 고른 뒤 '다음으로'를 눌러주세요.
      </p>
    </div>

    {#if !g_options_loading && g_total_count > 0}
      <!-- 진행도 바: 이전 버튼 + 점 인디케이터 + 진행 카운트 -->
      <div
        class="shrink-0 mx-auto flex w-full max-w-[clamp(480px,52vw,860px)] items-center gap-3 px-[clamp(12px,3svh,40px)] mt-[clamp(4px,1.4svh,18px)]"
      >
        <div class="flex flex-1 justify-start">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-0.5 rounded-md border-0 bg-transparent font-bold text-slate-500 transition hover:text-[var(--retina-primary-300)] disabled:cursor-default disabled:opacity-0 text-[clamp(11px,2svh,18px)]"
            disabled={g_is_first_question}
            onclick={on_click_prev_question}
          >
            <ChevronLeft class="h-[1.15em] w-[1.15em]" />
            이전
          </button>
        </div>

        <div class="flex items-center gap-[clamp(3px,0.8svh,7px)]" aria-hidden="true">
          {#each g_question_arr as _question_obj, dot_index (dot_index)}
            <span
              class={`rounded-full transition-all duration-300 h-[clamp(5px,1svh,10px)] ${
                dot_index === g_current_index
                  ? 'w-[clamp(16px,3svh,30px)] bg-[var(--retina-primary-300)]'
                  : dot_index < g_current_index
                    ? 'w-[clamp(5px,1svh,10px)] bg-[var(--retina-primary-300)]'
                    : 'w-[clamp(5px,1svh,10px)] bg-slate-300'
              }`}
            ></span>
          {/each}
        </div>

        <div class="flex flex-1 justify-end">
          <span class="font-extrabold tabular-nums text-slate-400 text-[clamp(11px,2svh,18px)]">
            {g_current_index + 1} / {g_total_count}
          </span>
        </div>
      </div>
    {/if}

    <!--
      질문 뷰포트: 한 질문씩만 노출. {#key} 로 질문이 바뀔 때마다 슬라이드+페이드(fly) 전환.
      두 질문이 전환 중 겹쳐 슬라이드하도록 absolute inset-0 배치, overflow-hidden 으로 좌우 클립.
    -->
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden" aria-live="polite">
      {#if g_options_loading}
        <div class="grid flex-1 place-items-center">
          <span
            class="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--retina-primary-300)] border-t-transparent"
            aria-label="옵션 로딩 중"
          ></span>
        </div>
      {:else if g_total_count === 0}
        <div class="grid flex-1 place-items-center px-6">
          <p
            class="rounded-xl bg-slate-50 px-5 py-4 text-center text-sm font-bold text-slate-500"
          >
            등록된 질문이 없습니다.
          </p>
        </div>
      {:else}
        {#key g_current_index}
          <div
            class="absolute inset-0 flex flex-col items-center overflow-hidden px-[clamp(12px,3svh,40px)] py-[clamp(6px,1.6svh,18px)]"
            in:fly={{ x: g_direction * 64, duration: 300 }}
            out:fly={{ x: g_direction * -64, duration: 240 }}
          >
            {#if g_current_question_obj}
              <div
                class="flex flex-col flex-1 min-h-0 w-full max-w-[clamp(480px,52vw,860px)] overflow-y-auto rounded-[20px] border border-slate-200 bg-white text-center shadow-[0_10px_28px_rgba(15,23,42,0.08)] px-[clamp(20px,5svh,64px)] pt-[clamp(16px,4.5svh,60px)] pb-[clamp(16px,4svh,48px)]"
              >
                <p
                  class="m-0 font-extrabold tracking-wide text-[var(--retina-primary-300)] text-[clamp(14px,2.8svh,28px)]"
                >
                  Q{g_current_index + 1}
                </p>
                <h2
                  class="m-0 mt-[clamp(6px,1.6svh,20px)] font-extrabold leading-snug text-zinc-950 text-[clamp(18px,3.8svh,44px)]"
                >
                  {g_current_question_obj.question_text}
                </h2>

                {#if g_current_question_obj.is_slider && g_current_question_obj.answer_arr.length > 0}
                  {@const local_max_index = g_current_question_obj.answer_arr.length - 1}
                  {@const local_selected_index =
                    get_slider_selected_index(g_current_question_obj)}
                  {@const local_value_index =
                    local_selected_index < 0 ? 0 : local_selected_index}
                  {@const local_progress_pct =
                    local_max_index === 0 ? 100 : (local_value_index / local_max_index) * 100}
                  <div class="mt-[clamp(16px,4svh,44px)] px-[clamp(4px,1.5svh,16px)]">
                    <div
                      class="relative h-[clamp(10px,2.4svh,24px)] rounded-full bg-[var(--retina-primary-100)]"
                    >
                      <div
                        class="absolute top-0 left-0 h-full rounded-full bg-[var(--retina-primary-300)] transition-[width] duration-150"
                        style={`width: ${local_progress_pct}%`}
                      ></div>
                      <input
                        class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                        type="range"
                        min="0"
                        max={local_max_index}
                        step="1"
                        value={local_value_index}
                        aria-label={g_current_question_obj.question_text}
                        oninput={(local_event) =>
                          on_input_slider_answer(g_current_question_obj, local_event)}
                      />
                      <span
                        class="pointer-events-none absolute top-1/2 h-[clamp(18px,4svh,38px)] w-[clamp(18px,4svh,38px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--retina-primary-300)] shadow-[0_2px_8px_rgba(249,115,22,0.5)] transition"
                        style={`left: ${local_progress_pct}%`}
                        aria-hidden="true"
                      ></span>
                    </div>
                    <div
                      class="mt-[clamp(6px,1.6svh,16px)] flex justify-between font-bold text-[clamp(10px,1.9svh,18px)]"
                    >
                      {#each g_current_question_obj.answer_arr as answer_obj, answer_index (answer_obj.option_no)}
                        <span
                          class={answer_index === local_value_index
                            ? 'text-[var(--retina-primary-400)]'
                            : 'text-slate-400'}
                        >
                          {answer_obj.option_name}
                        </span>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div
                    class="mt-[clamp(12px,3svh,36px)] flex flex-wrap justify-center gap-[clamp(8px,1.8svh,18px)]"
                  >
                    {#each g_current_question_obj.answer_arr as answer_obj (answer_obj.option_no)}
                      {@const local_active = is_selected(
                        g_current_question_obj.question_text,
                        answer_obj.option_no,
                      )}
                      <button
                        class={`cursor-pointer rounded-xl border-2 font-bold transition min-h-[clamp(48px,8.5svh,88px)] px-[clamp(18px,4svh,42px)] py-[clamp(8px,1.8svh,18px)] text-[clamp(14px,3svh,32px)] ${
                          local_active
                            ? 'border-[var(--retina-primary-300)] bg-[var(--retina-primary-100)] text-[var(--retina-primary-400)] shadow-[0_4px_12px_rgba(249,115,22,0.22)] scale-[1.03]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--retina-primary-300)]/60 hover:text-[var(--retina-primary-300)]'
                        }`}
                        type="button"
                        aria-pressed={local_active}
                        onclick={() =>
                          on_click_chip_answer(g_current_question_obj, answer_obj.option_no)}
                      >
                        {answer_obj.option_name}
                      </button>
                    {/each}
                  </div>
                {/if}

                <!-- 건너뛰기 / 다음으로 — 질문 카드 하단에 배치. 마지막 질문은 하단 제출 버튼으로 마무리한다. -->
                {#if !g_is_last_question}
                  <div
                    class="mt-auto flex w-full items-center justify-center gap-[clamp(8px,2svh,20px)] pt-[clamp(12px,3svh,32px)]"
                  >
                    <button
                      type="button"
                      class="inline-flex cursor-pointer items-center rounded-lg border-0 bg-transparent font-bold text-slate-400 transition hover:text-[var(--retina-primary-300)] px-[clamp(12px,3svh,28px)] py-[clamp(8px,1.8svh,18px)] text-[clamp(12px,2.8svh,26px)]"
                      onclick={on_click_skip_question}
                    >
                      건너뛰기
                    </button>
                    <button
                      type="button"
                      class="inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-[var(--retina-primary-300)] font-bold text-[var(--retina-surface)] transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-40 px-[clamp(18px,4svh,42px)] py-[clamp(8px,1.8svh,18px)] text-[clamp(12px,2.8svh,26px)]"
                      disabled={!g_has_current_selection}
                      onclick={on_click_next_question}
                    >
                      다음으로
                      <ChevronRight class="h-[1.15em] w-[1.15em]" />
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/key}
      {/if}
    </div>

    <BottomActionBar padding_class="px-[clamp(8px,2svh,16px)] py-[clamp(3px,0.95svh,11px)]">
      <!--
        하단 영역은 고정 높이 행 — 마지막 질문은 제출 버튼이 채우고, 그 외 질문은 비워둔다
        (질문 이동 버튼은 질문 카드 하단에 있다). 행 높이를 고정해 하단 바 높이 점프를 막는다.
      -->
      <div
        class="mx-auto flex h-[clamp(40px,7.5svh,80px)] w-full max-w-[clamp(480px,52vw,860px)] items-center justify-center"
      >
        {#if g_is_last_question}
          <button
            class="inline-flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--retina-primary-300)] tracking-tight text-[var(--retina-surface)] transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60 px-[clamp(12px,3svh,36px)] text-[clamp(14px,3.2svh,30px)]"
            type="button"
            disabled={g_loading}
            onclick={on_click_submit}
          >
            {#if g_loading}
              <span
                class="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white border-t-transparent"
                aria-hidden="true"
              ></span>
              <span>저장 중...</span>
            {:else}
              <span>{g_is_from_detail ? '생활패턴 저장' : 'AR 피팅하기'}</span>
            {/if}
          </button>
        {/if}
      </div>
    </BottomActionBar>
  </section>

  <LoadingOverlay open={g_loading} label="추천 옵션 저장 중..." />
</AnalysisPageLayout>
