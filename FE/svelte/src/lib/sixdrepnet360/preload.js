/**
 * 6DRepNet360 ONNX 모델 사전 다운로드 유틸. 스플래시에서 호출해 진행률을 보고하고
 * 받은 바이트를 그대로 반환 — 호출자는 inference.js 의 warm_session_from_bytes() 에
 * 이 바이트를 넘겨 InferenceSession 을 만든다. ort 가 URL 을 다시 fetch 하지 않으므로
 * 같은 .onnx 를 두 번 다운로드하지 않는 단일 다운로드 흐름을 보장.
 *
 * @typedef {'fp32' | 'dynamic' | 'static'} ModelVariant
 * @typedef {{ received: number, total: number, ratio: number }} PreloadProgress
 */

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
 * Uint8Array 로 결합해 반환한다.
 * @param {ModelVariant} variant
 * @param {(progress_obj: PreloadProgress) => void} [on_progress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Uint8Array>}
 */
export async function preload_sixdrepnet_model(variant, on_progress, signal) {
  const local_url = build_model_url(variant)
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
  return local_bytes
}
