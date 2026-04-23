<script>
  import { onDestroy } from 'svelte'
  import CameraView from '@/components/camera/camera_view.svelte'
  import GlassesModeModal from '@/components/capture/glasses_mode_modal.svelte'
  import StepIndicator from '@/components/capture/step_indicator.svelte'
  import StepStatusBar from '@/components/capture/step_status_bar.svelte'
  import CaptureReview from '@/components/capture/capture_review.svelte'
  import {
    get_session,
    set_glasses_mode,
    add_capture,
    get_current_step,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'

  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   * @typedef {import('@/lib/capture/step_config.js').GlassesMode} GlassesMode
   * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
   */

  const g_session = $derived(get_session())
  const g_current_step = $derived(get_current_step())

  /** @type {{ trigger_capture: () => Promise<void>, reset: () => void } | null} */
  let ref_this_camera = $state(null)
  let g_is_capturing = $state(false)

  // 세션에서 current_step 이 바뀌면 camera_view 를 재장전해 다음 스텝을 받아들이게 한다.
  $effect(() => {
    // g_current_step.step_id 가 바뀌는 순간을 트리거로 사용.
    const _step_id = g_current_step?.step_id
    if (_step_id && ref_this_camera) {
      ref_this_camera.reset()
    }
  })

  /**
   * 안경 착용 여부 모달에서 선택된 모드로 캡쳐 플로우 진입.
   * @param {GlassesMode} mode
   */
  function on_select_glasses(mode) {
    set_glasses_mode(mode)
  }

  /**
   * camera_view 가 촬영을 마치면 세션에 저장하고 다음 스텝으로 진행.
   * @param {import('@/components/camera/camera_view.svelte').CaptureResult} result
   */
  function on_capture(result) {
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
    }
    add_capture(capture)
  }

  // 수동 촬영 버튼 클릭 — camera_view 의 trigger_capture 호출.
  async function on_manual_capture_click() {
    if (g_is_capturing || !ref_this_camera) return
    g_is_capturing = true
    try {
      await ref_this_camera.trigger_capture()
    } finally {
      // trigger_capture 성공 시 on_capture 가 g_is_capturing 을 내리지만,
      // trigger_capture 가 얼굴 미검출로 no-op 반환한 경우 여기서 내린다.
      setTimeout(() => {
        g_is_capturing = false
      }, 100)
    }
  }

  // 리뷰 화면에서 "처음부터" 버튼 클릭 — 세션이 이미 reset 됐으므로 추가 액션 없음.
  function on_restart_review() {
    // reset_session 은 이미 capture_review 내부에서 호출됨.
    // phase='select_glasses' 로 복귀하므로 모달이 자동 재표시된다.
  }

  // 페이지 이탈 시 ObjectURL 전부 정리.
  onDestroy(() => {
    reset_session()
  })
</script>

<div class="flex flex-col gap-4">
  <GlassesModeModal open={g_session.phase === 'select_glasses'} onselect={on_select_glasses} />

  {#if g_session.phase === 'capturing' && g_current_step}
    <StepIndicator current_index={g_session.current_step_index} total={g_session.steps_arr.length} />

    <section class="mx-auto max-w-[540px]" aria-label="실시간 얼굴 분석">
      <CameraView
        bind:this={ref_this_camera}
        active={true}
        pose_target={g_current_step.pose_type}
        capture_mode={g_current_step.capture_mode}
        oncapture={on_capture}
      />
    </section>

    <section class="mx-auto w-full max-w-[540px]">
      <StepStatusBar
        step={g_current_step}
        is_capturing={g_is_capturing}
        oncapture_click={on_manual_capture_click}
      />
    </section>
  {/if}

  {#if g_session.phase === 'review'}
    <section class="mx-auto w-full max-w-[720px]">
      <CaptureReview onrestart={on_restart_review} />
    </section>
  {/if}
</div>
