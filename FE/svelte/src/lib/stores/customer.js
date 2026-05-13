import { get } from 'svelte/store'
import { writable } from 'svelte/store'

const SELECTED_CUSTOMER_STORAGE_KEY = 'retinal_selected_customer_obj'
const SELECTED_VISIT_STORAGE_KEY = 'retinal_selected_visit_obj'

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   phone: string,
 *   phone2?: string,
 *   email?: string,
 *   gender?: string,
 *   birth_dt?: string,
 *   age?: number | string,
 *   visit_count: number,
 *   last_visit_dt: string,
 *   face_shape?: string,
 *   skin_tone?: string,
 *   analysis_done?: boolean,
 *   status?: string,
 *   status_key?: string,
 *   status_box_class?: string,
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
export const selected_visit_obj = writable(
  /** @type {VisitObj | null} */ (get_selected_visit_storage()),
)

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
 * 선택 고객 정보를 저장하고 새로고침 후에도 복원되도록 sessionStorage에 보관한다.
 * @param {CustomerObj} customer_obj
 */
export function set_selected_customer(customer_obj) {
  selected_customer_obj.set(customer_obj)
  sessionStorage.setItem(SELECTED_CUSTOMER_STORAGE_KEY, JSON.stringify(customer_obj))
}

/**
 * 선택 방문 정보를 저장하고 새로고침 후에도 복원되도록 sessionStorage에 보관한다.
 * @param {VisitObj} visit_obj
 */
export function set_selected_visit(visit_obj) {
  selected_visit_obj.set(visit_obj)
  sessionStorage.setItem(SELECTED_VISIT_STORAGE_KEY, JSON.stringify(visit_obj))
}

/**
 * 방문 단위로 누적된 화면 상태(고객/방문 선택, 렌즈 선택, 저장된 피팅, 임시 visit_no)를 모두 비운다.
 * 로그아웃 또는 visit_select 재진입 시 호출 — 이전 사용자의 분석/피팅 결과가 다음 사용자에게 새어 들어가지 않도록 한다.
 * (capture_session 모듈 상태는 별도로 reset 호출 필요)
 */
export function clear_visit_session_data() {
  selected_customer_obj.set(/** @type {CustomerObj | null} */ (null))
  selected_visit_obj.set(/** @type {VisitObj | null} */ (null))
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY)
  sessionStorage.removeItem(SELECTED_VISIT_STORAGE_KEY)
  sessionStorage.removeItem('retinal_visit_no')
  sessionStorage.removeItem('retinal_lens_selections')
  sessionStorage.removeItem('retinal_saved_fittings')
  // users/[id] 에서 분석 시작 시 set 되는 복귀 경로. 청소 안 하면 로고 클릭/로그아웃 후
  // 새 분석 흐름이 이전 고객 상세로 잘못 튕긴다.
  sessionStorage.removeItem('retinal_detail_return_path')
}

/**
 * 고객 번호로 현재 조회된 고객 목록에서 고객 상세 정보를 찾는다.
 * @param {string | number} id
 */
export function get_customer_store_by_id(id) {
  return get(customer_arr_store).find((customer_obj) => customer_obj.id === Number(id)) ?? null
}

/**
 * 고객 정보를 목록과 선택 상태에 동시에 반영한다.
 * @param {number | string} id
 * @param {Partial<CustomerObj>} customer_patch_obj
 */
export function update_customer_store_by_id(id, customer_patch_obj) {
  const local_customer_id = Number(id)
  let local_updated_customer_obj = null

  customer_arr_store.update((customer_arr) =>
    customer_arr.map((customer_obj) => {
      if (customer_obj.id !== local_customer_id) {
        return customer_obj
      }

      local_updated_customer_obj = {
        ...customer_obj,
        ...customer_patch_obj,
      }

      return local_updated_customer_obj
    }),
  )

  if (!local_updated_customer_obj) {
    return null
  }

  const local_selected_customer_obj = get(selected_customer_obj)

  if (local_selected_customer_obj?.id === local_customer_id) {
    set_selected_customer(local_updated_customer_obj)
  }

  return local_updated_customer_obj
}
