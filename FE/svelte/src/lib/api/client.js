const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * @typedef {Omit<RequestInit, 'body'> & { body?: BodyInit | Record<string, unknown> | null }} ApiRequestOptions
 */

/**
 * sessionStorage에서 token, token_no를 읽어 인증 헤더 객체를 반환한다.
 */
function get_auth_header() {
  const local_token = sessionStorage.getItem('token')
  const local_token_no = sessionStorage.getItem('token_no')
  return {
    ...(local_token ? { token: local_token } : {}),
    ...(local_token_no ? { 'token-no': local_token_no } : {}),
  }
}

/**
 * API 요청을 공통 형식으로 보내고 JSON 응답과 오류 처리를 표준화한다.
 * @param {string} path
 * @param {ApiRequestOptions} [options]
 */
export const apiRequest = async (path, options = {}) => {
  const { headers, body, ...restOptions } = options
  const hasJsonBody = body && typeof body === 'object' && !(body instanceof FormData)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...get_auth_header(),
      ...headers,
    },
    body: hasJsonBody ? JSON.stringify(body) : body,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed with status ${response.status}.`)
  }

  return data
}
