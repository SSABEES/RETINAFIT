<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Glasses } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { get_glasses_options, save_lens_requirements } from '@/lib/api/glasses'

  // 서버에서 받아온 선택 옵션 그룹
  let g_option_group_arr = $state([])
  let g_options_loading = $state(true)
  let g_options_error = $state('')

  // 사용자가 선택한 옵션 저장할 객체
  let ref_selected_obj = $state({})

  // 마운트 시 옵션 목록을 서버에서 가져와 선택 상태를 초기화
  onMount(() => {
    get_glasses_options()
      .then((local_data) => {
        g_option_group_arr = local_data
        const local_init_obj = {}
        for (const group_obj of local_data) {
          local_init_obj[group_obj.key] = []
        }
        ref_selected_obj = local_init_obj
      })
      .catch((local_err) => {
        g_options_error = local_err.message ?? '옵션을 불러오지 못했습니다.'
      })
      .finally(() => {
        g_options_loading = false
      })
  })

  // 해당 옵션이 선택됐는지 확인
  const is_selected = (key, id) => ref_selected_obj[key]?.includes(id) ?? false

  // 하나 이상 선택했는지 확인해 저장 버튼 활성화 여부를 결정
  let g_can_submit = $derived(Object.values(ref_selected_obj).some((arr) => arr.length > 0))

  // API 요청 상태
  let g_loading = $state(false)
  let g_error = $state('')

  // 옵션 토글 — 이미 선택된 항목이면 해제하고, 없으면 추가하도록
  function on_click_toggle_option(group_key, opt_id) {
    const local_arr = ref_selected_obj[group_key]
    if (local_arr.includes(opt_id)) {
      ref_selected_obj[group_key] = local_arr.filter((id) => id !== opt_id)
    } else {
      ref_selected_obj[group_key] = [...local_arr, opt_id]
    }
  }

  // 렌즈 조건 저장 후 AR 피팅 페이지로 이동
  async function on_click_submit() {
    g_loading = true
    g_error = ''
    try {
      await save_lens_requirements(ref_selected_obj)
      window.location.href = PATH.analysisArFitting
    } catch (local_err) {
      g_error = local_err.message ?? '조건 저장에 실패했습니다.'
      g_loading = false
    }
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
        type="button"
        onclick={() => window.history.back()}
      >
        <ArrowLeft size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">렌즈 조건 선택</h1>
    <div></div>
  </header>

  <section class="h-[calc(100%-72px)] overflow-y-auto">
    <div class="mx-auto max-w-[800px] px-8 py-10">
      <!-- 안내 배너 -->
      <div class="mb-8 rounded-2xl bg-[#F3E8F5] px-7 py-6">
        <p class="m-0 text-xl font-extrabold text-[#4B0055]">
          고객에게 맞는 렌즈와 사용 환경을 체크해 주세요.
        </p>
        <p class="m-0 mt-1 text-sm font-semibold text-[#7B3F8A]">
          여러 항목을 중복으로 선택할 수 있습니다.
        </p>
      </div>

      <!-- 옵션 그룹 -->
      <div class="grid gap-8">
        {#if g_options_loading}
          <div class="grid place-items-center py-16">
            <span
              class="h-8 w-8 animate-spin rounded-full border-2 border-[#4B0055] border-t-transparent"
            ></span>
          </div>
        {:else if g_options_error}
          <p class="rounded-xl bg-red-50 px-5 py-4 text-sm font-bold text-red-600" role="alert">
            {g_options_error}
          </p>
        {:else}
          {#each g_option_group_arr as group_obj (group_obj.key)}
            <section>
              <h2 class="m-0 mb-3 text-lg font-extrabold text-zinc-950">{group_obj.label}</h2>
              <div class="flex flex-wrap gap-3">
                {#each group_obj.options as opt_obj (opt_obj.id)}
                  {@const local_active = is_selected(group_obj.key, opt_obj.id)}
                  <button
                    class={`min-h-[48px] rounded-xl px-6 text-base font-bold transition ${
                      local_active
                        ? 'bg-[#4B0055] text-white shadow-sm'
                        : 'border border-[#E5E7EB] bg-white text-slate-700 hover:border-[#4B0055] hover:text-[#4B0055]'
                    }`}
                    type="button"
                    aria-pressed={local_active}
                    onclick={() => on_click_toggle_option(group_obj.key, opt_obj.id)}
                  >
                    {opt_obj.label}
                  </button>
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      </div>

      <!-- 에러 메시지 -->
      {#if g_error}
        <p class="mt-6 rounded-xl bg-red-50 px-5 py-4 text-sm font-bold text-red-600" role="alert">
          {g_error}
        </p>
      {/if}

      <!-- 저장 후 AR 피팅으로 이동 버튼 -->
      <button
        class="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!g_can_submit || g_loading}
        onclick={on_click_submit}
      >
        {#if g_loading}
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          ></span>
          <span>저장 중...</span>
        {:else}
          <Glasses size={22} aria-hidden="true" />
          <span>AR 피팅으로 이동</span>
        {/if}
      </button>
    </div>
  </section>
</main>
