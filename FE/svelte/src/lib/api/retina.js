const RETINA_API_BASE_URL = import.meta.env.VITE_RETINA_API_BASE_URL

/**
 * RETINAL 프로시저 요청을 beta9 retina API 형식으로 전송한다.
 * @param {Record<string, unknown>} request_obj
 * @param {{ token?: string, token_no?: string }} [auth_obj]
 */
async function exec_retina_request(request_obj, auth_obj = {}) {
  const local_body_obj = {
    data: request_obj,
    token: auth_obj.token ?? '',
    token_no: auth_obj.token_no ?? '',
  }

  const local_response = await fetch(`${RETINA_API_BASE_URL}/retina/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(local_body_obj),
  })

  const local_result_obj = await local_response.json().catch(() => null)

  if (!local_response.ok) {
    throw new Error(
      local_result_obj?.message ?? `로그인 요청에 실패했습니다. (${local_response.status})`,
    )
  }

  if (!local_result_obj) {
    throw new Error('로그인 응답을 확인할 수 없습니다.')
  }

  return local_result_obj
}

/**
 * 로그인 토큰이 필요한 RETINAL 프로시저 요청을 beta9 request API로 전송한다.
 * @param {Record<string, unknown>} request_obj
 */
async function exec_retina_auth_request(request_obj) {
  const local_token = sessionStorage.getItem('token')
  const local_token_no = sessionStorage.getItem('token_no')

  if (!local_token || !local_token_no) {
    throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')
  }

  const local_body_obj = {
    data: request_obj,
    token: local_token,
    token_no: local_token_no,
  }

  const local_response = await fetch(`${RETINA_API_BASE_URL}/retina/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(local_body_obj),
  })

  const local_result_obj = await local_response.json().catch(() => null)

  if (!local_response.ok) {
    throw new Error(local_result_obj?.message ?? `요청에 실패했습니다. (${local_response.status})`)
  }

  if (!local_result_obj) {
    throw new Error('요청 응답을 확인할 수 없습니다.')
  }

  if (local_result_obj.O_TOKEN === '-1') {
    throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
  }

  if (local_result_obj.data?.RESULT !== undefined) {
    throw new Error(String(local_result_obj.data.RESULT || '요청 처리에 실패했습니다.'))
  }

  return local_result_obj.data
}

/**
 * 매장 계정으로 로그인하고 안경원/안경사 목록과 토큰 정보를 반환한다.
 * @param {{ user_id: string, user_passwd: string }} login_obj
 */
export async function retina_login(login_obj) {
  const local_params_obj = {
    p_nm: 'PKG_RTN_SSAFY.SP_S_LOGIN',
    in1: login_obj.user_id,
    in2: login_obj.user_passwd,
    out1: 'cursor',
    out2: 'cursor',
    out3: 'num',
  }

  const local_result_obj = await exec_retina_request(local_params_obj)

  if (local_result_obj.token) {
    sessionStorage.setItem('token', local_result_obj.token)
  }

  if (local_result_obj.token_no && local_result_obj.token_no !== '0') {
    sessionStorage.setItem('token_no', local_result_obj.token_no)
  }

  if (local_result_obj.data?.RESULT !== undefined) {
    throw new Error(String(local_result_obj.data.RESULT || '로그인 정보가 올바르지 않습니다.'))
  }

  return {
    opt_arr: Array.isArray(local_result_obj.data?.out1) ? local_result_obj.data.out1 : [],
    member_arr: Array.isArray(local_result_obj.data?.out2) ? local_result_obj.data.out2 : [],
    result_no: String(local_result_obj.data?.out3 ?? '-1'),
  }
}

/**
 * 선택된 안경원 번호와 휴대폰 번호로 고객 정보를 조회한다.
 * @param {{ opt_no: string, phone: string }} search_obj
 */
export async function retina_find_customer_by_phone(search_obj) {
  const local_params_obj = {
    p_nm: 'PKG_RTN_SSAFY.SP_L_CUST_PHONE',
    in1: search_obj.opt_no,
    in2: search_obj.phone.replace(/[^0-9]/g, ''),
    out1: 'cursor',
    out2: 'num',
  }

  const local_data_obj = await exec_retina_auth_request(local_params_obj)

  return {
    customer_arr: Array.isArray(local_data_obj?.out1) ? local_data_obj.out1 : [],
    result_no: String(local_data_obj?.out2 ?? '-1'),
  }
}

/**
 * 선택된 안경원에 신규 고객 정보를 등록한다.
 * @param {{ opt_no: string, name: string, phone1: string, phone2: string, birth_dt: string, gender: string }} customer_obj
 */
export async function retina_create_customer(customer_obj) {
  const local_params_obj = {
    p_nm: 'PKG_RTN_SSAFY.SP_I_CUST',
    in1: customer_obj.opt_no,
    in2: customer_obj.name,
    in3: customer_obj.phone1.replace(/[^0-9]/g, ''),
    in4: customer_obj.phone2.replace(/[^0-9]/g, ''),
    in5: customer_obj.birth_dt,
    in6: customer_obj.gender,
    out1: 'num',
    out2: 'num',
    out3: 'num',
  }

  const local_data_obj = await exec_retina_auth_request(local_params_obj)

  return {
    cust_no: Number(local_data_obj?.out1 ?? 0),
    result_no: String(local_data_obj?.out2 ?? '-1'),
    error_no: String(local_data_obj?.out3 ?? '-1'),
  }
}
