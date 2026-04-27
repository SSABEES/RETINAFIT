import { apiRequest } from '@/lib/api/client'

/**
 * 고객의 방문 기록 목록 조회
 * @param {{ cust_no: number, opt_no: number }} param_obj
 */
export const get_visit_list = ({ cust_no, opt_no }) => {
  return apiRequest(`/api/v1/visit?cust_no=${cust_no}&opt_no=${opt_no}`)
}

/**
 * 신규 방문 생성
 * @param {{ cust_no: number, opt_no: number, member_no: number }} param_obj
 */
export const create_visit = (param_obj) => {
  return apiRequest('/api/v1/visit', {
    method: 'POST',
    body: param_obj,
  })
}
