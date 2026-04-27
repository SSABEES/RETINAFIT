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
