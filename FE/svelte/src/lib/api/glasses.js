import { apiRequest } from '@/lib/api/client'

/**
 * 렌즈 선택 옵션 조회
 */
export const get_glasses_options = () => {
  return apiRequest('/api/v1/glasses/lens') // 경로 확정되면 수정 필요 (작성한 모든 파일 수정)
}

/**
 * 안경 추천 목록 조회
 */
export const get_glasses_recommendations = () => {
  return apiRequest('/glasses/recommendations')
}

/**
 * 선택한 렌즈 조건을 서버에 저장
 * @param {Record<string, string[]>} selected_obj
 */
export const save_lens_requirements = (selected_obj) => {
  return apiRequest('/glasses/requirements', {
    method: 'POST',
    body: selected_obj,
  })
}
