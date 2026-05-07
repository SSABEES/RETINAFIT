import { apiRequest } from '@/lib/api/client'
import { get_admin_auth_headers, get_session_auth_headers } from '@/lib/api/session_auth'

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
 * (관리자) 전체 방문 데이터 조회.
 * 응답: { total: number, visits: VisitObj[] }
 * VisitObj 필드명은 phone_no1/phone_no2 (안경사용 visit 응답의 phone1/phone2 와 다름).
 */
export const get_admin_all_visits = () => {
  return apiRequest('/api/v1/admin/visits', {
    headers: get_admin_auth_headers(),
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
 * (관리자 화면용) 방문 단건 상세를 세션 토큰(token / token-no) 으로 조회한다.
 * BE /api/v1/visits/{visit_no} 가 admin 토큰이 아닌 안경사 세션 헤더(token, token-no)를 요구하므로
 * sessionStorage 의 token / token_no 를 그대로 보낸다 (= get_visit 와 동일한 헤더, 별칭).
 * @param {{ visit_no: number | string }} param_obj
 */
export const get_admin_visit = ({ visit_no }) => {
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

/**
 * 방문 데이터를 PATCH 로 일괄 업데이트한다 (BE VisitUpdateRequest 기준 변경된 필드만 전달).
 * @param {{ visit_no: number | string, body: Record<string, unknown> }} param_obj
 */
export const update_visit = ({ visit_no, body }) => {
  return apiRequest(`/api/v1/visits/${visit_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body,
  })
}
