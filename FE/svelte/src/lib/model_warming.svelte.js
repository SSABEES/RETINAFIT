/**
 * AI 모델 워밍(다운로드 + 컴파일 + 검출기 init) 전역 상태 + 백그라운드 실행 모듈.
 *
 * 디자인 의도:
 *   - 첫 진입 (cache miss) → 다운로드만 splash UI 로 진행률 표시 (94MB 네트워크 대기 정당화)
 *   - 그 외 (cache hit, 컴파일, 검출기 init) → 사용자에게 보이지 않게 백그라운드 진행
 *   - 결과: 캐시 있는 사용자(=2번째 방문 이후 모두) 는 splash 가 영영 안 뜸
 *
 * 흐름 (App.svelte onMount 가 start_warming() 호출):
 *   1) is_model_cached() 빠른 확인 → cache miss 일 때만 is_downloading = true
 *   2) preload_sixdrepnet_model — cache hit 0초 / miss 면 progress 보고
 *   3) is_downloading = false (splash UI 종료)
 *   4) warm_session_from_bytes — ort WASM 그래프 컴파일 (백그라운드)
 *   5) get_video_detector — BlazeFace 검출기 init (백그라운드)
 *   6) is_ready = true
 *
 * 모듈 단일 인스턴스라 start_warming 은 dedup 됨. 컴파일 실패 시 error_message 노출 후
 * splash 가 재시도 가능.
 */

import { preload_sixdrepnet_model, is_model_cached } from '@/lib/sixdrepnet360/preload.js'
import { warm_session_from_bytes, get_active_variant } from '@/lib/sixdrepnet360/inference.js'
import { get_video_detector } from '@/lib/mediapipe/face_detector.js'

/**
 * @typedef {{
 *   is_downloading: boolean,
 *   download_progress: { received: number, total: number, ratio: number },
 *   is_ready: boolean,
 *   error_message: string | null,
 *   stage_label: string,
 * }} WarmingState
 */

/** @type {WarmingState} */
export const warming_state = $state({
  is_downloading: false,
  download_progress: { received: 0, total: 0, ratio: 0 },
  is_ready: false,
  error_message: null,
  stage_label: 'AI 모델 준비 중...',
})

/** @type {Promise<void> | null} */
let g_warming_promise = null

/**
 * 모델 워밍을 한 번만 시작한다. 같은 호출은 진행 중인 promise 를 반환 (dedup).
 * 실패 후 retry 하려면 retry_warming() 사용.
 * @returns {Promise<void>}
 */
export function start_warming() {
  if (g_warming_promise) return g_warming_promise
  g_warming_promise = (async () => {
    warming_state.error_message = null
    warming_state.is_ready = false
    warming_state.is_downloading = false
    warming_state.download_progress = { received: 0, total: 0, ratio: 0 }

    try {
      const local_variant = get_active_variant()

      // cache 확인 — 다운로드가 필요한 경우만 splash UI 노출. cache hit 면 전 단계 백그라운드.
      const local_is_cached = await is_model_cached(local_variant)
      // 디버그 — 콘솔에 캐시 상태 / variant 노출. 캐시 hit 이라면 splash 가 떠선 안 됨.
      console.log('[model_warming]', {
        variant: local_variant,
        is_cached: local_is_cached,
        caches_supported: typeof caches !== 'undefined',
      })
      if (!local_is_cached) {
        warming_state.is_downloading = true
        warming_state.stage_label = 'AI 모델 다운로드 중...'
      }

      const local_bytes = await preload_sixdrepnet_model(local_variant, (progress_obj) => {
        warming_state.download_progress = progress_obj
      })

      warming_state.is_downloading = false

      // 컴파일 + 검출기 init 은 splash UI 없이 백그라운드. is_ready 가 true 가 되기 전에는
      // 모델을 직접 호출하는 추론 호출처에서 await 가능 (start_warming() 반환 promise 사용).
      warming_state.stage_label = 'AI 모델 컴파일 중...'
      await warm_session_from_bytes(local_variant, local_bytes)

      warming_state.stage_label = '얼굴 검출 모델 준비 중...'
      await get_video_detector()

      warming_state.is_ready = true
    } catch (local_error) {
      warming_state.is_downloading = false
      warming_state.error_message =
        local_error instanceof Error
          ? local_error.message
          : 'AI 모델 준비 중 오류가 발생했습니다.'
      // promise 를 비워 retry_warming 으로 다시 시도 가능하게 함
      g_warming_promise = null
    }
  })()
  return g_warming_promise
}

/** 에러 후 또는 사용자 retry 버튼으로 다시 시작. */
export function retry_warming() {
  g_warming_promise = null
  warming_state.error_message = null
  return start_warming()
}

/** splash skip 버튼용 — 워밍이 진행 중이라도 UI 만 닫고 백그라운드 계속. is_ready 는 별도. */
export function dismiss_warming_ui() {
  warming_state.is_downloading = false
  warming_state.error_message = null
}
