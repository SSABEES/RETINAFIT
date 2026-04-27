import { apiRequest } from '@/lib/api/client'

/**
 * 고객의 방문 기록 목록 조회
 * @param {{ cust_no: number, opt_no: number }} param_obj
 */
export const get_visit_list = ({ cust_no, opt_no }) => {
  return apiRequest(`/v1/customers/${cust_no}/visits?opt_no=${opt_no}`)
}

/**
 * 신규 방문 생성
 * @param {{ cust_no: number, opt_no: number, member_no: number }} param_obj
 */
export const create_visit = (param_obj) => {
  return apiRequest('/v1/visits', {
    method: 'POST',
    body: param_obj,
  })
}

/**
 * 가상 피팅 이미지 S3 presigned URL을 발급한다.
 * @param {{ visit_no: number, glasses_no: number }} param_obj
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const get_vp_presigned_urls = (param_obj) => {
  return apiRequest(`/v1/visits/${param_obj.visit_no}/files/vp`, {
    method: 'POST',
    body: { glasses_no: param_obj.glasses_no },
  })
}

/**
 * 실제 착용 이미지 S3 presigned URL을 발급한다.
 * @param {{ visit_no: number, glasses_no: number }} param_obj
 */
export const get_real_vp_presigned_urls = (param_obj) => {
  return apiRequest(`/v1/visits/${param_obj.visit_no}/files/real-vp`, {
    method: 'POST',
    body: { glasses_no: param_obj.glasses_no },
  })
}
