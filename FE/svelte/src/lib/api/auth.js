import { apiRequest } from '@/lib/api/client'

/**
 * 안경사 로그인 API를 호출하고 후속 Retina 요청에 필요한 토큰을 세션에 저장한다.
 * @param {{ id: string, password: string }} login_obj
 */
export const login = async ({ id, password }) => {
  const local_login_response_obj = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { id, password },
  })

  if (local_login_response_obj?.token) {
    sessionStorage.setItem('token', String(local_login_response_obj.token))
  }

  if (local_login_response_obj?.token_no) {
    sessionStorage.setItem('token_no', String(local_login_response_obj.token_no))
  }

  return local_login_response_obj
}
