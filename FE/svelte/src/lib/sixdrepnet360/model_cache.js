/**
 * 6DRepNet360 모델 바이트의 영구 캐시 레이어 (Cache Storage API).
 *
 * 동기: 94MB ONNX 가 Chrome HTTP 캐시의 per-resource 한계와 마찰을 일으켜 매 reload 마다
 * 재다운로드 발생 (ERR_CACHE_WRITE_FAILURE 또는 단순 evict). HTTP 캐시 대신 Cache Storage 에
 * 직접 저장해 evict 위험을 제거하고, 첫 진입 1회 다운로드로 끝나도록 함.
 *
 * 호출 관계:
 *   preload_sixdrepnet_model() (preload.js)
 *     ├─ get_cached_model_response(url)  ← cache hit 면 즉시 반환
 *     └─ fetch(url) → store_model_response(url, response.clone())  ← cache miss 시 저장
 *
 * 보안 컨텍스트: Cache Storage 는 secure context (HTTPS 또는 localhost) 에서만 사용 가능.
 * 비-secure 컨텍스트에선 caches 가 undefined 라 가드가 필요.
 *
 * 무효화 정책: 모델 파일명 자체에 variant 가 들어있고 (`6drepnet360.int8.dynamic.onnx` 등)
 * 모델 갱신 시 파일명도 바뀌는 운영 패턴이라 별도 invalidation 불필요. 캐시 이름의 -v1
 * suffix 는 향후 캐시 스키마 변경(예: 압축 적용) 시 한 번에 폐기하기 위한 헷지.
 */

// 캐시 storage 이름. 같은 origin 의 다른 캐시(Service Worker 등) 와 충돌 방지 위해 prefix 명시.
const CACHE_NAME = 'sixdrepnet360-models-v1'

/**
 * Cache Storage 가 사용 가능한 환경인지 검사.
 * @returns {boolean}
 */
function is_cache_supported() {
  return typeof caches !== 'undefined'
}

/**
 * 주어진 URL 에 해당하는 캐시된 Response 를 조회. 없으면 null.
 *
 * @param {string} url  모델 파일의 절대/상대 URL (cache key 로 사용됨)
 * @returns {Promise<Response | null>}
 */
export async function get_cached_model_response(url) {
  if (!is_cache_supported()) return null

  const local_cache = await caches.open(CACHE_NAME)
  const local_cached_response = await local_cache.match(url)
  return local_cached_response ?? null
}

/**
 * Response 를 Cache Storage 에 저장. response 는 본문 미사용 상태여야 한다 (호출자가 clone 해서 전달).
 *
 * @param {string} url
 * @param {Response} response  본문이 아직 소비되지 않은(=stream 가용한) Response
 * @returns {Promise<void>}
 */
export async function store_model_response(url, response) {
  if (!is_cache_supported()) return

  try {
    const local_cache = await caches.open(CACHE_NAME)
    await local_cache.put(url, response)
  } catch {
    // best-effort: 디스크 부족 / quota 초과 등 → silent. 호출자 흐름은 안 깸.
  }
}

/**
 * 캐시 전체 폐기. 디버깅 또는 모델 강제 재다운로드용.
 * @returns {Promise<void>}
 */
export async function clear_model_cache() {
  if (!is_cache_supported()) return
  await caches.delete(CACHE_NAME)
}
