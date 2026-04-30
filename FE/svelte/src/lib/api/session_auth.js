import { load_auto_login_obj } from '@/lib/stores/auto_login'

/**
 * sessionStorage 에 token / token_no 가 비었으면 자동 로그인 정보에서 복구한다.
 * @returns {boolean}
 */
export function ensure_session_auth_tokens() {
  if (typeof sessionStorage === 'undefined') {
    return false
  }

  const local_saved_token = sessionStorage.getItem('token')
  const local_saved_token_no = sessionStorage.getItem('token_no')

  if (local_saved_token && local_saved_token_no) {
    return true
  }

  const local_auto_login_obj = load_auto_login_obj()

  if (!local_auto_login_obj?.token || !local_auto_login_obj?.token_no) {
    return false
  }

  sessionStorage.setItem('token', String(local_auto_login_obj.token))
  sessionStorage.setItem('token_no', String(local_auto_login_obj.token_no))
  return true
}

/**
 * 로그인 세션에서 백엔드 인증 헤더를 만든다.
 */
export function get_session_auth_headers() {
  const local_has_session_auth = ensure_session_auth_tokens()
  const local_token = local_has_session_auth ? sessionStorage.getItem('token') : null
  const local_token_no = local_has_session_auth ? sessionStorage.getItem('token_no') : null

  if (!local_token || !local_token_no) {
    throw new Error('로그인 정보가 없습니다. 다시 로그인해 주세요.')
  }

  return {
    token: local_token,
    'token-no': local_token_no,
  }
}

/**
 * 관리자 세션에서 admin_token(JWT)을 읽어 Authorization 헤더로 만든다.
 */
export function get_admin_auth_headers() {
  const local_admin_token = sessionStorage.getItem('admin_token')

  if (!local_admin_token) {
    throw new Error('관리자 로그인 정보가 없습니다. 다시 로그인해 주세요.')
  }

  return {
    Authorization: `Bearer ${local_admin_token}`,
  }
}
