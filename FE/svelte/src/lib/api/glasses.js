import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 렌즈 상담 추천 옵션 조회
 */
export const get_glasses_options = () => {
  return apiRequest('/api/v1/glasses/lens')
}

/**
 * 안경 추천 목록 조회
 */
export const get_glasses_recommendations = () => {
  return apiRequest('/glasses/recommendations')
}

/**
 * 선택한 렌즈 조건을 서버에 저장
 * @param {Record<string, string[]>} selected_obj
 */
export const save_lens_requirements = (selected_obj) => {
  return apiRequest('/glasses/requirements', {
    method: 'POST',
    body: selected_obj,
  })
}

/**
 * 안경 1개에 대한 가상 피팅 이미지 Presigned URL 발급 요청
 * @param {number} visit_no
 * @param {number} glasses_no
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const request_fitting_presigned_urls = (visit_no, glasses_no) => {
  return apiRequest(`/api/v1/visits/${visit_no}/files/vp`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: { glasses_no },
  })
}

/**
 * S3 업로드 완료 후 가상 피팅 결과를 백엔드에 저장
 * @param {number} visit_no
 * @param {{ vp_file_arr: string[], vp_json: { glasses_no: number, fitting_result: object } }} body
 */
export const confirm_fitting_result = (visit_no, body) => {
  return apiRequest(`/api/v1/visits/${visit_no}/vp`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body,
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
