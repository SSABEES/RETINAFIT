<script>
  import { Link } from '@maks11060/svelte5-router'
  import { ArrowLeft, Download, Glasses, Info, Send, Sparkles, UserRound } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { selected_customer_obj } from '@/lib/stores/customer'

  const g_default_customer_obj = {
    name: '김민준',
    phone: '010-1234-5678',
    age: '32세',
    visit_dt: '2026년 4월 16일',
  }

  const g_analysis_photo_group_arr = [
    {
      key: 'with_glasses',
      title: '안경 착용 버전',
      photo_arr: [
        {
          label: '정면',
          tone_class: 'border-[#E8D6FF] bg-[#FAF5FF]',
          icon_class: 'text-[#8B24F8]',
        },
        {
          label: '좌측',
          tone_class: 'border-[#E8D6FF] bg-[#FAF5FF]',
          icon_class: 'text-[#8B24F8]',
        },
        {
          label: '우측',
          tone_class: 'border-[#E8D6FF] bg-[#FAF5FF]',
          icon_class: 'text-[#8B24F8]',
        },
      ],
    },
    {
      key: 'without_glasses',
      title: '안경 미착용 버전',
      photo_arr: [
        {
          label: '정면',
          tone_class: 'border-[#DDE5EF] bg-[#EEF3F9]',
          icon_class: 'text-[#8B9BB4]',
        },
        {
          label: '좌측',
          tone_class: 'border-[#DDE5EF] bg-[#F5F7FB]',
          icon_class: 'text-[#8391AA]',
        },
        {
          label: '우측',
          tone_class: 'border-[#DDE5EF] bg-[#F5F7FB]',
          icon_class: 'text-[#8391AA]',
        },
      ],
    },
  ]

  const g_lens_group_arr = [
    {
      title: '렌즈 종류',
      option_arr: [
        { label: '단초점', active: true },
        { label: '다초점', active: false },
        { label: '누진다초점', active: false },
        { label: '비구면', active: false },
      ],
    },
    {
      title: '코팅',
      option_arr: [
        { label: '블루라이트 차단', active: false },
        { label: '자외선 차단', active: false },
        { label: '반사방지', active: true },
        { label: '발수코팅', active: false },
      ],
    },
    {
      title: '주 사용 환경',
      option_arr: [
        { label: '사무·PC', active: false },
        { label: '운전', active: false },
        { label: '야외활동', active: false },
        { label: '독서', active: false },
      ],
    },
    {
      title: '렌즈 소재',
      option_arr: [
        { label: '일반', active: false },
        { label: '초박형', active: false },
        { label: '고굴절', active: false },
      ],
    },
  ]

  const g_face_measure_arr = [
    { label: 'PD (눈 간격)', value: '64mm' },
    { label: '얼굴 너비', value: '135mm' },
    { label: '얼굴 길이', value: '190mm' },
    { label: '턱 너비', value: '118mm' },
    { label: '이마 너비', value: '128mm' },
    { label: '광대 너비', value: '142mm' },
  ]

  const g_recommended_frame_arr = [
    '라운드 프레임',
    '스퀘어 프레임',
    '보스턴 프레임',
    '하금테 프레임',
  ]

  const g_glasses_variant_arr = [
    {
      key: 'wellington',
      label: '클래식 블랙 웰링턴',
      product_arr: [
        { label: '모델명', value: '클래식 블랙 웰링턴' },
        { label: '브랜드', value: '레이밴' },
        { label: '모델 코드', value: 'RB5154' },
        { label: '컬러', value: '블랙' },
      ],
      price_text: '159,000원',
      measure_arr: [
        { label: '프레임 전체 너비', value: '142mm' },
        { label: '렌즈 너비', value: '52mm' },
        { label: '브릿지 너비', value: '18mm' },
        { label: '렌즈 높이', value: '42mm' },
        { label: '템플 길이', value: '145mm' },
      ],
      fit_metric_arr: [
        {
          label: '얼굴 대비 프레임 비율',
          value: '적정',
          tone_class: 'bg-[#EAF9F1] text-[#17804C] border-[#C7EED8]',
        },
        {
          label: '렌즈-눈동자 정렬',
          value: '양호',
          tone_class: 'bg-[#E9F7F2] text-[#177A69] border-[#CBEDE2]',
        },
        {
          label: '템플 각도',
          value: '12°',
          tone_class: 'bg-[#EDF4FF] text-[#2563EB] border-[#D6E5FF]',
        },
        {
          label: '착용 편안함',
          value: '매우 좋음',
          tone_class: 'bg-[#F5EEFF] text-[#9A1BFF] border-[#E9D7FF]',
        },
      ],
      expert_opinion_arr: [
        '선택하신 프레임은 얼굴형과 매우 잘 어울립니다.',
        '프레임 너비 142mm는 얼굴 너비 135mm에 적합한 사이즈입니다.',
        '렌즈 중심이 눈동자와 잘 정렬되어 시야 왜곡이 최소화됩니다.',
        '전반적으로 매우 만족스러운 선택이며, 장시간 착용에도 편안할 것으로 예상됩니다.',
      ],
    },
    {
      key: 'boston',
      label: '브라운 라운드 보스턴',
      product_arr: [
        { label: '모델명', value: '브라운 라운드 보스턴' },
        { label: '브랜드', value: '젠틀몬스터' },
        { label: '모델 코드', value: 'GM2208' },
        { label: '컬러', value: '브라운' },
      ],
      price_text: '182,000원',
      measure_arr: [
        { label: '프레임 전체 너비', value: '138mm' },
        { label: '렌즈 너비', value: '49mm' },
        { label: '브릿지 너비', value: '20mm' },
        { label: '렌즈 높이', value: '44mm' },
        { label: '템플 길이', value: '147mm' },
      ],
      fit_metric_arr: [
        {
          label: '얼굴 대비 프레임 비율',
          value: '양호',
          tone_class: 'bg-[#EEF6FF] text-[#2F6FED] border-[#D6E6FF]',
        },
        {
          label: '렌즈-눈동자 정렬',
          value: '적정',
          tone_class: 'bg-[#EAF9F1] text-[#17804C] border-[#C7EED8]',
        },
        {
          label: '템플 각도',
          value: '10°',
          tone_class: 'bg-[#EDF4FF] text-[#2563EB] border-[#D6E5FF]',
        },
        {
          label: '착용 편안함',
          value: '좋음',
          tone_class: 'bg-[#F5EEFF] text-[#7C3AED] border-[#E9D7FF]',
        },
      ],
      expert_opinion_arr: [
        '보스턴 프레임은 부드러운 인상을 유지하면서 얼굴 비율을 안정적으로 보완합니다.',
        '브릿지 폭이 넉넉해 코받침 압박이 적고 착용 밸런스가 좋습니다.',
        '렌즈 세로 높이가 확보되어 다초점 구성에도 대응하기 좋습니다.',
      ],
    },
    {
      key: 'square',
      label: '실버 메탈 스퀘어',
      product_arr: [
        { label: '모델명', value: '실버 메탈 스퀘어' },
        { label: '브랜드', value: '린드버그' },
        { label: '모델 코드', value: 'LB9031' },
        { label: '컬러', value: '실버' },
      ],
      price_text: '215,000원',
      measure_arr: [
        { label: '프레임 전체 너비', value: '144mm' },
        { label: '렌즈 너비', value: '54mm' },
        { label: '브릿지 너비', value: '17mm' },
        { label: '렌즈 높이', value: '39mm' },
        { label: '템플 길이', value: '145mm' },
      ],
      fit_metric_arr: [
        {
          label: '얼굴 대비 프레임 비율',
          value: '매우 좋음',
          tone_class: 'bg-[#EAF9F1] text-[#17804C] border-[#C7EED8]',
        },
        {
          label: '렌즈-눈동자 정렬',
          value: '양호',
          tone_class: 'bg-[#E9F7F2] text-[#177A69] border-[#CBEDE2]',
        },
        {
          label: '템플 각도',
          value: '13°',
          tone_class: 'bg-[#EDF4FF] text-[#2563EB] border-[#D6E5FF]',
        },
        {
          label: '착용 편안함',
          value: '보통',
          tone_class: 'bg-[#FFF5E8] text-[#C76A10] border-[#FFE4C2]',
        },
      ],
      expert_opinion_arr: [
        '스퀘어 메탈 프레임은 또렷한 인상을 주며 업무용 스타일에 적합합니다.',
        '프레임 폭이 넓어 시각적으로 얼굴선이 더 정돈되어 보입니다.',
        '초기 착용 시 템플 장력 조정이 들어가면 만족도가 더 높아질 수 있습니다.',
      ],
    },
  ]

  let g_customer_name = $derived($selected_customer_obj?.name ?? g_default_customer_obj.name)
  let g_customer_phone = $derived($selected_customer_obj?.phone ?? g_default_customer_obj.phone)
  let g_customer_age = $derived(get_customer_age_label($selected_customer_obj))
  let g_visit_dt = $derived(get_visit_dt_label($selected_customer_obj))
  let ref_open_photo_group_key_arr = $state(['with_glasses', 'without_glasses'])
  let ref_selected_glasses_key = $state('wellington')
  let g_selected_glasses_variant_obj = $derived(
    g_glasses_variant_arr.find((variant_obj) => variant_obj.key === ref_selected_glasses_key) ??
      g_glasses_variant_arr[0],
  )

  // 이전 화면으로 이동한다.
  function on_click_go_back() {
    window.history.back()
  }

  // 현재는 인쇄 기반 저장 흐름으로 PDF 다운로드를 대체한다.
  function on_click_download_pdf() {
    window.print()
  }

  // 추후 카카오톡 전송 기능이 연결될 CTA 자리다.
  function on_click_send_result() {
    return
  }

  // 촬영 이미지 그룹을 접거나 펼친다.
  function on_click_toggle_photo_group(group_key) {
    if (ref_open_photo_group_key_arr.includes(group_key)) {
      ref_open_photo_group_key_arr = ref_open_photo_group_key_arr.filter(
        (local_group_key) => local_group_key !== group_key,
      )
      return
    }

    ref_open_photo_group_key_arr = [...ref_open_photo_group_key_arr, group_key]
  }

  // 선택한 안경 탭을 기준으로 결과 카드 내용을 전환한다.
  function on_click_select_glasses(glasses_key) {
    ref_selected_glasses_key = glasses_key
  }

  // 고객 스토어 값이 없거나 불완전해도 리포트 상단에 안정적인 표시 문자열을 만든다.
  function get_customer_age_label(customer_obj) {
    if (customer_obj?.age) {
      return String(customer_obj.age)
    }

    const local_birth_dt = String(customer_obj?.birth_dt ?? '').trim()

    if (!local_birth_dt) {
      return g_default_customer_obj.age
    }

    const local_birth_year_match = local_birth_dt.match(/\d{4}/)

    if (!local_birth_year_match) {
      return g_default_customer_obj.age
    }

    const local_age = new Date().getFullYear() - Number(local_birth_year_match[0]) + 1
    return `${local_age}세`
  }

  // 고객의 최근 방문일을 한국어 형식으로 표시하고 값이 없으면 기본 예시 날짜를 사용한다.
  function get_visit_dt_label(customer_obj) {
    const local_visit_dt = String(customer_obj?.last_visit_dt ?? '').trim()

    if (!local_visit_dt) {
      return g_default_customer_obj.visit_dt
    }

    const local_date = new Date(local_visit_dt)

    if (Number.isNaN(local_date.getTime())) {
      return local_visit_dt
    }

    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(local_date)
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
        type="button"
        onclick={on_click_go_back}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>

    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">최종 분석 리포트</h1>

    <div class="flex justify-end gap-3">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--retinal-primary-700)] bg-[var(--retinal-primary-700)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--retinal-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/30"
        type="button"
        onclick={on_click_download_pdf}
      >
        <Download size={16} strokeWidth={2.1} aria-hidden="true" />
        <span>PDF 다운로드</span>
      </button>

      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--retinal-primary-700)] bg-[var(--retinal-soft-purple)] px-4 text-sm font-extrabold text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-600)] hover:bg-[#EEDCF3] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/20"
        type="button"
        onclick={on_click_send_result}
      >
        <Send size={16} strokeWidth={2.1} aria-hidden="true" />
        <span>결과 전송</span>
      </button>
    </div>
  </header>

  <section class="app-page-scroll h-[calc(100%-72px)] px-8 py-6">
    <div class="mx-auto flex w-full max-w-[1216px] flex-col gap-4 pb-20">
      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            고객 정보
          </h2>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="m-0 text-xs font-bold text-[#98A2B3]">고객명</p>
            <p class="mt-1 text-lg font-extrabold text-[#30313A]">{g_customer_name}</p>
          </div>
          <div>
            <p class="m-0 text-xs font-bold text-[#98A2B3]">연령</p>
            <p class="mt-1 text-lg font-extrabold text-[#30313A]">{g_customer_age}</p>
          </div>
          <div>
            <p class="m-0 text-xs font-bold text-[#98A2B3]">연락처</p>
            <p class="mt-1 text-lg font-extrabold text-[#30313A]">{g_customer_phone}</p>
          </div>
          <div>
            <p class="m-0 text-xs font-bold text-[#98A2B3]">방문일</p>
            <p class="mt-1 text-lg font-extrabold text-[#30313A]">{g_visit_dt}</p>
          </div>
        </div>
      </section>

      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            1. 얼굴 분석 촬영 이미지
          </h2>
        </div>

        <div class="grid gap-4">
          {#each g_analysis_photo_group_arr as photo_group_obj (photo_group_obj.key)}
            {@const local_is_open = ref_open_photo_group_key_arr.includes(photo_group_obj.key)}
            <section class="rounded-[16px] bg-[#F8FAFD] p-4">
              <button
                class="flex w-full cursor-pointer items-center justify-between rounded-[12px] border border-[#E8EEF6] bg-white px-4 py-3 text-left transition hover:border-[var(--retinal-primary-600)] hover:bg-[var(--retinal-soft-purple)]"
                type="button"
                onclick={() => on_click_toggle_photo_group(photo_group_obj.key)}
              >
                <span class="text-base font-extrabold text-[#202127]">{photo_group_obj.title}</span>
                <span class="text-sm font-bold text-[#667085]">
                  {local_is_open ? '접기' : '펼치기'}
                </span>
              </button>

              {#if local_is_open}
                <div class="mt-4 grid gap-4 md:grid-cols-3">
                  {#each photo_group_obj.photo_arr as photo_obj, photo_index (`${photo_group_obj.key}-${photo_index}`)}
                    <article class="rounded-[14px] bg-white p-3">
                      <p class="mb-3 text-center text-sm font-extrabold text-[#30313A]">
                        {photo_obj.label}
                      </p>
                      <div
                        class={`flex aspect-[4/5] items-center justify-center rounded-[12px] border ${photo_obj.tone_class}`}
                      >
                        <div class={`grid justify-items-center gap-3 ${photo_obj.icon_class}`}>
                          <UserRound size={42} strokeWidth={1.9} aria-hidden="true" />
                          <p class="m-0 text-xs font-extrabold">분석용 촬영 이미지</p>
                        </div>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      </section>

      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            2. 얼굴 분석 결과
          </h2>
        </div>

        <div class="grid gap-4 md:grid-cols-[1.05fr_1fr]">
          <div class="grid gap-4">
            <article class="rounded-[14px] bg-[#F8FAFD] p-4">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-[#9A1BFF]"></span>
                <h3 class="m-0 text-sm font-extrabold text-[#30313A]">얼굴형 분석</h3>
              </div>
              <div class="mt-4">
                <p class="m-0 text-xl font-extrabold text-[#9A1BFF]">타원형</p>
              </div>
              <p class="mt-3 text-sm leading-6 text-[#667085]">
                타원형 얼굴은 모든 안경 프레임을 잘 받아주는 얼굴형입니다.<br />
                다양한 스타일의 프레임을 시도해보세요.
              </p>
            </article>

            <article class="rounded-[14px] bg-[#F8FAFD] p-4">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-[#FF6A3D]"></span>
                <h3 class="m-0 text-sm font-extrabold text-[#30313A]">피부톤 분석</h3>
              </div>
              <div class="mt-4">
                <p class="m-0 text-xl font-extrabold text-[#FF6A3D]">웜톤</p>
              </div>
              <p class="mt-3 text-sm leading-6 text-[#667085]">
                웜톤 피부에는 골드, 레드, 화이트, 오렌지 계열의 프레임이 잘 어울립니다.
              </p>
            </article>
          </div>

          <article class="rounded-[14px] bg-[#F8FAFD] p-4">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full bg-[#2563EB]"></span>
              <h3 class="m-0 text-sm font-extrabold text-[#30313A]">얼굴 측정값</h3>
            </div>

            <div class="mt-4 overflow-hidden rounded-[10px] border border-[#E8EEF6] bg-white">
              {#each g_face_measure_arr as measure_obj, measure_index (`face-${measure_index}`)}
                <div
                  class={`grid grid-cols-[1fr_auto] gap-3 px-4 py-3 ${
                    measure_index === g_face_measure_arr.length - 1
                      ? ''
                      : 'border-b border-[#EEF2F7]'
                  }`}
                >
                  <span class="text-sm font-bold text-[#98A2B3]">{measure_obj.label}</span>
                  <span class="text-sm font-extrabold text-[#30313A]">{measure_obj.value}</span>
                </div>
              {/each}
            </div>
          </article>
        </div>

        <article class="mt-4 rounded-[14px] border border-[#F0DFFB] bg-[#FBF6FF] p-4">
          <div class="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={2.2} class="text-[#9A1BFF]" aria-hidden="true" />
            <h3 class="m-0 text-sm font-extrabold text-[#30313A]">추천 프레임 스타일</h3>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            {#each g_recommended_frame_arr as frame_label, frame_index (`frame-${frame_index}`)}
              <span
                class="inline-flex min-h-9 items-center rounded-full bg-gradient-to-r from-[#7C13F9] to-[#9A1BFF] px-4 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(154,27,255,0.22)]"
              >
                {frame_label}
              </span>
            {/each}
          </div>
        </article>
      </section>

      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            3. 선택한 렌즈 조건
          </h2>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          {#each g_lens_group_arr as lens_group_obj (lens_group_obj.title)}
            {@const local_selected_option_arr = lens_group_obj.option_arr.filter(
              (option_obj) => option_obj.active,
            )}
            <section
              class="grid gap-3 rounded-[14px] bg-[#F8FAFD] px-4 py-4 md:grid-cols-[132px_1fr] md:items-center"
            >
              <h3 class="m-0 text-[1.05rem] font-extrabold text-zinc-950">
                {lens_group_obj.title}
              </h3>
              <div class="flex flex-wrap items-center gap-3">
                {#if local_selected_option_arr.length > 0}
                  {#each local_selected_option_arr as option_obj, option_index (`${lens_group_obj.title}-${option_index}`)}
                    <span
                      class="inline-flex min-h-11 items-center rounded-full border border-[var(--retinal-primary-700)] bg-[var(--retinal-soft-purple)] px-4 py-2 text-sm font-extrabold text-[var(--retinal-primary-700)]"
                    >
                      {option_obj.label}
                    </span>
                  {/each}
                {:else}
                  <span class="text-base font-bold text-[#98A2B3]">-</span>
                {/if}
              </div>
            </section>
          {/each}
        </div>
      </section>

      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            4. AR 피팅 결과
          </h2>
        </div>

        <div class="mb-4 rounded-[14px] bg-[#F8FAFD] p-4">
          <div class="flex flex-wrap gap-3">
            {#each g_glasses_variant_arr as variant_obj (variant_obj.key)}
              <button
                class={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-5 text-sm font-extrabold transition ${
                  ref_selected_glasses_key === variant_obj.key
                    ? 'border-[var(--retinal-primary-700)] bg-[var(--retinal-primary-700)] text-white'
                    : 'border-[var(--retinal-border)] bg-white text-[var(--retinal-primary-700)] hover:border-[var(--retinal-primary-600)] hover:bg-[var(--retinal-soft-purple)]'
                }`}
                type="button"
                onclick={() => on_click_select_glasses(variant_obj.key)}
              >
                {variant_obj.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-[minmax(0,420px)_1fr]">
          <article class="rounded-[14px] bg-[#F8FAFD] p-4">
            <p class="mb-3 text-center text-sm font-extrabold text-[#30313A]">AR 피팅 목업</p>
            <div
              class="flex aspect-[4/5] items-center justify-center rounded-[14px] border border-[#E8D6FF] bg-[linear-gradient(180deg,#FAF4FF_0%,#FFF8FD_100%)]"
            >
              <div class="grid justify-items-center gap-3 text-[#8B24F8]">
                <Glasses size={48} strokeWidth={2.3} aria-hidden="true" />
                <p class="m-0 text-sm font-extrabold">AR 피팅 목업 이미지</p>
              </div>
            </div>
          </article>

          <div class="grid gap-4">
            <div class="grid gap-4 lg:grid-cols-2">
              <article class="rounded-[14px] bg-[#F8FAFD] p-4">
                <h3 class="m-0 text-sm font-extrabold text-[#30313A]">제품 정보</h3>
                <div class="mt-4 overflow-hidden rounded-[10px] border border-[#E8EEF6] bg-white">
                  {#each g_selected_glasses_variant_obj.product_arr as product_obj, product_index (`product-${product_index}`)}
                    <div
                      class={`grid grid-cols-[88px_1fr] gap-3 px-4 py-3 ${
                        product_index === g_selected_glasses_variant_obj.product_arr.length - 1
                          ? ''
                          : 'border-b border-[#EEF2F7]'
                      }`}
                    >
                      <span class="text-sm font-bold text-[#98A2B3]">{product_obj.label}</span>
                      <span class="text-sm font-extrabold text-[#30313A]">{product_obj.value}</span>
                    </div>
                  {/each}
                  <div class="grid grid-cols-[88px_1fr] gap-3 px-4 py-3">
                    <span class="text-sm font-bold text-[#98A2B3]">가격</span>
                    <span class="text-right text-[1.35rem] font-extrabold text-[#9A1BFF]">
                      {g_selected_glasses_variant_obj.price_text}
                    </span>
                  </div>
                </div>
              </article>

              <article class="rounded-[14px] bg-[#F8FAFD] p-4">
                <h3 class="m-0 text-sm font-extrabold text-[#30313A]">프레임 측정값</h3>
                <div class="mt-4 overflow-hidden rounded-[10px] border border-[#E8EEF6] bg-white">
                  {#each g_selected_glasses_variant_obj.measure_arr as measure_obj, measure_index (`glasses-${measure_index}`)}
                    <div
                      class={`grid grid-cols-[1fr_auto] gap-3 px-4 py-3 ${
                        measure_index === g_selected_glasses_variant_obj.measure_arr.length - 1
                          ? ''
                          : 'border-b border-[#EEF2F7]'
                      }`}
                    >
                      <span class="text-sm font-bold text-[#98A2B3]">{measure_obj.label}</span>
                      <span class="text-sm font-extrabold text-[#30313A]">{measure_obj.value}</span>
                    </div>
                  {/each}
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-[18px] border border-[#E9E8F0] bg-white p-5 shadow-sm shadow-black/8">
        <div class="mb-4 flex justify-start text-left">
          <h2 class="m-0 text-[1.4rem] font-extrabold tracking-[-0.02em] text-[#202127]">
            5. 착용 적합도 분석
          </h2>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {#each g_selected_glasses_variant_obj.fit_metric_arr as metric_obj, metric_index (`fit-${metric_index}`)}
            <article class={`rounded-[14px] border p-4 text-center ${metric_obj.tone_class}`}>
              <p class="m-0 text-xs font-extrabold">{metric_obj.label}</p>
              <p class="mt-3 text-[1.55rem] font-extrabold tracking-[-0.03em]">
                {metric_obj.value}
              </p>
            </article>
          {/each}
        </div>

        <article class="mt-4 rounded-[14px] border border-[#DCE9FF] bg-[#EEF5FF] p-4">
          <div class="flex items-center gap-2">
            <Info size={16} strokeWidth={2.2} class="text-[#F0B429]" aria-hidden="true" />
            <h3 class="m-0 text-sm font-extrabold text-[#36558F]">전문가 의견</h3>
          </div>

          <ul class="mt-3 grid gap-2 pl-4 text-sm font-bold leading-6 text-[#4D70AF]">
            {#each g_selected_glasses_variant_obj.expert_opinion_arr as opinion_text, opinion_index (`opinion-${opinion_index}`)}
              <li>{opinion_text}</li>
            {/each}
          </ul>
        </article>
      </section>

      <section
        class="rounded-[18px] border border-[#E9E8F0] bg-[#F6F8FC] px-5 py-4 text-center shadow-sm shadow-black/5"
      >
        <p class="m-0 text-xs font-bold leading-5 text-[#7B8599]">
          본 리포트는 AI 기반 얼굴 분석 시스템을 통해 생성되었습니다.
        </p>
        <p class="mt-1 text-xs font-bold leading-5 text-[#7B8599]">
          실제 착용감은 개인차가 있을 수 있으며, 전문 안경사의 최종 피팅 조정을 권장합니다.
        </p>
        <p class="mt-2 text-xs font-bold text-[#A2AABC]">
          © 2026 Retina - 실시간 AR 안경 피팅 서비스
        </p>
      </section>

      <div class="grid gap-3 md:grid-cols-2">
        <Link
          class="grid min-h-14 place-items-center rounded-[14px] border border-[var(--retinal-border)] bg-white px-6 text-base font-extrabold text-[var(--retinal-primary-700)] transition hover:border-[var(--retinal-primary-600)] hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/25"
          href={PATH.analysis}
        >
          고객 페이지로 돌아가기
        </Link>
        <Link
          class="grid min-h-14 place-items-center rounded-[14px] border border-[var(--retinal-primary-700)] bg-[var(--retinal-primary-700)] px-6 text-base font-extrabold !text-white transition hover:bg-[var(--retinal-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/30"
          href={PATH.users}
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  </section>
</main>
