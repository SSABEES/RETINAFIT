<script>
  import {
    get_video_landmarker,
    detect_from_video,
    check_frontal,
    check_face_completeness,
    clear_video_cache,
    draw_face_mesh,
    YAW_THR,
    PITCH_THR,
    ROLL_THR,
  } from '@/lib/mediapipe/face_landmarker.js'
  import { clear_video_detector_cache } from '@/lib/mediapipe/face_detector.js'
  import { compute_measurements, compute_measurement_points } from '@/lib/mediapipe/measurements.js'
  import {
    video_to_blob,
    get_center_crop_box,
    remap_landmarks_to_crop,
  } from '@/lib/capture/capture_utils.js'
  // 분석·캡처 좌표계 — 가운데 3:4 crop 기준 480×640.
  const ANALYSIS_W = 480
  const ANALYSIS_H = 640
  // 측면(left_profile/right_profile) 자세 감지 composable. pose_target 에 따라 tick() 이
  // no-op 이거나 6D 추론 발사. 정면 단계엔 무관 — 인스턴스만 만들어두고 사용 안 함.
  import { create_profile_pose_detector } from '@/lib/capture/use_profile_pose.svelte.js'
  import { PROFILE_CONSTANTS, compute_target_deg } from '@/lib/capture/profile_pose_logic.js'
  // 음성 가이드 — 모듈 단위 단일 audio 채널. 우선순위 / 1회성 키 가드 포함.
  import {
    play as play_voice,
    stop as stop_voice,
    wait_for_active as wait_for_voice,
  } from '@/lib/audio/voice_guide.js'

  /**
   * @typedef {import("@/lib/mediapipe/face_types.js").FaceMeasurements} FaceMeasurements
   * @typedef {import("@/lib/mediapipe/face_types.js").FrontalCheck} FrontalCheck
   * @typedef {import("@/lib/mediapipe/face_types.js").CompletenessCheck} CompletenessCheck
   * @typedef {import("@/lib/mediapipe/face_types.js").Point2D} Point2D
   *
   * @typedef {object} CaptureResult
   * @property {Blob} blob
   * @property {string} object_url
   * @property {number} captured_at
   * @property {number} width
   * @property {number} height
   * @property {FaceMeasurements | null} measurements_obj
   * @property {Record<string, [Point2D, Point2D]> | null} measurement_points_obj
   * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[] | null} landmarks
   * @property {import('@/lib/stores/capture_session.svelte.js').HeadPoseSnapshot | null} head_pose
   */

  /**
   * @typedef {object} LandmarkDetectionResult
   * @property {import('@mediapipe/tasks-vision').NormalizedLandmark[]} landmarks  detect loop 가 잡은 정면 landmarks (crop 좌표계로 remap 됨)
   * @property {HTMLVideoElement} source_el  비디오 element ref (live frame 캡처용)
   * @property {number} source_width  source_el.videoWidth (캡처 시점의 native 픽셀)
   * @property {number} source_height  source_el.videoHeight
   */

  /** @type {{
   *   active?: boolean,
   *   pose_target?: 'front' | 'left_profile' | 'right_profile',
   *   capture_mode?: 'auto' | 'manual',
   *   show_overlay?: boolean,
   *   is_landmark_visible?: boolean,
   *   oncapture?: ((c: CaptureResult) => void) | undefined,
   *   oncapture_error?: ((err: unknown) => void) | undefined,
   *   onlandmarks?: ((d: LandmarkDetectionResult) => void) | undefined,
   * }}
   */
  let {
    active = false,
    pose_target = 'front',
    capture_mode = 'auto',
    show_overlay = true,
    is_landmark_visible = true,
    oncapture = undefined,
    oncapture_error = undefined,
    onlandmarks = undefined,
  } = $props()

  // FRAME_SKIP: 60fps / 5 = 12Hz 추론 (성능과 반응성의 타협점)
  // STABILITY_FRAMES: 12Hz × 30 ≈ 2.5초 유지되어야 최종 확정
  // STABILITY_THRESHOLD: 최근 10프레임 face_width/height 표준편차 상한 (640x480 기준 경험값)
  const FRAME_SKIP = 5
  const STABILITY_FRAMES = 30
  const STABILITY_THRESHOLD = 5

  /** @type {HTMLVideoElement | null} */
  let ref_this_video_el = $state(null)
  /** @type {HTMLCanvasElement | null} */
  let ref_this_canvas_el = $state(null)
  // 좌우 빈 영역을 같은 스트림의 흐릿한 확대본으로 채워 시각적으로 fill 효과.
  // 분석/캡처 video 와 별개 element 지만 동일 MediaStream 공유 — 같은 프레임이라 sync 문제 없음.
  /** @type {HTMLVideoElement | null} */
  let ref_this_backdrop_video_el = $state(null)

  // 비동기 카메라 시작 도중 cleanup 이 끼어들 때 stale rAF/이벤트 핸들러 등록을 막기 위한 세대 토큰.
  // on_stop_camera 가 증가시키고, on_start_camera 는 각 await 뒤에 자신의 세대가 아직 유효한지 확인한다.
  let g_start_generation = 0

  /** @type {MediaStream | null} */
  let g_stream = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarker | null} */
  let g_landmarker = null
  /** @type {number | null} */
  let g_raf_id = null
  /** @type {import("@mediapipe/tasks-vision").FaceLandmarkerResult | null} */
  let g_last_detection = null
  let g_frame_counter = 0
  // g_can_auto_fire ($derived) 와 자동 발사 $effect 의 deps 로 사용되므로 $state 로 선언해야
  // reset 시 false 로 되돌리는 변경이 reactive 하게 추적된다. 그냥 let 으로 두면 plain 변수라
  // derived 가 재계산되지 않아 reset 후에도 stale=true 가 유지되어 자동 캡처가 발사되지 않는다.
  let g_already_dispatched = $state(false)
  /** @type {ReturnType<typeof setTimeout> | null} */
  let g_capture_timeout = null
  /** @type {'idle' | 'started' | 'final'} */
  let g_stability_audio_stage = $state('idle')
  let g_capture_sequence_token = 0
  // step 단위 1회 안내 — 자세 OK 후 안정화 미달 상태에서 "가만히 계세요" 음성. reset() 에서 false 로.
  let g_did_announce_in_progress = false
  // step 단위 1회 안내 — 진입 직후 길이 긴 step intro 안내 (정면/좌/우 별 다른 키). reset() 에서 false 로.
  let g_did_play_step_intro = false

  // 측면 자세 감지 — pose_target 이 'front' 면 tick() 이 즉시 return 하므로 항상 생성해도 안전.
  // on_stable_reached 콜백: composable 의 stable_count 가 max 처음 도달할 때 rAF 안에서 직접
  // 호출됨 → Svelte $effect 의 cross-module reactivity 거치지 않고 즉시 시퀀스 발사.
  const profile_pose = create_profile_pose_detector({
    get_pose_target: () => pose_target,
    get_video_el: () => ref_this_video_el,
    on_stable_reached: () => {
      // 가드: 이미 dispatch 됐거나 sequence 진행 중이면 중복 호출 방지.
      if (g_already_dispatched) return
      if (g_stability_audio_stage === 'final') return
      g_stability_audio_stage = 'final'
      void run_auto_capture_sequence()
    },
  })

  let g_init_error = $state(/** @type {string | null} */ (null))
  let g_permission_denied = $state(false)
  let g_face_detected = $state(false)
  /** @type {FaceMeasurements | null} */
  let g_measurements_obj = $state(null)
  /** @type {FrontalCheck | null} */
  let g_frontal_obj = $state(null)
  /** @type {CompletenessCheck} */
  let g_complete_obj = $state({ is_complete: true, reason: null })
  /** @type {FaceMeasurements[]} */
  let g_buffer_arr = []
  let g_stable_count = $state(0)

  const g_is_stable = $derived(g_stable_count >= STABILITY_FRAMES)
  const g_stability_progress = $derived(
    Math.min(100, Math.round((g_stable_count / STABILITY_FRAMES) * 100)),
  )

  // 정면 단계: 얼굴 검출 + 영역 내 + 정면 자세 일 때 "정면 영역 진입" 으로 간주.
  // 좌측상단 게이지 + face_recognition_in_progress 음성 트리거 기준 (측면의 in-zone 과 의미 일치).
  const g_front_in_zone = $derived(
    pose_target === 'front' &&
      g_face_detected &&
      g_complete_obj.is_complete &&
      !!g_frontal_obj?.is_frontal,
  )

  // 정면 / 측면 모두 capture_mode==='auto' 일 때 자동 발사 활성화. pose_target 별 stable 계산은
  // 각 파이프라인이 담당하고, 통합 게이트(g_can_auto_fire) 가 분기.
  const g_is_auto_capture = $derived(capture_mode === 'auto')

  // 자동 발사 단일 게이트. 정면은 안정화 기반(face dimension std), 측면은 yaw 기반(composable).
  const g_can_auto_fire = $derived.by(() => {
    if (!active || !g_is_auto_capture || g_already_dispatched) return false
    if (pose_target === 'front') {
      return (
        g_face_detected && g_complete_obj.is_complete && !!g_frontal_obj?.is_frontal && g_is_stable
      )
    }
    return profile_pose.is_stable
  })
  // 정면 포즈일 때만 check_frontal 결과를 UI/판정에 반영한다.
  const g_should_check_frontal = $derived(pose_target === 'front')

  // 가이드 타원 색상을 pose_target 과 상태에 따라 결정한다.
  // 정면/측면 동일한 색 의미 (회색=대기, 노랑=자세 잡는 중, 초록=안정 도달).
  // 정면은 추가로 빨강(=얼굴 일부가 frame 밖) 상태가 있다.
  const g_guide_color = $derived.by(() => {
    if (pose_target !== 'front') {
      // 대기 — 모델 미준비 또는 첫 yaw 추론 전
      if (!profile_pose.session_ready || profile_pose.last_yaw === null) {
        return 'rgba(200,200,200,0.5)'
      }
      const target_deg = compute_target_deg(pose_target)
      const distance = Math.abs(profile_pose.last_yaw - target_deg)
      // 영역 밖 — 더 돌려야 함 (정면의 "not frontal" 과 동일 의미)
      if (distance >= PROFILE_CONSTANTS.TOLERANCE) return 'rgba(255,193,7,0.85)'
      // 영역 안 진입 시점부터 즉시 초록 (인식 시작 시각화) — 안정화 완료 후에도 동일.
      return 'rgba(0,230,118,0.9)'
    }

    // 정면 — 얼굴이 영역 안 + frontal 진입 시 즉시 초록(인식 시작 시각화), 안정화 완료 후에도 초록 유지.
    if (!g_face_detected) return 'rgba(200,200,200,0.5)'
    if (!g_complete_obj.is_complete) return 'rgba(244,67,54,0.85)'
    if (!g_frontal_obj?.is_frontal) return 'rgba(255,193,7,0.85)'
    return 'rgba(0,230,118,0.9)'
  })

  // 사용자에게 보여줄 힌트 문자열을 pose_target 과 상태에 따라 결정한다.
  const g_hint_text = $derived.by(() => {
    // 측면: composable 이 자체 hint 계산. null 이면 기본 가이드로 폴백.
    // 영역 진입 이후 ('자세 유지 중 N%' 또는 '✓ 측정 중…') 는 게이지로 대체되므로 hint 숨김.
    if (pose_target !== 'front') {
      const local_hint = profile_pose.hint_text ?? '카메라 앞에 자세를 잡아주세요'
      if (local_hint.startsWith('자세 유지 중') || local_hint.startsWith('✓')) {
        return ''
      }
      return local_hint
    }

    // 정면 — 기존 로직 그대로 (측면 분기는 위에서 이미 return 했으므로 여기서 pose_target='front' 로 narrowing 됨).
    if (!g_face_detected) return '얼굴을 가이드 안에 맞춰주세요'
    if (!g_complete_obj.is_complete) return '얼굴 전체가 화면에 나오도록 해주세요'
    if (!g_frontal_obj) return '정면을 바라봐 주세요'
    if (g_frontal_obj.is_frontal) {
      // 정면 영역 진입 후엔 게이지가 진행률을 보여주므로 하단 hint 는 노출 X.
      return ''
    }
    if (g_frontal_obj.reason === 'yaw') {
      return g_frontal_obj.yaw > 0 ? '고개를 오른쪽으로 돌려주세요' : '고개를 왼쪽으로 돌려주세요'
    }
    if (g_frontal_obj.reason === 'pitch') {
      return g_frontal_obj.pitch > 0 ? '턱을 올려주세요' : '턱을 내려주세요'
    }
    if (g_frontal_obj.reason === 'roll') {
      return g_frontal_obj.roll > 0 ? '오른쪽으로 기울었어요' : '왼쪽으로 기울었어요'
    }
    return '정면을 바라봐 주세요'
  })

  // 상태별 힌트 배지 색상 (inline style 로 적용할 문자열).
  const g_badge_style = $derived.by(() => {
    const base = 'background: rgba(0,0,0,0.55);'
    // 측면: stable=초록, 진행 중=주황, 대기=흰
    if (pose_target !== 'front') {
      if (profile_pose.is_stable)
        return base + ' border-color: rgba(0,230,118,0.7); color: #69f0ae;'
      if (profile_pose.progress > 0)
        return base + ' border-color: rgba(255,152,0,0.6); color: #ffb74d;'
      return base + ' border-color: rgba(255,255,255,0.25); color: #eeeeee;'
    }

    // 정면 — 기존 로직 그대로
    if (pose_target === 'front' && g_is_stable) {
      return base + ' border-color: rgba(0,230,118,0.7); color: #69f0ae;'
    }
    if (g_face_detected) {
      return base + ' border-color: rgba(255,152,0,0.6); color: #ffb74d;'
    }
    return base + ' border-color: rgba(255,255,255,0.25); color: #eeeeee;'
  })

  // active prop 이 true 로 바뀌면 카메라를 시작하고, false 로 돌아가거나 언마운트되면 정리한다.
  $effect(() => {
    if (active) {
      void on_start_camera()
      return () => on_stop_camera()
    }
  })

  // step 진입 직후 1회 — 단계 intro 음성 (정면/좌/우 별로 다른 길이 안내).
  // 부모(analysis/index.svelte) 의 start_capture 가 진행 중일 수 있어, wait_for_voice 로 종료를
  // 기다린 뒤 재생한다. step 전환 시 reset() 이 g_did_play_step_intro 를 false 로 되돌려 재무장.
  $effect(() => {
    if (!active || g_did_play_step_intro || !pose_target) return
    /** @type {import('@/lib/audio/voice_guide.js').VoiceGuideKey} */
    const intro_key =
      pose_target === 'front'
        ? 'center_face_for_front_capture'
        : pose_target === 'left_profile'
          ? 'turn_head_right_for_left_capture'
          : 'turn_left_for_right_capture'
    g_did_play_step_intro = true
    void (async () => {
      await wait_for_voice()
      await play_voice(intro_key, { priority: 'low' })
    })()
  })

  // 자동 발사 통합 — 정면/측면 분기는 g_can_auto_fire 안에서 끝남.
  $effect(() => {
    // stage 가 'final' 이면 시퀀스 진행 중 — stability 플리커링에 반응 안 함.
    // 측면 단계의 yaw 기반 안정성은 추론 노이즈로 단일 프레임만 영역 이탈해도 _stable_count -=5 가
    // 일어나 is_stable 이 잠깐 false → 다시 true 가 됨. 이 토글에 effect 가 반응해 stage 를
    // 'idle' → 'final' 로 다시 세팅하면 run_auto_capture_sequence 가 재호출 + 직전 sequence 가
    // 토큰 불일치로 abort 되어 캡처 자체가 발사되지 않음. 시퀀스는 reset() / dispatch 으로만 재무장.
    if (g_stability_audio_stage === 'final') return

    if (!g_can_auto_fire) {
      if (g_capture_timeout !== null) {
        clearTimeout(g_capture_timeout)
        g_capture_timeout = null
      }
      g_stability_audio_stage = 'idle'
      return
    }

    g_stability_audio_stage = 'final'
    void run_auto_capture_sequence()
  })

  $effect(() => {
    // ★ entry guard 보다 먼저 측면 yaw / session_ready 를 한 번 읽어 effect 의 reactive deps 에
    //   무조건 등록한다. 이 effect 의 첫 실행이 정면 단계 (front 분기) 에 일어나거나 entry guard
    //   에서 일찍 bail 하면 last_yaw 가 dep 으로 잡히지 않아, 이후 yaw 가 바뀌어도 effect 가 재실행
    //   되지 않고 측면 음성 안내가 영영 침묵하는 문제가 있었음. 텍스트 ($derived 경유) 는 항상
    //   읽으니 정상 동작했지만, effect 는 read-path 에 따라 deps 가 달라지므로 명시 고정 필요.
    const local_last_yaw = profile_pose.last_yaw
    const local_session_ready = profile_pose.session_ready

    if (
      !active ||
      !g_is_auto_capture ||
      g_already_dispatched ||
      g_stability_audio_stage !== 'idle'
    ) {
      return
    }

    /** @type {'head_center' | 'head_right' | 'head_left' | null} */
    let next_audio_key = null
    // 자세 OK 여부 — 안정화 미달 상태 안내 (face_recognition_in_progress) 분기 결정에 사용.
    let local_pose_ok = false

    if (pose_target === 'front') {
      // 정면 — 얼굴 미검출 / 일부 잘림 / yaw 어긋남 모두 head_center 로 통일.
      // 긴 step intro (center_face_for_front_capture) 는 step 진입 시 별도 effect 가 1회 재생.
      if (!g_face_detected) {
        next_audio_key = 'head_center'
      } else if (!g_complete_obj.is_complete) {
        next_audio_key = 'head_center'
      } else if (g_frontal_obj && !g_frontal_obj.is_frontal && g_frontal_obj.reason === 'yaw') {
        next_audio_key = 'head_center'
      } else {
        local_pose_ok = g_complete_obj.is_complete && (g_frontal_obj?.is_frontal ?? false)
      }
    } else {
      // 측면 — 6DRepNet360 yaw 기준 안정화 영역 (target ± TOLERANCE) 미도달이면 target 방향으로
      // 더 돌리도록 안내. 영역 안 (도달 직전~stable) 이면 인식 진행 안내로 폴백.
      if (local_session_ready && local_last_yaw !== null) {
        const target_deg = compute_target_deg(pose_target)
        const distance = Math.abs(local_last_yaw - target_deg)
        if (distance >= PROFILE_CONSTANTS.TOLERANCE) {
          // pose-correction 키 — 짧은 prompt (head_*). 긴 step intro 안내는 별도 effect 가 step
          // 진입 시 1회 재생 (turn_head_right_for_left_capture / turn_left_for_right_capture).
          next_audio_key = pose_target === 'right_profile' ? 'head_left' : 'head_right'
        } else {
          local_pose_ok = true
        }
      }
    }

    // 영역을 벗어나면 안내 발사 플래그 해제 — 다시 영역 안으로 들어오면 face_recognition_in_progress
    // 가 재생되도록. (한 step 내에서도 진입/이탈 반복 시마다 안내가 나오는 동작.)
    if (!local_pose_ok && g_did_announce_in_progress) {
      g_did_announce_in_progress = false
    }

    if (next_audio_key) {
      void play_voice(next_audio_key)
      return
    }

    // 자세 OK + 아직 안내 미발사 — 정면/측면 모두 진행 중인 intro/start_capture 음성을 즉시 끊고
    // face_recognition_in_progress 를 priority 'high' 로 preempt 재생. 영역 진입할 때마다 1회.
    // 플래그는 await 전에 동기적으로 set — effect 가 매 프레임 재실행되며 stop_voice+play_voice 를
    // 반복 호출해 직전 재생을 끊어버리는 race 를 차단한다 (이전: played 후 set → 음성이 끝까지 안 들림).
    if (local_pose_ok && !g_did_announce_in_progress) {
      g_did_announce_in_progress = true
      void (async () => {
        stop_voice()
        await play_voice('face_recognition_in_progress', { priority: 'high' })
      })()
    }
  })

  // 사용자 카메라 권한을 요청하고 MediaPipe 모델을 로드해 rAF 루프를 시작한다.
  // 각 await 지점 뒤에 세대 토큰을 검사해, 중간에 on_stop_camera 가 끼어들면 조용히 빠져나간다.
  async function on_start_camera() {
    const my_generation = ++g_start_generation
    try {
      g_init_error = null
      g_permission_denied = false
      g_already_dispatched = false
      g_stability_audio_stage = 'idle'
      g_did_announce_in_progress = false
      g_did_play_step_intro = false
      g_capture_sequence_token += 1
      g_buffer_arr = []
      g_stable_count = 0
      profile_pose.reset()
      g_face_detected = false
      g_measurements_obj = null

      const landmarker = await get_video_landmarker()
      if (my_generation !== g_start_generation) return
      g_landmarker = landmarker

      // 가로 1280×720 (16:9) 로 요청 — 좌우 빈 영역까지 진짜 카메라 시야로 채우기 위함.
      // 분석·캡처는 가운데 3:4 영역(540×720) 만 사용하며, 480×640 으로 정규화 저장.
      // 디바이스가 정확히 1280×720 을 못 줘도 가까운 가로형으로 대체 반환 — get_center_crop_box 가
      // 모든 aspect 에서 가운데 3:4 영역을 정확히 산출.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      if (my_generation !== g_start_generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      g_stream = stream

      // active 전환 직후 <video> 가 아직 마운트되지 않았을 수 있어 한 틱 대기.
      await new Promise((r) => setTimeout(r, 0))
      if (my_generation !== g_start_generation) return
      if (!ref_this_video_el) throw new Error('video element missing')
      ref_this_video_el.srcObject = g_stream
      // 동일 stream 을 backdrop 에도 연결. 별도 onloadedmetadata 훅 없이 자동재생만.
      if (ref_this_backdrop_video_el) {
        ref_this_backdrop_video_el.srcObject = g_stream
        ref_this_backdrop_video_el.play().catch(() => {})
      }
      ref_this_video_el.onloadedmetadata = () => {
        // metadata 콜백이 불릴 시점에 이미 정지되었으면 재생하지 않는다.
        if (my_generation !== g_start_generation || !ref_this_video_el || !g_stream) return
        void ref_this_video_el.play()
        on_loop_frame()
      }
    } catch (err) {
      on_stop_camera()
      const e = /** @type {DOMException} */ (err)
      if (e.name === 'NotAllowedError') {
        g_permission_denied = true
        g_init_error = '카메라 접근 권한이 거부되었습니다.'
      } else if (e.name === 'NotFoundError') {
        g_init_error = '카메라를 찾을 수 없습니다.'
      } else {
        g_init_error = `카메라 시작 실패: ${e.message ?? String(err)}`
      }
    }
  }

  // rAF 루프를 중지하고 스트림을 해제한다. 진행 중인 on_start_camera 의 async tail 이 남은 작업을
  // 이어가지 못하도록 세대 토큰을 증가시킨다.
  function on_stop_camera() {
    g_start_generation++
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_capture_sequence_token += 1
    profile_pose.reset()
    stop_voice()
    g_stability_audio_stage = 'idle'
    g_did_announce_in_progress = false
    g_did_play_step_intro = false
    if (g_raf_id !== null) {
      cancelAnimationFrame(g_raf_id)
      g_raf_id = null
    }
    if (g_stream) {
      g_stream.getTracks().forEach((t) => t.stop())
      g_stream = null
    }
    if (ref_this_video_el) {
      ref_this_video_el.onloadedmetadata = null
      ref_this_video_el.srcObject = null
    }
    if (ref_this_backdrop_video_el) {
      ref_this_backdrop_video_el.srcObject = null
    }
    clear_video_cache()
    clear_video_detector_cache()
  }

  async function run_auto_capture_sequence() {
    const my_token = ++g_capture_sequence_token

    if (
      my_token !== g_capture_sequence_token ||
      !active ||
      !g_is_auto_capture ||
      g_already_dispatched
    ) {
      return
    }

    // 정면/측면 공통 시퀀스 — "셔터음 시작 = 캡처 시점" 이 되도록 셔터음과 캡처를 동시에 발사한다.
    // 이전엔 셔터음을 await 끝까지 → 그 후 캡처 였는데, 인지상 "찰칵 소리 다 끝나고 찍히는" 느낌이라 부자연스러움.
    // 직전 face_recognition_in_progress (priority high) 가 아직 재생 중이면 동등 priority 의 셔터음이
    // play() 시점에 false 로 차단되므로 시퀀스 시작 직전에 stop_voice() 로 active 를 비워둔다.
    // 셔터음은 캡처 종료 후 await 해서 face_recognition_complete (동일 high priority) 가 차단되지 않게 한다.
    stop_voice()

    // 1) 셔터음 재생 시작 (await 안 함 — 캡처와 동시에 들리도록)
    const local_shutter_promise = play_voice('camera_shutter_sound', { priority: 'high' })

    // 2) 캡처 — 측면은 MediaPipe 측정값 없음 → measurements_obj=null.
    //    셔터음 시작과 같은 tick 에 발사돼 "셔터음 = 사진 찍힌 순간" 으로 인지됨.
    const meas = pose_target === 'front' ? get_average() : null
    await trigger_capture_internal(meas)

    if (my_token !== g_capture_sequence_token || !active || !g_is_auto_capture) return

    // 3) 셔터음이 끝까지 재생되길 보장 — 그래야 다음 단계의 high priority 음성이 차단되지 않음.
    await local_shutter_promise

    if (my_token !== g_capture_sequence_token || !active || !g_is_auto_capture) return

    // 4) 인식 완료 음성 (await — 끝까지 들려야 함)
    await play_voice('face_recognition_complete', { priority: 'high' })
  }

  /**
   * 안정화 버퍼를 갱신하고 stable_count 를 조정한다.
   * 최근 10프레임 face_width/height 표준편차가 임계치 미만이면 안정.
   * 불안정 프레임은 1회당 5회분 되감아 조기 확정을 방지한다.
   * @param {FaceMeasurements} m
   */
  function update_stability(m) {
    g_buffer_arr = [...g_buffer_arr.slice(-29), m]
    if (g_buffer_arr.length < 10) {
      g_stable_count = 0
      return
    }
    const recent = g_buffer_arr.slice(-10)
    const std = (/** @type {number[]} */ arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length
      return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
    }
    const w_std = std(recent.map((r) => r.face_width))
    const h_std = std(recent.map((r) => r.face_height))
    if (w_std < STABILITY_THRESHOLD && h_std < STABILITY_THRESHOLD) {
      g_stable_count = Math.min(g_stable_count + 1, STABILITY_FRAMES)
    } else {
      g_stable_count = Math.max(0, g_stable_count - 5)
    }
  }

  /**
   * 최근 10프레임 측정값의 평균을 반환한다.
   * @returns {FaceMeasurements | null}
   */
  function get_average() {
    const recent = g_buffer_arr.slice(-10)
    if (recent.length === 0) return null
    /** @param {keyof FaceMeasurements} k */
    const avg = (k) => Math.round(recent.reduce((s, m) => s + m[k], 0) / recent.length)
    return {
      face_width: avg('face_width'),
      face_height: avg('face_height'),
      eye_distance: avg('eye_distance'),
      pd_pixels: avg('pd_pixels'),
      nose_width: avg('nose_width'),
      jaw_width: avg('jaw_width'),
      forehead_width: avg('forehead_width'),
      cheekbone_width: avg('cheekbone_width'),
      right_pd_pixels: avg('right_pd_pixels'),
      left_pd_pixels: avg('left_pd_pixels'),
    }
  }

  // rAF 루프 한 틱. FRAME_SKIP 프레임마다 추론을 수행하고 매 틱 canvas 를 다시 그린다.
  function on_loop_frame() {
    if (!g_stream || !ref_this_video_el || !g_landmarker) return
    g_frame_counter++

    if (g_frame_counter % FRAME_SKIP === 0) {
      if (pose_target === 'front') {
        // ───── 정면: MediaPipe 검출 + frontal/completeness/안정성 ─────
        // 비디오는 가로형 (예 1280×720) 으로 받지만 분석·측정·캡처 좌표계는 가운데 3:4 crop 으로 통일.
        // landmarks 를 crop 좌표계로 remap 한 뒤 측정/완전성 검사에 넘긴다.
        // (frontal 은 transformation matrix 기반이라 좌표계 영향 없음 → result 원본 그대로 사용)
        const result = detect_from_video(g_landmarker, ref_this_video_el)
        g_last_detection = result
        if (result?.faceLandmarks?.length) {
          g_face_detected = true
          const local_crop = get_center_crop_box(
            ref_this_video_el.videoWidth,
            ref_this_video_el.videoHeight,
          )
          const local_remapped_arr = remap_landmarks_to_crop(result.faceLandmarks[0], local_crop)
          g_complete_obj = check_face_completeness({
            ...result,
            faceLandmarks: [local_remapped_arr],
          })
          g_frontal_obj = check_frontal(result)
          const m = compute_measurements(local_remapped_arr, ANALYSIS_W, ANALYSIS_H)
          if (m) g_measurements_obj = m
          // 외부 컨슈머 (real_fitting 의 OH 게이트 등) 에 정면 landmarks + video source 노출.
          // 측면 detection 분기 (landmarks 없음) 에서는 호출 안 함.
          if (onlandmarks) {
            onlandmarks({
              landmarks: local_remapped_arr,
              source_el: ref_this_video_el,
              source_width: ref_this_video_el.videoWidth,
              source_height: ref_this_video_el.videoHeight,
            })
          }
          if (
            g_should_check_frontal &&
            m &&
            g_complete_obj.is_complete &&
            g_frontal_obj?.is_frontal
          ) {
            update_stability(m)
          } else {
            g_buffer_arr = []
            g_stable_count = 0
          }
        } else {
          g_face_detected = false
          g_frontal_obj = null
          g_complete_obj = { is_complete: true, reason: null }
          g_measurements_obj = null
          g_buffer_arr = []
          g_stable_count = 0
        }
      } else {
        // ───── 측면: yaw 기반 자세 판정은 profile_pose 가 담당하지만, face mesh 시각화를 위해
        // MediaPipe 검출은 계속 돌린다. 정면 전용 게이트(frontal/completeness/안정성)는 끄고
        // landmarks 만 g_last_detection 에 보관해 draw_face_mesh 가 그릴 수 있도록.
        const local_result = detect_from_video(g_landmarker, ref_this_video_el)
        g_last_detection = local_result
        g_face_detected = false
        g_frontal_obj = null
        g_complete_obj = { is_complete: true, reason: null }
        g_measurements_obj = null
        g_buffer_arr = []
        g_stable_count = 0
      }
    }

    // 측면 단계의 6D 추론 — 매 rAF 호출, 내부 throttle (ORT_FRAME_SKIP) 로 ~2.4Hz 자동 제한
    if (pose_target !== 'front') {
      void profile_pose.tick()
    }

    sync_canvas_size()
    if (show_overlay && ref_this_canvas_el) {
      const ctx = ref_this_canvas_el.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, ref_this_canvas_el.width, ref_this_canvas_el.height)
      }
      if (is_landmark_visible) {
        draw_face_mesh(ref_this_canvas_el, g_last_detection)
      }
      draw_guide_ellipse()
    }

    g_raf_id = requestAnimationFrame(on_loop_frame)
  }

  /**
   * 현재 비디오 프레임을 Blob 으로 캡쳐하고 oncapture 콜백으로 전달한다.
   * g_already_dispatched 로 동일 세션에 중복 호출이 되지 않도록 가드.
   * @param {FaceMeasurements | null} measurements_obj
   */
  async function trigger_capture_internal(measurements_obj) {
    if (g_already_dispatched) return
    if (!ref_this_video_el || !g_stream) return
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_already_dispatched = true
    try {
      const { blob, width, height } = await video_to_blob(ref_this_video_el)
      const object_url = URL.createObjectURL(blob)
      // landmarks 는 비디오 전체 프레임 기준 [0,1] — 캡처(가운데 3:4 crop, 480×640) 와 좌표계가
      // 다르므로 crop 좌표계로 remap 후 저장 · measurement_points 계산.
      const raw_landmarks = g_last_detection?.faceLandmarks?.[0] ?? null
      const landmarks = raw_landmarks
        ? remap_landmarks_to_crop(
            raw_landmarks,
            get_center_crop_box(ref_this_video_el.videoWidth, ref_this_video_el.videoHeight),
          )
        : null
      const measurement_points_obj = landmarks
        ? compute_measurement_points(landmarks, width, height)
        : null
      // 측면 캡처 시점의 머리 자세를 동결 — 전경각 보정에 쓰인다. last_image_tilt 가 buffer 평균
      // 후 안정화된 값이므로 캡처 직전 jitter 영향이 작은 값을 그대로 보관. 정면 캡처거나 추론 결과가
      // 아직 없으면 null (보정 없이 raw 림 각도가 측정값으로 사용됨).
      const head_pose =
        pose_target !== 'front' && profile_pose.last_image_tilt !== null
          ? {
              image_tilt_deg: profile_pose.last_image_tilt,
              pitch_deg: profile_pose.last_pitch,
              yaw_deg: profile_pose.last_yaw,
              roll_deg: profile_pose.last_roll,
            }
          : null
      oncapture?.({
        blob,
        object_url,
        width,
        height,
        captured_at: Date.now(),
        measurements_obj: measurements_obj ?? null,
        measurement_points_obj,
        landmarks,
        head_pose,
      })
    } catch (err) {
      // 촬영 실패 시 재시도 가능하도록 dispatched 플래그 해제 + 소비자에게 에러 알림.
      g_already_dispatched = false

      console.error('[camera_view] capture failed:', err)
      oncapture_error?.(err)
    }
  }

  /**
   * 외부에서 (수동 캡쳐용으로) 호출하는 촬영 트리거.
   * capture_mode='manual' 에서만 쓰는 것이 정상 — auto 모드에서는 이미 안정화 후 자동 발사되므로
   * 호출할 필요 없음(중복 호출은 g_already_dispatched 로 무시됨).
   *
   * 얼굴 검출 가드는 **정면 포즈에서만** 적용한다. 프로필 포즈(left/right)에서는 MediaPipe 가
   * 강한 측면 각도에서 검출에 실패해 g_face_detected=false 가 지속될 수 있기 때문에, 이 상태에서도
   * 비디오 프레임 자체는 유효하므로 촬영은 계속 가능해야 한다.
   * 비디오 프레임이 아직 준비되지 않은 경우(videoWidth=0)만 false 로 취소한다.
   *
   * @returns {Promise<boolean>} true = 촬영 트리거됨, false = 비디오 미준비 또는 정면에서 얼굴 미검출로 취소됨
   */
  export async function trigger_capture() {
    if (capture_mode === 'auto') {
      console.warn('[camera_view] trigger_capture: auto 모드에서는 외부 호출이 불필요합니다')
    }
    if (!ref_this_video_el || ref_this_video_el.videoWidth === 0) {
      console.warn('[camera_view] trigger_capture: 비디오 프레임이 준비되지 않음')
      return false
    }
    if (pose_target === 'front' && !g_face_detected) {
      console.warn('[camera_view] trigger_capture: 정면 포즈에서 얼굴이 감지되지 않음')
      return false
    }
    await trigger_capture_internal(g_measurements_obj)
    return true
  }

  // canvas 내부 해상도를 비디오 해상도에 맞춘다.
  function sync_canvas_size() {
    if (!ref_this_canvas_el || !ref_this_video_el || ref_this_video_el.videoWidth === 0) return
    if (ref_this_canvas_el.width !== ref_this_video_el.videoWidth) {
      ref_this_canvas_el.width = ref_this_video_el.videoWidth
    }
    if (ref_this_canvas_el.height !== ref_this_video_el.videoHeight) {
      ref_this_canvas_el.height = ref_this_video_el.videoHeight
    }
  }

  /**
   * 상태색이 적용된 얼굴형 가이드를 canvas 위에 그린다.
   * pose_target 에 따라 정면(계란형) / 측면(옆얼굴 실루엣) 으로 분기.
   * 색 의미는 동일 (회색=대기, 노랑=자세 잡는 중, 초록=안정 도달, 빨강=프레임 이탈).
   */
  function draw_guide_ellipse() {
    if (!ref_this_canvas_el || ref_this_canvas_el.width === 0) return
    const ctx = ref_this_canvas_el.getContext('2d')
    if (!ctx) return

    // 가이드는 캡처와 동일한 가운데 3:4 영역을 기준으로 그린다 — 사용자가 보는 가이드가
    // "캡처될 영역" 과 같은 공간을 지칭하도록.
    const crop = get_center_crop_box(ref_this_canvas_el.width, ref_this_canvas_el.height)
    const cx = crop.crop_x + crop.crop_w * 0.5
    const cy = crop.crop_y + crop.crop_h * 0.47

    // 얼굴 전체 세로(이마 위~턱 끝). 캡처 영역 세로의 60% 를 얼굴 영역으로 가정.
    const face_h = crop.crop_h * 0.6
    // 광대뼈 너비(최대 가로) — 얼굴 세로의 약 76% 가 일반적 해부학 평균.
    const face_w = face_h * 0.76

    ctx.save()
    // 배경 영상에 관계없이 선이 잘 보이도록 약한 드롭섀도.
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 4
    ctx.strokeStyle = g_guide_color
    ctx.lineWidth = 3
    ctx.setLineDash([14, 7])

    if (pose_target === 'front') {
      draw_front_face_path(ctx, cx, cy, face_w, face_h)
    } else {
      // canvas 가 scaleX(-1) 로 거울 반전되어 표시되므로, 사용자가 거울에서 보는 방향과
      // 캔버스 작도 방향은 반대다. left_profile 단계는 사용자가 거울에서 본인 코가 우측을 향하도록
      // 고개를 돌려야 하므로, 캔버스에는 코가 좌측 (sign=-1) 으로 향하게 그린다. right_profile 은 반대.
      const local_face_sign = pose_target === 'left_profile' ? -1 : 1
      draw_side_face_path(ctx, cx, cy, face_w, face_h, local_face_sign)
    }

    ctx.stroke()
    ctx.restore()
  }

  /**
   * 정면 얼굴 가이드 — 계란형(이마는 둥글게, 턱은 좁게) 베지어. 기존 로직 그대로.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} face_w
   * @param {number} face_h
   */
  function draw_front_face_path(ctx, cx, cy, face_w, face_h) {
    const top_y = cy - face_h * 0.46
    const bottom_y = cy + face_h * 0.54
    const cheek_y = cy + face_h * 0.04
    const cheek_x = face_w * 0.5
    const k_upper_out = cheek_x * 1.05
    const k_upper_vert = (cheek_y - top_y) * 0.55
    const k_lower_in = cheek_x * 0.45
    const k_lower_vert = (bottom_y - cheek_y) * 0.55

    ctx.beginPath()
    ctx.moveTo(cx, top_y)
    ctx.bezierCurveTo(
      cx + k_upper_out,
      top_y,
      cx + cheek_x,
      cheek_y - k_upper_vert,
      cx + cheek_x,
      cheek_y,
    )
    ctx.bezierCurveTo(cx + cheek_x, cheek_y + k_lower_vert, cx + k_lower_in, bottom_y, cx, bottom_y)
    ctx.bezierCurveTo(
      cx - k_lower_in,
      bottom_y,
      cx - cheek_x,
      cheek_y + k_lower_vert,
      cx - cheek_x,
      cheek_y,
    )
    ctx.bezierCurveTo(cx - cheek_x, cheek_y - k_upper_vert, cx - k_upper_out, top_y, cx, top_y)
    ctx.closePath()
  }

  /**
   * 측면 얼굴 가이드 — 사용자가 외부 SVG path editor 로 그린 좌표를 그대로 사용.
   * SVG path 의 bbox 중심을 (cx, cy) 에 매핑하고 face_h 비례로 스케일.
   * sign 으로 좌우 반전 (canvas scaleX(-1) 반전 보정).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} face_w           (현재 미사용 — SVG path 자체 비율 유지)
   * @param {number} face_h
   * @param {1 | -1} sign
   */

  function draw_side_face_path(ctx, cx, cy, face_w, face_h, sign) {
    // SVG path 좌표 — 사용자가 외부 editor 에서 그려준 d 문자열을 그대로 변환.
    // bbox: x ∈ [228, 401], y ∈ [21, 238] — 가로 173, 세로 217. 비례 ≈ 0.8:1 (얼굴 비례와 유사).
    const SVG_CX = 314.5
    const SVG_CY = 129.5
    const SVG_H = 217
    const scale = face_h / SVG_H

    // SVG path 에서 코가 svg_x 작은 쪽(좌측) 에 위치하므로, sign 부호를 반전해
    // sign=+1 (right_profile) 일 때 캔버스 +x (우측) 가 머리, -x (좌측) 가 코가 되도록 매핑.
    /** @param {number} svg_x */
    const Xc = (svg_x) => cx - sign * (svg_x - SVG_CX) * scale
    /** @param {number} svg_y */
    const Yc = (svg_y) => cy + (svg_y - SVG_CY) * scale

    // 디버그 색상 모드 — true 면 segment 별 다른 색, false 면 g_guide_color 단색 + 외부 dash 유지.
    const SEGMENT_DEBUG_COLOR = false

    ctx.save()

    /**
     * 한 segment 를 지정 색으로 stroke.
     * @param {string} color
     * @param {() => void} build_path
     */
    const stroke_seg = (color, build_path) => {
      ctx.strokeStyle = SEGMENT_DEBUG_COLOR ? color : g_guide_color
      ctx.beginPath()
      build_path()
      ctx.stroke()
    }

    // M (323, 22) — 시작점
    // 1. C 367 23 401 55 → (401, 92)
    stroke_seg('#ff3b30', () => {
      ctx.moveTo(Xc(323), Yc(22))
      ctx.bezierCurveTo(Xc(367), Yc(23), Xc(401), Yc(55), Xc(401), Yc(92))
    })
    // 2. C 401 116 392 136 → (384, 157)
    stroke_seg('#ff9500', () => {
      ctx.moveTo(Xc(401), Yc(92))
      ctx.bezierCurveTo(Xc(401), Yc(116), Xc(392), Yc(136), Xc(384), Yc(157))
    })
    // 3. C 376 177 367 197 → (367, 221)
    stroke_seg('#ffcc00', () => {
      ctx.moveTo(Xc(384), Yc(157))
      ctx.bezierCurveTo(Xc(376), Yc(177), Xc(367), Yc(197), Xc(367), Yc(221))
    })
    // 4. L → (367, 238)
    stroke_seg('#34c759', () => {
      ctx.moveTo(Xc(367), Yc(221))
      ctx.lineTo(Xc(367), Yc(238))
    })
    // 5. L → (315, 238)
    stroke_seg('#00c7be', () => {
      ctx.moveTo(Xc(367), Yc(238))
      ctx.lineTo(Xc(315), Yc(238))
    })
    // 6. C 306 238 299 232 → (299, 223)
    stroke_seg('#007aff', () => {
      ctx.moveTo(Xc(315), Yc(238))
      ctx.bezierCurveTo(Xc(306), Yc(238), Xc(299), Yc(232), Xc(299), Yc(223))
    })
    // 7. L → (299, 196)
    stroke_seg('#5856d6', () => {
      ctx.moveTo(Xc(299), Yc(223))
      ctx.lineTo(Xc(299), Yc(196))
    })
    // 8. C 289 196 279 196 → (270, 196)
    stroke_seg('#af52de', () => {
      ctx.moveTo(Xc(299), Yc(196))
      ctx.bezierCurveTo(Xc(289), Yc(196), Xc(279), Yc(196), Xc(270), Yc(196))
    })
    // 9. C 257 196 247 189 → (250, 174)
    stroke_seg('#ff2d55', () => {
      ctx.moveTo(Xc(270), Yc(196))
      ctx.bezierCurveTo(Xc(257), Yc(196), Xc(247), Yc(189), Xc(250), Yc(174))
    })
    // 10. C 242 169 241 161 → (240, 154)
    stroke_seg('#a2845e', () => {
      ctx.moveTo(Xc(250), Yc(174))
      ctx.bezierCurveTo(Xc(242), Yc(169), Xc(241), Yc(161), Xc(240), Yc(154))
    })
    // 11. C 231 151 228 145 → (233, 138)
    stroke_seg('#8e8e93', () => {
      ctx.moveTo(Xc(240), Yc(154))
      ctx.bezierCurveTo(Xc(231), Yc(151), Xc(228), Yc(145), Xc(233), Yc(138))
    })
    // 12. L → (248, 117)
    stroke_seg('#ffd60a', () => {
      ctx.moveTo(Xc(233), Yc(138))
      ctx.lineTo(Xc(248), Yc(117))
    })
    // 13. C 250 114 250 111 → (250, 107)
    stroke_seg('#30d158', () => {
      ctx.moveTo(Xc(248), Yc(117))
      ctx.bezierCurveTo(Xc(250), Yc(114), Xc(250), Yc(111), Xc(250), Yc(107))
    })
    // 14. L → (250, 92)
    stroke_seg('#5ac8fa', () => {
      ctx.moveTo(Xc(250), Yc(107))
      ctx.lineTo(Xc(250), Yc(92))
    })
    // 15. C 250 51 282 21 → (323, 22) — Z (시작점 닫음)
    stroke_seg('#3a3a3c', () => {
      ctx.moveTo(Xc(250), Yc(92))
      ctx.bezierCurveTo(Xc(250), Yc(51), Xc(282), Yc(21), Xc(323), Yc(22))
    })

    ctx.restore()
  }

  /**
   * 재측정을 위해 안정화 상태를 초기화한다.
   * 외부에서 `bind:this` 로 참조해 호출하면 자동 스텝에서 `oncapture` 가 다시 발사되거나,
   * 수동 스텝에서 `trigger_capture()` 호출이 다시 수락되도록 재장전된다.
   */
  export function reset() {
    if (g_capture_timeout !== null) {
      clearTimeout(g_capture_timeout)
      g_capture_timeout = null
    }
    g_capture_sequence_token += 1
    stop_voice()
    g_already_dispatched = false
    g_buffer_arr = []
    g_stable_count = 0
    g_stability_audio_stage = 'idle'
    g_did_announce_in_progress = false
    g_did_play_step_intro = false
    profile_pose.reset()
  }

  /**
   * yaw/pitch/roll 각도 진행 바의 색상과 너비를 계산한다.
   * @param {number} value
   * @param {number} threshold
   */
  function angle_style(value, threshold) {
    const ok = Math.abs(value) < threshold
    const width_pct = Math.min(100, (Math.abs(value) / threshold) * 100)
    const track_bg = ok ? 'rgba(0,200,83,0.15)' : 'rgba(220,53,69,0.15)'
    const fill_bg = ok ? '#00c853' : '#dc3545'
    const text_color = ok ? '#34d399' : '#f87171'
    return { ok, width_pct, track_bg, fill_bg, text_color }
  }

  const g_yaw_style = $derived(angle_style(g_frontal_obj?.yaw ?? 0, YAW_THR))
  const g_pitch_style = $derived(angle_style(g_frontal_obj?.pitch ?? 0, PITCH_THR))
  const g_roll_style = $derived(angle_style(g_frontal_obj?.roll ?? 0, ROLL_THR))

  /**
   * 측면 yaw 각도 진행 바 — 목표(±90°) 까지 가까워질수록 채움.
   * angle_style 과 의미가 반대 (정면: 0 에 가까울수록 ok / 측면: target 에 가까울수록 ok).
   * @param {number | null} yaw
   * @param {number} target_deg
   */
  function profile_yaw_style(yaw, target_deg) {
    if (yaw === null) {
      return {
        ok: false,
        width_pct: 0,
        track_bg: 'rgba(255,255,255,0.1)',
        fill_bg: '#9ca3af',
        text_color: '#9ca3af',
      }
    }
    const distance = Math.abs(yaw - target_deg)
    const ok = distance < 10 // PROFILE_CONSTANTS.TOLERANCE — 직접 import 안 하고 fixed value (UI 영역)
    // 0° 부터 ±90° 까지 0–100% 진행. 사용자가 정면(0°)→측면(target) 으로 회전 정도를 직관 시각화.
    const progress = Math.max(0, Math.min(100, (1 - distance / 90) * 100))
    const track_bg = ok ? 'rgba(0,200,83,0.15)' : 'rgba(255,193,7,0.15)'
    const fill_bg = ok ? '#00c853' : '#ffc107'
    const text_color = ok ? '#34d399' : '#fbbf24'
    return { ok, width_pct: progress, track_bg, fill_bg, text_color }
  }

  const g_profile_yaw_style = $derived.by(() => {
    const target = pose_target === 'right_profile' ? +90 : -90
    return profile_yaw_style(profile_pose.last_yaw, target)
  })

  // pitch / roll 은 정면용 angle_style 그대로 사용 — 0 에서 멀어질수록 'not ok'. 측면 자세에서도
  // 사용자 머리가 위/아래/기울어짐 없이 수평으로 돌아가는 게 이상적이라 같은 의미로 적용 가능.
  // 단 측면(yaw≈±90°) 에서 ZYX Euler 분해의 pitch 는 gimbal lock 으로 ±180° 부근까지 튐 — 화면에는
  // 회전행렬에서 직접 사영한 image_plane_tilt(특이점 무관, 정자세=0°) 를 대신 노출.
  //
  // Dead zone: 정자세 유지 시 모델 R jitter 로 ±1° 안쪽 흔들림이 남는다. 표시값에만 dead band
  // 적용해 |값| < 1° 면 0° 로 잠금. 캡처 시점 동결되는 raw last_image_tilt 는 그대로 사용해 보정
  // 정확도 유지.
  const IMAGE_TILT_DEADBAND_DEG = 1.0
  const g_image_tilt_display = $derived.by(() => {
    const v = profile_pose.last_image_tilt
    if (v === null) return 0
    return Math.abs(v) < IMAGE_TILT_DEADBAND_DEG ? 0 : v
  })
  const g_profile_pitch_style = $derived(angle_style(g_image_tilt_display, PITCH_THR))
  const g_profile_roll_style = $derived(angle_style(profile_pose.last_roll ?? 0, ROLL_THR))
</script>

<div class="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
  <!--
    좌우 빈 영역까지 진짜 카메라 시야로 채우기 위해 가로형(1280×720) stream 을 가로 영역 전체에
    object-cover 로 fill. 분석/캡처는 가운데 3:4 영역만 처리하지만, 사용자에게는 카메라가 잡고 있는
    더 넓은 시야가 시각적으로 노출 — 자연스러운 fill.
  -->
  <video
    bind:this={ref_this_backdrop_video_el}
    class="pointer-events-none absolute inset-0 h-full w-full object-cover"
    style="transform: scaleX(-1);"
    aria-hidden="true"
    playsinline
    autoplay
    muted
  ></video>
  <!--
    가운데 3:4 wrapper — 실제 캡처되는 영역. 같은 stream 을 한번 더 깔지만 좌표계 정합 (canvas
    overlay·가이드 타원이 이 영역 안에 그려짐) 을 위해 분리.
  -->
  <div class="relative aspect-[3/4] h-full overflow-hidden bg-black">
    <video
      bind:this={ref_this_video_el}
      class="absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
      playsinline
      autoplay
      muted
    ></video>
    <canvas
      bind:this={ref_this_canvas_el}
      class:hidden={!show_overlay}
      class="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1);"
    ></canvas>

    {#if g_init_error}
      <div
        class="absolute left-2.5 right-2.5 top-2.5 z-20 rounded-lg border border-red-500 bg-zinc-900/90 p-3 text-sm font-semibold text-red-400 backdrop-blur-sm"
      >
        <p>{g_init_error}</p>
        {#if g_permission_denied}
          <p class="mt-1 text-xs font-normal text-zinc-400">
            브라우저 주소창의 잠금 아이콘에서 카메라 접근을 허용해 주세요.
          </p>
        {/if}
      </div>
    {/if}

    {#if show_overlay && active && g_face_detected && g_measurements_obj}
      <div
        class="pointer-events-none absolute left-2.5 top-2.5 z-10 grid grid-cols-[auto_auto] gap-x-2.5 gap-y-0.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] tabular-nums text-zinc-200 backdrop-blur-sm"
        aria-live="polite"
      >
        <span class="text-white/65">너비</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.face_width}</b
        >
        <span class="text-white/65">높이</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.face_height}</b
        >
        <span class="text-white/65">눈간</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.eye_distance}</b
        >
        <span class="text-white/65">PD</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.pd_pixels}</b
        >
        <span class="text-white/65">코</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.nose_width}</b
        >
        <span class="text-white/65">턱</span><b class="text-right font-bold text-emerald-300"
          >{g_measurements_obj.jaw_width}</b
        >
      </div>
    {/if}

    {#if show_overlay && active && pose_target === 'front' && g_face_detected && g_frontal_obj && !g_frontal_obj.is_frontal}
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse text-[7rem] leading-none text-orange-400 drop-shadow-[0_2px_16px_rgba(0,0,0,0.65)]"
        aria-hidden="true"
      >
        {#if g_frontal_obj.reason === 'yaw'}
          {g_frontal_obj.yaw > 0 ? '→' : '←'}
        {:else if g_frontal_obj.reason === 'pitch'}
          {g_frontal_obj.pitch > 0 ? '↑' : '↓'}
        {:else if g_frontal_obj.reason === 'roll'}
          {g_frontal_obj.roll > 0 ? '↺' : '↻'}
        {/if}
      </div>
    {/if}

    <!--
      측면 단계 화살표 안내 — yaw 가 target ± TOLERANCE 영역 밖이면 target 방향으로 회전하라는
      화살표 표시. 영역 안이면 숨김. compute_target_deg 부호 규약 (left_profile=+90, right_profile=-90)
      과 음성 안내 (좌→오른쪽, 우→왼쪽) 와 일치. 오버슈트 시 반대 화살표로 되돌림 안내.
    -->
    {#if show_overlay && active && pose_target !== 'front' && profile_pose.session_ready && profile_pose.last_yaw !== null && !g_already_dispatched}
      {@const local_arrow_target_deg = compute_target_deg(pose_target)}
      {@const local_arrow_distance = Math.abs(profile_pose.last_yaw - local_arrow_target_deg)}
      {#if local_arrow_distance >= PROFILE_CONSTANTS.TOLERANCE}
        <div
          class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse text-[7rem] leading-none text-orange-400 drop-shadow-[0_2px_16px_rgba(0,0,0,0.65)]"
          aria-hidden="true"
        >
          {profile_pose.last_yaw < local_arrow_target_deg ? '→' : '←'}
        </div>
      {/if}
    {/if}

    {#if show_overlay && active && pose_target === 'front' && g_face_detected && g_frontal_obj}
      <div
        class="pointer-events-none absolute right-2.5 top-2.5 z-10 flex w-44 flex-col gap-1.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">좌우</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_yaw_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_yaw_style.width_pct}%; background: {g_yaw_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_yaw_style.text_color};"
          >
            {g_frontal_obj.yaw.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">상하</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_pitch_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_pitch_style.width_pct}%; background: {g_pitch_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_pitch_style.text_color};"
          >
            {g_frontal_obj.pitch.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">기울기</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_roll_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_roll_style.width_pct}%; background: {g_roll_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_roll_style.text_color};"
          >
            {g_frontal_obj.roll.toFixed(1)}°
          </span>
        </div>
      </div>
    {/if}

    <!--
      측면 단계 한정 6D 각도 인디케이터 (yaw/pitch/roll) — 정면의 좌우/상하/기울기 패널과
      같은 위치/스타일. 모델이 반환하는 3축을 그대로 표시. 좌우(yaw) 만 stable 판정에 사용되고
      상하(pitch)/기울기(roll) 는 참고 표시. session_ready 이전엔 노출 안 함.
    -->
    {#if show_overlay && active && pose_target !== 'front' && profile_pose.session_ready && profile_pose.last_yaw !== null && !g_already_dispatched}
      <div
        class="pointer-events-none absolute right-2.5 top-2.5 z-10 flex w-44 flex-col gap-1.5 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-[11px] backdrop-blur-sm"
        aria-live="polite"
        aria-label="측면 자세 각도"
      >
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">좌우</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_profile_yaw_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_profile_yaw_style.width_pct}%; background: {g_profile_yaw_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_profile_yaw_style.text_color};"
          >
            {profile_pose.last_yaw.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">상하</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_profile_pitch_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_profile_pitch_style.width_pct}%; background: {g_profile_pitch_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_profile_pitch_style.text_color};"
          >
            {g_image_tilt_display.toFixed(1)}°
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 font-semibold text-white/65">기울기</span>
          <div
            class="h-1.5 flex-1 overflow-hidden rounded-sm"
            style="background: {g_profile_roll_style.track_bg};"
          >
            <div
              class="h-full transition-[width]"
              style="width: {g_profile_roll_style.width_pct}%; background: {g_profile_roll_style.fill_bg};"
            ></div>
          </div>
          <span
            class="w-12 text-right font-bold tabular-nums"
            style="color: {g_profile_roll_style.text_color};"
          >
            {(profile_pose.last_roll ?? 0).toFixed(1)}°
          </span>
        </div>
      </div>
    {/if}

    <!--
      측면 단계 한정 진행률 게이지. composable 이 yaw 영역 진입을 감지해 진행률 누적.
      test.svelte 의 g_capture_progress 게이지와 동일 디자인 — 시각 일관성.
      g_already_dispatched 면 캡처 완료 후라 노출 불필요.
    -->
    {#if pose_target !== 'front' && profile_pose.progress > 0 && !g_already_dispatched}
      <div
        class="pointer-events-none absolute bottom-3 left-1/2 z-10 flex w-56 -translate-x-1/2 flex-col gap-1
               rounded-lg border border-emerald-400/50 bg-black/65 px-3 py-2 text-[12px] backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="flex items-baseline justify-between text-emerald-300">
          <span class="font-bold">측면 자세 유지 중</span>
          <span class="tabular-nums">{Math.round(profile_pose.progress)}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-sm bg-emerald-900/50">
          <div
            class="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
            style="width: {profile_pose.progress}%;"
          ></div>
        </div>
      </div>
    {/if}

    <!--
      정면 단계 진행률 게이지 — 측면과 동일 디자인. 정면 영역 진입(g_front_in_zone) 시점부터
      face dimension std 기반 g_stability_progress 노출. dispatched 후엔 숨김. 위치는 하단 중앙.
    -->
    {#if pose_target === 'front' && g_front_in_zone && g_stability_progress > 0 && !g_already_dispatched}
      <div
        class="pointer-events-none absolute bottom-3 left-1/2 z-10 flex w-56 -translate-x-1/2 flex-col gap-1
               rounded-lg border border-emerald-400/50 bg-black/65 px-3 py-2 text-[12px] backdrop-blur-sm"
        aria-live="polite"
      >
        <div class="flex items-baseline justify-between text-emerald-300">
          <span class="font-bold">정면 자세 유지 중</span>
          <span class="tabular-nums">{g_stability_progress}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-sm bg-emerald-900/50">
          <div
            class="h-full bg-emerald-400 transition-[width] duration-200 ease-out"
            style="width: {g_stability_progress}%;"
          ></div>
        </div>
      </div>
    {/if}

    {#if show_overlay && active && g_hint_text}
      <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <span
          class="inline-block whitespace-nowrap rounded-full border-[1.5px] px-4 py-2 text-sm font-bold backdrop-blur-sm"
          style={g_badge_style}
        >
          {g_hint_text}
        </span>
      </div>
    {/if}
  </div>
</div>
