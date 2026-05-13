/**
 * 방문 상세 prefetch 모듈.
 * [id].svelte 에서 카드 클릭 즉시 fetch 를 시작하고, result.svelte 에서 그 Promise 를 await 해서
 * 네트워크 대기 시간을 navigate + mount 시간과 겹쳐 체감 로딩을 줄인다.
 */

/** @type {number | null} */
let g_visit_no = null

/** @type {Promise<any> | null} */
let g_promise = null

/**
 * @param {number} visit_no
 * @param {() => Promise<any>} fetch_fn
 */
export function prefetch_visit(visit_no, fetch_fn) {
  g_visit_no = visit_no
  g_promise = fetch_fn()
}

/**
 * @param {number} visit_no
 * @returns {Promise<any> | null}
 */
export function consume_prefetch_visit(visit_no) {
  if (g_visit_no !== visit_no || !g_promise) return null
  const local_promise = g_promise
  g_visit_no = null
  g_promise = null
  return local_promise
}
