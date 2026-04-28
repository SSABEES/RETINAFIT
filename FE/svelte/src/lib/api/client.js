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
    throw new Error(extract_error_message(local_data_obj, local_response.status))
  }

  return local_data_obj
}

// 응답 본문에서 사용자에게 보여줄 에러 메시지를 추출한다.
// FastAPI 검증 에러는 detail 이 배열 형태여서 별도 정리가 필요하다.
function extract_error_message(data_obj, status) {
  if (!data_obj) return `Request failed with status ${status}.`

  if (typeof data_obj.message === 'string' && data_obj.message) {
    return data_obj.message
  }

  if (Array.isArray(data_obj.detail)) {
    return data_obj.detail
      .map((detail_obj) => {
        const local_loc = Array.isArray(detail_obj?.loc) ? detail_obj.loc.join('.') : ''
        const local_msg = detail_obj?.msg ?? ''
        return local_loc ? `${local_loc}: ${local_msg}` : local_msg
      })
      .filter(Boolean)
      .join(' / ')
  }

  if (typeof data_obj.detail === 'string' && data_obj.detail) {
    return data_obj.detail
  }

  return `Request failed with status ${status}.`
}
