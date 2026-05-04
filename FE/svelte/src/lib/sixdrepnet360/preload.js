/**
 * 6DRepNet360 ONNX 모델 사전 다운로드 유틸리티.
 *
 * 앱 시작 시 스플래시 화면에서 호출하여 모델을 미리 받아두면, 카메라 페이지 진입 시
 * MediaPipe/onnxruntime 가 같은 URL 로 fetch 할 때 HTTP 캐시에서 즉시 로드된다.
 *
 * 임시 경로는 현재 inference.js 와 동일한 same-origin (`${BASE_URL}models/sixdrepnet360/`).
 * 나중에 EC2 reverse proxy 가 설정되어도 FE 변경 없이 동작한다.
 *
 * @typedef {'fp32' | 'dynamic' | 'static'} ModelVariant
 *
 * @typedef {object} PreloadProgress
 * @property {number} received  지금까지 수신한 바이트 수
 * @property {number} total     전체 바이트 수 (Content-Length 미제공 시 0)
 * @property {number} ratio     0~1 진행률 (total 0 이면 0)
 */

// inference.js 의 VARIANT_FILES_OBJ 와 동기 — 변경 시 두 곳을 함께 업데이트할 것.
const VARIANT_FILES_OBJ = {
  fp32: '6drepnet360.onnx',
  dynamic: '6drepnet360.int8.dynamic.onnx',
  static: '6drepnet360.int8.static.onnx',
}

// variant → 모델 파일 URL.
function build_model_url(variant) {
  return `${import.meta.env.BASE_URL}models/sixdrepnet360/${VARIANT_FILES_OBJ[variant]}`
}

/**
 * 지정 variant 의 모델 파일을 fetch 로 미리 받아 HTTP 캐시에 저장한다.
 * 진행률 콜백을 통해 스플래시 UI 와 연동한다.
 *
 * @param {ModelVariant} variant
 * @param {(progress_obj: PreloadProgress) => void} [on_progress]
 * @param {AbortSignal} [signal]  취소 토큰 (스플래시 unmount 시 abort)
 * @returns {Promise<void>}       성공 시 void, 실패 시 throw
 */
export async function preload_sixdrepnet_model(variant, on_progress, signal) {
  const local_url = build_model_url(variant)
  const local_response = await fetch(local_url, { signal })

  if (!local_response.ok) {
    throw new Error(`모델 다운로드 실패 (HTTP ${local_response.status})`)
  }

  // Vite 개발 서버는 존재하지 않는 정적 파일 요청에 SPA fallback 으로 index.html(200 OK) 을
  // 반환해 fetch 가 "성공"으로 인식될 수 있다. Content-Type 으로 HTML 응답을 걸러내 모델 파일
  // 부재를 명확히 에러로 노출한다.
  const local_content_type = local_response.headers.get('Content-Type') ?? ''
  if (local_content_type.includes('text/html')) {
    throw new Error('모델 파일을 찾을 수 없습니다 (서버가 HTML 을 반환했습니다).')
  }

  if (!local_response.body) {
    throw new Error('스트리밍 응답을 사용할 수 없어 진행률 추적이 불가합니다.')
  }

  const local_total = Number(local_response.headers.get('Content-Length')) || 0
  const local_reader = local_response.body.getReader()
  let local_received = 0

  on_progress?.({ received: 0, total: local_total, ratio: 0 })

  while (true) {
    const { done, value } = await local_reader.read()
    if (done) break

    local_received += value.byteLength
    on_progress?.({
      received: local_received,
      total: local_total,
      ratio: local_total > 0 ? local_received / local_total : 0,
    })
  }
}
