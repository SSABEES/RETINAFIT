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

/**
 * 관리자 로그인 API를 호출하고 받은 admin_token(JWT)을 세션에 저장한다.
 * @param {{ id: string, password: string }} login_obj
 */
export const admin_login = async ({ id, password }) => {
  const local_response_obj = await apiRequest('/api/v1/auth/admin/login', {
    method: 'POST',
    body: { id, password },
  })

  if (local_response_obj?.admin_token) {
    sessionStorage.setItem('admin_token', String(local_response_obj.admin_token))
  }

  return local_response_obj
}

// 저장된 관리자 토큰을 비운다.
export const admin_logout = () => {
  sessionStorage.removeItem('admin_token')
}
