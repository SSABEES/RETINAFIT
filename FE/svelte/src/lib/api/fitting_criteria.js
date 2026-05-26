import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 안경사 세션으로 피팅 기준 목록을 조회한다.
 * @returns {Promise<Array<{ criteria_no: number, criteria_label: string, range_type: string, lower_bound: number, upper_bound: number, out_of_range_note: string, is_active: boolean }>>}
 */
export function get_fitting_criteria_arr() {
  return apiRequest('/api/v1/fitting-criteria', {
    headers: get_session_auth_headers(),
  })
}
