<script>
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import {
    ArrowLeft,
    Camera,
    Glasses,
    CheckCheck,
    User,
    Sparkles,
    X,
    HelpCircle,
    ChevronRight,
  } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { save_fitting_captures } from '@/lib/api/glasses'

  let g_glasses_arr = $state([])
  let g_loading = $state(true)
  let g_selected_id = $state(null)
  let g_capture_slot_arr = $state([null, null, null])
  let g_show_intro = $state(false)

  const SLOT_LABEL_ARR = ['정면', '측면 좌', '측면 우']

  let g_all_captured = $derived(g_capture_slot_arr.every((s) => s !== null))
  let g_next_slot_idx = $derived(g_capture_slot_arr.findIndex((s) => s === null))

  // 추천 안경 리스트는 임시 데이터로 진행
  onMount(() => {
    g_show_intro = true
    setTimeout(() => (g_show_intro = false), 3200)
    const mock_glasses = [
      {
        id: 'g1',
        brand: '젠틀몬스터',
        model: '쿠보 01',
        price: '289,000',
        frame_type: '뿔테',
        img_url: 'https://placehold.co/340x160/F5EAF7/AA83B4?text=KUBO+01',
      },
      {
        id: 'g2',
        brand: '레이벤',
        model: '라운드 메탈',
        price: '185,000',
        frame_type: '메탈',
        img_url: 'https://placehold.co/340x160/EEF2FF/818CF8?text=Round+Metal',
      },
      {
        id: 'g3',
        brand: '모스콧',
        model: '렘토쉬',
        price: '360,000',
        frame_type: '아세테이트',
        img_url: 'https://placehold.co/340x160/FEF9EE/F59E0B?text=LEMTOSH',
      },
      {
        id: 'g4',
        brand: '구찌',
        model: 'GG0006O',
        price: '420,000',
        frame_type: '하프림',
        img_url: 'https://placehold.co/340x160/F0FDF4/4ADE80?text=GG0006O',
      },
      {
        id: 'g5',
        brand: '톰포드',
        model: 'TF5488-B',
        price: '380,000',
        frame_type: '뿔테',
        img_url: 'https://placehold.co/340x160/F1F5F9/475569?text=TF5488',
      },
    ]
    setTimeout(() => {
      g_glasses_arr = mock_glasses
      g_selected_id = mock_glasses[0].id
      g_loading = false
    }, 500)
  })

  /**
   * 안경 선택 시 id 를 저장하고 캡처 슬롯을 초기화
   */
  function on_click_select_glasses(id) {
    if (id === g_selected_id) return
    g_selected_id = id
    g_capture_slot_arr = [null, null, null]
  }

  /**
   * 현재 화면을 캡처하여 배열에 추가
   */
  function on_click_capture() {
    if (g_next_slot_idx === -1) return
    const new_arr = [...g_capture_slot_arr]
    new_arr[g_next_slot_idx] = '__captured__'
    g_capture_slot_arr = new_arr
  }

  /**
   * 해당 캡처 슬롯의 이미지를 삭제
   */
  function on_click_reset_slot(idx) {
    const new_arr = [...g_capture_slot_arr]
    new_arr[idx] = null
    g_capture_slot_arr = new_arr
  }

  let g_submit_loading = $state(false)
  let g_submit_error = $state('')

  /**
   * 캡처 3장을 서버에 저장하고 리포트 페이지로 이동
   */
  async function on_click_submit_report() {
    g_submit_loading = true
    g_submit_error = ''
    try {
      await save_fitting_captures({ glasses_id: g_selected_id, captures: g_capture_slot_arr })
      window.location.href = PATH.analysisReport
    } catch (local_err) {
      g_submit_error = local_err.message ?? '저장에 실패했습니다.'
      g_submit_loading = false
    }
  }

  /* ── 가이드 투어 ─────────────────────────────────────── */
  let g_guide_step = $state(0) // 0 = 비활성, 1~4 = 단계

  const GUIDE_STEP_ARR = [
    null,
    {
      title: '시착할 안경을 선택하세요',
      desc: '오른쪽 목록에서 원하는 안경을 선택하세요.\n선택하면 카메라에 AR 피팅이 적용됩니다.',
      hint: '우측 안경 목록을 확인하세요',
      hint_dir: 'right',
      card_style: 'right: 468px; top: 50%; transform: translateY(-50%)',
    },
    {
      title: '3장을 촬영하세요',
      desc: '촬영 버튼을 눌러 정면 → 왼쪽 측면 → 오른쪽 측면\n순서로 3장을 찍어주세요.',
      hint: '위 카메라를 바라보고 촬영하세요',
      hint_dir: 'up',
      card_style: 'left: 40px; bottom: 168px',
    },
    {
      title: '촬영 상태를 확인하세요',
      desc: '3개의 슬롯이 모두 채워졌는지 확인하세요.\nX 버튼으로 재촬영할 수 있습니다.',
      hint: '오른쪽 상단 슬롯을 확인하세요',
      hint_dir: 'right',
      card_style: 'right: 468px; top: 80px',
    },
    {
      title: '리포트를 확인하세요',
      desc: '3장이 완료되면 버튼이 활성화됩니다.\n눌러서 AI 분석 리포트를 확인하세요.',
      hint: '오른쪽 하단 버튼을 눌러주세요',
      hint_dir: 'right',
      card_style: 'right: 468px; bottom: 72px',
    },
  ]

  let g_guide_info = $derived(GUIDE_STEP_ARR[g_guide_step])

  /**
   * 가이드 시작
   */
  function on_click_guide_open() {
    g_guide_step = 1
  }

  /**
   * 가이드 닫기
   */
  function on_click_guide_close() {
    g_guide_step = 0
  }

  /**
   * 다음 단계 이동 (마지막 단계면 닫기)
   */
  function on_click_guide_next() {
    if (g_guide_step < 4) g_guide_step++
    else g_guide_step = 0
  }

  /**
   * 이전 단계 이동
   */
  function on_click_guide_prev() {
    if (g_guide_step > 1) g_guide_step--
  }

  /* 단계별로 강조할 영역 */
  let g_highlight_camera = $derived(g_guide_step === 2)
  let g_highlight_aside = $derived(g_guide_step === 1 || g_guide_step === 3 || g_guide_step === 4)
</script>

<main class="app-frame-page flex overflow-hidden bg-[#F8F9FA] text-zinc-900">
  <!-- 좌측: 카메라 + 캡처 슬롯 -->
  <section
    class="relative flex flex-1 flex-col p-8 transition-[z-index]"
    class:z-50={g_highlight_camera}
  >
    <header class="mb-6 flex items-center justify-between">
      <button
        type="button"
        onclick={() => window.history.back()}
        class="flex items-center gap-2 text-lg font-bold text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={24} />
        <span>뒤로가기</span>
      </button>
      <div class="flex items-center gap-3">
        <div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
        <h1 class="text-2xl font-black tracking-tight">AR FITTING</h1>
      </div>

      <!-- 가이드 버튼 -->
      <button
        type="button"
        onclick={on_click_guide_open}
        class="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-[#F5EAF7] hover:text-[#7B3F8A]"
      >
        <HelpCircle size={16} />
        <span>사용 가이드</span>
      </button>
    </header>

    <div
      class="relative flex-1 overflow-hidden rounded-[2.5rem] bg-zinc-950 shadow-inner transition-all"
      class:ring-4={g_highlight_camera}
      class:ring-[#AA83B4]={g_highlight_camera}
      class:ring-offset-4={g_highlight_camera}
    >
      <div
        class="absolute inset-0 flex items-center justify-center rounded-[2.5rem] border-[16px] border-white/5"
      >
        <Camera size={80} strokeWidth={0.5} class="text-white/10" />
      </div>

      {#if g_show_intro}
        <div
          class="absolute left-1/2 top-8 z-10 -translate-x-1/2"
          in:fly={{ y: -16, duration: 400 }}
          out:fade={{ duration: 500 }}
        >
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-6 py-3.5 shadow-2xl backdrop-blur-md"
          >
            <Glasses size={18} class="shrink-0 text-[#AA83B4]" />
            <span class="whitespace-nowrap text-sm font-semibold text-white/90">
              원하시는 안경을 선택해 시착해보세요
            </span>
          </div>
        </div>
      {/if}

      {#if g_next_slot_idx !== -1}
        <div class="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
          <p class="rounded-full bg-black/40 px-4 py-1 font-medium text-white/80 backdrop-blur-md">
            {SLOT_LABEL_ARR[g_next_slot_idx]} 각도를 촬영해주세요
          </p>
          <button
            type="button"
            onclick={on_click_capture}
            aria-label="{SLOT_LABEL_ARR[g_next_slot_idx]} 촬영"
            class="group flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
          >
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#4B0055]"
            >
              <div
                class="h-12 w-12 rounded-full bg-[#4B0055] transition-all group-hover:bg-[#7B3F8A]"
              ></div>
            </div>
          </button>
        </div>
      {/if}
    </div>
  </section>

  <!-- 우측: 캡처 상태 + 추천 안경 + 리포트 버튼 -->
  <aside
    class="relative flex w-[440px] flex-col border-l border-slate-200 bg-white shadow-xl transition-[z-index]"
    class:z-50={g_highlight_aside}
  >
    <!-- 캡처 슬롯 -->
    <div
      class="p-8 pb-4 transition-all"
      class:ring-4={g_guide_step === 3}
      class:ring-[#AA83B4]={g_guide_step === 3}
      class:ring-inset={g_guide_step === 3}
      class:rounded-t-none={g_guide_step === 3}
    >
      <h2 class="mb-5 text-sm font-black uppercase tracking-widest text-slate-400">
        Capture Status
      </h2>
      <div class="grid grid-cols-3 gap-4">
        {#each g_capture_slot_arr as slot, idx (idx)}
          <div class="group relative flex flex-col items-center gap-3">
            <div
              class={`flex h-[100px] w-full items-center justify-center rounded-2xl border-2 transition-all ${
                slot
                  ? 'border-[#AA83B4] bg-[#F5EAF7]'
                  : idx === g_next_slot_idx
                    ? 'animate-pulse border-dashed border-slate-300 bg-slate-50'
                    : 'border-slate-100 bg-slate-50'
              }`}
            >
              {#if slot}
                <CheckCheck size={32} class="text-[#7B3F8A]" />
                <button
                  type="button"
                  onclick={() => on_click_reset_slot(idx)}
                  aria-label="다시 촬영"
                  class="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 shadow-md hover:text-red-500"
                >
                  <X size={16} />
                </button>
              {:else}
                <User size={32} class="text-slate-200" />
              {/if}
            </div>
            <span class={`text-xs font-bold ${slot ? 'text-[#7B3F8A]' : 'text-slate-400'}`}
              >{SLOT_LABEL_ARR[idx]}</span
            >
          </div>
        {/each}
      </div>
    </div>

    <hr class="mx-8 my-4 border-slate-100" />

    <!-- 추천 안경 목록 -->
    <div
      class="flex min-h-0 flex-1 flex-col px-8 transition-all"
      class:ring-4={g_guide_step === 1}
      class:ring-[#AA83B4]={g_guide_step === 1}
      class:ring-inset={g_guide_step === 1}
    >
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-black">추천 안경</h2>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"
          >{g_glasses_arr.length} Items</span
        >
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div class="flex flex-col gap-4 pb-4">
          {#each g_glasses_arr as item (item.id)}
            {@const active = item.id === g_selected_id}
            <button
              type="button"
              onclick={() => on_click_select_glasses(item.id)}
              class={`group relative flex items-center gap-5 rounded-[1.5rem] border-2 p-4 text-left transition-all ${
                active
                  ? 'border-[#AA83B4] bg-[#FDF8FF] shadow-md'
                  : 'border-slate-50 bg-white hover:border-slate-200'
              }`}
            >
              <div
                class="flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-2"
              >
                <img src={item.img_url} alt={item.model} class="h-full w-full object-contain" />
              </div>
              <div class="flex flex-1 flex-col overflow-hidden">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                  >{item.brand}</span
                >
                <p class="truncate text-base font-black text-slate-800">{item.model}</p>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-sm font-extrabold text-[#7B3F8A]">₩{item.price}</span>
                  {#if active}
                    <div
                      class="flex animate-bounce items-center gap-1 text-[10px] font-black text-[#AA83B4]"
                    >
                      <Sparkles size={12} />
                      <span>FITTING</span>
                    </div>
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- 최종 리포트 버튼 -->
    <div
      class="bg-gradient-to-t from-slate-50 to-white p-8 transition-all"
      class:ring-4={g_guide_step === 4}
      class:ring-[#AA83B4]={g_guide_step === 4}
      class:ring-inset={g_guide_step === 4}
    >
      {#if g_submit_error}
        <p class="mb-3 text-xs font-bold text-red-500" role="alert">{g_submit_error}</p>
      {/if}
      <button
        type="button"
        disabled={!g_all_captured || g_submit_loading}
        onclick={on_click_submit_report}
        class="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#4B0055] text-lg font-black text-white shadow-xl transition-all hover:bg-[#320038] disabled:cursor-not-allowed disabled:opacity-20 disabled:grayscale"
      >
        {#if g_submit_loading}
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          ></span>
          <span>저장 중...</span>
        {:else}
          최종 분석 리포트 확인
        {/if}
      </button>
    </div>
  </aside>
</main>

<!-- 가이드 오버레이 -->
{#if g_guide_step > 0}
  <!-- 배경 딤 -->
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
    role="presentation"
    onclick={on_click_guide_close}
    in:fade={{ duration: 250 }}
    out:fade={{ duration: 200 }}
  ></div>

  <!-- 가이드 카드 -->
  {#if g_guide_info}
    <div
      class="fixed z-50 w-80 rounded-3xl bg-white p-6 shadow-2xl"
      style={g_guide_info.card_style}
      in:fly={{ y: 8, duration: 300 }}
      out:fade={{ duration: 150 }}
    >
      <!-- 진행 바 -->
      <div class="mb-5 flex gap-1.5">
        {#each [1, 2, 3, 4] as step_num}
          <div
            class="h-1.5 flex-1 rounded-full transition-colors duration-300 {g_guide_step >= step_num
              ? 'bg-[#AA83B4]'
              : 'bg-slate-100'}"
          ></div>
        {/each}
      </div>

      <!-- 단계 레이블 -->
      <p class="mb-1.5 text-xs font-black uppercase tracking-widest text-[#AA83B4]">
        Step {g_guide_step} / 4
      </p>

      <!-- 제목 -->
      <h3 class="mb-3 text-lg font-black leading-snug text-zinc-900">{g_guide_info.title}</h3>

      <!-- 설명 -->
      <p class="whitespace-pre-line text-sm leading-relaxed text-slate-500">{g_guide_info.desc}</p>

      <!-- 방향 힌트 -->
      <div
        class="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[#F5EAF7] px-4 py-3"
      >
        <span class="text-xs font-bold text-[#7B3F8A]">{g_guide_info.hint}</span>
        <ChevronRight size={14} class="shrink-0 text-[#AA83B4]" />
      </div>

      <!-- 네비게이션 -->
      <div class="mt-5 flex items-center justify-between">
        <button
          type="button"
          onclick={on_click_guide_close}
          class="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
        >
          건너뛰기
        </button>
        <div class="flex gap-2">
          {#if g_guide_step > 1}
            <button
              type="button"
              onclick={on_click_guide_prev}
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              이전
            </button>
          {/if}
          <button
            type="button"
            onclick={on_click_guide_next}
            class="rounded-xl bg-[#4B0055] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#320038]"
          >
            {g_guide_step < 4 ? '다음' : '시작하기'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* 리스트 스크롤바 디자인 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
</style>
