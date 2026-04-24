import { apiRequest } from '@/lib/api/client'

/**
 * 이메일과 비밀번호로 로그인 API를 호출한다.
 * @param {{ email: string, password: string }} params
 */
export const login = async ({ email, password }) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}
