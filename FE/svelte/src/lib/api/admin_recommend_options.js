import { apiRequest } from '@/lib/api/client'
import { get_admin_auth_headers } from '@/lib/api/session_auth'

/**
 * 추천 옵션 목록을 조회한다.
 */
export function get_recommend_option_arr() {
  return apiRequest('/api/v1/admin/recommend-options', {
    headers: get_admin_auth_headers(),
  })
}

/**
 * 추천 옵션을 추가한다.
 * @param {{ option_name: string, option_category: string, display_order: number, is_active: boolean }} option_obj
 */
export function create_recommend_option(option_obj) {
  return apiRequest('/api/v1/admin/recommend-options', {
    method: 'POST',
    headers: get_admin_auth_headers(),
    body: option_obj,
  })
}

/**
 * 추천 옵션을 수정한다.
 * @param {{ option_no: number | string, option_name: string, option_category: string, is_active: boolean }} option_obj
 */
export function update_recommend_option(option_obj) {
  return apiRequest(`/api/v1/admin/recommend-options/${option_obj.option_no}`, {
    method: 'PATCH',
    headers: get_admin_auth_headers(),
    body: {
      option_name: option_obj.option_name,
      option_category: option_obj.option_category,
      is_active: option_obj.is_active,
    },
  })
}

/**
 * 추천 옵션을 삭제한다.
 * @param {{ option_no: number | string }} option_obj
 */
export function delete_recommend_option(option_obj) {
  return apiRequest(`/api/v1/admin/recommend-options/${option_obj.option_no}`, {
    method: 'DELETE',
    headers: get_admin_auth_headers(),
  })
}

/**
 * 추천 옵션 표시 순서를 변경한다.
 * BE 는 단일 PATCH /admin/recommend-options/{option_no} 만 제공하며, 모든 필드가 Optional 이라
 * display_order 만 담아 보내면 순서만 갱신된다.
 * @param {{ option_no: number | string, display_order: number }} option_obj
 */
export function update_recommend_option_order(option_obj) {
  return apiRequest(`/api/v1/admin/recommend-options/${option_obj.option_no}`, {
    method: 'PATCH',
    headers: get_admin_auth_headers(),
    body: {
      display_order: option_obj.display_order,
    },
  })
}
