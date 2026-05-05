import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 안경 1개에 대한 가상 피팅 이미지 Presigned URL 발급 요청
 * @param {number} visit_no
 * @param {number} glasses_no
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const request_fitting_presigned_urls = (visit_no, glasses_no) => {
  return apiRequest(`/api/v1/visits/${visit_no}/files/fitting-photos`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: { glasses_no },
  })
}

/**
 * S3 업로드 완료 후 가상 피팅 결과를 방문 데이터에 PATCH 로 저장
 * @param {number} visit_no
 * @param {{
 *   vp_file_arr: string[],
 *   vp_json: {
 *     fitting_arr: Array<{
 *       glasses_no: number,
 *       brand: string,
 *       model: string,
 *       capture_arr: Array<{ label: string, url: string }>,
 *     }>,
 *   },
 * }} body
 */
export const confirm_fitting_result = (visit_no, body) => {
  return apiRequest(`/api/v1/visits/${visit_no}`, {
    method: 'PATCH',
    headers: get_session_auth_headers(),
    body: {
      ...body,
      vp_dt: new Date().toISOString(),
    },
  })
}

/**
 * 활성화된 안경 전체 목록을 조회
 */
export const get_all_glasses = () => {
  return apiRequest('/api/v1/glasses', {
    headers: get_session_auth_headers(),
  })
}

/**
 * API 응답 안경 객체를 피팅 카드·필터에서 사용하는 필드 구조로 정규화
 * @param {unknown} glass_arr
 */
export const normalize_glasses_arr = (glass_arr) => {
  return (Array.isArray(glass_arr) ? glass_arr : []).map((local_glass_obj, local_index) => {
    const local_spec_obj = local_glass_obj?.glasses_spec_json ?? {}
    const local_raw_no = Number(local_glass_obj?.glasses_no)
    const local_safe_no = Number.isFinite(local_raw_no) ? local_raw_no : local_index + 1

    return {
      id: local_safe_no,
      glasses_no: local_safe_no,
      brand: String(local_glass_obj?.glasses_brand ?? ''),
      model: String(local_glass_obj?.glasses_name ?? ''),
      price: String(local_spec_obj.price ?? ''),
      frame_type: String(local_spec_obj.frame_type ?? ''),
      frame_style: String(local_spec_obj.frame_style ?? ''),
      material: String(local_spec_obj.material ?? ''),
      category: String(local_spec_obj.category ?? ''),
      color: String(local_spec_obj.color ?? ''),
      img_url: String(local_glass_obj?.glasses_img_url ?? ''),
      glasses_3d_url: String(local_glass_obj?.glasses_3d_url ?? ''),
    }
  })
}

/**
 * 활성화된 안경 전체 목록을 조회 후 페이지에서 사용할 형태로 정규화해 반환
 */
export const load_normalized_glasses = async () => {
  const local_raw_arr = await get_all_glasses()
  return normalize_glasses_arr(local_raw_arr)
}
