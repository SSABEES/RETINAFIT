import { get } from 'svelte/store'
import { writable } from 'svelte/store'

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

export const customer_arr_store = writable(/** @type {CustomerObj[]} */ ([]))

/**
 * 고객 번호로 현재 조회된 고객 목록에서 고객 상세 정보를 찾는다.
 * @param {string | number} id
 */
export function get_customer_store_by_id(id) {
  return get(customer_arr_store).find((customer_obj) => customer_obj.id === Number(id)) ?? null
}
