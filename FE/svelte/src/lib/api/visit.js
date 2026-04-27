import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 고객 방문 이력을 최신순으로 조회한다.
 * @param {{ cust_no: number | string }} param_obj
 */
export const get_visit_list = ({ cust_no }) => {
  return apiRequest(`/api/v1/customers/${cust_no}/visits`, {
    headers: get_session_auth_headers(),
  })
}

/**
 * 방문 단건 상세를 조회한다.
 * @param {{ visit_no: number | string }} param_obj
 */
export const get_visit = ({ visit_no }) => {
  return apiRequest(`/api/v1/visits/${visit_no}`, {
    headers: get_session_auth_headers(),
  })
}

/**
 * 신규 방문을 생성한다.
 * @param {{ opt_no: number | string, cust_no: number | string, cust_name: string, birthday: string, phone_no1: string, phone_no2: string, sex: number, member_no: number | string }} param_obj
 */
export const create_visit = (param_obj) => {
  return apiRequest('/api/v1/visits', {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: {
      opt_no: Number(param_obj.opt_no),
      cust_no: Number(param_obj.cust_no),
      cust_name: param_obj.cust_name,
      birthday: param_obj.birthday,
      phone_no1: param_obj.phone_no1.replace(/[^0-9]/g, ''),
      phone_no2: param_obj.phone_no2.replace(/[^0-9]/g, ''),
      sex: Number(param_obj.sex),
      member_no: Number(param_obj.member_no),
    },
  })
}

/**
 * 가상 피팅 이미지 S3 presigned URL을 발급한다.
 * @param {{ visit_no: number, glasses_no: number }} param_obj
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const get_vp_presigned_urls = (param_obj) => {
  return apiRequest(`/api/v1/visits/${param_obj.visit_no}/files/vp`, {
    method: 'POST',
    body: { glasses_no: param_obj.glasses_no },
  })
}

/**
 * 실제 착용 이미지 S3 presigned URL을 발급한다.
 * @param {{ visit_no: number, glasses_no: number }} param_obj
 */
export const get_real_vp_presigned_urls = (param_obj) => {
  return apiRequest(`/api/v1/visits/${param_obj.visit_no}/files/real-vp`, {
    method: 'POST',
    body: { glasses_no: param_obj.glasses_no },
  })
}
