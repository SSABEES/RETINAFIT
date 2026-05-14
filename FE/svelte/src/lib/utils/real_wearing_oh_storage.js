/**
 * real_fitting 의 정면 슬롯에서 산출한 OH(mm) 를 result.svelte 가 사용할 수 있도록
 * sessionStorage 에 미러링한다. visit_id 가 매치되지 않으면 다른 visit 의 잔재로
 * 간주해 무시한다.
 *
 * 기존 PREFETCH_VISIT_KEY ('retinal_prefetched_visit_obj') 와 별도 key 로 운영.
 *
 * @typedef {{
 *   set_id: number,
 *   oh_left_mm: number,
 *   oh_right_mm: number,
 *   oh_source: 'aruco' | 'pd_fallback',
 * }} RealWearingOhSet
 *
 * @typedef {{ visit_id: number, sets: RealWearingOhSet[] }} RealWearingOhMirror
 */

const STORAGE_KEY = 'retinal_real_wearing_oh_mirror'

/**
 * 미러 데이터를 sessionStorage 에 직렬화 저장. 실패 시 콘솔 경고만 (sessionStorage quota / 비활성화 등 안전 처리).
 * @param {RealWearingOhMirror} mirror
 */
export function save_real_wearing_oh(mirror) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mirror))
  } catch (err) {
    console.warn('[real_wearing_oh_storage] save failed:', err)
  }
}

/**
 * 미러를 읽어 visit_id 가 매치하면 반환, 아니면 null (다른 visit 의 잔재 격리).
 * @param {number} visit_id
 * @returns {RealWearingOhMirror | null}
 */
export function read_real_wearing_oh(visit_id) {
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
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}
