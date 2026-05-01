import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 안경사 세션으로 추천 옵션 목록을 조회한다.
 * (질문 = option_category, 답변 = option_name 으로 매핑되어 등록된 데이터)
 * @returns {Promise<Array<{ option_no: number, option_name: string, option_category: string, display_order: number, is_active: boolean }>>}
 */
export function get_recommend_option_arr() {
  return apiRequest('/api/v1/recommend-options', {
    headers: get_session_auth_headers(),
  })
}
