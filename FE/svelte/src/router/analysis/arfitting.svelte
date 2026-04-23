<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Camera, Glasses, CheckCheck, User, Sparkles, X } from 'lucide-svelte'
  // 경로 및 API는 기존 설정 유지
  // import { PATH } from '@/config/path'
  // import { save_fitting_captures } from '@/lib/api/glasses'

  let g_glasses_arr = $state([])
  let g_loading = $state(true)
  let g_selected_id = $state(null)
  let g_capture_slot_arr = $state([null, null, null])

  const SLOT_LABEL_ARR = ['정면', '측면 좌', '측면 우']

  let g_all_captured = $derived(g_capture_slot_arr.every((s) => s !== null))
  let g_next_slot_idx = $derived(g_capture_slot_arr.findIndex((s) => s === null))

  onMount(() => {
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

  function on_click_select_glasses(id) {
    if (id === g_selected_id) return
    g_selected_id = id
    g_capture_slot_arr = [null, null, null]
  }

  function on_click_capture() {
    if (g_next_slot_idx === -1) return
    const new_arr = [...g_capture_slot_arr]
    new_arr[g_next_slot_idx] = '__captured__'
    g_capture_slot_arr = new_arr
  }

  function on_click_reset_slot(idx) {
    const new_arr = [...g_capture_slot_arr]
    new_arr[idx] = null
    g_capture_slot_arr = new_arr
  }
</script>

<main
  class="mx-auto flex h-[1024px] w-[1366px] overflow-hidden bg-[#F8F9FA] text-zinc-900 shadow-2xl"
>
  <section class="relative flex flex-1 flex-col p-8">
    <header class="mb-6 flex items-center justify-between">
      <button
        class="flex items-center gap-2 text-lg font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={24} />
        <span>뒤로가기</span>
      </button>
      <div class="flex items-center gap-3">
        <div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
        <h1 class="text-2xl font-black tracking-tight">AR REAL-TIME FITTING</h1>
      </div>
      <div class="w-24"></div>
    </header>

    <div class="relative flex-1 overflow-hidden rounded-[2.5rem] bg-zinc-950 shadow-inner">
      <div
        class="absolute inset-0 flex items-center justify-center border-[16px] border-white/5 rounded-[2.5rem]"
      >
        <Camera size={80} strokeWidth={0.5} class="text-white/10" />
      </div>

      {#if g_next_slot_idx !== -1}
        <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
          <p class="text-white/80 font-medium bg-black/40 px-4 py-1 rounded-full backdrop-blur-md">
            {SLOT_LABEL_ARR[g_next_slot_idx]} 각도를 촬영해주세요
          </p>
          <button
            onclick={on_click_capture}
            class="group flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
          >
            <div
              class="h-16 w-16 rounded-full border-4 border-[#4B0055] flex items-center justify-center"
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

  <aside class="flex w-[440px] flex-col border-l border-slate-200 bg-white shadow-xl">
    <div class="p-8 pb-4">
      <h2 class="mb-5 text-sm font-black uppercase tracking-widest text-slate-400">
        Capture Status
      </h2>
      <div class="grid grid-cols-3 gap-4">
        {#each g_capture_slot_arr as slot, idx}
          <div class="group relative flex flex-col items-center gap-3">
            <div
              class={`flex h-[100px] w-full items-center justify-center rounded-2xl border-2 transition-all 
              ${slot ? 'border-[#AA83B4] bg-[#F5EAF7]' : idx === g_next_slot_idx ? 'border-dashed border-slate-300 bg-slate-50 animate-pulse' : 'border-slate-100 bg-slate-50'}`}
            >
              {#if slot}
                <CheckCheck size={32} class="text-[#7B3F8A]" />
                <button
                  onclick={() => on_click_reset_slot(idx)}
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

    <div class="flex flex-1 flex-col px-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-black">추천 안경</h2>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"
          >{g_glasses_arr.length} Items</span
        >
      </div>

      <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div class="flex flex-col gap-4 pb-4">
          {#each g_glasses_arr as item (item.id)}
            {@const active = item.id === g_selected_id}
            <button
              onclick={() => on_click_select_glasses(item.id)}
              class={`group relative flex items-center gap-5 rounded-[1.5rem] border-2 p-4 transition-all 
              ${active ? 'border-[#AA83B4] bg-[#FDF8FF] shadow-md' : 'border-slate-50 bg-white hover:border-slate-200'}`}
            >
              <div
                class="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-white border border-slate-100 flex items-center justify-center p-2"
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
                      class="flex items-center gap-1 text-[10px] font-black text-[#AA83B4] animate-bounce"
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

    <div class="p-8 bg-gradient-to-t from-slate-50 to-white">
      <button
        disabled={!g_all_captured}
        class="h-16 w-full rounded-2xl bg-[#4B0055] text-lg font-black text-white shadow-xl transition-all hover:bg-[#320038] disabled:opacity-20 disabled:grayscale"
      >
        최종 분석 리포트 확인
      </button>
    </div>
  </aside>
</main>

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
