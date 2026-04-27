<script>
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'

  const g_metric_arr = [
    { label: '얼굴 너비', min_key: 'face_width_min', max_key: 'face_width_max', unit: 'mm' },
    { label: '얼굴 길이', min_key: 'face_length_min', max_key: 'face_length_max', unit: 'mm' },
    { label: '얼굴 비율', min_key: 'face_ratio_min', max_key: 'face_ratio_max', unit: ':1' },
    { label: '광대 너비', min_key: 'cheek_width_min', max_key: 'cheek_width_max', unit: 'mm' },
    { label: '턱 너비', min_key: 'jaw_width_min', max_key: 'jaw_width_max', unit: 'mm' },
  ]

  let ref_saved_message = $state('')
  let ref_face_criteria_arr = $state([
    {
      id: 'oval',
      name: '계란형',
      english_nm: 'Oval',
      criteria_obj: {
        face_width_min: 130,
        face_width_max: 155,
        face_length_min: 180,
        face_length_max: 215,
        face_ratio_min: 1.25,
        face_ratio_max: 1.45,
        cheek_width_min: 128,
        cheek_width_max: 150,
        jaw_width_min: 105,
        jaw_width_max: 132,
      },
    },
    {
      id: 'round',
      name: '둥근형',
      english_nm: 'Round',
      criteria_obj: {
        face_width_min: 135,
        face_width_max: 165,
        face_length_min: 145,
        face_length_max: 175,
        face_ratio_min: 0.95,
        face_ratio_max: 1.15,
        cheek_width_min: 132,
        cheek_width_max: 162,
        jaw_width_min: 118,
        jaw_width_max: 148,
      },
    },
    {
      id: 'square',
      name: '사각형',
      english_nm: 'Square',
      criteria_obj: {
        face_width_min: 140,
        face_width_max: 170,
        face_length_min: 155,
        face_length_max: 190,
        face_ratio_min: 1.05,
        face_ratio_max: 1.25,
        cheek_width_min: 136,
        cheek_width_max: 168,
        jaw_width_min: 130,
        jaw_width_max: 165,
      },
    },
    {
      id: 'heart',
      name: '하트형',
      english_nm: 'Heart',
      criteria_obj: {
        face_width_min: 135,
        face_width_max: 165,
        face_length_min: 165,
        face_length_max: 205,
        face_ratio_min: 1.15,
        face_ratio_max: 1.4,
        cheek_width_min: 135,
        cheek_width_max: 165,
        jaw_width_min: 95,
        jaw_width_max: 125,
      },
    },
    {
      id: 'oblong',
      name: '긴형',
      english_nm: 'Oblong',
      criteria_obj: {
        face_width_min: 120,
        face_width_max: 150,
        face_length_min: 195,
        face_length_max: 235,
        face_ratio_min: 1.45,
        face_ratio_max: 1.75,
        cheek_width_min: 118,
        cheek_width_max: 148,
        jaw_width_min: 105,
        jaw_width_max: 135,
      },
    },
  ])

  // 얼굴형 기준 설정 내용을 저장한 것으로 처리하고 완료 메시지를 표시한다.
  function on_submit_face_criteria(local_event) {
    local_event.preventDefault()
    ref_saved_message = '얼굴형 기준 설정이 임시 저장되었습니다.'
  }
</script>

<AdminLayout active_key="face">
  <form class="grid gap-7" onsubmit={on_submit_face_criteria}>
    <div class="flex items-start justify-between gap-6">
      <h2 class="m-0 text-2xl font-extrabold text-zinc-950">얼굴형 기준 설정</h2>
      <button
        class="min-h-12 cursor-pointer rounded-xl border-0 bg-[var(--retinal-primary-700)] px-7 text-base font-extrabold text-white transition hover:bg-[var(--retinal-primary-500)]"
        type="submit"
      >
        기준 저장
      </button>
    </div>

    {#if ref_saved_message}
      <p class="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-left text-base font-bold text-emerald-700">
        {ref_saved_message}
      </p>
    {/if}

    <div class="grid gap-7">
      {#each ref_face_criteria_arr as face_obj (face_obj.id)}
        <article class="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-left shadow-sm shadow-slate-200/50">
          <div class="flex items-center gap-3">
            <h3 class="m-0 text-2xl font-extrabold text-zinc-950">{face_obj.name}</h3>
            <span class="rounded-full bg-[var(--retinal-soft-purple)] px-3 py-1 text-sm font-extrabold text-[var(--retinal-primary-700)]">
              {face_obj.english_nm}
            </span>
          </div>

          <div class="mt-7 grid gap-5 lg:grid-cols-3">
            {#each g_metric_arr as metric_obj (metric_obj.label)}
              <fieldset class="m-0 rounded-xl border border-slate-200 p-5">
                <legend class="px-2 text-base font-extrabold text-slate-700">{metric_obj.label}</legend>

                <div class="mt-3 grid gap-4">
                  <label class="grid gap-2 text-sm font-bold text-slate-500">
                    최소
                    <div class="flex items-center rounded-lg border border-slate-200 bg-white px-3">
                      <input
                        class="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-lg font-extrabold text-zinc-950 outline-none"
                        type="number"
                        step={metric_obj.unit === ':1' ? '0.01' : '1'}
                        bind:value={face_obj.criteria_obj[metric_obj.min_key]}
                      />
                      <span class="text-sm font-bold text-slate-400">{metric_obj.unit}</span>
                    </div>
                  </label>

                  <label class="grid gap-2 text-sm font-bold text-slate-500">
                    최대
                    <div class="flex items-center rounded-lg border border-slate-200 bg-white px-3">
                      <input
                        class="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-lg font-extrabold text-zinc-950 outline-none"
                        type="number"
                        step={metric_obj.unit === ':1' ? '0.01' : '1'}
                        bind:value={face_obj.criteria_obj[metric_obj.max_key]}
                      />
                      <span class="text-sm font-bold text-slate-400">{metric_obj.unit}</span>
                    </div>
                  </label>
                </div>
              </fieldset>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </form>
</AdminLayout>
