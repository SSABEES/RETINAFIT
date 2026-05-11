<script>
  import { onDestroy, onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { navigate } from '@maks11060/svelte5-router'
  import CameraView from '@/components/camera/camera_view.svelte'
  import StepIndicator from '@/components/capture/step_indicator.svelte'
  import StepStatusBar from '@/components/capture/step_status_bar.svelte'
  import CaptureThumbnails from '@/components/capture/capture_thumbnails.svelte'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import {
    get_session,
    set_glasses_mode,
    add_capture,
    get_current_step,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'
  import { selected_customer_obj } from '@/lib/stores/customer'
  import { flip_blob_horizontally } from '@/lib/capture/capture_utils.js'
  import { PATH } from '@/config/path.js'
  // 음성 가이드 — 세션 단위 1회성 키(start_capture, capture_complete) 와 단계 완료 안내를 담당.
  import {
    play as play_voice,
    reset_session as reset_voice_session,
    wait_for_active as wait_for_voice,
  } from '@/lib/audio/voice_guide.js'

  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
   * @typedef {import('@/lib/mediapipe/face_types.js').FaceMeasurements} FaceMeasurements
   * @typedef {import('@/lib/mediapipe/face_types.js').Point2D} Point2D
   * @typedef {object} CaptureResult
   * @property {Blob} blob
   * @property {string} object_url
   * @property {number} captured_at
   * @property {number} width
   * @property {number} height
   * @property {FaceMeasurements | null} measurements_obj
   * @property {Record<string, [Point2D, Point2D]> | null} measurement_points_obj
   * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[] | null} landmarks
   */

  // 수동 촬영 버튼 잠금 해제 지연: trigger_capture 가 no-op 으로 즉시 반환한 경우를 대비한 fallback.
  const CAPTURE_BUTTON_RESET_DELAY_MS = 100
  // 얼굴 미검출 토스트 노출 시간.
  const TOAST_VISIBLE_MS = 2000

  const g_session = $derived(get_session())
  const g_current_step = $derived(get_current_step())

  /** @type {{ trigger_capture: () => Promise<boolean>, reset: () => void } | null} */
  let ref_this_camera = $state(null)
  let g_is_capturing = $state(false)
  let g_toast_message = $state(/** @type {string | null} */ (null))
  let g_is_landmark_visible = $state(true)

  // 비회원(cust_no=0)으로 진입한 경우 방문 유형 선택 화면으로, 회원이면 해당 고객 상세 페이지로 돌아간다.
  function on_click_go_back() {
    const local_customer_obj = get(selected_customer_obj)
    const local_is_guest_visit = Number(local_customer_obj?.id) === 0

    navigate(local_is_guest_visit ? PATH.visitSelect : PATH.userDetail(local_customer_obj.id))
  }

  // 세션에서 current_step 이 바뀌면 camera_view 를 재장전해 다음 스텝을 받아들이게 한다.
  $effect(() => {
    const _step_id = g_current_step?.step_id
    if (_step_id && ref_this_camera) {
      ref_this_camera.reset()
    }
  })

  // 안경 착용 분석은 더 이상 사용하지 않으므로 진입 시 자동으로 미착용 모드로 시작한다.
  $effect(() => {
    if (g_session.phase === 'select_glasses') {
      set_glasses_mode('no_glasses')
    }
  })

  // 새 촬영 세션 시작 시 음성 1회성 키(start_capture / capture_complete) 플래그 초기화.
  // 이전 분석 후 결과 페이지에서 "처음부터" 로 돌아왔을 때도 음성이 다시 재생되도록.
  onMount(() => {
    reset_voice_session()
  })

  // capturing phase 첫 진입 시 "촬영을 시작하겠습니다" 안내 1회.
  // 1회성 키라 step 전환에 따라 effect 가 재실행돼도 voice_guide 가 무시.
  $effect(() => {
    if (g_session.phase === 'capturing') {
      void play_voice('start_capture', { priority: 'high' })
    }
  })

  /**
   * camera_view 가 촬영을 마치면 세션에 저장하고 다음 스텝으로 진행.
   * 썸네일/리뷰 화면용 object_url 만 카메라 프리뷰처럼 좌우 반전하고,
   * 분석에 쓰이는 raw blob 과 landmarks 좌표계는 변경하지 않는다.
   * @param {CaptureResult} result
   */
  async function on_capture(result) {
    g_is_capturing = false
    if (!g_current_step) return

    let local_display_object_url = result.object_url
    try {
      const local_mirrored_blob = await flip_blob_horizontally(result.blob)
      URL.revokeObjectURL(result.object_url)
      local_display_object_url = URL.createObjectURL(local_mirrored_blob)
    } catch {
      // 반전 실패 시 원본 URL 그대로 사용 (UX 막지 않음)
    }

    /** @type {Capture} */
    const capture = {
      step_id: g_current_step.step_id,
      blob: result.blob,
      object_url: local_display_object_url,
      captured_at: result.captured_at,
      width: result.width,
      height: result.height,
      measurements_obj: result.measurements_obj,
      measurement_points_obj: result.measurement_points_obj,
      landmarks: result.landmarks,
      head_pose: result.head_pose,
    }

    // 단계 완료 안내를 add_capture (step 전환) 직전에 await — step 변경 시 camera_view.reset()
    // 이 stop_voice() 를 호출하므로, 안내가 끝까지 들리도록 여기서 await 후 진행한다.
    // 셔터음(camera_shutter_sound) 이 fire-and-forget 으로 진행 중일 가능성이 있어, 먼저 그 종료를
    // 기다린 뒤 단계 완료 안내를 시작 — 동일 high 우선순위라 진행 중 셔터를 끊지 않기 때문.
    const local_pose_type = g_current_step.pose_type
    const local_complete_key =
      local_pose_type === 'front'
        ? 'front_side_capture_complete'
        : local_pose_type === 'left_profile'
          ? 'left_side_capture_complete'
          : 'right_side_capture_complete'
    await wait_for_voice()
    await play_voice(local_complete_key, { priority: 'high' })

    await add_capture(capture)
  }

  // camera_view 의 trigger_capture_internal 이 toBlob 실패 등으로 에러를 던진 경우 호출됨.
  // 자동 스텝/수동 스텝 모두에 공통으로 사용자 토스트를 노출한다.
  function on_capture_error() {
    g_is_capturing = false
    show_toast('촬영에 실패했어요')
  }

  // 수동 촬영 버튼 클릭 — camera_view 의 trigger_capture 호출 후 결과에 따라 토스트 표시.
  async function on_manual_capture_click() {
    if (g_is_capturing || !ref_this_camera) return
    g_is_capturing = true
    try {
      const ok = await ref_this_camera.trigger_capture()
      if (!ok) show_toast('얼굴이 감지되지 않아요')
    } finally {
      // 성공 시 on_capture 가 이미 false 로 내렸지만, no-op 반환 경로를 위한 fallback.
      setTimeout(() => {
        g_is_capturing = false
      }, CAPTURE_BUTTON_RESET_DELAY_MS)
    }
  }

  /**
   * 지정된 메시지로 토스트를 일정 시간 노출하고 자동 숨긴다.
   * @param {string} message
   */
  function show_toast(message) {
    g_toast_message = message
    setTimeout(() => {
      if (g_toast_message === message) g_toast_message = null
    }, TOAST_VISIBLE_MS)
  }

  // 마지막 캡쳐 완료 → "촬영이 완료되었습니다" 안내 후 얼굴 측정 페이지로 이동.
  // capture_complete 는 1회성 키 — 페이지가 결과 페이지로 넘어가는 동안 모듈 단위 audio 가
  // 끊김 없이 재생됨 (onDestroy 가 review phase 에선 voice 를 stop 하지 않음).
  $effect(() => {
    if (g_session.phase === 'review') {
      void play_voice('capture_complete', { priority: 'high' })
      navigate(PATH.analysisReport)
    }
  })

  // 페이지 이탈 시 ObjectURL 전부 정리.
  // 단, phase === 'review' 이면 결과 페이지로 이동하는 중이므로 세션을 보존해야 한다.
  // (리셋은 결과 페이지의 "처음부터" 버튼이 담당한다.)
  onDestroy(() => {
    if (g_session.phase === 'review') return
    reset_session()
  })
</script>

<AnalysisPageLayout
  current_step={1}
  bg_class="bg-[var(--retina-surface)] text-[var(--retina-text)]"
  onback={on_click_go_back}
>
  <!--
    Default.svg 기반 레이아웃 (1280×800 design 기준):
    - 좌측 카메라 섹션 ≈ 73% (937/1280), 회색 bg #E5E7EB, 카메라 preview 가 상하좌우 중앙 정렬
    - 우측 컨트롤 패널 ≈ 27% (343/1280), 흰색 bg, 가이드 toggle / step / 상태 / 썸네일 수직 스택
    AnalysisPageLayout 이 위에서 헤더 + AnalysisStepBar 를 렌더링하고, 이 영역은 그 밑으로 채운다.
  -->
  <div class="flex min-h-0 flex-1">
    {#if g_session.phase === 'capturing' && g_current_step}
      <div
        class="grid h-full w-full grid-cols-1 grid-rows-[55svh_auto] md:grid-cols-[1fr_220px] md:grid-rows-1 lg:grid-cols-[2.73fr_1fr] items-stretch min-h-0"
      >
        <!--
          좌: 실시간 카메라. 모바일에선 위쪽 row(55svh), md+ 에서 좌측 컬럼.
          real_fitting/arfitting 와 동일 패턴 — CameraView 자체가 영역 fill.
        -->
        <section
          aria-label="실시간 얼굴 분석"
          class="relative flex min-h-0 flex-col overflow-hidden bg-zinc-950 shadow-inner"
        >
          <CameraView
            bind:this={ref_this_camera}
            active={true}
            pose_target={g_current_step.pose_type}
            capture_mode={g_current_step.capture_mode}
            is_landmark_visible={g_is_landmark_visible}
            oncapture={on_capture}
            oncapture_error={on_capture_error}
          />
        </section>

        <!-- 우: 컨트롤 패널. 모바일에선 하단 stack, md+ 에서 우측 컬럼. -->
        <aside
          class="flex min-h-0 flex-col border-t md:border-t-0 md:border-l border-[var(--retina-text-200)] bg-white"
        >
          <section class="shrink-0 border-b border-[var(--retina-text-200)] px-[clamp(8px,2svh,16px)] py-[clamp(6px,1.5svh,14px)]">
            <div class="flex items-center justify-between gap-2">
              <p class="font-extrabold text-[var(--retina-text-800)] text-[clamp(10px,1.6svh,14px)]">가이드 표시</p>
              <button
                type="button"
                class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/40"
                class:bg-[var(--retina-primary-300)]={g_is_landmark_visible}
                class:border-[var(--retina-primary-300)]={g_is_landmark_visible}
                class:bg-[var(--retina-text-300)]={!g_is_landmark_visible}
                class:border-[var(--retina-text-300)]={!g_is_landmark_visible}
                aria-pressed={g_is_landmark_visible}
                aria-label="얼굴 랜드마크 표시 전환"
                onclick={() => {
                  g_is_landmark_visible = !g_is_landmark_visible
                }}
              >
                <span
                  class="absolute left-[1px] top-[1px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                  class:translate-x-4={g_is_landmark_visible}
                ></span>
                <span class="sr-only">
                  {g_is_landmark_visible ? '얼굴 랜드마크 켜짐' : '얼굴 랜드마크 꺼짐'}
                </span>
              </button>
            </div>
          </section>

          <!--
            촬영 단계 표시 (정면만일 때 의미 없으므로 비활성화).
            측면 촬영을 다시 살릴 때 아래 주석을 풀어 복원한다.

            <section class="shrink-0 border-b border-[var(--retina-text-200)] px-4 py-3">
              <StepIndicator
                steps_arr={g_session.steps_arr}
                current_index={g_session.current_step_index}
              />
            </section>
          -->

          <section class="shrink-0 border-b border-[var(--retina-text-200)] px-[clamp(8px,2svh,16px)] py-[clamp(6px,1.5svh,14px)]">
            <StepStatusBar
              step={g_current_step}
              is_capturing={g_is_capturing}
              oncapture_click={on_manual_capture_click}
            />
          </section>

          <section class="flex min-h-0 flex-1 flex-col overflow-hidden px-[clamp(8px,2svh,16px)] py-[clamp(6px,1.5svh,14px)]">
            <CaptureThumbnails />
          </section>
        </aside>
      </div>
    {/if}

    {#if g_toast_message}
      <div
        class="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
        role="status"
        aria-live="polite"
      >
        {g_toast_message}
      </div>
    {/if}
  </div>
</AnalysisPageLayout>
