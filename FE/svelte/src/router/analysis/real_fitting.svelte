<script>
  import { onDestroy, onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import { navigate } from '@maks11060/svelte5-router'
  import { Camera as CameraIcon, X, Loader2, CheckCheck, Glasses } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import { request_real_wearing_presigned_urls, upload_blob_to_s3 } from '@/lib/api/analysis.js'
  import { update_visit } from '@/lib/api/visit.js'
  import { push_error_toast } from '@/lib/stores/toast'

  /**
   * @typedef {{ blob: Blob, object_url: string, captured_at: number }} CaptureSlot
   * @typedef {{ id: number, slot_arr: (CaptureSlot | null)[], captured_at: number }} SavedSet
   */

  // 한 번 분석 세션에서 저장 가능한 최대 세트 수.
  const MAX_PHOTO_SET_COUNT = 5
  const SLOT_LABEL_ARR = ['정면', '좌측', '우측']
  const SLOT_ICON_ARR = [
    '/icons/face_center.png',
    '/icons/face_left.png',
    '/icons/face_right.png',
  ]

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {MediaStream | null} */
  let g_stream = null
  let g_is_camera_ready = $state(false)
  let g_camera_error = $state(/** @type {string | null} */ (null))

  /** @type {(CaptureSlot | null)[]} */
  let g_capture_slot_arr = $state([null, null, null])
  /** @type {SavedSet[]} */
  let g_saved_set_arr = $state([])
  let g_set_id_seq = 0

  // 최종 리포트 보기 클릭 시 업로드/PATCH 진행 상태.
  let g_is_submitting = $state(false)
  let g_submit_error = $state(/** @type {string | null} */ (null))

  // 1장 이상 촬영했으면 세트 저장 가능 (arfitting 정책과 동일).
  let g_has_any_capture = $derived(g_capture_slot_arr.some((s) => s !== null))
  let g_is_set_limit_reached = $derived(g_saved_set_arr.length >= MAX_PHOTO_SET_COUNT)
  let g_can_save = $derived(g_has_any_capture && !g_is_set_limit_reached)
  let g_can_submit = $derived(g_saved_set_arr.length > 0)

  // 카메라 시작 — 권한 거부/장치 없음 시 오류 메시지 노출.
  async function start_camera() {
    if (g_stream) return
    try {
      const local_stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      g_stream = local_stream
      if (ref_this_video_el) {
        ref_this_video_el.srcObject = local_stream
        await ref_this_video_el.play()
        g_is_camera_ready = true
      }
    } catch (err) {
      g_camera_error = '카메라를 사용할 수 없습니다. 권한과 장치 연결을 확인하세요.'
      console.error('[real_fitting] getUserMedia failed', err)
    }
  }

  // 카메라 정리 — 페이지 이탈 시 트랙 해제.
  function stop_camera() {
    if (g_stream) {
      for (const local_track of g_stream.getTracks()) local_track.stop()
      g_stream = null
    }
    if (ref_this_video_el) ref_this_video_el.srcObject = null
    g_is_camera_ready = false
  }

  onMount(() => {
    void start_camera()
  })

  onDestroy(() => {
    stop_camera()
    for (const local_slot of g_capture_slot_arr) {
      if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
    }
    for (const local_set of g_saved_set_arr) {
      for (const local_slot of local_set.slot_arr) {
        if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
      }
    }
  })

  // 현재 비디오 프레임을 좌우반전 보정해 jpeg Blob 으로 만들고 objectURL 까지 같이 반환.
  /** @returns {Promise<CaptureSlot | null>} */
  async function capture_current_frame() {
    if (!g_is_camera_ready || !ref_this_video_el) return null
    const local_video = ref_this_video_el
    const local_w = local_video.videoWidth
    const local_h = local_video.videoHeight
    if (!local_w || !local_h) return null

    const local_canvas = document.createElement('canvas')
    local_canvas.width = local_w
    local_canvas.height = local_h
    const local_ctx = local_canvas.getContext('2d')
    if (!local_ctx) return null
    // 사용자가 보는 좌우반전 프리뷰와 동일한 시각으로 저장.
    local_ctx.translate(local_w, 0)
    local_ctx.scale(-1, 1)
    local_ctx.drawImage(local_video, 0, 0, local_w, local_h)

    const local_blob = await /** @type {Promise<Blob | null>} */ (
      new Promise((resolve) => {
        local_canvas.toBlob(resolve, 'image/jpeg', 0.92)
      })
    )
    if (!local_blob) return null
    return {
      blob: local_blob,
      object_url: URL.createObjectURL(local_blob),
      captured_at: Date.now(),
    }
  }

  // 슬롯 클릭 — 해당 슬롯에 즉시 캡처. 이미 채워진 슬롯은 새 사진으로 덮어쓴다.
  /** @param {number} idx */
  async function on_click_capture_slot(idx) {
    if (g_is_submitting || !g_is_camera_ready) return
    const local_capture = await capture_current_frame()
    if (!local_capture) return
    const local_prev = g_capture_slot_arr[idx]
    if (local_prev?.object_url) URL.revokeObjectURL(local_prev.object_url)
    const local_next_arr = [...g_capture_slot_arr]
    local_next_arr[idx] = local_capture
    g_capture_slot_arr = local_next_arr
  }

  // 슬롯 비우기.
  /** @param {number} idx */
  function on_click_reset_slot(idx) {
    if (g_is_submitting) return
    const local_prev = g_capture_slot_arr[idx]
    if (local_prev?.object_url) URL.revokeObjectURL(local_prev.object_url)
    const local_next_arr = [...g_capture_slot_arr]
    local_next_arr[idx] = null
    g_capture_slot_arr = local_next_arr
  }

  // 현재 3슬롯을 한 세트로 저장 (최신이 위로 prepend). 슬롯 초기화.
  function on_click_save_set() {
    if (!g_can_save || g_is_submitting) return
    g_set_id_seq += 1
    g_saved_set_arr = [
      {
        id: g_set_id_seq,
        slot_arr: [...g_capture_slot_arr],
        captured_at: Date.now(),
      },
      ...g_saved_set_arr,
    ]
    g_capture_slot_arr = [null, null, null]
  }

  // 저장된 세트 개별 제거.
  /** @param {number} id */
  function on_click_remove_saved(id) {
    if (g_is_submitting) return
    const local_target = g_saved_set_arr.find((local_set) => local_set.id === id)
    if (local_target) {
      for (const local_slot of local_target.slot_arr) {
        if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
      }
    }
    g_saved_set_arr = g_saved_set_arr.filter((local_set) => local_set.id !== id)
  }

  // 현재 탭 세션의 visit_no 를 읽어 PATCH 대상을 결정. lens_consult.svelte 와 동일 규칙.
  function get_visit_no() {
    if (typeof sessionStorage === 'undefined') return null
    const local_raw = sessionStorage.getItem('retinal_visit_no')
    if (local_raw) {
      const local_num = Number(local_raw)
      if (Number.isFinite(local_num)) return local_num
    }
    const local_selected_json = sessionStorage.getItem('retinal_selected_visit_obj')
    if (!local_selected_json) return null
    try {
      const local_selected = JSON.parse(local_selected_json)
      const local_num = Number(local_selected?.visit_no)
      return Number.isFinite(local_num) ? local_num : null
    } catch {
      return null
    }
  }

  function on_click_back() {
    if (g_is_submitting) return
    navigate(PATH.analysisArFitting)
  }

  // 최종 리포트 보기 — 세트별로 presigned 발급 → 채워진 슬롯만 S3 PUT → 모두 끝나면 visit PATCH(real_vp_json).
  // 오버레이는 다른 분석 화면(report/arfitting)과 동일한 LoadingOverlay 패턴 — 클릭 즉시 노출되도록
  // g_is_submitting 을 함수 진입 시점에 true 로 끌어올린다.
  async function on_click_continue() {
    if (g_is_submitting) return
    g_is_submitting = true
    g_submit_error = null

    try {
      // 사진이 없으면 업로드 없이 바로 result 로.
      if (g_saved_set_arr.length === 0) {
        navigate(PATH.analysisResult)
        return
      }

      const local_visit_no = get_visit_no()
      if (!local_visit_no) {
        g_submit_error = '방문 번호를 찾을 수 없습니다. 다시 진입해 주세요.'
        return
      }

      /** @type {Array<{ set_no: number, front_key: string, left_key: string, right_key: string, captured_at: number }>} */
      const local_set_record_arr = []

      // 화면상 최신이 위 = 배열 앞쪽. 저장 순서는 촬영 순서(오래된 → 최신) 로 뒤집어서 반복.
      const local_chronological_arr = [...g_saved_set_arr].reverse()

      for (let i = 0; i < local_chronological_arr.length; i += 1) {
        const local_set = local_chronological_arr[i]
        const local_presigned = await request_real_wearing_presigned_urls(local_visit_no)
        const local_url_arr = [
          local_presigned.front_url,
          local_presigned.left_url,
          local_presigned.right_url,
        ]
        const local_key_arr = [
          local_presigned.front_key,
          local_presigned.left_key,
          local_presigned.right_key,
        ]

        // 채워진 슬롯만 업로드. 빈 슬롯은 빈 key 로 BE 에 전달.
        await Promise.all(
          local_set.slot_arr.map((local_slot, local_idx) =>
            local_slot ? upload_blob_to_s3(local_url_arr[local_idx], local_slot.blob) : null,
          ),
        )

        // BE 가 GET 응답 시점에 _key 를 presigned download URL 로 변환하므로 FE 는 key 만 저장.
        local_set_record_arr.push({
          set_no: i + 1,
          front_key: local_set.slot_arr[0] ? local_key_arr[0] : '',
          left_key: local_set.slot_arr[1] ? local_key_arr[1] : '',
          right_key: local_set.slot_arr[2] ? local_key_arr[2] : '',
          captured_at: local_set.captured_at,
        })
      }

      await update_visit({
        visit_no: local_visit_no,
        body: {
          real_vp_json: { sets: local_set_record_arr },
          real_vp_dt: new Date().toISOString(),
        },
      })

      navigate(PATH.analysisResult)
    } catch (err) {
      g_submit_error = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      console.error('[real_fitting] submit failed', err)
      push_error_toast(g_submit_error)
    } finally {
      g_is_submitting = false
    }
  }
</script>

<AnalysisPageLayout
  current_step={3}
  bg_class="bg-white text-zinc-900"
  onback={on_click_back}
>
  <div
    class="flex min-h-0 flex-1 overflow-clip [overflow-clip-margin:9999px] bg-[var(--retina-text-100)]"
  >
    <!-- 좌측: 카메라 -->
    <section class="relative flex min-h-0 flex-1 flex-col">
      <div
        class="app-bg-edge-extend-left relative min-h-0 flex-1 overflow-hidden bg-zinc-950 shadow-inner"
      >
        {#if g_camera_error}
          <div class="flex h-full items-center justify-center px-6 text-center">
            <p class="text-[14px] font-semibold text-white/80">{g_camera_error}</p>
          </div>
        {:else}
          <video
            bind:this={ref_this_video_el}
            class="h-full w-full -scale-x-100 object-cover"
            playsinline
            muted
            autoplay
          ></video>
          <div class="pointer-events-none absolute inset-x-0 bottom-6 px-6 text-center">
            <p class="text-[18px] font-extrabold leading-relaxed text-white/90">
              우측 정면 → 좌측 → 우측 슬롯을 눌러 촬영해 주세요
            </p>
          </div>
        {/if}
      </div>
    </section>

    <!-- 우측: 캡쳐 슬롯 + 안내 + 저장 액션 -->
    <aside
      class="app-bg-edge-extend-right relative flex w-[300px] flex-col border-l border-slate-200 bg-white"
    >
      <!-- 캡쳐 슬롯 -->
      <div class="px-4 pt-3 pb-2">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[11px] font-extrabold tracking-wide text-[#374151]">촬영 기록</h2>
        </div>
        <div class="grid grid-cols-3 gap-2 pr-1">
          {#each g_capture_slot_arr as slot, idx (idx)}
            <div class="group relative flex flex-col items-center gap-1">
              <button
                type="button"
                onclick={() => on_click_capture_slot(idx)}
                disabled={!g_is_camera_ready || g_is_submitting}
                aria-label={`${SLOT_LABEL_ARR[idx]} 촬영`}
                class={`relative flex h-[120px] w-full cursor-pointer items-center justify-center rounded-none border bg-transparent p-0 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  slot
                    ? 'border-[var(--retina-primary-300)] bg-[var(--retina-bg-1)]'
                    : 'border-[#F1F3F5] bg-[#F1F3F5] hover:bg-[#E9ECEF]'
                }`}
              >
                {#if slot}
                  <img
                    src={slot.object_url}
                    alt={SLOT_LABEL_ARR[idx]}
                    class="h-full w-full object-contain"
                  />
                {:else}
                  <img
                    src={SLOT_ICON_ARR[idx]}
                    alt={`${SLOT_LABEL_ARR[idx]} 안내`}
                    class="h-[18px] w-[18px] object-contain opacity-70"
                  />
                {/if}
              </button>
              {#if slot}
                <button
                  type="button"
                  onclick={() => on_click_reset_slot(idx)}
                  aria-label="다시 촬영"
                  class="absolute -right-1.5 top-[-6px] flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-white text-slate-400 shadow-md hover:text-red-500"
                >
                  <X size={11} />
                </button>
              {/if}
              <span
                class={`text-[10px] font-bold ${slot ? 'text-[var(--retina-primary-300)]' : 'text-slate-400'}`}
              >
                {SLOT_LABEL_ARR[idx]}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <hr class="mx-4 my-1 border-slate-200" />

      <!-- 안내 영역 (arfitting 의 추천 안경 자리) -->
      <div class="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        <h2 class="mb-2 text-[13px] font-extrabold text-zinc-900">실제 착용 촬영</h2>
        <div
          class="rounded-lg bg-[var(--retina-text-100)] px-3 py-3 text-[12px] font-medium leading-relaxed text-slate-600"
        >
          고객이 실제로 착용한 안경 모습을 정면/좌측/우측 슬롯에 촬영해 주세요.<br />
          1장 이상 촬영하면 [세트 저장] 버튼이 활성화됩니다.<br />
          여러 안경을 비교하려면 세트를 추가로 저장하세요.
        </div>
        <div
          class="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500"
        >
          <Glasses size={14} class="shrink-0 text-slate-400" />
          최대 {MAX_PHOTO_SET_COUNT} 세트까지 저장 가능
        </div>
      </div>

      <!-- 저장된 세트 + 액션 버튼 -->
      <div class="border-t border-slate-100 bg-white px-4 py-3">
        {#if g_saved_set_arr.length > 0}
          <div class="mb-2">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[10px] font-extrabold tracking-wide text-slate-500">
                저장된 세트 ({g_saved_set_arr.length}/{MAX_PHOTO_SET_COUNT})
              </span>
              {#if g_saved_set_arr.length >= MAX_PHOTO_SET_COUNT}
                <span class="text-[10px] font-bold text-amber-500">최대</span>
              {/if}
            </div>
            <div class="custom-scrollbar flex gap-1 overflow-x-auto pb-0.5">
              {#each g_saved_set_arr as set, idx (set.id)}
                <div
                  class="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--retina-bg-1)] px-2 py-1"
                  in:fly={{ y: 6, duration: 200 }}
                >
                  <CheckCheck size={9} class="shrink-0 text-[var(--retina-primary-300)]" />
                  <span
                    class="max-w-[60px] truncate text-[10px] font-bold text-[var(--retina-primary-300)]"
                  >
                    세트 {g_saved_set_arr.length - idx}
                  </span>
                  <button
                    type="button"
                    onclick={() => on_click_remove_saved(set.id)}
                    aria-label="세트 제거"
                    class="ml-0.5 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-red-400"
                  >
                    <X size={9} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if g_submit_error}
          <p
            class="mb-1.5 rounded-md bg-rose-50 px-2 py-1 text-center text-[10px] font-bold text-rose-600"
          >
            {g_submit_error}
          </p>
        {:else}
          <p class="mb-1.5 text-center text-[10px] font-semibold text-slate-500">
            1장 이상 촬영하면 세트를 저장할 수 있어요.
          </p>
        {/if}

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!g_can_save || g_is_submitting}
            onclick={on_click_save_set}
            aria-label="세트 저장"
            class="flex aspect-[31/13] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-2 border-[var(--retina-primary-300)] bg-white px-2 text-[12px] font-extrabold text-[var(--retina-primary-300)] transition-all hover:bg-[var(--retina-bg-1)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          >
            <CameraIcon size={12} strokeWidth={2.5} aria-hidden="true" />
            세트 저장
          </button>

          <button
            type="button"
            disabled={(!g_can_submit && g_saved_set_arr.length === 0) || g_is_submitting}
            onclick={on_click_continue}
            aria-label="최종 리포트 보기"
            class="flex aspect-[31/13] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-0 bg-[var(--retina-primary-300)] px-2 text-[12px] font-extrabold leading-tight text-white shadow-sm transition-all hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          >
            {#if g_is_submitting}
              <Loader2 size={12} strokeWidth={2.4} class="animate-spin" aria-hidden="true" />
              업로드 중
            {:else}
              최종 리포트 보기
            {/if}
          </button>
        </div>
      </div>
    </aside>
  </div>

  <LoadingOverlay open={g_is_submitting} label="분석 결과 저장 중..." />
</AnalysisPageLayout>

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
