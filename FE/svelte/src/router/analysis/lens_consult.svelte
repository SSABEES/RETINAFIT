<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Glasses } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { ensure_session_auth_tokens } from '@/lib/api/session_auth'
  import { get_fitting_criteria_arr } from '@/lib/api/fitting_criteria'
  import { save_visit_recommend } from '@/lib/api/visit'

  const g_lens_category_meta_arr = [
    { key: 'lens_type', label: '렌즈 종류' },
    { key: 'coating', label: '코팅' },
    { key: 'usage', label: '주 사용 환경' },
    { key: 'lens_material', label: '렌즈 소재' },
  ]

  let g_option_group_arr = $state([])
  let g_options_loading = $state(true)
  let g_options_error = $state('')
  let g_loading = $state(false)
  let g_error = $state('')
  let ref_selected_obj = $state({})
  let g_flat_option_arr = $derived(
    g_option_group_arr.flatMap((group_obj) =>
      group_obj.options.map((option_obj) => ({
        ...option_obj,
        group_key: group_obj.key,
      })),
    ),
  )

  // 추천 옵션 응답에서 렌즈 상담 화면에 필요한 카테고리만 추려 버튼 그룹으로 정규화한다.
  function normalize_lens_option_group_arr(option_arr) {
    return g_lens_category_meta_arr
      .map((local_category_meta_obj) => {
        const local_option_arr = option_arr
          .filter(
            (local_option_obj) =>
              local_option_obj.option_category === local_category_meta_obj.key &&
              local_option_obj.is_active,
          )
          .sort(
            (local_left_option_obj, local_right_option_obj) =>
              local_left_option_obj.display_order - local_right_option_obj.display_order,
          )
          .map((local_option_obj) => ({
            id: String(local_option_obj.option_no),
            label: String(local_option_obj.option_name ?? ''),
          }))

        return {
          key: local_category_meta_obj.key,
          label: local_category_meta_obj.label,
          options: local_option_arr,
        }
      })
      .filter((local_group_obj) => local_group_obj.options.length > 0)
  }

  // 렌즈 카테고리별 선택 상태를 빈 배열로 초기화한다.
  function init_selected_obj(option_group_arr) {
    const local_selected_obj = {}

    for (const local_group_obj of option_group_arr) {
      local_selected_obj[local_group_obj.key] = []
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

  onMount(() => {
    if (!ensure_session_auth_tokens()) {
      g_options_error = '로그인 토큰 정보가 없습니다. 다시 로그인해주세요.'
      g_options_loading = false
      return
    }

    get_fitting_criteria_arr()
      .then((local_option_arr) => {
        const local_group_arr = normalize_lens_option_group_arr(
          Array.isArray(local_option_arr) ? local_option_arr : [],
        )

        g_option_group_arr = local_group_arr
        init_selected_obj(local_group_arr)
      })
      .catch((local_err) => {
        g_options_error = local_err.message ?? '옵션을 불러오지 못했습니다.'
      })
      .finally(() => {
        g_options_loading = false
      })
  })

  const is_selected = (group_key, option_id) =>
    ref_selected_obj[group_key]?.includes(option_id) ?? false

  let g_can_submit = $derived(
    Object.values(ref_selected_obj).some(
      (local_selected_option_arr) => local_selected_option_arr.length > 0,
    ),
  )

  // 옵션 버튼 클릭 시 같은 값은 해제하고, 없던 값은 선택 목록에 추가한다.
  function on_click_toggle_option(group_key, option_id) {
    const local_selected_option_arr = ref_selected_obj[group_key] ?? []

    if (local_selected_option_arr.includes(option_id)) {
      ref_selected_obj[group_key] = local_selected_option_arr.filter(
        (local_saved_option_id) => local_saved_option_id !== option_id,
      )
      return
    }

    ref_selected_obj[group_key] = [...local_selected_option_arr, option_id]
  }

  // 선택한 추천 옵션을 방문 데이터에 저장한 뒤 AR 피팅 화면으로 이동한다.
  async function on_click_submit() {
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

      window.location.href = PATH.analysisArFitting
    } catch (local_err) {
      g_error = local_err.message ?? '조건 저장에 실패했습니다.'
      g_loading = false
    }
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[74px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
        type="button"
        onclick={() => window.history.back()}
      >
        <ArrowLeft size={22} strokeWidth={2.2} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
    <h1 class="m-0 text-[30px] font-extrabold tracking-[-0.03em] text-zinc-950">렌즈 조건 선택</h1>
    <div></div>
  </header>

  <section
    class="h-[calc(100%-74px)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    <div class="mx-auto max-w-[1120px] px-8 pb-8 pt-8">
      <div class="mx-auto mb-8 max-w-[860px] rounded-[24px] bg-[#F3E8F5] px-12 py-7 text-center">
        <p
          class="m-0 whitespace-nowrap text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#4B0055]"
        >
          고객에게 맞는 렌즈와 사용 환경을 체크해 주세요.
        </p>
        <p class="m-0 mt-2 text-[17px] font-bold text-[#7B3F8A]">
          여러 항목을 중복으로 선택할 수 있습니다.
        </p>
      </div>

      {#if g_options_loading}
        <div class="grid place-items-center py-24">
          <span
            class="h-10 w-10 animate-spin rounded-full border-[3px] border-[#4B0055] border-t-transparent"
          ></span>
        </div>
      {:else if g_options_error}
        <p
          class="mx-auto max-w-[640px] rounded-2xl bg-red-50 px-6 py-5 text-center text-base font-bold text-red-600"
          role="alert"
        >
          {g_options_error}
        </p>
      {:else if g_flat_option_arr.length === 0}
        <p
          class="mx-auto max-w-[640px] rounded-2xl bg-slate-50 px-6 py-5 text-center text-base font-bold text-slate-500"
        >
          선택 가능한 옵션이 없습니다.
        </p>
      {:else}
        <div class="mx-auto flex max-w-[760px] flex-wrap justify-center gap-4">
          {#each g_flat_option_arr as opt_obj (opt_obj.id)}
            {@const local_active = is_selected(opt_obj.group_key, opt_obj.id)}
            <button
              class={`flex min-h-[68px] w-[176px] items-center justify-center rounded-[18px] border px-6 text-[17px] font-bold transition ${
                local_active
                  ? 'border-[#1F1F1F] bg-[#4B0055] text-white shadow-[0_10px_24px_rgba(75,0,85,0.18)]'
                  : 'border-[#E9E1EE] bg-[#F5F1F7] text-slate-600 hover:border-[#4B0055] hover:bg-[#F0E7F4] hover:text-[#4B0055]'
              }`}
              type="button"
              aria-pressed={local_active}
              onclick={() => on_click_toggle_option(opt_obj.group_key, opt_obj.id)}
            >
              {opt_obj.label}
            </button>
          {/each}
        </div>
      {/if}

      {#if g_error}
        <p
          class="mx-auto mt-8 max-w-[640px] rounded-2xl bg-red-50 px-6 py-5 text-center text-base font-bold text-red-600"
          role="alert"
        >
          {g_error}
        </p>
      {/if}

      <div class="mx-auto mt-8 max-w-[1120px]">
        <button
          class="inline-flex min-h-[72px] w-full items-center justify-center gap-3 rounded-[20px] border-0 bg-[#4B0055] px-8 text-[20px] font-extrabold text-white transition hover:bg-[#65006F] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={g_loading || !g_can_submit}
          onclick={on_click_submit}
        >
          {#if g_loading}
            <span
              class="h-6 w-6 animate-spin rounded-full border-[3px] border-white border-t-transparent"
            ></span>
            <span>저장 중...</span>
          {:else}
            <Glasses size={25} aria-hidden="true" />
            <span>AR 피팅으로 이동</span>
          {/if}
        </button>
      </div>
    </div>
  </section>
</main>
