/**
 * 음성 가이드 — 카메라 촬영 페이지 전반에서 공유하는 단일 audio 채널.
 *
 * 우선순위:
 * - 'low'  : 자세 교정 / 인식 진행 안내 — 진행 중이면 무시 (재생 중 자기를 끊지 않는다).
 * - 'high' : 셔터 / 단계 완료 / 전체 완료 안내 — 진행 중인 'low' 안내를 인터럽트하고 재생.
 *
 * 1회성 키 (start_capture, capture_complete) 는 reset_session() 호출 전까지 한 번만 재생.
 * 이는 camera_view 의 step 전환마다 발생하는 reset() 가 호출하지 않는다 — 세션 단위로만 리셋.
 *
 * 동일 키를 짧은 간격에 다시 호출하면 REPEAT_DEBOUNCE_MS 안에서는 무시 — 이펙트 다중 트리거에 대비.
 */

/** @typedef {(
 *   'camera_shutter_sound'
 *   | 'right_side_capture_complete'
 *   | 'left_side_capture_complete'
 *   | 'front_side_capture_complete'
 *   | 'capture_complete'
 *   | 'turn_head_right_for_left_capture'
 *   | 'turn_left_for_right_capture'
 *   | 'center_face_for_front_capture'
 *   | 'face_recognition_in_progress'
 *   | 'start_face_recognition'
 *   | 'face_recognition_complete'
 *   | 'start_capture'
 *   | 'head_center'
 *   | 'head_right'
 *   | 'head_left'
 * )} VoiceGuideKey */

const REPEAT_DEBOUNCE_MS = 1200
const ONCE_KEYS = new Set(['start_capture', 'capture_complete'])

/** @type {HTMLAudioElement | null} */
let g_active_audio = null
/** @type {'low' | 'high' | null} */
let g_active_priority = null
/** @type {Promise<void> | null} */
let g_active_promise = null
/** @type {VoiceGuideKey | null} */
let g_last_key = null
let g_last_at = 0
/** @type {Set<VoiceGuideKey>} */
const g_played_once_set = new Set()

// 봉인 플래그 — true 이면 play() 가 즉시 false 반환하며 새 audio 를 만들지 않는다.
// 화면 이동 직전에 silence() 로 켜서, 이미 큐잉된 rAF/microtask 안의 fire-and-forget play 호출까지 모두 차단.
// camera_view 의 rAF 루프와 effect 들이 stop() 호출 직후 마이크로태스크 안에서 새 play_voice 를 또 시작해
// 이전 화면 음성이 result 화면으로 따라오는 race 를 막기 위함. reset_session() 가 해제한다.
let g_is_silenced = false

// 활성 audio 핸들을 정리. ended/pause 콜백이 동일 audio 에 한해 안전하게 호출되도록 분리.
function clear_active() {
  g_active_audio = null
  g_active_priority = null
  g_active_promise = null
}

/**
 * 음성 가이드를 1회 재생한다.
 * - priority='low' 가 진행 중이고 새 호출이 'high' 면, 진행 중인 음성을 끊고 새 음성 재생.
 * - 그 외 진행 중이면 무시.
 * - 1회성 키는 reset_session() 전까지 재호출되어도 무시.
 *
 * @param {VoiceGuideKey} key
 * @param {{ priority?: 'low' | 'high' }} [opts]
 * @returns {Promise<boolean>} 실제 재생되었으면 true (재생 종료 시점에 resolve).
 *                             무시(rejected/once-key/debounced) 면 false 즉시 resolve.
 */
export async function play(key, opts = {}) {
  if (typeof window === 'undefined') return false
  // 봉인 모드 — 어떤 priority 든 새 audio 를 만들지 않고 즉시 종료. silence() 호출 후 reset_session() 까지 유지.
  if (g_is_silenced) return false
  const priority = opts.priority ?? 'low'

  if (ONCE_KEYS.has(key) && g_played_once_set.has(key)) return false

  const now = Date.now()
  if (g_last_key === key && now - g_last_at < REPEAT_DEBOUNCE_MS) return false

  if (g_active_audio && !g_active_audio.paused && !g_active_audio.ended) {
    if (priority === 'high' && g_active_priority === 'low') {
      g_active_audio.pause()
      g_active_audio.currentTime = 0
      clear_active()
    } else {
      return false
    }
  }

  if (ONCE_KEYS.has(key)) g_played_once_set.add(key)

  const audio = new Audio(`/tts/${key}.mp3`)
  audio.preload = 'auto'
  g_active_audio = audio
  g_active_priority = priority
  g_last_key = key
  g_last_at = now

  const on_end_or_pause = () => {
    if (g_active_audio === audio) clear_active()
  }
  audio.addEventListener('ended', on_end_or_pause, { once: true })
  audio.addEventListener('pause', on_end_or_pause, { once: true })

  // 재생-종료까지의 promise 를 모듈 레벨에 저장 — wait_for_active() 가 이 promise 를 반환하여
  // 외부 호출자가 진행 중 음성의 종료 시점을 정확히 await 할 수 있게 한다.
  const playback_promise = (async () => {
    try {
      await audio.play()
      await new Promise((resolve) => {
        audio.addEventListener('ended', resolve, { once: true })
        audio.addEventListener('pause', resolve, { once: true })
        audio.addEventListener('error', resolve, { once: true })
      })
    } catch {
      if (g_active_audio === audio) clear_active()
    }
  })()
  g_active_promise = playback_promise

  await playback_promise
  return true
}

/**
 * 진행 중인 음성이 끝날 때까지 await 가능. 진행 중 없으면 즉시 resolve.
 * 호출자가 자기 음성을 재생하기 전에 앞 음성 종료를 보장하고 싶을 때 사용.
 * - audio 객체의 paused/ended 직접 검사로는 audio.play() 가 awaited 되기 직전 microtask 윈도우에서
 *   paused=true 로 잘못 인식되는 race 가 있어, play() 가 끝까지 기다리는 promise 를 그대로 반환.
 *
 * @returns {Promise<void>}
 */
export function wait_for_active() {
  return g_active_promise ?? Promise.resolve()
}

// 진행 중인 음성을 즉시 정지. step 전환 / 카메라 정지 시 호출.
// 1회성 플래그는 보존 — reset_session() 만 초기화한다.
export function stop() {
  if (!g_active_audio) return
  g_active_audio.pause()
  g_active_audio.currentTime = 0
  clear_active()
}

// 음성 채널을 완전히 봉인 — 진행 중 음성 정지 + 이후 play() 호출 모두 거부.
// 화면 이탈 직전(예: real_fitting 의 "최종 리포트 보기" 클릭) 에 호출해서, rAF/microtask 잔여 큐가
// 깨어나 새 audio 를 만들어 다음 화면까지 끌고 가는 race 를 차단한다.
// 새 캡처 세션(reset_session) 진입 전까진 어떤 호출자도 voice 재생을 시작할 수 없다.
export function silence() {
  stop()
  g_is_silenced = true
}

// 봉인 해제 — 카메라 페이지에 (재)진입할 때 호출해 음성 재생을 다시 허용한다.
// 이전 페이지가 silence() 로 봉인해둔 상태라도, 이 페이지에서는 CameraView 음성이 정상 작동해야 하므로.
export function unsilence() {
  g_is_silenced = false
}

// 새 촬영 세션 시작 시 호출 — 1회성 키 플래그와 디바운스 상태를 초기화한다.
// camera_view 의 reset() 와 다른 레벨 (세션 단위) — step 전환마다 부르면 안 된다.
// 봉인 플래그(silence) 도 함께 해제해 새 세션에서 음성이 정상 재생되도록 한다.
export function reset_session() {
  stop()
  g_is_silenced = false
  g_played_once_set.clear()
  g_last_key = null
  g_last_at = 0
}
