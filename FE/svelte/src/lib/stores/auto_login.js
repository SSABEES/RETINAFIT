const AUTO_LOGIN_STORAGE_KEY = 'retinal_auto_login_obj'

/**
 * @typedef {{
 *   token: string,
 *   token_no: string,
 *   opt_info: Record<string, unknown>,
 *   member_list: Array<Record<string, unknown>>,
 *   keep_login: boolean,
 *   expire_at: number,
 * }} AutoLoginObj
 */

// 오늘 자정(다음날 00:00:00)의 타임스탬프를 반환한다.
function get_next_midnight_ts() {
  const local_now = new Date()
  return new Date(
    local_now.getFullYear(),
    local_now.getMonth(),
    local_now.getDate() + 1,
    0,
    0,
    0,
    0,
  ).getTime()
}

// 자동로그인 세션을 localStorage에 보관한다. 탭/세션을 닫아도 살아남아 다음 진입 시 자동 로그인된다.
export function save_auto_login_obj(auto_login_obj) {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(
      AUTO_LOGIN_STORAGE_KEY,
      JSON.stringify({ ...auto_login_obj, expire_at: get_next_midnight_ts() }),
    )
  } catch {
    // 저장 실패는 무시 - 다음 로그인부터 다시 시도된다.
  }
}

// 저장된 자동로그인 세션을 읽는다. 데이터가 없거나 파싱이 실패하면 null 을 돌려준다.
// keep_login: false 인 경우 자정이 지났으면 만료로 간주하고 삭제 후 null 을 반환한다.
export function load_auto_login_obj() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const local_value = localStorage.getItem(AUTO_LOGIN_STORAGE_KEY)

  if (!local_value) {
    return null
  }

  try {
    const local_obj = /** @type {AutoLoginObj} */ (JSON.parse(local_value))

    if (!local_obj.keep_login && local_obj.expire_at && Date.now() >= local_obj.expire_at) {
      localStorage.removeItem(AUTO_LOGIN_STORAGE_KEY)
      return null
    }

    return local_obj
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
