/**
 * real_fitting 의 정면 슬롯에서 산출한 OH(mm) 를 result.svelte 가 사용할 수 있도록
 * sessionStorage 에 미러링한다. visit_id 가 매치되지 않으면 다른 visit 의 잔재로
 * 간주해 무시한다.
 *
 * 기존 PREFETCH_VISIT_KEY ('retinal_prefetched_visit_obj') 와 별도 key 로 운영.
 *
 * @typedef {{ x: number, y: number }} Point2D
 * @typedef {{ pupil: Point2D, rim_bottom: Point2D }} OhMeasurePoints
 *
 * @typedef {{
 *   set_id: number,
 *   oh_left_mm: number,
 *   oh_right_mm: number,
 *   oh_source: 'aruco' | 'pd_fallback',
 *   oh_points_left?: OhMeasurePoints,
 *   oh_points_right?: OhMeasurePoints,
 * }} RealWearingOhSet
 *
 * @typedef {{ visit_id: number, sets: RealWearingOhSet[] }} RealWearingOhMirror
 */

const STORAGE_KEY = 'retinal_real_wearing_oh_mirror'

// SSR / 시크릿 모드 등에서 sessionStorage 접근 자체가 throw 할 수 있어 가드한다.
function is_available() {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * 미러 데이터를 sessionStorage 에 직렬화 저장. quota exceeded 등 실패는 사용자 흐름에 영향 없으므로 조용히 무시.
 * @param {RealWearingOhMirror} mirror
 */
export function save_real_wearing_oh(mirror) {
  if (!is_available()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mirror))
  } catch {
    // QuotaExceededError 등 — 미러링 실패는 사용자 흐름에 영향 없음, 조용히 무시.
  }
}

/**
 * 미러를 읽어 visit_id 가 매치하면 반환, 아니면 null (다른 visit 의 잔재 격리).
 * @param {number} visit_id
 * @returns {RealWearingOhMirror | null}
 */
export function read_real_wearing_oh(visit_id) {
  if (!is_available()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.visit_id !== visit_id) return null
    if (!Array.isArray(parsed.sets)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 미러 데이터를 sessionStorage 에서 제거 (페이지/visit 전환 정리용).
 */
export function clear_real_wearing_oh() {
  if (!is_available()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // removeItem 실패는 클리어 의도로 충분 — 재시도 불필요.
  }
}
