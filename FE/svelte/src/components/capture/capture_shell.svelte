<script>
  import { onDestroy } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path.js'
  import CameraView from '@/components/camera/camera_view.svelte'
  import StepIndicator from '@/components/capture/step_indicator.svelte'
  import StepStatusBar from '@/components/capture/step_status_bar.svelte'
  import CaptureThumbnails from '@/components/capture/capture_thumbnails.svelte'
  import {
    get_session,
    set_glasses_mode,
    add_capture,
    get_current_step,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'

  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
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

  /**
   * camera_view 가 촬영을 마치면 세션에 저장하고 다음 스텝으로 진행.
   * @param {import('@/components/camera/camera_view.svelte').CaptureResult} result
   */
  async function on_capture(result) {
    g_is_capturing = false
    if (!g_current_step) return
    /** @type {Capture} */
    const capture = {
      step_id: g_current_step.step_id,
      blob: result.blob,
      object_url: result.object_url,
      captured_at: result.captured_at,
      width: result.width,
      height: result.height,
      measurements_obj: result.measurements_obj,
      measurement_points_obj: result.measurement_points_obj,
      landmarks: result.landmarks,
    }
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

  // 마지막 캡쳐 완료 → 얼굴 측정 페이지로 이동.
  $effect(() => {
    if (g_session.phase === 'review') {
      navigate(PATH.analysisFaceMeasurement)
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

<div class="grid min-h-full grid-cols-12 overflow-hidden">
  {#if g_session.phase === 'capturing' && g_current_step}
    <!--
      Default.png 형태의 9:3 레이아웃:
      - 좌측 9: 카메라 뷰 (가운데 정렬, 좌측 영역 차지)
      - 우측 3: 스텝 인디케이터 + 촬영 컨트롤 + 촬영 기록 (흰 배경 패널)
      - 두 컬럼 사이 세로 보더로 구분
    -->
    <section
      aria-label="실시간 얼굴 분석"
      class="col-span-8 grid min-h-0 items-start justify-items-center overflow-hidden border-r border-[var(--retina-text-200)] bg-[var(--retina-bg-2)] px-6 pt-2 pb-2"
    >
      <div class="w-full max-w-[420px]">
        <CameraView
          bind:this={ref_this_camera}
          active={true}
          pose_target={g_current_step.pose_type}
          capture_mode={g_current_step.capture_mode}
          oncapture={on_capture}
          oncapture_error={on_capture_error}
        />
      </div>
    </section>

    <aside
      class="col-span-4 flex min-h-0 flex-col gap-5 overflow-hidden bg-[var(--retina-surface)] px-3 py-4"
    >
      <StepIndicator
        steps_arr={g_session.steps_arr}
        current_index={g_session.current_step_index}
      />
      <StepStatusBar
        step={g_current_step}
        is_capturing={g_is_capturing}
        oncapture_click={on_manual_capture_click}
      />
      <CaptureThumbnails />
    </aside>
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
