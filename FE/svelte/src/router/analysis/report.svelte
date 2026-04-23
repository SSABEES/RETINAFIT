<script>
  import { Link } from '@maks11060/svelte5-router'
  import { ArrowLeft, Camera, ChevronRight, Ear, ScanFace, Sparkles } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import { selected_customer_obj } from '@/lib/stores/customer'

  const g_view_tab_arr = [
    { key: 'front_glasses', label: '정면 (안경 착용)' },
    { key: 'front_no_glasses', label: '정면 (안경 미착용)' },
    { key: 'left_ear', label: '왼쪽 귀' },
    { key: 'right_ear', label: '오른쪽 귀' },
  ]

  const g_analysis_by_tab_obj = {
    front_glasses: {
      image_caption: '정면 사진 (안경 착용)',
      title: '안경 착용 분석',
      measure_title: '안경 측정',
      measure_arr: [
        { label: '프레임 전체 너비', value: '142mm', note: '', tone: 'text-zinc-950' },
        { label: '렌즈 너비 (좌/우)', value: '52mm / 52mm', note: '', tone: 'text-zinc-950' },
        { label: '브릿지 너비', value: '18mm', note: '', tone: 'text-zinc-950' },
        { label: '렌즈 높이', value: '42mm', note: '', tone: 'text-zinc-950' },
        { label: '템플 길이', value: '145mm', note: '', tone: 'text-zinc-950' },
      ],
      sub_card_title: '프레임 핏 분석',
      sub_measure_arr: [
        { label: '얼굴 대비 프레임 비율', value: '적정', note: '', tone: 'text-emerald-600' },
        { label: '렌즈 중심과 눈동자 정렬', value: '양호', note: '', tone: 'text-emerald-600' },
        { label: '템플 각도', value: '12°', note: '', tone: 'text-zinc-950' },
      ],
    },
    front_no_glasses: {
      image_caption: '정면 사진 (안경 미착용)',
      title: '얼굴 분석',
      measure_title: '얼굴 측정값',
      measure_arr: [
        { label: 'PD (눈 간격)', value: '64mm', note: '', tone: 'text-zinc-950' },
        { label: '얼굴 너비', value: '135mm', note: '', tone: 'text-zinc-950' },
        { label: '얼굴 길이', value: '190mm', note: '', tone: 'text-zinc-950' },
        { label: '턱 너비', value: '118mm', note: '', tone: 'text-zinc-950' },
        { label: '이마 너비', value: '128mm', note: '', tone: 'text-zinc-950' },
        { label: '광대 너비', value: '142mm', note: '', tone: 'text-zinc-950' },
        { label: '얼굴 비율', value: '1:1.41', note: '(이상형)', tone: 'text-emerald-600' },
      ],
    },
    left_ear: {
      image_caption: '왼쪽 귀 사진',
      title: '왼쪽 귀 분석',
      measure_title: '귀 측정',
      measure_arr: [
        { label: '귀 높이', value: '+2mm', note: '중심선 대비 위쪽', tone: 'text-zinc-950' },
        { label: '귀 각도', value: '8°', note: '정상 범위', tone: 'text-emerald-600' },
        { label: '템플 권장 각도', value: '12°', note: '', tone: 'text-zinc-950' },
        { label: '귀 위치', value: '표준', note: '', tone: 'text-emerald-600' },
      ],
    },
    right_ear: {
      image_caption: '오른쪽 귀 사진',
      title: '오른쪽 귀 분석',
      measure_title: '귀 측정',
      measure_arr: [
        { label: '귀 높이', value: '-3mm', note: '중심선 대비 아래쪽', tone: 'text-zinc-950' },
        { label: '귀 각도', value: '7°', note: '정상 범위', tone: 'text-emerald-600' },
        { label: '템플 권장 각도', value: '10°', note: '', tone: 'text-zinc-950' },
        { label: '귀 위치', value: '표준', note: '', tone: 'text-emerald-600' },
      ],
      sub_card_title: '좌우 귀 높이 차이',
      highlight_value: '5mm',
      highlight_text: '왼쪽이 오른쪽보다 5mm 높습니다',
    },
  }

  const g_face_shape_meta_obj = {
    oval: { label: '계란형', aliases: ['계란형', '타원형', 'oval'] },
    round: { label: '둥근형', aliases: ['둥근형', 'round'] },
    heart: { label: '하트형', aliases: ['하트형', 'heart'] },
    square: { label: '사각형', aliases: ['사각형', 'square'] },
    oblong: { label: '긴형', aliases: ['긴형', '긴 얼굴형', 'oblong'] },
  }

  function normalize_face_shape_key(face_shape_value) {
    const local_value = String(face_shape_value ?? '').trim().toLowerCase()

    for (const [face_shape_key, face_shape_meta_obj] of Object.entries(g_face_shape_meta_obj)) {
      if (
        face_shape_meta_obj.aliases.some((alias_value) => alias_value.toLowerCase() === local_value)
      ) {
        return face_shape_key
      }
    }

    return 'oval'
  }

  function normalize_gender_key(gender_value) {
    const local_value = String(gender_value ?? '').trim().toLowerCase()

    if (['0', 'm', 'male', 'man', '남', '남자'].includes(local_value)) {
      return 'man'
    }

    return 'woman'
  }

  function get_face_image_src(face_shape_key, gender_key) {
    const local_gender_key = gender_key === 'man' ? 'man' : 'woman'

    return {
      man: {
        oval: '/face/man/oval_man.png',
        round: '/face/man/round_man.png',
        heart: '/face/man/heart_man.png',
        square: '/face/man/square_man.png',
        oblong: '/face/man/oblong_man.png',
      },
      woman: {
        oval: '/face/woman/oval_woman.png',
        round: '/face/woman/round_woman.png',
        heart: '/face/woman/heart_woman.png',
        square: '/face/woman/square_woman.png',
        oblong: '/face/woman/oblong.png',
      },
    }[local_gender_key][face_shape_key]
  }

  function get_skin_tone_meta(skin_tone_value) {
    const local_value = String(skin_tone_value ?? '').trim().toUpperCase()

    if (local_value === 'COOL' || local_value.includes('쿨')) {
      return {
        label: 'COOL',
        detail: '차가운 톤',
        chips: [
          { label: '실버', tone_class: 'bg-[#A7B0BC]' },
          { label: '블랙', tone_class: 'bg-[#111827]' },
          { label: '블루', tone_class: 'bg-[#4A6CF7]' },
          { label: '퍼플', tone_class: 'bg-[#8B5CF6]' },
        ],
      }
    }

    if (local_value === 'NEUTRAL' || local_value.includes('뉴트럴') || local_value.includes('중성')) {
      return {
        label: 'NEUTRAL',
        detail: '중성 톤',
        chips: [
          { label: '모든 색상 가능', tone_class: 'bg-[#64748B]' },
          { label: '고객 선호 반영', tone_class: 'bg-[#9A1BFF]' },
          { label: '균형감 있는 색', tone_class: 'bg-[#94A3B8]' },
          { label: '무난한 선택', tone_class: 'bg-[#C084FC]' },
        ],
      }
    }

    return {
      label: 'WARM',
      detail: '따뜻한 톤',
      chips: [
        { label: '골드', tone_class: 'bg-[#D4A63F]' },
        { label: '브라운', tone_class: 'bg-[#8B5E3C]' },
        { label: '버건디', tone_class: 'bg-[#7A1E3A]' },
        { label: '토트이즈', tone_class: 'bg-[#B86B2C]' },
      ],
    }
  }

  let g_customer_name = $derived(
    $selected_customer_obj?.name
      ? $selected_customer_obj.name.endsWith('님')
        ? $selected_customer_obj.name
        : `${$selected_customer_obj.name}님`
      : '고객님',
  )

  let g_customer_face_shape_key = $derived(
    normalize_face_shape_key($selected_customer_obj?.face_shape ?? 'oval'),
  )

  let g_summary_card_arr = $derived([
    {
      title: '얼굴형',
      label: '분석 결과',
      value: g_face_shape_meta_obj[g_customer_face_shape_key].label,
      image_src: get_face_image_src(
        g_customer_face_shape_key,
        normalize_gender_key($selected_customer_obj?.gender),
      ),
    },
    {
      title: '피부톤 분석',
      label: '피부톤',
      value: get_skin_tone_meta($selected_customer_obj?.skin_tone ?? 'WARM').label,
    },
    {
      title: '추천 프레임',
      label: '추천 유형',
      value: '메탈',
      badge_arr: ['라운드', '스퀘어', '보스턴', '하금테'],
    },
  ])

  let ref_active_tab = $state('front_glasses')
  let g_active_analysis_obj = $derived(g_analysis_by_tab_obj[ref_active_tab])

  function on_click_select_tab(tab_key) {
    ref_active_tab = tab_key
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <Link
        class="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-base font-bold text-slate-600 transition hover:text-[var(--retinal-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/20"
        href={PATH.analysis}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </Link>
    </div>

    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 분석</h1>

    <div></div>
  </header>

  <div class="h-[calc(100%-72px)] overflow-y-auto px-8 py-6">
    <div class="mx-auto max-w-[1216px]">
      <section
        class="rounded-lg border border-slate-200 bg-white px-8 py-8 shadow-sm shadow-slate-200/50"
      >
        <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{g_customer_name}</h2>

        <div class="mt-7 flex flex-wrap gap-3">
          {#each g_view_tab_arr as tab_obj (tab_obj.key)}
            <button
              class={`min-h-12 cursor-pointer rounded-full border px-7 text-base font-extrabold transition ${
                ref_active_tab === tab_obj.key
                  ? 'border-[var(--retinal-primary-600)] bg-[var(--retinal-primary-600)] text-white shadow-lg shadow-purple-950/20'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--retinal-primary-600)]/40 hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)]'
              }`}
              type="button"
              aria-pressed={ref_active_tab === tab_obj.key}
              onclick={() => on_click_select_tab(tab_obj.key)}
            >
              {tab_obj.label}
            </button>
          {/each}
        </div>

        <div class="mt-6 grid grid-cols-[560px_1fr] gap-6">
          <figure class="m-0">
            <div class="grid aspect-[3/4] place-items-center rounded-lg bg-[#111827] text-slate-500">
              <div class="grid justify-items-center gap-4">
                <Camera size={58} strokeWidth={1.8} aria-hidden="true" />
                <p class="m-0 text-base font-semibold">사진이 없습니다</p>
              </div>
            </div>
            <figcaption class="mt-3 text-center text-sm font-bold text-slate-500">
              {g_active_analysis_obj.image_caption}
            </figcaption>
          </figure>

          <div class="grid content-start gap-4">
            <section>
              <h2 class="m-0 text-2xl font-extrabold text-zinc-950">
                {g_active_analysis_obj.title}
              </h2>

              <div class="mt-4 rounded-lg border border-slate-200 bg-white px-6 py-5">
                <div class="mb-4 flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-[var(--retinal-primary-600)]"></span>
                  <h3 class="m-0 text-lg font-extrabold text-zinc-950">
                    {g_active_analysis_obj.measure_title}
                  </h3>
                </div>

                <div class="grid">
                  {#each g_active_analysis_obj.measure_arr as measure_obj, measure_index (`${measure_obj.label}-${measure_index}`)}
                    <div
                      class="flex min-h-14 items-center justify-between gap-6 border-b border-slate-100 last:border-b-0"
                    >
                      <span class="min-w-0 flex-1 text-left text-base font-bold text-slate-500">
                        {measure_obj.label}
                      </span>
                      <span
                        class={`ml-auto flex-none text-right text-xl font-extrabold ${measure_obj.tone}`}
                      >
                        {measure_obj.value}
                        {#if measure_obj.note}
                          <span class="ml-1 text-sm font-bold">{measure_obj.note}</span>
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            </section>

            {#if g_active_analysis_obj.sub_measure_arr}
              <section class="rounded-lg border border-slate-200 bg-white px-6 py-6">
                <div class="mb-4 flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-[var(--retinal-primary-600)]"></span>
                  <h3 class="m-0 text-lg font-extrabold text-zinc-950">
                    {g_active_analysis_obj.sub_card_title}
                  </h3>
                </div>

                <div class="grid">
                  {#each g_active_analysis_obj.sub_measure_arr as measure_obj, measure_index (`${measure_obj.label}-${measure_index}`)}
                    <div
                      class="flex min-h-14 items-center justify-between gap-6 border-b border-slate-100 last:border-b-0"
                    >
                      <span class="min-w-0 flex-1 text-left text-base font-bold text-slate-500">
                        {measure_obj.label}
                      </span>
                      <span
                        class={`ml-auto flex-none text-right text-xl font-extrabold ${measure_obj.tone}`}
                      >
                        {measure_obj.value}
                      </span>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            {#if g_active_analysis_obj.highlight_value}
              <section class="rounded-lg border border-slate-200 bg-white px-6 py-6">
                <div class="mb-5 flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-[var(--retinal-primary-600)]"></span>
                  <h3 class="m-0 text-lg font-extrabold text-zinc-950">
                    {g_active_analysis_obj.sub_card_title}
                  </h3>
                </div>
                <div class="grid place-items-center py-3">
                  <p class="m-0 text-5xl font-extrabold text-[var(--retinal-primary-600)]">
                    {g_active_analysis_obj.highlight_value}
                  </p>
                  <p class="m-0 mt-3 text-sm font-bold text-slate-600">
                    {g_active_analysis_obj.highlight_text}
                  </p>
                </div>
              </section>
            {/if}
          </div>
        </div>
      </section>

      <section
        class="mt-6 rounded-lg border border-slate-200 bg-white px-8 py-8 shadow-sm shadow-slate-200/50"
      >
        <div class="grid grid-cols-3 gap-6">
          {#each g_summary_card_arr as summary_obj (summary_obj.title)}
            <article class="min-h-[244px] rounded-lg border border-slate-200 bg-white px-6 py-6">
              <div class="flex items-center gap-2">
                {#if summary_obj.title === '추천 프레임'}
                  <Sparkles
                    size={21}
                    strokeWidth={2.4}
                    class="text-[var(--retinal-primary-600)]"
                    aria-hidden="true"
                  />
                {:else if summary_obj.title === '얼굴형'}
                  <ScanFace
                    size={21}
                    strokeWidth={2.4}
                    class="text-[var(--retinal-primary-600)]"
                    aria-hidden="true"
                  />
                {:else}
                  <Ear
                    size={21}
                    strokeWidth={2.4}
                    class="text-[var(--retinal-primary-600)]"
                    aria-hidden="true"
                  />
                {/if}
                <h3 class="m-0 text-xl font-extrabold text-zinc-950">{summary_obj.title}</h3>
              </div>

              {#if summary_obj.title === '얼굴형'}
                <div class="mt-7 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <div class="relative aspect-[4/5]">
                    <img
                      class="h-full w-full object-cover object-center"
                      src={summary_obj.image_src}
                      alt={`${summary_obj.value} 얼굴형`}
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/18 to-transparent"></div>
                    <div class="absolute inset-x-0 bottom-0 p-5 text-center text-white">
                      <p class="m-0 text-sm font-semibold text-white/78">{summary_obj.label}</p>
                      <p class="m-0 mt-1 text-3xl font-extrabold tracking-normal">
                        {summary_obj.value}
                      </p>
                    </div>
                  </div>
                </div>
              {:else if summary_obj.title === '피부톤 분석'}
                <div class="mt-7 grid gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 lg:grid-cols-[1fr_1fr] lg:items-stretch">
                  <div class="flex min-h-[180px] flex-col justify-center border-b border-slate-100 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
                    <p class="m-0 text-base font-bold text-slate-500">{summary_obj.label}:</p>
                    <p class="m-0 mt-3 text-4xl font-extrabold tracking-normal text-[var(--retinal-primary-600)]">
                      {get_skin_tone_meta(summary_obj.value).label}
                    </p>
                  </div>

                  <div class="grid content-center gap-3">
                    <div class="flex flex-wrap gap-2">
                      {#each get_skin_tone_meta(summary_obj.value).chips as chip_obj, chip_index (`${chip_obj.label}-${chip_index}`)}
                        <span
                          class={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-white ${chip_obj.tone_class}`}
                        >
                          <span class="h-2.5 w-2.5 rounded-full bg-white/80"></span>
                          {chip_obj.label}
                        </span>
                      {/each}
                    </div>
                  </div>
                </div>
              {:else}
                <div class="mt-7 grid grid-cols-[1fr_auto] items-center gap-4">
                  <p class="m-0 text-base font-bold text-slate-500">{summary_obj.label}</p>
                  <p class="m-0 text-xl font-extrabold text-[var(--retinal-primary-600)]">
                    {summary_obj.value}
                  </p>
                </div>
              {/if}

              {#if summary_obj.badge_arr}
                <div class="mt-4 grid grid-cols-2 gap-2">
                  {#each summary_obj.badge_arr as badge_text, badge_index (`${badge_text}-${badge_index}`)}
                    <span
                      class="rounded-lg bg-[var(--retinal-primary-600)] px-3 py-2 text-center text-sm font-extrabold text-white"
                    >
                      {badge_text}
                    </span>
                  {/each}
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </section>

      <div class="mt-6 grid grid-cols-2 gap-4 pb-8">
        <Link
          class="grid min-h-16 place-items-center rounded-lg border border-[var(--retinal-border)] bg-white text-lg font-extrabold text-zinc-950 transition hover:border-[var(--retinal-primary-600)] hover:bg-[var(--retinal-soft-purple)] hover:text-[var(--retinal-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/20"
          href={PATH.analysis}
        >
          다시 분석하기
        </Link>
        <Link
          class="grid min-h-16 grid-cols-[1fr_auto] items-center rounded-lg bg-[var(--retinal-primary-600)] px-8 text-center text-lg font-extrabold text-white transition hover:bg-[var(--retinal-primary-500)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retinal-primary-600)]/30"
          href={PATH.analysisArFitting}
        >
          <span>안경 둘러보기</span>
          <ChevronRight size={24} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </div>
  </div>
</main>
