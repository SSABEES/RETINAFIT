<script>
  import { onMount } from 'svelte'
  import { ChevronLeft, ChevronRight, Plus, Save, Trash2, X } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import {
    create_recommend_option,
    delete_recommend_option,
    get_recommend_option_arr,
    update_recommend_option,
  } from '@/lib/api/admin_recommend_options'

  // 질문 = option_category, 답변 = option_name 으로 매핑해 기존 추천 옵션 API 를 재사용한다.
  let g_question_arr = $state([])
  let g_is_loading = $state(true)
  let g_toast_message = $state('')
  let g_toast_variant = $state('success')
  let g_toast_timer = null

  // 현재 네브바에서 선택된 질문 텍스트
  let ref_active_question_text = $state('')
  // 새 질문 입력값
  let ref_new_question_text = $state('')
  // 질문 추가 모달 열림 여부
  let g_is_create_question_open = $state(false)
  // 질문별 새 답변 입력값 (key = 질문 텍스트)
  let ref_new_answer_text_obj = $state({})

  // 선택된 질문 객체 (없거나 목록에서 사라졌으면 null)
  let g_active_question_obj = $derived(
    g_question_arr.find(
      (question_obj) => question_obj.question_text === ref_active_question_text,
    ) ?? null,
  )

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

  function normalize_option_obj(option_obj) {
    return {
      option_no: Number(option_obj.option_no ?? 0),
      option_name: String(option_obj.option_name ?? ''),
      option_category: String(option_obj.option_category ?? ''),
      display_order: Number(option_obj.display_order ?? 0),
      is_active: Boolean(option_obj.is_active),
    }
  }

  // 추천 옵션 목록을 질문별로 그룹핑하여 질문 카드 배열을 만든다.
  // 질문(category) 단위 순서는 각 질문에 속한 답변들의 최소 display_order 로 결정한다.
  function build_question_arr_from_option_arr(option_arr) {
    const local_grouped_obj = {}

    for (const option_obj of option_arr) {
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
      answer_arr: question_obj.answer_arr.sort(
        (left_obj, right_obj) => left_obj.display_order - right_obj.display_order,
      ),
    }))

    return local_question_arr.sort((left_question_obj, right_question_obj) => {
      const local_left_min =
        left_question_obj.answer_arr[0]?.display_order ?? Number.MAX_SAFE_INTEGER
      const local_right_min =
        right_question_obj.answer_arr[0]?.display_order ?? Number.MAX_SAFE_INTEGER
      return local_left_min - local_right_min
    })
  }

  async function load_question_arr() {
    g_is_loading = true

    try {
      const local_option_arr = await get_recommend_option_arr()
      const local_normalized_arr = (Array.isArray(local_option_arr) ? local_option_arr : []).map(
        normalize_option_obj,
      )
      const local_loaded_question_arr = build_question_arr_from_option_arr(local_normalized_arr)
      const local_loaded_key_set = new Set(
        local_loaded_question_arr.map((question_obj) => question_obj.question_text),
      )
      // 답변이 0개인 상태로 추가된 질문(서버 반영 전)은 그대로 유지한다.
      const local_pending_question_arr = g_question_arr.filter(
        (question_obj) =>
          question_obj.answer_arr.length === 0 &&
          !local_loaded_key_set.has(question_obj.question_text),
      )

      const local_next_question_arr = [...local_loaded_question_arr, ...local_pending_question_arr]
      g_question_arr = local_next_question_arr

      // 선택된 질문이 사라졌거나 비어 있으면 첫 번째 질문으로 보정한다.
      const local_active_still_exists = local_next_question_arr.some(
        (question_obj) => question_obj.question_text === ref_active_question_text,
      )
      if (!local_active_still_exists) {
        ref_active_question_text = local_next_question_arr[0]?.question_text ?? ''
      }
    } catch (local_error) {
      const local_message =
        local_error instanceof Error
          ? local_error.message
          : '질문 목록 조회 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    } finally {
      g_is_loading = false
    }
  }

  function on_input_new_question_text(local_event) {
    ref_new_question_text = /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 새 질문을 화면 상태에 추가한다 (서버 저장은 첫 답변 등록 시 진행).
  function on_submit_create_question(local_event) {
    local_event.preventDefault()

    const local_question_text = ref_new_question_text.trim()

    if (!local_question_text) {
      show_toast('질문 내용을 입력해 주세요.', 'error')
      return
    }

    if (g_question_arr.some((question_obj) => question_obj.question_text === local_question_text)) {
      show_toast('이미 존재하는 질문입니다.', 'error')
      return
    }

    g_question_arr = [...g_question_arr, { question_text: local_question_text, answer_arr: [] }]
    ref_active_question_text = local_question_text
    ref_new_question_text = ''
    g_is_create_question_open = false
    show_toast('질문을 추가했습니다. 답변을 등록해 주세요.')
  }

  // 질문 추가 모달을 연다.
  function on_click_open_create_question() {
    ref_new_question_text = ''
    g_is_create_question_open = true
  }

  // 질문 추가 모달을 닫고 입력값을 초기화한다.
  function on_click_close_create_question() {
    g_is_create_question_open = false
    ref_new_question_text = ''
  }

  // 좌우 스와이프 / 마우스 드래그로 활성 질문을 옆으로 넘긴다. 네브바와 상세 카드가 함께 동기화.
  const SWIPE_THRESHOLD_PX = 60
  let g_swipe_start_x = /** @type {number | null} */ (null)
  let g_swipe_start_y = /** @type {number | null} */ (null)

  // 활성 질문을 delta(+1: 다음, -1: 이전) 만큼 이동. 양 끝에서 멈춤.
  function shift_active_question(delta) {
    const local_current_idx = g_question_arr.findIndex(
      (local_question_obj) => local_question_obj.question_text === ref_active_question_text,
    )
    if (local_current_idx < 0) return
    const local_next_idx = Math.max(
      0,
      Math.min(g_question_arr.length - 1, local_current_idx + delta),
    )
    if (local_next_idx === local_current_idx) return
    ref_active_question_text = g_question_arr[local_next_idx].question_text
  }

  /** @param {TouchEvent} local_event */
  function on_touchstart_swipe(local_event) {
    const local_touch = local_event.touches[0]
    if (!local_touch) return
    g_swipe_start_x = local_touch.clientX
    g_swipe_start_y = local_touch.clientY
  }

  /** @param {TouchEvent} local_event */
  function on_touchend_swipe(local_event) {
    if (g_swipe_start_x === null || g_swipe_start_y === null) return
    const local_touch = local_event.changedTouches[0]
    if (!local_touch) return
    const local_dx = local_touch.clientX - g_swipe_start_x
    const local_dy = local_touch.clientY - g_swipe_start_y
    g_swipe_start_x = null
    g_swipe_start_y = null
    // 세로 움직임이 더 크면 스크롤 의도 — 무시.
    if (Math.abs(local_dy) > Math.abs(local_dx)) return
    if (Math.abs(local_dx) < SWIPE_THRESHOLD_PX) return
    shift_active_question(local_dx < 0 ? 1 : -1)
  }

  /** @param {PointerEvent} local_event */
  function on_pointerdown_swipe(local_event) {
    // 터치는 touchstart 가 먼저 처리하므로 mouse 만 추적.
    if (local_event.pointerType !== 'mouse') return
    g_swipe_start_x = local_event.clientX
    g_swipe_start_y = local_event.clientY
  }

  /** @param {PointerEvent} local_event */
  function on_pointerup_swipe(local_event) {
    if (local_event.pointerType !== 'mouse') return
    if (g_swipe_start_x === null || g_swipe_start_y === null) return
    const local_dx = local_event.clientX - g_swipe_start_x
    const local_dy = local_event.clientY - g_swipe_start_y
    g_swipe_start_x = null
    g_swipe_start_y = null
    if (Math.abs(local_dy) > Math.abs(local_dx)) return
    if (Math.abs(local_dx) < SWIPE_THRESHOLD_PX) return
    shift_active_question(local_dx < 0 ? 1 : -1)
  }

  function on_input_new_answer_text(question_obj, local_event) {
    ref_new_answer_text_obj = {
      ...ref_new_answer_text_obj,
      [question_obj.question_text]: /** @type {HTMLInputElement} */ (local_event.currentTarget)
        .value,
    }
  }

  async function on_submit_create_answer(question_obj, local_event) {
    local_event.preventDefault()

    const local_answer_text = (ref_new_answer_text_obj[question_obj.question_text] ?? '').trim()

    if (!local_answer_text) {
      show_toast('답변 내용을 입력해 주세요.', 'error')
      return
    }

    try {
      await create_recommend_option({
        option_name: local_answer_text,
        option_category: question_obj.question_text,
        display_order: question_obj.answer_arr.length,
        is_active: true,
      })

      ref_new_answer_text_obj = {
        ...ref_new_answer_text_obj,
        [question_obj.question_text]: '',
      }
      show_toast('답변을 등록했습니다.')
      await load_question_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error ? local_error.message : '답변 등록 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  async function on_click_save_answer(answer_obj) {
    const local_answer_text = answer_obj.option_name.trim()

    if (!local_answer_text) {
      show_toast('답변 내용은 비워둘 수 없습니다.', 'error')
      return
    }

    try {
      await update_recommend_option({
        option_no: answer_obj.option_no,
        option_name: local_answer_text,
        option_category: answer_obj.option_category,
        is_active: answer_obj.is_active,
      })

      show_toast('답변을 수정했습니다.')
      await load_question_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error ? local_error.message : '답변 수정 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  async function on_click_delete_answer(answer_obj) {
    try {
      await delete_recommend_option({ option_no: answer_obj.option_no })

      show_toast('답변을 삭제했습니다.')
      await load_question_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error ? local_error.message : '답변 삭제 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  async function on_click_delete_question(question_obj) {
    try {
      if (question_obj.answer_arr.length > 0) {
        await Promise.all(
          question_obj.answer_arr.map((answer_obj) =>
            delete_recommend_option({ option_no: answer_obj.option_no }),
          ),
        )
      }

      g_question_arr = g_question_arr.filter(
        (local_question_obj) => local_question_obj.question_text !== question_obj.question_text,
      )

      show_toast('질문을 삭제했습니다.')
      await load_question_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error ? local_error.message : '질문 삭제 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  onMount(() => {
    load_question_arr()
  })
</script>

<AdminLayout active_key="lens">
  <section class="grid gap-3">
    {#if g_toast_message}
      <div class="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
        <div
          class={`rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] ${
            g_toast_variant === 'error' ? 'bg-[#B42318]' : 'bg-[var(--retina-primary-400)]'
          }`}
        >
          {g_toast_message}
        </div>
      </div>
    {/if}

    <div class="flex items-start justify-between gap-6">
      <div>
        <h2 class="m-0 text-2xl font-extrabold text-[var(--retina-text-800)]">
          렌즈 추천 질문 설정
        </h2>
        <p class="mt-1 mb-0 text-sm font-semibold text-[var(--retina-text-500)]">
          질문을 등록하고, 각 질문에 대해 선택 가능한 답변을 추가하세요.
        </p>
      </div>

      <button
        class="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[var(--retina-primary-600)] bg-white px-5 text-sm font-extrabold text-[var(--retina-primary-600)] transition hover:bg-[var(--retina-primary-50)]"
        type="button"
        onclick={on_click_open_create_question}
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>질문 추가</span>
      </button>
    </div>

    {#if g_is_loading}
      <div
        class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-10 text-center text-base font-bold text-[var(--retina-text-500)] shadow-sm shadow-slate-200/50"
      >
        질문 목록을 불러오는 중입니다.
      </div>
    {:else if g_question_arr.length === 0}
      <div
        class="rounded-2xl border border-dashed border-[var(--retina-text-200)] bg-white px-8 py-12 text-center text-sm font-bold text-[var(--retina-text-500)] shadow-sm shadow-slate-200/50"
      >
        등록된 질문이 없습니다. 위에서 [질문 추가]로 항목을 등록해 주세요.
      </div>
    {:else}
      {@const local_active_idx = g_question_arr.findIndex(
        (local_question_obj) => local_question_obj.question_text === ref_active_question_text,
      )}
      <!--
        스와이프 컨테이너 — 네브바와 상세 카드를 함께 감싸 좌우 드래그/스와이프로 활성 질문 전환.
        touch-pan-y 로 세로 스크롤은 그대로 두고, 가로 드래그만 활성 전환 트리거로 사용.
        활성 질문 하나만 칩으로 노출. 좌/우 화살표는 질문 순서 이동(display_order 갱신)
        — 스와이프(전체 컨테이너)와는 별개로 reorder 용도.
      -->
      <div
        class="grid gap-3 touch-pan-y"
        ontouchstart={on_touchstart_swipe}
        ontouchend={on_touchend_swipe}
        onpointerdown={on_pointerdown_swipe}
        onpointerup={on_pointerup_swipe}
      >
        <nav class="flex items-center" aria-label="질문 네브바">
          {#if g_active_question_obj && local_active_idx >= 0}
            <div
              class="flex h-14 w-full items-stretch justify-between gap-2 rounded-[14px] border border-[var(--retina-primary-400)] bg-[var(--retina-primary-400)] py-1.5 pl-2 pr-2 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(234,106,15,0.28)]"
            >
              <button
                class="grid h-full w-11 shrink-0 cursor-pointer place-items-center rounded-[10px] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                type="button"
                aria-label="이전 질문 보기"
                disabled={local_active_idx === 0}
                onclick={() => shift_active_question(-1)}
              >
                <ChevronLeft size={30} strokeWidth={2.6} aria-hidden="true" />
              </button>

              <span
                aria-pressed="true"
                class="flex min-w-0 flex-1 items-center justify-center gap-3 px-2 text-base font-extrabold text-white"
              >
                <span
                  class="grid h-full min-w-16 shrink-0 place-items-center rounded-full bg-white/20 px-3 text-base font-extrabold text-white"
                >
                  {local_active_idx + 1} / {g_question_arr.length}
                </span>
                <span class="min-w-0 truncate text-xl"
                  >{g_active_question_obj.question_text}</span
                >
              </span>

              <button
                class="grid h-full w-11 shrink-0 cursor-pointer place-items-center rounded-[10px] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                type="button"
                aria-label="다음 질문 보기"
                disabled={local_active_idx === g_question_arr.length - 1}
                onclick={() => shift_active_question(1)}
              >
                <ChevronRight size={30} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </div>
          {/if}
        </nav>

        {#if g_active_question_obj}
          <section
            class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-3 shadow-sm shadow-slate-200/50"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="m-0 text-xl font-extrabold text-[var(--retina-text-800)]">
                  {g_active_question_obj.question_text}
                </h3>
                <p class="mb-0 mt-1 text-sm font-semibold text-[var(--retina-text-500)]">
                  총 {g_active_question_obj.answer_arr.length}개 답변
                </p>
              </div>

              <button
                class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-sm font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                type="button"
                onclick={() => on_click_delete_question(g_active_question_obj)}
              >
                <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                <span>질문 삭제</span>
              </button>
            </div>

            <form
              class="mt-3 grid gap-2 rounded-2xl border border-[var(--retina-text-200)] bg-[var(--retina-primary-50)] px-5 py-3 md:grid-cols-[1fr_auto]"
              onsubmit={(local_event) =>
                on_submit_create_answer(g_active_question_obj, local_event)}
            >
              <label class="grid gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
                답변 내용
                <input
                  class="min-h-12 rounded-xl border border-[var(--retina-text-200)] bg-white px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
                  type="text"
                  value={ref_new_answer_text_obj[g_active_question_obj.question_text] ?? ''}
                  placeholder="답변 내용을 입력해 주세요."
                  oninput={(local_event) =>
                    on_input_new_answer_text(g_active_question_obj, local_event)}
                />
              </label>

              <button
                class="mt-[1.4rem] inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--retina-primary-300)] px-5 text-sm font-extrabold text-white transition hover:bg-[var(--retina-primary-400)]"
                type="submit"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                <span>답변 추가</span>
              </button>
            </form>

            {#if g_active_question_obj.answer_arr.length > 0}
              <div class="mt-3 grid gap-2">
                {#each g_active_question_obj.answer_arr as answer_obj (answer_obj.option_no)}
                  <article
                    class="grid gap-2 rounded-2xl border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-5 py-2 lg:grid-cols-[1fr_140px_auto] lg:items-center"
                  >
                    <input
                      class="min-h-12 rounded-xl border border-[var(--retina-text-200)] bg-white px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
                      type="text"
                      bind:value={answer_obj.option_name}
                    />

                    <label class="grid text-sm font-extrabold text-[var(--retina-text-500)]">
                      <span
                        class="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--retina-text-200)] bg-white px-4"
                      >
                        <input
                          class="h-4 w-4 accent-[var(--retina-primary-400)]"
                          type="checkbox"
                          bind:checked={answer_obj.is_active}
                        />
                        <span class="text-base font-bold text-[var(--retina-text-800)]">
                          {answer_obj.is_active ? '활성' : '비활성화'}
                        </span>
                      </span>
                    </label>

                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <button
                        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[var(--retina-primary-300)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--retina-primary-400)]"
                        type="button"
                        onclick={() => on_click_save_answer(answer_obj)}
                      >
                        <Save size={16} strokeWidth={2.3} aria-hidden="true" />
                        <span>저장</span>
                      </button>
                      <button
                        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-sm font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                        type="button"
                        onclick={() => on_click_delete_answer(answer_obj)}
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
                class="mt-5 rounded-2xl border border-dashed border-[var(--retina-text-200)] bg-white px-5 py-6 text-center text-sm font-bold text-[var(--retina-text-500)]"
              >
                등록된 답변이 없습니다. 위 입력란에서 답변을 추가해 주세요.
              </div>
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  </section>

  <!-- 질문 추가 모달 — 헤더의 [질문 추가] 버튼으로 열고 등록 또는 취소 시 닫힘. -->
  {#if g_is_create_question_open}
    <div
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 px-5"
      role="presentation"
      onclick={on_click_close_create_question}
    >
      <div
        class="w-full max-w-[420px] rounded-[18px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] text-left shadow-[0_12px_30px_rgba(19,25,40,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-question-title"
        tabindex="-1"
        onclick={(local_event) => local_event.stopPropagation()}
        onkeydown={(local_event) => local_event.stopPropagation()}
      >
        <header
          class="flex min-h-10 items-center justify-between rounded-t-[18px] border-b border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-4 py-2"
        >
          <h2
            id="create-question-title"
            class="m-0 text-base font-extrabold text-[var(--retina-text-800)]"
          >
            질문 추가
          </h2>
          <button
            class="grid h-8 w-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
            type="button"
            aria-label="질문 추가 닫기"
            onclick={on_click_close_create_question}
          >
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <form class="grid gap-3 px-4 py-4" onsubmit={on_submit_create_question}>
          <label
            class="grid gap-1 text-xs font-bold text-[var(--retina-text-700)]"
            for="new-question-text"
          >
            <span>질문 내용 <span class="text-[#dc2626]">*</span></span>
            <input
              id="new-question-text"
              class="min-h-10 rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] px-3 text-sm font-semibold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-bg-1)]/40"
              type="text"
              value={ref_new_question_text}
              placeholder="예: 평소 어떤 활동을 자주 하시나요?"
              oninput={on_input_new_question_text}
              autofocus
              required
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <button
              class="min-h-10 cursor-pointer rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] text-sm font-extrabold text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)]"
              type="button"
              onclick={on_click_close_create_question}
            >
              취소
            </button>
            <button
              class="min-h-10 cursor-pointer rounded-md border-0 bg-[var(--retina-primary-600)] text-sm font-extrabold text-[var(--retina-text-100)] transition hover:bg-[var(--retina-primary-700)]"
              type="submit"
            >
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</AdminLayout>
