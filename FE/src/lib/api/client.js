const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * @param {string} path
 * @param {RequestInit & { body?: BodyInit | object | null }} [options]
 */
export const apiRequest = async (path, options = {}) => {
  const { headers, body, ...restOptions } = options
  const hasJsonBody = body && typeof body === 'object' && !(body instanceof FormData)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
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
