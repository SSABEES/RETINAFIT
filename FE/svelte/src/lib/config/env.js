/**
 * .env.local에 정의된 base URL을 읽고 끝의 슬래시를 제거한다.
 * 값이 없으면 개발 단계에서 바로 원인을 알 수 있도록 명확한 에러를 던진다.
 * @param {string} env_key
 */
function get_required_base_url(env_key) {
  const local_env_value = import.meta.env[env_key]

  if (!local_env_value || typeof local_env_value !== 'string') {
    throw new Error(`${env_key} 값이 없습니다. .env.local 파일을 확인해 주세요.`)
  }

  return local_env_value.replace(/\/+$/, '')
}

export const api_base_url = get_required_base_url('VITE_API_BASE_URL')
