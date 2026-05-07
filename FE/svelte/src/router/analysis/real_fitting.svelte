<script>
  import { onDestroy, onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { Plus, Trash2, Camera as CameraIcon } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'

  // 실제 안경 피팅 단계 (Step 4) — 좌측 라이브 카메라 프리뷰에서 우측 패널의 + 버튼을
  // 누를 때마다 현재 프레임을 캡처해 사진 슬롯으로 누적한다. 데이터 영속화는 추후.
  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {MediaStream | null} */
  let g_stream = null
  let g_is_camera_ready = $state(false)
  let g_camera_error = $state(/** @type {string | null} */ (null))

  /**
   * @typedef {{ id: number, url: string, captured_at: number }} FittingPhoto
   */
  /** @type {FittingPhoto[]} */
  let g_photo_arr = $state([])
  let g_photo_id_seq = 0

  // 카메라 시작 — 외부 환경(권한 거부, 장치 없음 등) 실패 시 안내 메시지 노출.
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
    for (const photo of g_photo_arr) URL.revokeObjectURL(photo.url)
  })

  // + 버튼 — 현재 비디오 프레임을 캔버스에 그려 Blob 으로 만든 뒤 우측 슬롯에 추가.
  async function on_click_add_photo() {
    if (!g_is_camera_ready || !ref_this_video_el) return
    const local_video = ref_this_video_el
    const local_w = local_video.videoWidth
    const local_h = local_video.videoHeight
    if (!local_w || !local_h) return

    const local_canvas = document.createElement('canvas')
    local_canvas.width = local_w
    local_canvas.height = local_h
    const local_ctx = local_canvas.getContext('2d')
    if (!local_ctx) return
    // 사용자가 보는 좌우반전 프리뷰와 동일한 시각으로 저장하기 위해 캔버스도 반전.
    local_ctx.translate(local_w, 0)
    local_ctx.scale(-1, 1)
    local_ctx.drawImage(local_video, 0, 0, local_w, local_h)

    const local_blob = await new Promise(
      /** @type {(b: Blob | null) => void} */ (resolve) =>
        local_canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!local_blob) return

    g_photo_id_seq += 1
    g_photo_arr = [
      ...g_photo_arr,
      {
        id: g_photo_id_seq,
        url: URL.createObjectURL(local_blob),
        captured_at: Date.now(),
      },
    ]
  }

  // 슬롯 우상단 휴지통 — 해당 사진 제거 + objectURL 해제.
  /** @param {number} id */
  function on_click_remove_photo(id) {
    const local_target = g_photo_arr.find((p) => p.id === id)
    if (local_target) URL.revokeObjectURL(local_target.url)
    g_photo_arr = g_photo_arr.filter((p) => p.id !== id)
  }

  function on_click_back() {
    navigate(PATH.analysisArFitting)
  }

  function on_click_continue() {
    navigate(PATH.analysisResult)
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

        <!-- 좌하단 라이브 인디케이터 -->
        {#if g_is_camera_ready}
          <div
            class="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            <span class="block h-2 w-2 rounded-full bg-red-500"></span>
            LIVE
          </div>
        {/if}
      </div>

      <!-- 우측 사진 패널 -->
      <div
        class="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.07)]"
      >
        <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 class="m-0 text-[15px] font-extrabold text-slate-900">착용 사진</h2>
            <p class="mt-0.5 text-[11px] font-semibold text-slate-500">
              + 버튼을 눌러 현재 카메라 화면을 저장합니다.
            </p>
          </div>
          <span
            class="rounded-full bg-[var(--retina-primary-100)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--retina-primary-600)]"
          >
            {g_photo_arr.length}
          </span>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div class="grid grid-cols-2 gap-3">
            <!-- + 추가 버튼 (항상 첫 슬롯) -->
            <button
              type="button"
              onclick={on_click_add_photo}
              disabled={!g_is_camera_ready}
              class="group flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-[var(--retina-primary-300)] bg-[var(--retina-primary-100)]/40 text-[var(--retina-primary-600)] transition hover:border-[var(--retina-primary-500)] hover:bg-[var(--retina-primary-100)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="사진 추가"
            >
              <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
              <span class="text-[12px] font-extrabold">사진 추가</span>
            </button>

            {#each g_photo_arr as photo (photo.id)}
              <div
                class="group relative aspect-[3/4] overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100"
              >
                <img src={photo.url} alt="피팅 사진" class="h-full w-full object-cover" />
                <button
                  type="button"
                  onclick={() => on_click_remove_photo(photo.id)}
                  class="absolute top-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                  aria-label="사진 삭제"
                >
                  <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            {/each}
          </div>

          {#if g_photo_arr.length === 0}
            <div class="mt-4 flex items-center justify-center gap-1.5 text-slate-400">
              <CameraIcon size={14} aria-hidden="true" />
              <p class="m-0 text-[11px] font-semibold">아직 저장된 사진이 없습니다.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- 하단 액션 바 -->
    <div class="app-bg-edge-extend shrink-0 bg-white">
      <div class="h-px w-full bg-slate-200"></div>
      <div class="px-4 py-3">
        <div class="mx-auto grid w-full max-w-[820px] grid-cols-[2fr_3fr] gap-4">
          <button
            type="button"
            class="h-[64px] cursor-pointer rounded-lg border border-slate-300 bg-white text-[22px] text-[var(--retina-text-500)] transition hover:border-slate-400 hover:text-[var(--retina-text-700)]"
            onclick={on_click_back}
          >
            이전 단계
          </button>
          <button
            type="button"
            class="h-[64px] cursor-pointer rounded-lg border-0 bg-[var(--retina-primary-300)] text-[26px] tracking-tight text-[var(--retina-surface)] transition hover:bg-[var(--retina-primary-400)]"
            onclick={on_click_continue}
          >
            최종 리포트 보기
          </button>
        </div>
      </div>
    </div>
  </section>
</AnalysisPageLayout>
