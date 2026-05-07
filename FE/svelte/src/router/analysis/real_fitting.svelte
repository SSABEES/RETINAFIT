<script>
  import { onDestroy, onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Plus, Trash2, Camera as CameraIcon, X, Check, Loader2 } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import {
    request_real_wearing_presigned_urls,
    upload_blob_to_s3,
  } from '@/lib/api/analysis.js'
  import { update_visit } from '@/lib/api/visit.js'

  // 실제 안경 피팅 단계 (Step 4) — 좌측 라이브 카메라 프리뷰. 우측 패널 상단의 가로 + 버튼을
  // 누르면 정면 → 좌측 → 우측 3장 촬영 모드로 진입하고, 3장 모두 찍히면 한 세트로 누적.
  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {MediaStream | null} */
  let g_stream = null
  let g_is_camera_ready = $state(false)
  let g_camera_error = $state(/** @type {string | null} */ (null))

  /**
   * @typedef {'front' | 'left' | 'right'} CaptureStepKey
   * @typedef {{ id: number, front_url: string, front_blob: Blob, left_url: string, left_blob: Blob, right_url: string, right_blob: Blob, captured_at: number }} FittingPhotoSet
   * @typedef {{ blob: Blob, url: string }} CaptureFrame
   */
  /** @type {FittingPhotoSet[]} */
  let g_photo_set_arr = $state([])
  let g_set_id_seq = 0

  // 촬영 모드 — + 버튼 클릭 시 활성화. 단계별 임시 frame 누적 → 3단계 완료 시 세트 push.
  let g_is_capture_mode = $state(false)
  /** @type {CaptureStepKey} */
  let g_capture_step = $state('front')
  /** @type {CaptureFrame | null} */
  let g_pending_front = $state(null)
  /** @type {CaptureFrame | null} */
  let g_pending_left = $state(null)

  // 최종 리포트 보기 클릭 시 업로드/PATCH 진행 상태.
  let g_is_submitting = $state(false)
  let g_submit_error = $state(/** @type {string | null} */ (null))

  /** @type {Record<CaptureStepKey, { label: string, guide: string, order: number }>} */
  const STEP_INFO_OBJ = {
    front: { label: '정면', guide: '정면을 바라봐 주세요', order: 1 },
    left: { label: '좌측', guide: '왼쪽으로 고개를 돌려 주세요', order: 2 },
    right: { label: '우측', guide: '오른쪽으로 고개를 돌려 주세요', order: 3 },
  }
  const STEP_KEY_ARR = /** @type {CaptureStepKey[]} */ (['front', 'left', 'right'])

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
      for (const track of g_stream.getTracks()) track.stop()
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
    if (g_pending_front) URL.revokeObjectURL(g_pending_front.url)
    if (g_pending_left) URL.revokeObjectURL(g_pending_left.url)
    for (const set of g_photo_set_arr) {
      URL.revokeObjectURL(set.front_url)
      URL.revokeObjectURL(set.left_url)
      URL.revokeObjectURL(set.right_url)
    }
  })

  // 현재 비디오 프레임을 좌우반전 보정해 jpeg Blob 으로 만들고 objectURL 까지 같이 반환.
  /** @returns {Promise<CaptureFrame | null>} */
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
    return { blob: local_blob, url: URL.createObjectURL(local_blob) }
  }

  // + 사진 추가 — 촬영 모드 진입 (front 단계부터).
  function on_click_start_capture() {
    if (!g_is_camera_ready || g_is_capture_mode || g_is_submitting) return
    g_is_capture_mode = true
    g_capture_step = 'front'
    g_pending_front = null
    g_pending_left = null
  }

  // 촬영 취소 — 임시 캡처 정리 후 모드 종료.
  function on_click_cancel_capture() {
    if (g_pending_front) URL.revokeObjectURL(g_pending_front.url)
    if (g_pending_left) URL.revokeObjectURL(g_pending_left.url)
    g_pending_front = null
    g_pending_left = null
    g_is_capture_mode = false
  }

  // 단계별 촬영 — 정면 / 좌 / 우 순서로 누적, 3장 완료 시 세트 push 후 모드 종료.
  async function on_click_capture() {
    const local_frame = await capture_current_frame()
    if (!local_frame) return

    if (g_capture_step === 'front') {
      g_pending_front = local_frame
      g_capture_step = 'left'
    } else if (g_capture_step === 'left') {
      g_pending_left = local_frame
      g_capture_step = 'right'
    } else {
      // right — 세트 완성.
      const local_front = g_pending_front
      const local_left = g_pending_left
      if (!local_front || !local_left) {
        URL.revokeObjectURL(local_frame.url)
        return
      }
      g_set_id_seq += 1
      // 새 세트는 배열 앞쪽에 prepend → 패널 최상단에 자연 누적.
      g_photo_set_arr = [
        {
          id: g_set_id_seq,
          front_url: local_front.url,
          front_blob: local_front.blob,
          left_url: local_left.url,
          left_blob: local_left.blob,
          right_url: local_frame.url,
          right_blob: local_frame.blob,
          captured_at: Date.now(),
        },
        ...g_photo_set_arr,
      ]
      g_pending_front = null
      g_pending_left = null
      g_is_capture_mode = false
      g_capture_step = 'front'
    }
  }

  // 세트 삭제 — 3장 모두 objectURL 해제.
  /** @param {number} id */
  function on_click_remove_set(id) {
    if (g_is_submitting) return
    const local_target = g_photo_set_arr.find((s) => s.id === id)
    if (local_target) {
      URL.revokeObjectURL(local_target.front_url)
      URL.revokeObjectURL(local_target.left_url)
      URL.revokeObjectURL(local_target.right_url)
    }
    g_photo_set_arr = g_photo_set_arr.filter((s) => s.id !== id)
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

  // 최종 리포트 보기 — 세트별로 presigned 발급 → S3 PUT 3장 → 모두 끝나면 visit PATCH(real_vp_json).
  async function on_click_continue() {
    if (g_is_submitting) return
    g_submit_error = null

    // 사진이 없으면 업로드 없이 바로 result 로.
    if (g_photo_set_arr.length === 0) {
      navigate(PATH.analysisResult)
      return
    }

    const local_visit_no = get_visit_no()
    if (!local_visit_no) {
      g_submit_error = '방문 번호를 찾을 수 없습니다. 다시 진입해 주세요.'
      return
    }

    g_is_submitting = true
    try {
      /** @type {Array<{ set_no: number, front_key: string, left_key: string, right_key: string, front_url: string, left_url: string, right_url: string, captured_at: number }>} */
      const local_set_record_arr = []

      // 화면상 최신이 위 = 배열 앞쪽. 저장 순서는 촬영 순서(오래된 → 최신) 로 뒤집어서 반복.
      const local_chronological_arr = [...g_photo_set_arr].reverse()

      for (let i = 0; i < local_chronological_arr.length; i += 1) {
        const local_set = local_chronological_arr[i]
        const local_presigned = await request_real_wearing_presigned_urls(local_visit_no)
        await Promise.all([
          upload_blob_to_s3(local_presigned.front_url, local_set.front_blob),
          upload_blob_to_s3(local_presigned.left_url, local_set.left_blob),
          upload_blob_to_s3(local_presigned.right_url, local_set.right_blob),
        ])
        // result.svelte 가 그대로 <img src> 로 쓸 수 있도록 query string 떼어낸 public URL 도 저장.
        local_set_record_arr.push({
          set_no: i + 1,
          front_key: local_presigned.front_key,
          left_key: local_presigned.left_key,
          right_key: local_presigned.right_key,
          front_url: String(local_presigned.front_url).split('?')[0],
          left_url: String(local_presigned.left_url).split('?')[0],
          right_url: String(local_presigned.right_url).split('?')[0],
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
    } finally {
      g_is_submitting = false
    }
  }
</script>

<AnalysisPageLayout
  current_step={4}
  bg_class="bg-[var(--retina-text-100)] text-zinc-950"
  edge_extend_bg
  onback={on_click_back}
>
  <section class="flex min-h-0 flex-1 flex-col overflow-clip [overflow-clip-margin:9999px]">
    <!-- 본문: 좌(카메라) / 우(사진 패널) 2 컬럼 -->
    <div class="grid min-h-0 flex-1 grid-cols-[3fr_2fr] gap-4 px-4 pt-3 pb-4">
      <!-- 좌측 카메라 -->
      <div class="relative flex min-h-0 flex-col overflow-hidden rounded-[14px] bg-black">
        {#if g_camera_error}
          <div class="flex flex-1 items-center justify-center px-6 text-center">
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
        {/if}

        <!-- 촬영 모드 가이드 오버레이 (상단 chip + 하단 컨트롤 바) -->
        {#if g_is_capture_mode}
          {@const local_info = STEP_INFO_OBJ[g_capture_step]}
          <div class="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
            <div
              class="rounded-full bg-black/70 px-4 py-1.5 text-center text-[14px] font-extrabold text-white"
            >
              {local_info.order} / 3 · {local_info.guide}
            </div>
          </div>

          <div class="absolute right-3 bottom-3 left-3 flex flex-col gap-2">
            <!-- 단계별 dot 진행도 -->
            <div class="flex items-center gap-1.5">
              {#each STEP_KEY_ARR as step_key (step_key)}
                {@const local_is_done =
                  STEP_INFO_OBJ[step_key].order < STEP_INFO_OBJ[g_capture_step].order}
                {@const local_is_current = step_key === g_capture_step}
                <div
                  class={`h-1.5 flex-1 rounded-full transition-colors ${
                    local_is_done
                      ? 'bg-[var(--retina-primary-300)]'
                      : local_is_current
                        ? 'bg-white'
                        : 'bg-white/30'
                  }`}
                ></div>
              {/each}
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={on_click_cancel_capture}
                class="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-slate-700 transition hover:bg-white"
                aria-label="촬영 취소"
              >
                <X size={20} strokeWidth={2.4} aria-hidden="true" />
              </button>
              <button
                type="button"
                onclick={on_click_capture}
                class="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-[var(--retina-primary-500)] text-[15px] font-extrabold text-white transition hover:bg-[var(--retina-primary-600)]"
              >
                {#if g_capture_step === 'right'}
                  <Check size={20} strokeWidth={2.6} aria-hidden="true" />
                  마지막 촬영 · 완료
                {:else}
                  <CameraIcon size={20} strokeWidth={2.4} aria-hidden="true" />
                  {local_info.label} 촬영
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- 우측 사진 패널 -->
      <div
        class="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
      >

        <!-- 상단 고정 + 추가 버튼 — 촬영 모드 진입 여부와 무관하게 항상 동일 사이즈 유지. -->
        <div class="shrink-0 px-4 pt-3">
          <button
            type="button"
            onclick={on_click_start_capture}
            disabled={!g_is_camera_ready || g_is_capture_mode}
            class="flex h-[68px] w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--retina-primary-300)] bg-[var(--retina-primary-100)]/40 text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-500)] hover:bg-[var(--retina-primary-100)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="사진 추가 시작"
          >
            <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
            <span class="text-[14px] font-extrabold">
              {#if g_is_capture_mode}
                {@const local_info = STEP_INFO_OBJ[g_capture_step]}
                촬영 중 · {local_info.order} / 3 · {local_info.label}
              {:else}
                사진 추가 (정면 · 좌 · 우)
              {/if}
            </span>
          </button>
        </div>

        <!-- 누적된 세트 리스트 (최신이 위) -->
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-3">
          {#if g_photo_set_arr.length === 0 && !g_is_capture_mode}
            <div class="mt-2 flex flex-col items-center justify-center gap-1.5 text-slate-400">
              <CameraIcon size={16} aria-hidden="true" />
              <p class="m-0 text-[11px] font-semibold">아직 저장된 사진이 없습니다.</p>
            </div>
          {/if}

          {#each g_photo_set_arr as photo_set, set_index (photo_set.id)}
            <article
              class="group relative rounded-[12px] border border-slate-200 bg-slate-50 p-2.5"
            >
              <header class="mb-2 flex items-center justify-between px-0.5">
                <span class="text-[12px] font-extrabold text-slate-700">
                  세트 {g_photo_set_arr.length - set_index}
                </span>
                <button
                  type="button"
                  onclick={() => on_click_remove_set(photo_set.id)}
                  class="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-white text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="세트 삭제"
                >
                  <Trash2 size={13} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </header>
              <div class="grid grid-cols-3 gap-1.5">
                {#each [{ key: 'front', url: photo_set.front_url, label: '정면' }, { key: 'left', url: photo_set.left_url, label: '좌' }, { key: 'right', url: photo_set.right_url, label: '우' }] as photo_obj (photo_obj.key)}
                  <div class="relative aspect-[3/4] overflow-hidden rounded-[8px] bg-slate-200">
                    <img
                      src={photo_obj.url}
                      alt={photo_obj.label}
                      class="h-full w-full object-cover"
                    />
                    <span
                      class="absolute bottom-1 left-1 rounded-sm bg-black/55 px-1 py-0.5 text-[10px] font-extrabold text-white"
                    >
                      {photo_obj.label}
                    </span>
                  </div>
                {/each}
              </div>
            </article>
          {/each}
        </div>
      </div>
    </div>

    <!-- 하단 액션 바 -->
    <div class="app-bg-edge-extend shrink-0 bg-white">
      <div class="h-px w-full bg-slate-200"></div>
      {#if g_submit_error}
        <div
          class="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-[13px] font-extrabold text-rose-600"
        >
          {g_submit_error}
        </div>
      {/if}
      <div class="px-4 py-3">
        <div class="mx-auto grid w-full max-w-[820px] grid-cols-[2fr_3fr] gap-4">
          <button
            type="button"
            disabled={g_is_submitting}
            class="h-[64px] cursor-pointer rounded-lg border border-slate-300 bg-white text-[22px] text-[var(--retina-text-500)] transition hover:border-slate-400 hover:text-[var(--retina-text-700)] disabled:cursor-not-allowed disabled:opacity-50"
            onclick={on_click_back}
          >
            이전 단계
          </button>
          <button
            type="button"
            disabled={g_is_submitting}
            class="flex h-[64px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--retina-primary-300)] text-[26px] tracking-tight text-[var(--retina-surface)] transition hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
            onclick={on_click_continue}
          >
            {#if g_is_submitting}
              <Loader2 size={26} strokeWidth={2.4} class="animate-spin" aria-hidden="true" />
              업로드 중...
            {:else}
              최종 리포트 보기
            {/if}
          </button>
        </div>
      </div>
    </div>
  </section>
</AnalysisPageLayout>
