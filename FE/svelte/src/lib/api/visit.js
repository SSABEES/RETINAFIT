import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 고객 방문 이력을 최신순으로 조회한다.
 * @param {{ cust_no: number | string }} param_obj
 */
export const get_visit_list = ({ cust_no }) => {
  return apiRequest(`/api/v1/customers/${cust_no}/visit-history`, {
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
 * 안경사 추천 옵션 선택을 방문 데이터에 PATCH 로 저장한다.
 * @param {{ visit_no: number | string, opt_recommend_json: Record<string, unknown> }} param_obj
 */
export const save_visit_recommend = ({ visit_no, opt_recommend_json }) => {
  return apiRequest(`/api/v1/visits/${visit_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body: {
      opt_recommend_json,
    },
  })
}

