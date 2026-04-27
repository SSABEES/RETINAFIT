import { apiRequest } from '@/lib/api/client'

// 전부 다 경로 확정되면 수정 필요

/**
 * 렌즈 선택 옵션 조회
 */
export const get_glasses_options = () => {
  return apiRequest('/api/v1/glasses/lens')
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

/**
 * 안경 1개에 대한 가상 피팅 이미지 Presigned URL 발급 요청
 * @param {number} visit_no
 * @param {number} glasses_no
 * @returns {Promise<{ glasses_no: number, front_url: string, left_url: string, right_url: string, front_key: string, left_key: string, right_key: string }>}
 */
export const request_fitting_presigned_urls = (visit_no, glasses_no) => {
  return apiRequest(`/v1/visits/${visit_no}/files/vp`, {
    method: 'POST',
    body: { glasses_no },
  })
}

/**
 * S3 업로드 완료 후 가상 피팅 결과를 백엔드에 저장
 * @param {number} visit_no
 * @param {{ vp_file_arr: string[], vp_json: { glasses_no: number, fitting_result: object } }} body
 */
export const confirm_fitting_result = (visit_no, body) => {
  return apiRequest(`/v1/visits/${visit_no}/vp`, {
    method: 'POST',
    body,
  })
}

/**
 * 전체 안경 목록 조회 (프레임 필터 모달용)
 * TODO: 백엔드 연동 후 apiRequest로 교체
 */
export const get_all_glasses = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 'a1',
          brand: '젠틀몬스터',
          model: '쿠보 01',
          price: '289,000',
          frame_type: '뿔테',
          frame_style: '풀프레임',
          material: '아세테이트',
          category: '안경',
          img_url: 'https://placehold.co/340x160/F5EAF7/AA83B4?text=KUBO+01',
        },
        {
          id: 'a2',
          brand: '레이벤',
          model: '라운드 메탈',
          price: '185,000',
          frame_type: '메탈',
          frame_style: '풀프레임',
          material: '메탈',
          category: '안경',
          img_url: 'https://placehold.co/340x160/EEF2FF/818CF8?text=Round+Metal',
        },
        {
          id: 'a3',
          brand: '모스콧',
          model: '렘토쉬',
          price: '360,000',
          frame_type: '아세테이트',
          frame_style: '풀프레임',
          material: '아세테이트',
          category: '안경',
          img_url: 'https://placehold.co/340x160/FEF9EE/F59E0B?text=LEMTOSH',
        },
        {
          id: 'a4',
          brand: '구찌',
          model: 'GG0006O',
          price: '420,000',
          frame_type: '하프림',
          frame_style: '하프프레임',
          material: '메탈',
          category: '안경',
          img_url: 'https://placehold.co/340x160/F0FDF4/4ADE80?text=GG0006O',
        },
        {
          id: 'a5',
          brand: '톰포드',
          model: 'TF5488-B',
          price: '380,000',
          frame_type: '뿔테',
          frame_style: '풀프레임',
          material: '아세테이트',
          category: '안경',
          img_url: 'https://placehold.co/340x160/F1F5F9/475569?text=TF5488',
        },
        {
          id: 'a6',
          brand: '린드버그',
          model: '에어 티타늄',
          price: '450,000',
          frame_type: '무테',
          frame_style: '무프레임',
          material: '티타늄',
          category: '안경',
          img_url: 'https://placehold.co/340x160/E0F2FE/0284C7?text=Air+Ti',
        },
        {
          id: 'a7',
          brand: '실루엣',
          model: 'SPX Full',
          price: '390,000',
          frame_type: '무테',
          frame_style: '무프레임',
          material: '혼합',
          category: '안경',
          img_url: 'https://placehold.co/340x160/FEF3C7/D97706?text=SPX',
        },
        {
          id: 'a8',
          brand: '오클리',
          model: 'Frogskins',
          price: '160,000',
          frame_type: '뿔테',
          frame_style: '풀프레임',
          material: '혼합',
          category: '선글라스',
          img_url: 'https://placehold.co/340x160/ECFDF5/059669?text=Frogskins',
        },
        {
          id: 'a9',
          brand: '레이벤',
          model: '웨이파러',
          price: '195,000',
          frame_type: '아세테이트',
          frame_style: '풀프레임',
          material: '아세테이트',
          category: '선글라스',
          img_url: 'https://placehold.co/340x160/FFF1F2/E11D48?text=Wayfarer',
        },
        {
          id: 'a10',
          brand: '나이키',
          model: 'Veer',
          price: '120,000',
          frame_type: '혼합',
          frame_style: '풀프레임',
          material: '혼합',
          category: '스포츠',
          img_url: 'https://placehold.co/340x160/F0F9FF/0369A1?text=Veer',
        },
        {
          id: 'a11',
          brand: '프로스펙스',
          model: 'M-60',
          price: '89,000',
          frame_type: '메탈',
          frame_style: '하프프레임',
          material: '메탈',
          category: '스포츠',
          img_url: 'https://placehold.co/340x160/F5F3FF/7C3AED?text=M-60',
        },
        {
          id: 'a12',
          brand: '페라가모',
          model: 'SF2939',
          price: '280,000',
          frame_type: '하프림',
          frame_style: '하프프레임',
          material: '티타늄',
          category: '안경',
          img_url: 'https://placehold.co/340x160/FDF2F8/C026D3?text=SF2939',
        },
      ])
    }, 400)
  })
}
