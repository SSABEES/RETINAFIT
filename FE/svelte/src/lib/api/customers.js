import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 전화번호와 안경원 번호로 고객 목록을 조회한다.
 * @param {{ phone_no: string, opt_no: string | number }} search_obj
 */
export async function search_customer(search_obj) {
  const local_search_params = new URLSearchParams({
    phone_no: search_obj.phone_no.replace(/[^0-9]/g, ''),
    opt_no: String(search_obj.opt_no),
  })

  return apiRequest(`/api/v1/customers/search?${local_search_params.toString()}`, {
    headers: get_session_auth_headers(),
  })
}

/**
 * 신규 고객을 등록한다.
 * @param {{ opt_no: string | number, cust_name: string, phone1: string, phone2: string, birthday: string, sex: number }} customer_obj
 */
export async function create_customer(customer_obj) {
  const local_search_params = new URLSearchParams({
    opt_no: String(customer_obj.opt_no),
  })

  return apiRequest(`/api/v1/customers/register?${local_search_params.toString()}`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: {
      cust_name: customer_obj.cust_name,
      phone1: customer_obj.phone1.replace(/[^0-9]/g, ''),
      phone2: customer_obj.phone2.replace(/[^0-9]/g, ''),
      birthday: customer_obj.birthday,
      sex: customer_obj.sex,
    },
  })
}
