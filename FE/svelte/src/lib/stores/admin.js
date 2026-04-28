import { writable } from 'svelte/store'

const ADMIN_ARR_STORAGE_KEY = 'retinal_admin_arr'
const SELECTED_ADMIN_STORAGE_KEY = 'retinal_selected_admin_obj'
const SELECTED_OPT_STORE_STORAGE_KEY = 'retinal_selected_opt_store_obj'

/**
 * @typedef {{
 *   id: number,
 *   member_no?: number,
 *   name: string,
 *   position: string,
 *   password: string,
 *   mobile?: string,
 *   opt_no?: string,
 *   opt_name?: string,
 *   company_tel?: string,
 *   raw_obj?: Record<string, unknown>,
 * }} AdminObj
 *
 * @typedef {{
 *   id: number,
 *   opt_no: string,
 *   name: string,
 *   tel: string,
 *   raw_obj?: Record<string, unknown>,
 * }} OptStoreObj
 */

/** @type {AdminObj} */
const empty_admin_obj = {
  id: 0,
  name: '로그인 필요',
  position: '',
  password: '',
}

/**
 * sessionStorage에 저장된 JSON 값을 읽고 실패하면 기본값을 반환한다.
 * @template T
 * @param {string} key
 * @param {T} fallback_value
 */
function get_storage_json(key, fallback_value) {
  if (typeof sessionStorage === 'undefined') {
    return fallback_value
  }

  const local_value = sessionStorage.getItem(key)

  if (!local_value) {
    return fallback_value
  }

  try {
    return /** @type {T} */ (JSON.parse(local_value))
  } catch {
    return fallback_value
  }
}

/**
 * JSON으로 직렬화 가능한 값을 sessionStorage에 저장한다.
 * @param {string} key
 * @param {unknown} value
 */
function set_storage_json(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

export const admin_arr = writable(
  get_storage_json(ADMIN_ARR_STORAGE_KEY, /** @type {AdminObj[]} */ ([])),
)
export const selected_admin_obj = writable(
  get_storage_json(SELECTED_ADMIN_STORAGE_KEY, empty_admin_obj),
)
export const selected_opt_store_obj = writable(
  get_storage_json(SELECTED_OPT_STORE_STORAGE_KEY, /** @type {OptStoreObj | null} */ (null)),
)

/**
 * 선택한 안경원과 해당 안경원 소속 안경사 목록을 저장한다.
 * @param {OptStoreObj} opt_store_obj
 * @param {AdminObj[]} admin_arr_value
 */
export function set_selected_opt_store(opt_store_obj, admin_arr_value) {
  selected_opt_store_obj.set(opt_store_obj)
  admin_arr.set(admin_arr_value)

  set_storage_json(SELECTED_OPT_STORE_STORAGE_KEY, opt_store_obj)
  set_storage_json(ADMIN_ARR_STORAGE_KEY, admin_arr_value)
}

/**
 * 선택한 안경사 정보를 저장한다.
 * @param {AdminObj} admin_obj
 */
export function set_selected_admin(admin_obj) {
  selected_admin_obj.set(admin_obj)
  set_storage_json(SELECTED_ADMIN_STORAGE_KEY, admin_obj)
}

// 저장된 로그인 선택 상태를 모두 초기화한다.
export function clear_login_select_data() {
  admin_arr.set([])
  selected_admin_obj.set(empty_admin_obj)
  selected_opt_store_obj.set(null)

  sessionStorage.removeItem(ADMIN_ARR_STORAGE_KEY)
  sessionStorage.removeItem(SELECTED_ADMIN_STORAGE_KEY)
  sessionStorage.removeItem(SELECTED_OPT_STORE_STORAGE_KEY)
}
