<script>
  import { onMount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { Plus, Save, Trash2 } from 'lucide-svelte'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'
  import {
    create_fitting_criteria,
    delete_fitting_criteria,
    get_fitting_criteria_arr,
    update_fitting_criteria,
  } from '@/lib/api/admin_fitting_criteria'

  // 각 얼굴형 카드 안에 표시되는 측정 항목 (단위 포함)
  const MEASUREMENT_ARR = [
    { key: '얼굴 너비', unit: 'mm' },
    { key: '얼굴 길이', unit: 'mm' },
    { key: '얼굴 비율', unit: ':1' },
    { key: '광대 너비', unit: 'mm' },
    { key: '턱 너비', unit: 'mm' },
  ]

  // criteria_label 은 "얼굴형/측정 항목" 으로 인코딩한다.
  function get_criteria_key(shape_key, measurement_key) {
    return `${shape_key}/${measurement_key}`
  }

  // 한 셀(얼굴형 × 측정 항목)에 들어갈 빈 값 객체를 만든다.
  function create_empty_cell_obj() {
    return {
      criteria_no: null,
      lower_bound: null,
      upper_bound: null,
      out_of_range_note: '',
      is_active: true,
    }
  }

  // 특정 얼굴형의 5개 측정 항목 셀을 매트릭스에 만들어 둔다.
  function ensure_shape_cells(matrix_obj, shape_key) {
    for (const measurement_obj of MEASUREMENT_ARR) {
      const local_key = get_criteria_key(shape_key, measurement_obj.key)
      if (!matrix_obj[local_key]) {
        matrix_obj[local_key] = create_empty_cell_obj()
      }
    }
  }

  let g_face_shape_arr = $state([])
  let g_criteria_matrix_obj = $state({})
  let g_extra_criteria_arr = $state([])
  let g_is_loading = $state(true)
  let g_saving_shape_key = $state('')
  let g_toast_message = $state('')
  let g_toast_variant = $state('success')
  let g_toast_timer = null

  // 새 얼굴형 추가 폼 상태
  let ref_new_shape_key = $state('')
  let ref_new_shape_en = $state('')

  // 결과를 짧게 토스트로 보여주고 자동으로 닫는다.
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

  // 입력값을 안전하게 숫자로 읽어온다. 빈 문자열은 null 로 둔다.
  function parse_number_or_null(value) {
    if (value === '' || value === null || value === undefined) return null
    const local_number = Number(value)
    return Number.isFinite(local_number) ? local_number : null
  }

  // 판단 기준 목록을 다시 불러와 얼굴형 목록과 매트릭스를 채워 넣는다.
  async function load_criteria_arr() {
    g_is_loading = true

    try {
      const local_criteria_arr = await get_fitting_criteria_arr()
      const local_matrix_obj = {}
      const local_extra_arr = []
      const local_shape_key_set = new SvelteSet()

      // 사용자가 이번 세션에 추가했지만 아직 저장 전인 얼굴형도 유지한다.
      for (const shape_obj of g_face_shape_arr) {
        local_shape_key_set.add(shape_obj.key)
      }

      for (const criteria_obj of Array.isArray(local_criteria_arr) ? local_criteria_arr : []) {
        const local_label = String(criteria_obj.criteria_label ?? '')
        const local_split_index = local_label.indexOf('/')

        if (local_split_index <= 0) {
          local_extra_arr.push(normalize_extra_criteria(criteria_obj))
          continue
        }

        const local_shape_key = local_label.slice(0, local_split_index)
        const local_measurement_key = local_label.slice(local_split_index + 1)
        const local_is_known_measurement = MEASUREMENT_ARR.some(
          (measurement_obj) => measurement_obj.key === local_measurement_key,
        )

        if (!local_is_known_measurement) {
          local_extra_arr.push(normalize_extra_criteria(criteria_obj))
          continue
        }

        local_shape_key_set.add(local_shape_key)
        local_matrix_obj[local_label] = {
          criteria_no: Number(criteria_obj.criteria_no ?? 0) || null,
          lower_bound: criteria_obj.lower_bound ?? null,
          upper_bound: criteria_obj.upper_bound ?? null,
          out_of_range_note: String(criteria_obj.out_of_range_note ?? ''),
          is_active: Boolean(criteria_obj.is_active),
        }
      }

      // 매트릭스의 모든 얼굴형에 대해 5개 셀이 존재하도록 보정한다.
      const local_face_shape_arr = []
      for (const local_shape_key of local_shape_key_set) {
        ensure_shape_cells(local_matrix_obj, local_shape_key)
        local_face_shape_arr.push({
          key: local_shape_key,
          en: g_face_shape_arr.find((shape_obj) => shape_obj.key === local_shape_key)?.en ?? '',
        })
      }

      g_face_shape_arr = local_face_shape_arr
      g_criteria_matrix_obj = local_matrix_obj
      g_extra_criteria_arr = local_extra_arr
    } catch (local_error) {
      const local_message =
        local_error instanceof Error
          ? local_error.message
          : '판단 기준 조회 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    } finally {
      g_is_loading = false
    }
  }

  // 매트릭스 형식이 아닌 기존 데이터를 정규화한다.
  function normalize_extra_criteria(criteria_obj) {
    return {
      criteria_no: Number(criteria_obj.criteria_no ?? 0),
      criteria_label: String(criteria_obj.criteria_label ?? ''),
      range_type: String(criteria_obj.range_type ?? 'BETWEEN'),
      lower_bound: Number(criteria_obj.lower_bound ?? 0),
      upper_bound: Number(criteria_obj.upper_bound ?? 0),
      out_of_range_note: String(criteria_obj.out_of_range_note ?? ''),
      is_active: Boolean(criteria_obj.is_active),
    }
  }

  // 새 얼굴형 추가 폼의 입력값을 갱신한다.
  function on_input_new_shape_key(local_event) {
    ref_new_shape_key = /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  function on_input_new_shape_en(local_event) {
    ref_new_shape_en = /** @type {HTMLInputElement} */ (local_event.currentTarget).value
  }

  // 새 얼굴형을 매트릭스에 추가한다 (저장 전, 화면 상태에만 반영).
  function on_submit_create_face_shape(local_event) {
    local_event.preventDefault()

    const local_shape_key = ref_new_shape_key.trim()
    const local_shape_en = ref_new_shape_en.trim()

    if (!local_shape_key) {
      show_toast('얼굴형 이름을 입력해 주세요.', 'error')
      return
    }

    if (g_face_shape_arr.some((shape_obj) => shape_obj.key === local_shape_key)) {
      show_toast('이미 존재하는 얼굴형입니다.', 'error')
      return
    }

    const local_next_matrix_obj = { ...g_criteria_matrix_obj }
    ensure_shape_cells(local_next_matrix_obj, local_shape_key)

    g_criteria_matrix_obj = local_next_matrix_obj
    g_face_shape_arr = [...g_face_shape_arr, { key: local_shape_key, en: local_shape_en }]

    ref_new_shape_key = ''
    ref_new_shape_en = ''

    show_toast('얼굴형을 추가했습니다. 값을 입력하고 저장해 주세요.')
  }

  // 특정 얼굴형의 5개 측정값을 저장한다 (값이 입력된 셀만 upsert).
  async function on_click_save_face_shape(shape_obj) {
    if (g_saving_shape_key) return
    g_saving_shape_key = shape_obj.key

    try {
      const local_request_arr = []

      for (const measurement_obj of MEASUREMENT_ARR) {
        const local_key = get_criteria_key(shape_obj.key, measurement_obj.key)
        const local_cell_obj = g_criteria_matrix_obj[local_key]
        if (!local_cell_obj) continue

        const local_lower = parse_number_or_null(local_cell_obj.lower_bound)
        const local_upper = parse_number_or_null(local_cell_obj.upper_bound)

        if (local_lower === null && local_upper === null) continue

        if (local_lower !== null && local_upper !== null && local_lower > local_upper) {
          throw new Error(`${measurement_obj.key} 의 최소값은 최대값보다 클 수 없습니다.`)
        }

        // 백엔드 스키마는 lower_bound/upper_bound 가 Optional[int] 이므로 정수로 보낸다.
        const local_body_obj = {
          criteria_label: local_key,
          range_type: 'NORMAL',
          lower_bound: local_lower !== null ? Math.round(local_lower) : null,
          upper_bound: local_upper !== null ? Math.round(local_upper) : null,
          out_of_range_note: (local_cell_obj.out_of_range_note ?? '').trim() || null,
          is_active: local_cell_obj.is_active !== false,
        }

        if (local_cell_obj.criteria_no) {
          local_request_arr.push(
            update_fitting_criteria({ criteria_no: local_cell_obj.criteria_no, ...local_body_obj }),
          )
        } else {
          local_request_arr.push(create_fitting_criteria(local_body_obj))
        }
      }

      if (local_request_arr.length === 0) {
        show_toast('저장할 값이 없습니다.', 'error')
        return
      }

      await Promise.all(local_request_arr)
      show_toast(`${shape_obj.key} 기준을 저장했습니다.`)
      await load_criteria_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error
          ? local_error.message
          : '판단 기준 저장 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    } finally {
      g_saving_shape_key = ''
    }
  }

  // 특정 얼굴형 카드를 제거한다 (해당 얼굴형의 모든 기준을 삭제).
  async function on_click_delete_face_shape(shape_obj) {
    const local_delete_no_arr = []
    for (const measurement_obj of MEASUREMENT_ARR) {
      const local_cell_obj =
        g_criteria_matrix_obj[get_criteria_key(shape_obj.key, measurement_obj.key)]
      if (local_cell_obj?.criteria_no) {
        local_delete_no_arr.push(local_cell_obj.criteria_no)
      }
    }

    try {
      if (local_delete_no_arr.length > 0) {
        await Promise.all(
          local_delete_no_arr.map((criteria_no) => delete_fitting_criteria({ criteria_no })),
        )
      }

      g_face_shape_arr = g_face_shape_arr.filter(
        (local_shape_obj) => local_shape_obj.key !== shape_obj.key,
      )
      const local_next_matrix_obj = { ...g_criteria_matrix_obj }
      for (const measurement_obj of MEASUREMENT_ARR) {
        delete local_next_matrix_obj[get_criteria_key(shape_obj.key, measurement_obj.key)]
      }
      g_criteria_matrix_obj = local_next_matrix_obj

      show_toast(`${shape_obj.key} 얼굴형을 삭제했습니다.`)
      await load_criteria_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error ? local_error.message : '얼굴형 삭제 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  // 기타 기준(매트릭스 밖의 항목)을 삭제한다.
  async function on_click_delete_extra_criteria(criteria_obj) {
    try {
      await delete_fitting_criteria({ criteria_no: criteria_obj.criteria_no })
      show_toast('기타 기준을 삭제했습니다.')
      await load_criteria_arr()
    } catch (local_error) {
      const local_message =
        local_error instanceof Error
          ? local_error.message
          : '판단 기준 삭제 중 오류가 발생했습니다.'
      show_toast(local_message, 'error')
    }
  }

  onMount(() => {
    load_criteria_arr()
  })
</script>

<AdminLayout active_key="face">
  <section class="grid gap-6">
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

    <h2
      class="m-0 justify-self-start text-left text-2xl font-extrabold text-[var(--retina-text-800)]"
    >
      얼굴형 기준 설정
    </h2>

    <form
      class="grid gap-4 rounded-2xl border border-[var(--retina-text-200)] bg-white px-6 py-5 shadow-sm shadow-slate-200/50 md:grid-cols-[1fr_220px_auto]"
      onsubmit={on_submit_create_face_shape}
    >
      <label class="grid gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
        얼굴형 이름
        <input
          class="min-h-12 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
          type="text"
          value={ref_new_shape_key}
          placeholder="예: 계란형, 둥근형"
          oninput={on_input_new_shape_key}
        />
      </label>

      <label class="grid gap-2 text-sm font-extrabold text-[var(--retina-text-500)]">
        영문 라벨 (선택)
        <input
          class="min-h-12 rounded-xl border border-[var(--retina-text-200)] px-4 text-base font-bold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-400)] focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
          type="text"
          value={ref_new_shape_en}
          placeholder="예: Oval"
          oninput={on_input_new_shape_en}
        />
      </label>

      <button
        class="mt-[1.7rem] inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--retina-primary-300)] px-5 text-sm font-extrabold text-white transition hover:bg-[var(--retina-primary-400)]"
        type="submit"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        <span>얼굴형 추가</span>
      </button>
    </form>

    {#if g_is_loading}
      <div
        class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-10 text-center text-base font-bold text-[var(--retina-text-500)] shadow-sm shadow-slate-200/50"
      >
        판단 기준을 불러오는 중입니다.
      </div>
    {:else if g_face_shape_arr.length === 0}
      <div
        class="rounded-2xl border border-dashed border-[var(--retina-text-200)] bg-white px-8 py-12 text-center text-sm font-bold text-[var(--retina-text-500)] shadow-sm shadow-slate-200/50"
      >
        등록된 얼굴형이 없습니다. 위에서 [얼굴형 추가]로 항목을 등록해 주세요.
      </div>
    {:else}
      <div class="grid gap-6">
        {#each g_face_shape_arr as shape_obj (shape_obj.key)}
          <section
            class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-7 shadow-sm shadow-slate-200/50"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <h3 class="m-0 text-2xl font-extrabold text-[var(--retina-text-800)]">
                  {shape_obj.key}
                </h3>
                {#if shape_obj.en}
                  <span
                    class="rounded-full bg-[var(--retina-primary-50)] px-3 py-1 text-xs font-extrabold text-[var(--retina-primary-600)]"
                  >
                    {shape_obj.en}
                  </span>
                {/if}
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[var(--retina-primary-300)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={g_saving_shape_key === shape_obj.key}
                  onclick={() => on_click_save_face_shape(shape_obj)}
                >
                  <Save size={16} strokeWidth={2.4} aria-hidden="true" />
                  <span>{g_saving_shape_key === shape_obj.key ? '저장 중...' : '기준 저장'}</span>
                </button>
                <button
                  class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-sm font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                  type="button"
                  onclick={() => on_click_delete_face_shape(shape_obj)}
                >
                  <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                  <span>얼굴형 삭제</span>
                </button>
              </div>
            </div>

            <div class="mt-6 grid gap-5 lg:grid-cols-3">
              {#each MEASUREMENT_ARR as measurement_obj (measurement_obj.key)}
                {@const cell_key = get_criteria_key(shape_obj.key, measurement_obj.key)}
                {#if g_criteria_matrix_obj[cell_key]}
                  <div
                    class="rounded-2xl border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-5 py-5"
                  >
                    <p class="m-0 text-base font-extrabold text-[var(--retina-text-700)]">
                      {measurement_obj.key}
                    </p>

                    <div class="mt-4 grid gap-4">
                      <label
                        class="grid gap-1 text-sm font-extrabold text-[var(--retina-text-500)]"
                      >
                        최소
                        <span class="relative">
                          <input
                            class="min-h-12 w-full rounded-xl border border-[var(--retina-text-200)] bg-white px-4 pr-12 text-base font-extrabold text-[var(--retina-text-800)] outline-none transition focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
                            type="number"
                            step="0.01"
                            bind:value={g_criteria_matrix_obj[cell_key].lower_bound}
                          />
                          <span
                            class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--retina-text-400)]"
                          >
                            {measurement_obj.unit}
                          </span>
                        </span>
                      </label>

                      <label
                        class="grid gap-1 text-sm font-extrabold text-[var(--retina-text-500)]"
                      >
                        최대
                        <span class="relative">
                          <input
                            class="min-h-12 w-full rounded-xl border border-[var(--retina-text-200)] bg-white px-4 pr-12 text-base font-extrabold text-[var(--retina-text-800)] outline-none transition focus:border-[var(--retina-primary-400)] focus:ring-3 focus:ring-[var(--retina-primary-400)]/15"
                            type="number"
                            step="0.01"
                            bind:value={g_criteria_matrix_obj[cell_key].upper_bound}
                          />
                          <span
                            class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--retina-text-400)]"
                          >
                            {measurement_obj.unit}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </section>
        {/each}

        {#if g_extra_criteria_arr.length > 0}
          <section
            class="rounded-2xl border border-[var(--retina-text-200)] bg-white px-8 py-7 shadow-sm shadow-slate-200/50"
          >
            <div>
              <h3 class="m-0 text-xl font-extrabold text-[var(--retina-text-800)]">기타 기준</h3>
              <p class="mt-2 mb-0 text-sm font-semibold text-[var(--retina-text-500)]">
                위 매트릭스 형식에 속하지 않는 기존 데이터입니다. 필요 없는 항목은 삭제할 수
                있습니다.
              </p>
            </div>

            <div class="mt-6 grid gap-3">
              {#each g_extra_criteria_arr as criteria_obj (criteria_obj.criteria_no)}
                <div
                  class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--retina-text-200)] bg-[var(--retina-bg-1)] px-5 py-4"
                >
                  <div class="grid gap-1">
                    <span class="text-sm font-extrabold text-[var(--retina-text-800)]"
                      >{criteria_obj.criteria_label}</span
                    >
                    <span class="text-xs font-bold text-[var(--retina-text-500)]">
                      {criteria_obj.range_type} · {criteria_obj.lower_bound} ~ {criteria_obj.upper_bound}
                    </span>
                  </div>

                  <button
                    class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#F3D1D8] bg-[#FFF6F7] px-4 text-xs font-extrabold text-[#B42318] transition hover:bg-[#FEECEE]"
                    type="button"
                    onclick={() => on_click_delete_extra_criteria(criteria_obj)}
                  >
                    삭제
                  </button>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    {/if}
  </section>
</AdminLayout>
