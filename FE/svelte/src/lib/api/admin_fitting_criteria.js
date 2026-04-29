import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 얼굴형 판단 기준 목록을 조회한다.
 * @returns {Promise<Array<{ criteria_no: number, criteria_label: string, range_type: string, lower_bound: number, upper_bound: number, out_of_range_note: string, is_active: boolean }>>}
 */
export function get_fitting_criteria_arr() {
  return apiRequest('/api/v1/admin/fitting-criteria', {
    headers: get_session_auth_headers(),
  })
}

/**
 * 얼굴형 판단 기준을 추가한다.
 * @param {{ criteria_label: string, range_type: string, lower_bound: number, upper_bound: number, out_of_range_note: string, is_active: boolean }} criteria_obj
 */
export function create_fitting_criteria(criteria_obj) {
  return apiRequest('/api/v1/admin/fitting-criteria', {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: criteria_obj,
  })
}

/**
 * 얼굴형 판단 기준을 수정한다.
 * @param {{ criteria_no: number | string, criteria_label: string, range_type: string, lower_bound: number, upper_bound: number, out_of_range_note: string, is_active: boolean }} criteria_obj
 */
export function update_fitting_criteria(criteria_obj) {
  return apiRequest(`/api/v1/admin/fitting-criteria/${criteria_obj.criteria_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body: {
      criteria_label: criteria_obj.criteria_label,
      range_type: criteria_obj.range_type,
      lower_bound: criteria_obj.lower_bound,
      upper_bound: criteria_obj.upper_bound,
      out_of_range_note: criteria_obj.out_of_range_note,
      is_active: criteria_obj.is_active,
    },
  })
}

/**
 * 얼굴형 판단 기준을 삭제한다.
 * @param {{ criteria_no: number | string }} criteria_obj
 */
export function delete_fitting_criteria(criteria_obj) {
  return apiRequest(`/api/v1/admin/fitting-criteria/${criteria_obj.criteria_no}`, {
    method: 'DELETE',
    headers: get_session_auth_headers(),
  })
}
