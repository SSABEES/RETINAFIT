import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 활성화된 안경 목록을 조회한다.
 */
export function get_admin_glasses_arr() {
  return apiRequest('/api/v1/glasses', {
    headers: get_session_auth_headers(),
  })
}

/**
 * 관리자 안경을 등록한다.
 * @param {{
 *   glasses_name: string
 *   glasses_brand: string
 *   glasses_img_url: string
 *   glasses_3d_url: string
 *   glasses_spec_json: Record<string, unknown>
 *   is_active: boolean
 * }} glasses_obj
 */
export function create_admin_glasses(glasses_obj) {
  return apiRequest('/api/v1/admin/glasses', {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: glasses_obj,
  })
}

/**
 * 관리자 안경을 수정한다.
 * @param {{
 *   glasses_no: number | string
 *   glasses_name: string
 *   glasses_brand: string
 *   glasses_img_url: string
 *   glasses_3d_url: string
 *   glasses_spec_json: Record<string, unknown>
 *   is_active: boolean
 * }} glasses_obj
 */
export function update_admin_glasses(glasses_obj) {
  return apiRequest(`/api/v1/admin/glasses/${glasses_obj.glasses_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body: {
      glasses_name: glasses_obj.glasses_name,
      glasses_brand: glasses_obj.glasses_brand,
      glasses_img_url: glasses_obj.glasses_img_url,
      glasses_3d_url: glasses_obj.glasses_3d_url,
      glasses_spec_json: glasses_obj.glasses_spec_json,
      is_active: glasses_obj.is_active,
    },
  })
}

/**
 * 관리자 안경을 비활성화한다.
 * @param {{ glasses_no: number | string }} glasses_obj
 */
export function delete_admin_glasses(glasses_obj) {
  return apiRequest(`/api/v1/admin/glasses/${glasses_obj.glasses_no}`, {
    method: 'DELETE',
    headers: get_session_auth_headers(),
  })
}
