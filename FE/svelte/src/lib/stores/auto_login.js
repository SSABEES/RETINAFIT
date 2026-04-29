const AUTO_LOGIN_STORAGE_KEY = 'retinal_auto_login_obj'

/**
 * @typedef {{
 *   token: string,
 *   token_no: string,
 *   opt_info: Record<string, unknown>,
 *   member_list: Array<Record<string, unknown>>,
 * }} AutoLoginObj
 */

// 자동로그인 세션을 localStorage에 보관한다. 탭/세션을 닫아도 살아남아 다음 진입 시 자동 로그인된다.
export function save_auto_login_obj(auto_login_obj) {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, JSON.stringify(auto_login_obj))
  } catch {
    // 저장 실패는 무시 - 다음 로그인부터 다시 시도된다.
  }
}

// 저장된 자동로그인 세션을 읽는다. 데이터가 없거나 파싱이 실패하면 null 을 돌려준다.
export function load_auto_login_obj() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const local_value = localStorage.getItem(AUTO_LOGIN_STORAGE_KEY)

  if (!local_value) {
    return null
  }

  try {
    return /** @type {AutoLoginObj} */ (JSON.parse(local_value))
  } catch {
    return null
  }
}

// 저장된 자동로그인 세션을 비운다. 로그아웃 또는 토큰 만료 시 사용한다.
export function clear_auto_login_obj() {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.removeItem(AUTO_LOGIN_STORAGE_KEY)
}
