import { apiRequest } from '@/lib/api/client'

/**
 * 활성화된 안경 목록을 조회한다.
 */
export function get_admin_glasses_arr() {
  return apiRequest('/api/v1/glasses')
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
  })
}

/**
 * 대표 이미지 업로드용 presigned URL 을 발급받는다.
 * 문자열 응답 또는 presigned_url/url/upload_url 키를 가진 객체 응답을 모두 지원한다.
 * @returns {Promise<string | Record<string, unknown>>}
 */
export function get_admin_glasses_img_presigned_url() {
  return apiRequest('/api/v1/admin/glasses/files/img', {
    method: 'POST',
  })
}

/**
 * 3D 파일 업로드용 presigned URL 을 발급받는다.
 * 문자열 응답 또는 presigned_url/url/upload_url 키를 가진 객체 응답을 모두 지원한다.
 * @returns {Promise<string | Record<string, unknown>>}
 */
export function get_admin_glasses_3d_presigned_url() {
  return apiRequest('/api/v1/admin/glasses/files/3d', {
    method: 'POST',
  })
}

/**
 * presigned URL 응답값에서 실제 업로드 URL 문자열만 꺼낸다.
 * @param {string | Record<string, unknown>} presigned_value
 */
export function get_presigned_upload_url(presigned_value) {
  if (typeof presigned_value === 'string') {
    return presigned_value
  }

  const local_candidate_url =
    presigned_value?.presigned_url ??
    presigned_value?.upload_url ??
    presigned_value?.url ??
    presigned_value?.url_3d ??
    presigned_value?.img_url ??
    presigned_value?.file_url ??
    presigned_value?.glasses_img_url ??
    presigned_value?.glasses_3d_url ??
    presigned_value?.model_url

  if (typeof local_candidate_url !== 'string' || !local_candidate_url.trim()) {
    throw new Error('Presigned URL 응답 형식이 올바르지 않습니다.')
  }

  return local_candidate_url
}

/**
 * presigned URL 로 파일을 직접 업로드한다.
 * @param {string | Record<string, unknown>} presigned_value
 * @param {File} file_obj
 */
export async function upload_admin_glasses_file(presigned_value, file_obj) {
  const local_upload_url = get_presigned_upload_url(presigned_value)

  const local_response = await fetch(local_upload_url, {
    method: 'PUT',
    body: file_obj,
    headers: {
      'Content-Type': file_obj.type || 'application/octet-stream',
    },
  })

  if (!local_response.ok) {
    throw new Error(`파일 업로드에 실패했습니다. (status ${local_response.status})`)
  }
}

/**
 * presigned URL 에서 S3 object key 만 잘라 등록 API 에 보낼 값으로 만든다.
 * 백엔드가 host prefix 를 다시 붙이기 때문에 host 를 같이 보내면 경로가 중첩된다.
 * @param {string | Record<string, unknown>} presigned_value
 */
export function get_uploaded_file_url(presigned_value) {
  const local_full_url = get_presigned_upload_url(presigned_value).split('?')[0]
  return new URL(local_full_url).pathname.replace(/^\/+/, '')
}
