import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 안경 1개에 대한 가상 피팅 이미지 Presigned URL 발급 요청
 * @param {number} visit_no
 * @param {number} glasses_no
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const request_fitting_presigned_urls = (visit_no, glasses_no) => {
  return apiRequest(`/api/v1/visits/${visit_no}/files/fitting-photos`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: { glasses_no },
  })
}

/**
 * S3 업로드 완료 후 가상 피팅 결과를 방문 데이터에 PATCH 로 저장
 * @param {number} visit_no
 * @param {{ vp_file_arr: string[], vp_json: { glasses_no: number, fitting_result: object } }} body
 */
export const confirm_fitting_result = (visit_no, body) => {
  return apiRequest(`/api/v1/visits/${visit_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body: {
      ...body,
      vp_dt: new Date().toISOString(),
    },
  })
}

/**
 * 활성화된 안경 전체 목록을 조회
 */
export const get_all_glasses = () => {
  return apiRequest('/api/v1/glasses', {
    headers: get_session_auth_headers(),
  })
}
