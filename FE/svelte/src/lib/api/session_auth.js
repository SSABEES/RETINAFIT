/**
 * 로그인 세션에서 백엔드 인증 헤더를 읽는다.
 */
export function get_session_auth_headers() {
  const local_token = sessionStorage.getItem('token')
  const local_token_no = sessionStorage.getItem('token_no')

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
