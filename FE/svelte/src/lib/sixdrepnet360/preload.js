/**
 * 6DRepNet360 ONNX 모델 사전 다운로드 유틸. 스플래시에서 호출해 진행률을 보고하고
 * 받은 바이트를 그대로 반환 — 호출자는 inference.js 의 warm_session_from_bytes() 에
 * 이 바이트를 넘겨 InferenceSession 을 만든다. ort 가 URL 을 다시 fetch 하지 않으므로
 * 같은 .onnx 를 두 번 다운로드하지 않는 단일 다운로드 흐름을 보장.
 *
 * 추가로 model_cache.js 의 Cache Storage 레이어를 통과해 reload 간에도 모델 바이트를
 * 영구 보존 — 첫 진입에서만 네트워크 fetch, 이후 주소창 입력 / F5 / Ctrl+R 모두 즉시 반환.
 *
 * @typedef {'fp32' | 'dynamic' | 'static'} ModelVariant
 * @typedef {{ received: number, total: number, ratio: number }} PreloadProgress
 */

import { get_cached_model_response, store_model_response } from './model_cache.js'

// inference.js 의 VARIANT_FILES_OBJ 와 동기
const VARIANT_FILES_OBJ = {
  fp32: '6drepnet360.onnx',
  dynamic: '6drepnet360.int8.dynamic.onnx',
  static: '6drepnet360.int8.static.onnx',
}

// variant → 모델 파일 URL을 의미
function build_model_url(variant) {
  return `${import.meta.env.BASE_URL}models/sixdrepnet360/${VARIANT_FILES_OBJ[variant]}`
}

/**
 * 모델 파일을 fetch 스트리밍으로 받으며 진행률 콜백을 호출하고, 모든 청크를 단일
 * Uint8Array 로 결합해 반환한다. Cache Storage 에 동일 URL 의 응답이 이미 있으면
 * 네트워크 없이 즉시 반환.
 * @param {ModelVariant} variant
 * @param {(progress_obj: PreloadProgress) => void} [on_progress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Uint8Array>}
 */
export async function preload_sixdrepnet_model(variant, on_progress, signal) {
  const local_url = build_model_url(variant)

  // 영구 캐시 hit — 네트워크 0, 진행률은 100% 로 한 번 통지하고 종료
  const local_cached = await get_cached_model_response(local_url)
  if (local_cached) {
    const local_buf = await local_cached.arrayBuffer()
    const local_bytes = new Uint8Array(local_buf)
    on_progress?.({
      received: local_bytes.byteLength,
      total: local_bytes.byteLength,
      ratio: 1,
    })
    return local_bytes
  }

  // cache miss — 네트워크 fetch
  const local_response = await fetch(local_url, { signal })

  if (!local_response.ok) {
    throw new Error(`모델 다운로드 실패 (HTTP ${local_response.status})`)
  }

  // SPA fallback HTML 응답을 false-success 로 처리하지 않도록 차단
  const local_content_type = local_response.headers.get('Content-Type') ?? ''
  if (local_content_type.includes('text/html')) {
    throw new Error('모델 파일을 찾을 수 없습니다.')
  }

  if (!local_response.body) {
    throw new Error('스트리밍 응답을 사용할 수 없습니다.')
  }

  // 스트리밍이 원본 body 를 소비하므로 캐시용으로 미리 clone — clone 은 독립된 body stream 보유
  const local_cache_clone = local_response.clone()

  const local_total = Number(local_response.headers.get('Content-Length')) || 0
  const local_reader = local_response.body.getReader()
  /** @type {Uint8Array[]} */
  const local_chunks_arr = []
  let local_received = 0

  on_progress?.({ received: 0, total: local_total, ratio: 0 })

  while (true) {
    const { done, value } = await local_reader.read()
    if (done) break

    local_chunks_arr.push(value)
    local_received += value.byteLength
    on_progress?.({
      received: local_received,
      total: local_total,
      ratio: local_total > 0 ? local_received / local_total : 0,
    })
  }

  // 청크 결합 — InferenceSession.create 가 단일 buffer 를 요구. 결합 직후 chunks 는 GC 대상.
  const local_bytes = new Uint8Array(local_received)
  let local_offset = 0
  for (const chunk of local_chunks_arr) {
    local_bytes.set(chunk, local_offset)
    local_offset += chunk.byteLength
  }

  // 다운로드 성공 후 캐시 저장 — fire-and-forget. 실패(디스크 부족 등) 해도 호출자 영향 X
  store_model_response(local_url, local_cache_clone).catch(() => {})

  return local_bytes
}
