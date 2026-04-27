import { api_base_url } from '@/lib/config/env'

/**
 * @typedef {Omit<RequestInit, 'body'> & { body?: BodyInit | Record<string, unknown> | null }} ApiRequestOptions
 */

/**
 * API 요청을 공통 형식으로 보내고 JSON 응답과 오류 처리를 표준화한다.
 * 공통 JSON API 요청을 보내고 응답과 에러를 일관된 형식으로 처리한다.
 * @param {string} path
 * @param {ApiRequestOptions} [options]
 */
export const apiRequest = async (path, options = {}) => {
  const { headers, body, ...rest_options } = options
  const local_has_json_body = body && typeof body === 'object' && !(body instanceof FormData)

  const local_response = await fetch(`${api_base_url}${path}`, {
    ...rest_options,
    headers: {
      ...(local_has_json_body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: local_has_json_body ? JSON.stringify(body) : body,
  })

  const local_data_obj = await local_response.json().catch(() => null)

  if (!local_response.ok) {
    throw new Error(
      local_data_obj?.message ?? `Request failed with status ${local_response.status}.`,
    )
  }

  return local_data_obj
}
