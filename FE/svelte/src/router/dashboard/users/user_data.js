export const customer_arr = [
  {
    id: 1,
    name: '김민준',
    phone: '010-1234-5678',
    email: 'minjun@email.com',
    gender: '남성',
    birth_dt: '1990-05-15',
    visit_count: 3,
    last_visit_dt: '2026-04-10',
    face_shape: '타원형',
    skin_tone: '웜톤',
    analysis_done: true,
  },
  {
    id: 2,
    name: '이서연',
    phone: '010-2345-6789',
    email: 'seoyeon@email.com',
    gender: '여성',
    birth_dt: '1994-09-21',
    visit_count: 5,
    last_visit_dt: '2026-04-14',
    face_shape: '하트형',
    skin_tone: '쿨톤',
    analysis_done: true,
  },
  {
    id: 3,
    name: '박지훈',
    phone: '010-3456-7890',
    email: 'jihoon@email.com',
    gender: '남성',
    birth_dt: '1988-11-03',
    visit_count: 2,
    last_visit_dt: '2026-03-28',
    face_shape: '',
    skin_tone: '',
    analysis_done: false,
  },
  {
    id: 4,
    name: '최수빈',
    phone: '010-4567-8901',
    email: 'subin@email.com',
    gender: '여성',
    birth_dt: '1996-02-08',
    visit_count: 7,
    last_visit_dt: '2026-04-12',
    face_shape: '둥근형',
    skin_tone: '뉴트럴',
    analysis_done: true,
  },
  {
    id: 5,
    name: '정도윤',
    phone: '010-5678-9012',
    email: 'doyun@email.com',
    gender: '남성',
    birth_dt: '1992-07-19',
    visit_count: 1,
    last_visit_dt: '2026-04-18',
    face_shape: '',
    skin_tone: '',
    analysis_done: false,
  },
]

export const fitting_report_arr = [
  {
    id: 1,
    title: '클래식 블랙 웰링턴',
    product_nm: '레이벤 · RB5154',
    created_dt: '2026년 4월 16일',
    status: '완료',
  },
  {
    id: 2,
    title: '라운드 티타늄 프레임',
    product_nm: '젠틀몬스터 · GM-201',
    created_dt: '2026년 3월 22일',
    status: '완료',
  },
  {
    id: 3,
    title: '스퀘어 어 세테이트',
    product_nm: '톰브라운 · TB-403',
    created_dt: '2026년 2월 10일',
    status: '완료',
  },
]

export const face_analysis_history_arr = [
  {
    id: 1,
    title: '얼굴형 및 피부톤 분석',
    face_shape: '타원형',
    skin_tone: '웜톤',
    created_dt: '2026년 4월 10일',
    status: '완료',
  },
  {
    id: 2,
    title: '얼굴형 재분석',
    face_shape: '타원형',
    skin_tone: '뉴트럴',
    created_dt: '2026년 3월 22일',
    status: '완료',
  },
  {
    id: 3,
    title: '초기 얼굴 분석',
    face_shape: '둥근형',
    skin_tone: '웜톤',
    created_dt: '2026년 2월 10일',
    status: '완료',
  },
]

/**
 * 고객 ID로 상세 화면에 표시할 고객 정보를 조회한다.
 * @param {string | number} id
 */
export function get_customer_by_id(id) {
  return customer_arr.find((customer_obj) => customer_obj.id === Number(id)) ?? customer_arr[0]
}
