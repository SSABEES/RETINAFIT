import { get_customer_store_by_id } from '@/lib/stores/customer'

export const fitting_report_arr = []
export const face_analysis_history_arr = []

/**
 * 고객 ID로 현재 조회된 고객 상세 정보를 조회한다.
 * @param {string | number} id
 */
export function get_customer_by_id(id) {
  return (
    get_customer_store_by_id(id) ?? {
      id: Number(id),
      name: '고객 정보 없음',
      phone: '-',
      email: '',
      gender: '-',
      birth_dt: '-',
      visit_count: 0,
      last_visit_dt: '-',
      face_shape: '',
      skin_tone: '',
      analysis_done: false,
    }
  )
}
