import { get } from 'svelte/store'
import { writable } from 'svelte/store'

const SELECTED_CUSTOMER_STORAGE_KEY = 'retinal_selected_customer_obj'
const SELECTED_VISIT_STORAGE_KEY = 'retinal_selected_visit_obj'

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   phone: string,
 *   email?: string,
 *   gender?: string,
 *   birth_dt?: string,
 *   visit_count: number,
 *   last_visit_dt: string,
 *   face_shape?: string,
 *   skin_tone?: string,
 *   analysis_done?: boolean,
 *   status?: string,
 *   raw_obj?: Record<string, unknown>,
 * }} CustomerObj
 */

/**
 * @typedef {{
 *   visit_no: number,
 *   create_dt: string,
 *   test_dt: string | null,
 *   vp_dt: string | null,
 *   real_vp_dt: string | null,
 *   update_dt: string | null,
 *   is_new?: boolean,
 * }} VisitObj
 */

export const customer_arr_store = writable(/** @type {CustomerObj[]} */ ([]))
export const selected_customer_obj = writable(get_selected_customer_storage())
export const selected_visit_obj = writable(/** @type {VisitObj | null} */ (get_selected_visit_storage()))

// 저장된 선택 방문 정보를 sessionStorage에서 읽는다.
function get_selected_visit_storage() {
  if (typeof sessionStorage === 'undefined') return /** @type {VisitObj | null} */ (null)
  const local_value = sessionStorage.getItem(SELECTED_VISIT_STORAGE_KEY)
  if (!local_value) return /** @type {VisitObj | null} */ (null)
  try {
    return /** @type {VisitObj | null} */ (JSON.parse(local_value))
  } catch {
    return /** @type {VisitObj | null} */ (null)
  }
}

// 저장된 선택 고객 정보를 sessionStorage에서 읽는다.
function get_selected_customer_storage() {
  if (typeof sessionStorage === 'undefined') {
    return /** @type {CustomerObj | null} */ (null)
  }

  const local_value = sessionStorage.getItem(SELECTED_CUSTOMER_STORAGE_KEY)

  if (!local_value) {
    return /** @type {CustomerObj | null} */ (null)
  }

  try {
    return /** @type {CustomerObj | null} */ (JSON.parse(local_value))
  } catch {
    return /** @type {CustomerObj | null} */ (null)
  }
}

/**
 * 선택한 고객 정보를 저장하고 새로고침 시 복원할 수 있게 sessionStorage에 보관한다.
 * @param {CustomerObj} customer_obj
 */
export function set_selected_customer(customer_obj) {
  selected_customer_obj.set(customer_obj)
  sessionStorage.setItem(SELECTED_CUSTOMER_STORAGE_KEY, JSON.stringify(customer_obj))
}

/**
 * 선택한 방문 정보를 저장하고 새로고침 시 복원할 수 있게 sessionStorage에 보관한다.
 * @param {VisitObj} visit_obj
 */
export function set_selected_visit(visit_obj) {
  selected_visit_obj.set(visit_obj)
  sessionStorage.setItem(SELECTED_VISIT_STORAGE_KEY, JSON.stringify(visit_obj))
}

/**
 * 고객 번호로 현재 조회된 고객 목록에서 고객 상세 정보를 찾는다.
 * @param {string | number} id
 */
export function get_customer_store_by_id(id) {
  return get(customer_arr_store).find((customer_obj) => customer_obj.id === Number(id)) ?? null
}
