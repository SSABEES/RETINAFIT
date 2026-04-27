<script>
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
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
    SlidersHorizontal,
    RotateCcw,
    Save,
    FileText,
  } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { get_all_glasses, request_fitting_presigned_urls, confirm_fitting_result } from '@/lib/api/glasses'
  import { selected_visit_obj } from '@/lib/stores/customer'

  /* ── 안경 목록 ──────────────────────────────────────── */
  let g_recommended_arr = $state([])
  let g_loading = $state(true)
  let g_selected_id = $state(null)
  let g_capture_slot_arr = $state([null, null, null])
  let g_show_intro = $state(false)

  const SLOT_LABEL_ARR = ['정면', '측면 좌', '측면 우']
  const MAX_FITTINGS = 5

  let g_all_captured = $derived(g_capture_slot_arr.every((s) => s !== null))
  let g_next_slot_idx = $derived(g_capture_slot_arr.findIndex((s) => s === null))

  /* ── 다중 피팅 저장 ─────────────────────────────────── */
  // { glasses_id, brand, model, captures } 형태로 최대 5개 저장
  let g_saved_fittings_arr = $state([])

  let g_can_save = $derived(g_all_captured && g_saved_fittings_arr.length < MAX_FITTINGS)
  let g_can_submit = $derived(g_saved_fittings_arr.length > 0)

  // 안경 id별 저장 횟수 맵 (저장 표시 배지에 사용)
  let g_saved_count_map = $derived(
    g_saved_fittings_arr.reduce((acc, fit) => {
      acc[fit.glasses_id] = (acc[fit.glasses_id] ?? 0) + 1
      return acc
    }, {}),
  )

  /* ── 토스트 알림 ─────────────────────────────────────── */
  let g_toast_msg = $state('')
  let g_toast_timer = $state(null)

  /**
   * 토스트 메시지를 띄우고 2.8초 후 자동 제거
   */
  function show_toast(msg) {
    g_toast_msg = msg
    clearTimeout(g_toast_timer)
    g_toast_timer = setTimeout(() => (g_toast_msg = ''), 2800)
  }

  /* ── 프레임 필터 ─────────────────────────────────────── */
  const FRAME_TYPE_OPTIONS = ['풀프레임', '하프프레임', '무프레임']
  const MATERIAL_OPTIONS = ['아세테이트', '메탈', '티타늄', '혼합']
  const CATEGORY_OPTIONS = ['안경', '선글라스', '스포츠']

  const MOCK_ALL_GLASSES = [
    { id: 1,  glasses_no: 1,  brand: '젠틀몬스터', model: '쿠보 01',      price: '289,000', frame_type: '뿔테',      frame_style: '풀프레임',  material: '아세테이트', category: '안경',    img_url: 'https://placehold.co/340x160/F5EAF7/AA83B4?text=KUBO+01' },
    { id: 2,  glasses_no: 2,  brand: '레이벤',     model: '라운드 메탈',  price: '185,000', frame_type: '메탈',      frame_style: '풀프레임',  material: '메탈',       category: '안경',    img_url: 'https://placehold.co/340x160/EEF2FF/818CF8?text=Round+Metal' },
    { id: 3,  glasses_no: 3,  brand: '모스콧',     model: '렘토쉬',       price: '360,000', frame_type: '아세테이트', frame_style: '풀프레임',  material: '아세테이트', category: '안경',    img_url: 'https://placehold.co/340x160/FEF9EE/F59E0B?text=LEMTOSH' },
    { id: 4,  glasses_no: 4,  brand: '구찌',       model: 'GG0006O',      price: '420,000', frame_type: '하프림',    frame_style: '하프프레임', material: '메탈',       category: '안경',    img_url: 'https://placehold.co/340x160/F0FDF4/4ADE80?text=GG0006O' },
    { id: 5,  glasses_no: 5,  brand: '톰포드',     model: 'TF5488-B',     price: '380,000', frame_type: '뿔테',      frame_style: '풀프레임',  material: '아세테이트', category: '안경',    img_url: 'https://placehold.co/340x160/F1F5F9/475569?text=TF5488' },
    { id: 6,  glasses_no: 6,  brand: '린드버그',   model: '에어 티타늄',  price: '450,000', frame_type: '무테',      frame_style: '무프레임',  material: '티타늄',     category: '안경',    img_url: 'https://placehold.co/340x160/E0F2FE/0284C7?text=Air+Ti' },
    { id: 7,  glasses_no: 7,  brand: '실루엣',     model: 'SPX Full',     price: '390,000', frame_type: '무테',      frame_style: '무프레임',  material: '혼합',       category: '안경',    img_url: 'https://placehold.co/340x160/FEF3C7/D97706?text=SPX' },
    { id: 8,  glasses_no: 8,  brand: '오클리',     model: 'Frogskins',    price: '160,000', frame_type: '뿔테',      frame_style: '풀프레임',  material: '혼합',       category: '선글라스', img_url: 'https://placehold.co/340x160/ECFDF5/059669?text=Frogskins' },
    { id: 9,  glasses_no: 9,  brand: '레이벤',     model: '웨이파러',     price: '195,000', frame_type: '아세테이트', frame_style: '풀프레임',  material: '아세테이트', category: '선글라스', img_url: 'https://placehold.co/340x160/FFF1F2/E11D48?text=Wayfarer' },
    { id: 10, glasses_no: 10, brand: '나이키',     model: 'Veer',         price: '120,000', frame_type: '혼합',      frame_style: '풀프레임',  material: '혼합',       category: '스포츠',  img_url: 'https://placehold.co/340x160/F0F9FF/0369A1?text=Veer' },
    { id: 11, glasses_no: 11, brand: '프로스펙스', model: 'M-60',         price: '89,000',  frame_type: '메탈',      frame_style: '하프프레임', material: '메탈',       category: '스포츠',  img_url: 'https://placehold.co/340x160/F5F3FF/7C3AED?text=M-60' },
    { id: 12, glasses_no: 12, brand: '페라가모',   model: 'SF2939',       price: '280,000', frame_type: '하프림',    frame_style: '하프프레임', material: '티타늄',     category: '안경',    img_url: 'https://placehold.co/340x160/FDF2F8/C026D3?text=SF2939' },
  ]

  let g_filter_modal_open = $state(false)
  let g_filter_loading = $state(false)
  let g_all_glasses_arr = $state([])
  let g_filter_obj = $state({ frame_type_arr: [], material_arr: [], category_arr: [] })

  let g_active_filter_count = $derived(
    g_filter_obj.frame_type_arr.length +
      g_filter_obj.material_arr.length +
      g_filter_obj.category_arr.length,
  )

  let g_glasses_arr = $derived.by(() => {
    if (g_active_filter_count === 0 || g_all_glasses_arr.length === 0) return g_recommended_arr
    let result = [...g_all_glasses_arr]
    if (g_filter_obj.frame_type_arr.length > 0)
      result = result.filter((g) => g_filter_obj.frame_type_arr.includes(g.frame_style))
    if (g_filter_obj.material_arr.length > 0)
      result = result.filter((g) => g_filter_obj.material_arr.includes(g.material))
    if (g_filter_obj.category_arr.length > 0)
      result = result.filter((g) => g_filter_obj.category_arr.includes(g.category))
    return result
  })

  $effect(() => {
    if (g_glasses_arr.length > 0 && !g_glasses_arr.find((g) => g.id === g_selected_id)) {
      g_selected_id = g_glasses_arr[0].id
      g_capture_slot_arr = [null, null, null]
    }
  })

  onMount(() => {
    g_show_intro = true
    setTimeout(() => (g_show_intro = false), 3200)
    const mock_recommended = [
      { id: 1, glasses_no: 1, brand: '젠틀몬스터', model: '쿠보 01',     price: '289,000', frame_type: '뿔테',      frame_style: '풀프레임',  material: '아세테이트', category: '안경', img_url: 'https://placehold.co/340x160/F5EAF7/AA83B4?text=KUBO+01' },
      { id: 2, glasses_no: 2, brand: '레이벤',     model: '라운드 메탈', price: '185,000', frame_type: '메탈',      frame_style: '풀프레임',  material: '메탈',       category: '안경', img_url: 'https://placehold.co/340x160/EEF2FF/818CF8?text=Round+Metal' },
      { id: 3, glasses_no: 3, brand: '모스콧',     model: '렘토쉬',      price: '360,000', frame_type: '아세테이트', frame_style: '풀프레임',  material: '아세테이트', category: '안경', img_url: 'https://placehold.co/340x160/FEF9EE/F59E0B?text=LEMTOSH' },
      { id: 4, glasses_no: 4, brand: '구찌',       model: 'GG0006O',     price: '420,000', frame_type: '하프림',    frame_style: '하프프레임', material: '메탈',       category: '안경', img_url: 'https://placehold.co/340x160/F0FDF4/4ADE80?text=GG0006O' },
      { id: 5, glasses_no: 5, brand: '톰포드',     model: 'TF5488-B',    price: '380,000', frame_type: '뿔테',      frame_style: '풀프레임',  material: '아세테이트', category: '안경', img_url: 'https://placehold.co/340x160/F1F5F9/475569?text=TF5488' },
    ]
    setTimeout(() => {
      g_recommended_arr = mock_recommended
      g_selected_id = mock_recommended[0].id
      g_loading = false
    }, 500)
  })

  /**
   * 안경 선택 시 id를 저장하고 캡처 슬롯 초기화 (미완성 캡처는 버려짐)
   * 저장 5개 다 찼으면 토스트 경고 후 차단
   */
  function on_click_select_glasses(id) {
    if (id === g_selected_id) return
    if (g_saved_fittings_arr.length >= MAX_FITTINGS) {
      show_toast(`피팅은 최대 ${MAX_FITTINGS}개까지만 저장할 수 있습니다. 저장된 피팅을 취소 후 다시 시도하세요.`)
      return
    }
    g_selected_id = id
    g_capture_slot_arr = [null, null, null]
  }

  /**
   * 현재 화면을 캡처하여 다음 빈 슬롯에 추가
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

  /**
   * 저장된 피팅 목록에서 특정 항목 제거
   */
  function on_click_remove_saved(idx) {
    g_saved_fittings_arr = g_saved_fittings_arr.filter((_, i) => i !== idx)
  }

  let g_submit_loading = $state(false)
  let g_submit_error = $state('')

  /**
   * 3장 캡처된 현재 피팅을 API로 저장: Presigned URL 발급 → S3 업로드 → 백엔드 저장
   */
  async function on_click_save_fitting() {
    if (!g_can_save || g_submit_loading) return
    g_submit_loading = true
    g_submit_error = ''
    try {
      const local_visit_no = $selected_visit_obj?.visit_no
      const glasses_info = g_glasses_arr.find((g) => g.id === g_selected_id)
      const local_glasses_no = glasses_info?.glasses_no ?? g_selected_id

      // 1단계: 안경별 Presigned URL 발급 (front/left/right)
      const local_presigned = await request_fitting_presigned_urls(local_visit_no, local_glasses_no)

      // 2단계: front → left → right 순으로 S3에 PUT 업로드
      // 실제 File이 아닌 슬롯(카메라 미연동)은 더미 파일로 대체
      const local_file_arr = g_capture_slot_arr.map((f) =>
        f instanceof File
          ? f
          : new File([new Blob(['dummy'], { type: 'image/jpeg' })], 'capture.jpg', { type: 'image/jpeg' }),
      )
      const local_url_arr = [local_presigned.front_url, local_presigned.left_url, local_presigned.right_url]
      await Promise.all(
        local_url_arr.map((url, idx) =>
          fetch(url, {
            method: 'PUT',
            body: local_file_arr[idx],
          }).then((res) => {
            if (!res.ok) throw new Error(`S3 업로드 실패 (${res.status})`)
          }),
        ),
      )

      // 3단계: 업로드된 key 배열을 백엔드에 저장
      await confirm_fitting_result(local_visit_no, {
        vp_file_arr: [local_presigned.front_key, local_presigned.left_key, local_presigned.right_key],
        vp_json: { glasses_no: local_glasses_no, fitting_result: {} },
      })

      // 로컬 저장 목록 업데이트 및 슬롯 초기화
      g_saved_fittings_arr = [
        ...g_saved_fittings_arr,
        {
          glasses_id: g_selected_id,
          glasses_no: local_glasses_no,
          brand: glasses_info?.brand ?? '',
          model: glasses_info?.model ?? '',
          captures: [...g_capture_slot_arr],
        },
      ]
      g_capture_slot_arr = [null, null, null]
    } catch (local_err) {
      g_submit_error = local_err instanceof Error ? local_err.message : '저장에 실패했습니다.'
    } finally {
      g_submit_loading = false
    }
  }

  /**
   * 저장된 피팅이 1개 이상이면 리포트 페이지로 이동
   */
  function on_click_submit_report() {
    if (!g_can_submit) return
    window.location.href = PATH.analysisResult
  }

  /* ── 프레임 필터 모달 ─────────────────────────────────── */

  /**
   * 필터 모달 열기 — 전체 안경 목록을 한 번만 fetch
   */
  async function on_click_open_filter_modal() {
    g_filter_modal_open = true
    if (g_all_glasses_arr.length > 0) return
    g_filter_loading = true
    try {
      const data = await get_all_glasses()
      g_all_glasses_arr = data
    } catch {
      g_all_glasses_arr = MOCK_ALL_GLASSES
    } finally {
      g_filter_loading = false
    }
  }

  /**
   * 필터 옵션 토글 (즉시 반영)
   */
  function on_click_toggle_filter(field, value) {
    const arr = g_filter_obj[field]
    g_filter_obj[field] = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value]
  }

  /**
   * 필터 전체 초기화
   */
  function on_click_reset_filter() {
    g_filter_obj = { frame_type_arr: [], material_arr: [], category_arr: [] }
  }

  /* ── 사용 가이드 투어 ────────────────────────────────── */
  let g_guide_step = $state(0)

  const GUIDE_STEP_ARR = [
    null,
    {
      title: '시착할 안경을 선택하세요',
      desc: '오른쪽 목록에서 원하는 안경을 선택하세요.\n선택하면 카메라에 AR 피팅이 적용됩니다.',
      hint: '우측 안경 목록을 확인하세요',
      card_style: 'right: 468px; top: 50%; transform: translateY(-50%)',
    },
    {
      title: '3장을 촬영하세요',
      desc: '촬영 버튼을 눌러 정면 → 왼쪽 측면 → 오른쪽 측면\n순서로 3장을 찍어주세요.\n3장을 모두 찍어야 피팅 결과를 저장할 수 있습니다.',
      hint: '위 카메라를 바라보고 촬영하세요',
      card_style: 'left: 40px; bottom: 168px',
    },
    {
      title: '촬영 상태를 확인하세요',
      desc: '3개의 슬롯이 모두 채워졌는지 확인하세요.\nX 버튼으로 재촬영할 수 있습니다.\n다른 안경을 선택하면 현재 촬영 중인 사진은 초기화됩니다.',
      hint: '오른쪽 상단 슬롯을 확인하세요',
      card_style: 'right: 468px; top: 80px',
    },
    {
      title: '피팅 결과를 저장하세요',
      desc: '3장이 완료되면 [피팅 결과 저장] 버튼이 활성화됩니다.\n저장 후 다른 안경을 선택해 최대 5개까지 시착할 수 있습니다.\n3장 미완성 상태에서는 저장되지 않습니다.',
      hint: '오른쪽 하단 왼쪽 버튼을 눌러주세요',
      card_style: 'right: 468px; bottom: 72px',
    },
    {
      title: '최종 리포트를 확인하세요',
      desc: '피팅 결과가 1개 이상 저장되면 [최종 분석 리포트 확인] 버튼이 활성화됩니다.\n저장된 안경들을 한 번에 AI가 분석합니다.',
      hint: '오른쪽 하단 오른쪽 버튼을 눌러주세요',
      card_style: 'right: 468px; bottom: 72px',
    },
  ]

  let g_guide_info = $derived(GUIDE_STEP_ARR[g_guide_step])

  function on_click_guide_open() { g_guide_step = 1 }
  function on_click_guide_close() { g_guide_step = 0 }
  function on_click_guide_next() { if (g_guide_step < 5) g_guide_step++; else g_guide_step = 0 }
  function on_click_guide_prev() { if (g_guide_step > 1) g_guide_step-- }

  let g_highlight_camera = $derived(g_guide_step === 2)
  let g_highlight_aside = $derived([1, 3, 4, 5].includes(g_guide_step))
</script>

<main class="app-frame-page flex overflow-hidden bg-[#F8F9FA] text-zinc-900">
  <!-- 좌측: 카메라 -->
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

  <!-- 우측: 캡처 상태 + 추천 안경 + 액션 버튼 -->
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
      <div class="mb-4 flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black">추천 안경</h2>
          <button
            type="button"
            onclick={on_click_open_filter_modal}
            class="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-[#F5EAF7] hover:text-[#7B3F8A]"
          >
            <SlidersHorizontal size={13} />
            <span>프레임 변경</span>
            {#if g_active_filter_count > 0}
              <span
                class="flex h-4 w-4 items-center justify-center rounded-full bg-[#4B0055] text-[9px] font-black text-white"
              >
                {g_active_filter_count}
              </span>
            {/if}
          </button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-400">{g_glasses_arr.length}개</span>
          {#if g_active_filter_count > 0}
            <button
              type="button"
              onclick={on_click_reset_filter}
              class="flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-red-400"
            >
              <RotateCcw size={10} />
              <span>필터 초기화</span>
            </button>
          {/if}
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {#if g_loading}
          <div class="flex justify-center py-16">
            <span
              class="h-6 w-6 animate-spin rounded-full border-2 border-[#AA83B4] border-t-transparent"
            ></span>
          </div>
        {:else if g_glasses_arr.length === 0}
          <div class="flex flex-col items-center gap-3 py-16 text-center">
            <Glasses size={36} class="text-slate-200" />
            <p class="text-sm font-bold text-slate-400">조건에 맞는 안경이 없습니다</p>
            <button
              type="button"
              onclick={on_click_reset_filter}
              class="text-xs font-bold text-[#7B3F8A] underline underline-offset-2"
            >
              필터 초기화
            </button>
          </div>
        {:else}
          <div class="flex flex-col gap-4 pb-4">
            {#each g_glasses_arr as item (item.id)}
              {@const active = item.id === g_selected_id}
              {@const saved_count = g_saved_count_map[item.id] ?? 0}
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
                  <div class="mt-1 flex items-center gap-2">
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.frame_type}</span>
                    {#if saved_count > 0}
                      <span class="rounded-md bg-[#F5EAF7] px-2 py-0.5 text-[10px] font-bold text-[#7B3F8A]">
                        피팅 저장됨
                      </span>
                    {/if}
                  </div>
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
        {/if}
      </div>
    </div>

    <!-- 저장된 피팅 목록 + 액션 버튼 -->
    <div
      class="bg-gradient-to-t from-slate-50 to-white p-6 transition-all"
      class:ring-4={g_guide_step === 4 || g_guide_step === 5}
      class:ring-[#AA83B4]={g_guide_step === 4 || g_guide_step === 5}
      class:ring-inset={g_guide_step === 4 || g_guide_step === 5}
    >
      <!-- 저장된 피팅 칩 목록 -->
      {#if g_saved_fittings_arr.length > 0}
        <div class="mb-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
              저장된 피팅 ({g_saved_fittings_arr.length}/{MAX_FITTINGS})
            </span>
            {#if g_saved_fittings_arr.length >= MAX_FITTINGS}
              <span class="text-[10px] font-bold text-amber-500">최대 개수 도달</span>
            {/if}
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {#each g_saved_fittings_arr as fit, idx (idx)}
              <div
                class="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#F5EAF7] px-3 py-2"
                in:fly={{ y: 6, duration: 200 }}
              >
                <CheckCheck size={11} class="shrink-0 text-[#7B3F8A]" />
                <span class="max-w-[72px] truncate text-[11px] font-bold text-[#7B3F8A]"
                  >{fit.model}</span
                >
                <button
                  type="button"
                  onclick={() => on_click_remove_saved(idx)}
                  aria-label="피팅 제거"
                  class="ml-0.5 shrink-0 text-slate-400 transition-colors hover:text-red-400"
                >
                  <X size={11} />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="mb-4 text-[11px] font-semibold text-slate-400">
          3장 촬영 완료 후 피팅 결과를 저장하세요 (최대 {MAX_FITTINGS}개)
        </p>
      {/if}

      {#if g_submit_error}
        <p class="mb-3 text-xs font-bold text-red-500" role="alert">{g_submit_error}</p>
      {/if}

      <!-- 액션 버튼 2개 -->
      <div class="grid grid-cols-2 gap-3">
        <!-- 피팅 결과 저장 -->
        <button
          type="button"
          disabled={!g_can_save || g_submit_loading}
          onclick={on_click_save_fitting}
          class="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-[#AA83B4] bg-white text-sm font-black text-[#4B0055] shadow-sm transition-all hover:bg-[#F5EAF7] disabled:cursor-not-allowed disabled:opacity-25 disabled:grayscale"
        >
          {#if g_submit_loading}
            <span
              class="h-4 w-4 animate-spin rounded-full border-2 border-[#4B0055] border-t-transparent"
            ></span>
            <span>저장 중...</span>
          {:else}
            <Save size={16} />
            <span>피팅 결과 저장</span>
          {/if}
        </button>

        <!-- 최종 분석 리포트 -->
        <button
          type="button"
          disabled={!g_can_submit}
          onclick={on_click_submit_report}
          class="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#4B0055] text-sm font-black text-white shadow-xl transition-all hover:bg-[#320038] disabled:cursor-not-allowed disabled:opacity-25 disabled:grayscale"
        >
          <FileText size={16} />
          <span>리포트 확인</span>
        </button>
      </div>
    </div>
  </aside>
</main>

<!-- 프레임 필터 드로어 -->
{#if g_filter_modal_open}
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
    role="presentation"
    onclick={() => (g_filter_modal_open = false)}
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
  ></div>

  <div
    class="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col bg-white shadow-2xl"
    in:fly={{ x: 440, duration: 320, easing: cubicOut }}
    out:fly={{ x: 440, duration: 220, easing: cubicOut }}
  >
    <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-8 py-6">
      <div>
        <h3 class="text-lg font-black text-zinc-900">프레임 필터</h3>
        {#if g_filter_loading}
          <p class="mt-0.5 text-xs text-slate-400">안경 목록 불러오는 중...</p>
        {:else}
          <p class="mt-0.5 text-xs text-slate-400">전체 {g_all_glasses_arr.length}개</p>
        {/if}
      </div>
      <button
        type="button"
        onclick={() => (g_filter_modal_open = false)}
        class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={20} />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if g_filter_loading}
        <div class="flex justify-center py-20">
          <span
            class="h-6 w-6 animate-spin rounded-full border-2 border-[#AA83B4] border-t-transparent"
          ></span>
        </div>
      {:else}
        <div class="space-y-8 px-8 py-6">
          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">테 종류</p>
            <div class="flex flex-wrap gap-2">
              {#each FRAME_TYPE_OPTIONS as opt}
                {@const selected = g_filter_obj.frame_type_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('frame_type_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[#4B0055] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">재질</p>
            <div class="flex flex-wrap gap-2">
              {#each MATERIAL_OPTIONS as opt}
                {@const selected = g_filter_obj.material_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('material_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[#4B0055] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">카테고리</p>
            <div class="flex flex-wrap gap-2">
              {#each CATEGORY_OPTIONS as opt}
                {@const selected = g_filter_obj.category_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('category_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[#4B0055] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="shrink-0 border-t border-slate-100 bg-slate-50 px-8 py-6">
      <p class="mb-4 text-sm font-bold text-slate-500">
        {#if g_active_filter_count > 0}
          <span class="text-[#4B0055]">{g_glasses_arr.length}개</span>의 안경이 검색됩니다
        {:else}
          필터를 선택하면 실시간으로 결과가 반영됩니다
        {/if}
      </p>
      <div class="flex gap-3">
        <button
          type="button"
          onclick={on_click_reset_filter}
          disabled={g_active_filter_count === 0}
          class="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3.5 text-sm font-bold text-slate-500 transition-all hover:border-slate-300 hover:bg-white disabled:opacity-40"
        >
          <RotateCcw size={14} />
          초기화
        </button>
        <button
          type="button"
          onclick={() => (g_filter_modal_open = false)}
          class="flex flex-[2] items-center justify-center rounded-2xl bg-[#4B0055] py-3.5 text-sm font-black text-white transition-colors hover:bg-[#320038]"
        >
          적용하기
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 가이드 오버레이 -->
{#if g_guide_step > 0}
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
    role="presentation"
    onclick={on_click_guide_close}
    in:fade={{ duration: 250 }}
    out:fade={{ duration: 200 }}
  ></div>

  {#if g_guide_info}
    <div
      class="fixed z-50 w-80 rounded-3xl bg-white p-6 shadow-2xl"
      style={g_guide_info.card_style}
      in:fly={{ y: 8, duration: 300 }}
      out:fade={{ duration: 150 }}
    >
      <div class="mb-5 flex gap-1.5">
        {#each [1, 2, 3, 4, 5] as step_num}
          <div
            class="h-1.5 flex-1 rounded-full transition-colors duration-300 {g_guide_step >= step_num
              ? 'bg-[#AA83B4]'
              : 'bg-slate-100'}"
          ></div>
        {/each}
      </div>
      <p class="mb-1.5 text-xs font-black uppercase tracking-widest text-[#AA83B4]">
        Step {g_guide_step} / 5
      </p>
      <h3 class="mb-3 text-lg font-black leading-snug text-zinc-900">{g_guide_info.title}</h3>
      <p class="whitespace-pre-line text-sm leading-relaxed text-slate-500">{g_guide_info.desc}</p>
      <div
        class="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[#F5EAF7] px-4 py-3"
      >
        <span class="text-xs font-bold text-[#7B3F8A]">{g_guide_info.hint}</span>
        <ChevronRight size={14} class="shrink-0 text-[#AA83B4]" />
      </div>
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
            {g_guide_step < 5 ? '다음' : '시작하기'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<!-- 토스트 알림 -->
{#if g_toast_msg}
  <div
    class="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2"
    in:fly={{ y: 12, duration: 250 }}
    out:fade={{ duration: 200 }}
  >
    <div
      class="flex items-center gap-3 rounded-2xl bg-zinc-900/95 px-5 py-3.5 shadow-2xl backdrop-blur-md"
    >
      <span class="text-sm font-bold text-white">{g_toast_msg}</span>
    </div>
  </div>
{/if}

<style>
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
