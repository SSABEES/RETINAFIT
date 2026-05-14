/**
 * MediaPipe BlazeFace tflite 모델 바이트의 영구 캐시 레이어 (Cache Storage API).
 *
 * 동기: 측면 캡쳐용 BlazeFace 검출기가 새로고침마다 tflite 를 다시 가져오는 왕복을 제거.
 * sixdrepnet360 의 model_cache.js 와 동일한 패턴 — 캐시 이름만 분리해 같은 origin 의
 * 다른 모델 캐시와 충돌 방지.
 *
 * 한계: WASM 파일들(vision_wasm_internal.{js,wasm}) 은 MediaPipe FilesetResolver 가
 * 내부에서 fetch 해 외부에서 가로챌 수 없음 — 그 부분은 브라우저 HTTP 캐시에 맡김.
 * tflite (~3-4MB) 만 본 모듈에서 캐싱하고, createFromOptions 에 modelAssetBuffer 로 넘김.
 *
 * 보안 컨텍스트: Cache Storage 는 secure context (HTTPS 또는 localhost) 에서만 사용 가능.
 * 비-secure 컨텍스트에선 caches 가 undefined 라 가드를 통과한 뒤 일반 fetch 로 fallback.
 */

const CACHE_NAME = 'blaze-face-models-v1'

function is_cache_supported() {
  return typeof caches !== 'undefined'
}

/**
 * 주어진 URL 의 캐시 Response 조회. 없으면 null.
 * @param {string} url
 * @returns {Promise<Response | null>}
 */
export async function get_cached_blaze_face_response(url) {
  if (!is_cache_supported()) return null
  const local_cache = await caches.open(CACHE_NAME)
  const local_cached_response = await local_cache.match(url)
  return local_cached_response ?? null
}

/**
 * Response 를 캐시에 저장. 호출자는 본문 미소비 상태(=clone) 의 Response 를 전달해야 함.
 * @param {string} url
 * @param {Response} response
 * @returns {Promise<void>}
 */
export async function store_blaze_face_response(url, response) {
  if (!is_cache_supported()) return
  try {
    const local_cache = await caches.open(CACHE_NAME)
    await local_cache.put(url, response)
  } catch {
    // best-effort — quota 초과 등 silent. 호출자 흐름 안 깸.
  }
}

/**
 * tflite 모델 바이트를 cache 우선으로 받아온다. cache miss 시 네트워크 fetch 후 fire-and-forget
 * 저장하고 바이트는 즉시 반환. createFromOptions 의 modelAssetBuffer 로 그대로 넘길 수 있다.
 *
 * @param {string} url
 * @returns {Promise<Uint8Array>}
 */
export async function fetch_blaze_face_model_bytes(url) {
  // 영구 캐시 hit — 네트워크 0
  const local_cached = await get_cached_blaze_face_response(url)
  if (local_cached) {
    const local_buf = await local_cached.arrayBuffer()
    return new Uint8Array(local_buf)
  }

  // cache miss — fetch + 저장
  const local_response = await fetch(url)
  if (!local_response.ok) {
    throw new Error(`BlazeFace 모델 다운로드 실패 (HTTP ${local_response.status})`)
  }
  const local_content_type = local_response.headers.get('Content-Type') ?? ''
  if (local_content_type.includes('text/html')) {
    throw new Error('BlazeFace 모델 파일을 찾을 수 없습니다.')
  }

  // 본문은 곧 arrayBuffer 로 소비하므로 저장용으로 미리 clone — 독립 stream 확보
  const local_cache_clone = local_response.clone()
  store_blaze_face_response(url, local_cache_clone).catch(() => {})

  const local_buf = await local_response.arrayBuffer()
  return new Uint8Array(local_buf)
}

/** @type {Promise<void> | null} */
let g_ensure_promise = null

/**
 * Cache 가 비어있는지 점검하고 비어있으면 백그라운드 fetch + 저장. sixdrepnet 의 ensure_cache_warm 동일 패턴.
 * SPA 라우트 이동마다 fire-and-forget 호출해 외부에서 cache 가 삭제됐을 때 다음 reload 의 cold start 차단.
 *
 * @param {string} url
 * @returns {Promise<void>}
 */
export function ensure_blaze_face_cache_warm(url) {
  if (!is_cache_supported()) return Promise.resolve()
  if (g_ensure_promise) return g_ensure_promise

  g_ensure_promise = (async () => {
    try {
      const local_cached = await get_cached_blaze_face_response(url)
      if (local_cached) return
      const local_response = await fetch(url)
      if (!local_response.ok) return
      const local_content_type = local_response.headers.get('Content-Type') ?? ''
      if (local_content_type.includes('text/html')) return
      await store_blaze_face_response(url, local_response)
    } catch {
      // best-effort — 다음 navigation 에서 자연 재시도
    } finally {
      g_ensure_promise = null
    }
  })()

  return g_ensure_promise
}

/** 캐시 전체 폐기. 디버깅 / 강제 재다운로드용. */
export async function clear_blaze_face_cache() {
  if (!is_cache_supported()) return
  await caches.delete(CACHE_NAME)
}
