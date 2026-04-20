import { apiRequest } from './client'

/**
 * @param {{ email: string, password: string }} params
 */
export const login = async ({ email, password }) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}
