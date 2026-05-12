/**
 * 로컬 얼굴형/PD 분류 및 안경 추천 카테고리 생성.
 * Flutter 프로젝트 src/lib/classify.ts 에서 포팅. 서버 왕복 없이 완결된다.
 *
 * @typedef {import("./face_types.js").FaceShape} FaceShape
 * @typedef {import("./face_types.js").PDSize} PDSize
 * @typedef {import("./face_types.js").FaceMeasurements} FaceMeasurements
 * @typedef {import("./face_types.js").GlassesRecommendation} GlassesRecommendation
 * @typedef {import("./face_types.js").RecommendationsBundle} RecommendationsBundle
 * @typedef {import("./face_types.js").ClassifyFaceResponse} ClassifyFaceResponse
 */

/**
 * @typedef {object} CategoryRow
 * @property {number} id
 * @property {string} category_name
 * @property {"frame_style" | "size_suggestion"} category_type
 * @property {string} description
 */

/** @type {Record<number, CategoryRow>} */
const CATEGORIES = {
  1: {
    id: 1,
    category_name: '라운드프레임',
    category_type: 'frame_style',
    description: '둥근 모양의 프레임',
  },
  2: {
    id: 2,
    category_name: '오버사이즈',
    category_type: 'frame_style',
    description: '큰 사이즈의 프레임',
  },
  3: {
    id: 3,
    category_name: '스퀘어프레임',
    category_type: 'frame_style',
    description: '네모난 프레임',
  },
  4: {
    id: 4,
    category_name: '투톤',
    category_type: 'frame_style',
    description: '두 가지 색상의 프레임',
  },
  5: {
    id: 5,
    category_name: '캣아이',
    category_type: 'frame_style',
    description: '고양이 눈 모양의 프레임',
  },
  6: {
    id: 6,
    category_name: '보스턴',
    category_type: 'frame_style',
    description: '보스턴 렌즈 모양',
  },
  7: {
    id: 7,
    category_name: '서클',
    category_type: 'frame_style',
    description: '동그란 완전 원형 프레임',
  },
  8: { id: 8, category_name: '소형', category_type: 'size_suggestion', description: '작은 사이즈' },
  9: {
    id: 9,
    category_name: '좁은너비',
    category_type: 'size_suggestion',
    description: '좁은 너비',
  },
  10: {
    id: 10,
    category_name: '중간사이즈',
    category_type: 'size_suggestion',
    description: '중간 사이즈',
  },
  11: {
    id: 11,
    category_name: '표준',
    category_type: 'size_suggestion',
    description: '표준 사이즈',
  },
  12: { id: 12, category_name: '대형', category_type: 'size_suggestion', description: '큰 사이즈' },
  13: {
    id: 13,
    category_name: '넓은너비',
    category_type: 'size_suggestion',
    description: '넓은 너비',
  },
}

/** @type {Record<FaceShape, Array<[number, number]>>} */
const FACE_SHAPE_RECS = {
  oval: [
    [5, 1],
    [2, 2],
  ],
  round: [
    [1, 1],
    [2, 2],
  ],
  heart: [
    [6, 1],
    [1, 2],
  ],
  square: [
    [1, 1],
    [7, 2],
  ],
  oblong: [
    [3, 1],
    [4, 2],
  ],
}

/** @type {Record<PDSize, Array<[number, number]>>} */
const PD_SIZE_RECS = {
  NARROW: [
    [8, 1],
    [9, 2],
  ],
  MEDIUM: [
    [10, 1],
    [11, 2],
  ],
  WIDE: [
    [12, 1],
    [13, 2],
  ],
}

/**
 * 얼굴형을 5종 소문자 키로 분류한다.
 * 모든 비율은 광대 너비(cheekbone_width)를 분모로 정규화 — 얼굴 크기에 무관한 형태 비교.
 * 임계값은 한국인 안면계측 연구 기준 (Kim et al. PubMed 15262719, JCAD PMC7605391).
 *
 * @param {Pick<FaceMeasurements, "face_height" | "cheekbone_width" | "forehead_width" | "jaw_width">} m
 * @returns {FaceShape}
 */
export function classify_face_shape(m) {
  const length_to_cheekbone_ratio = m.face_height / m.cheekbone_width
  const forehead_to_cheekbone_ratio = m.forehead_width / m.cheekbone_width
  const jaw_to_cheekbone_ratio = m.jaw_width / m.cheekbone_width

  // 1. 얼굴이 광대 대비 1.55배 이상 길면 oblong (긴형)
  if (length_to_cheekbone_ratio >= 1.55) return 'oblong'

  // 2. 이마가 광대보다 3% 이상 넓고 턱이 광대보다 3% 이상 좁으면 heart (하트형)
  if (forehead_to_cheekbone_ratio > 1.03 && jaw_to_cheekbone_ratio < 0.97) return 'heart'

  // 3. 이마/턱 모두 광대와 7% 이내로 비슷하면 square (사각형)
  if (
    Math.abs(forehead_to_cheekbone_ratio - 1) < 0.07 &&
    Math.abs(jaw_to_cheekbone_ratio - 1) < 0.07
  )
    return 'square'

  // 4. 광대 대비 길이가 1.40 미만이면 round (둥근형)
  if (length_to_cheekbone_ratio < 1.4) return 'round'

  // 5. 기본은 oval (계란형) — 길이 [1.40, 1.55), 폭 비율은 어디에도 안 걸린 일반형
  return 'oval'
}

/**
 * pd_pixels/face_width 비율로 PD 사이즈를 분류한다.
 * @param {number} pd_ratio
 * @returns {PDSize}
 */
export function classify_pd_size(pd_ratio) {
  if (pd_ratio < 0.48) return 'NARROW'
  if (pd_ratio < 0.58) return 'MEDIUM'
  return 'WIDE'
}

/**
 * [카테고리ID, priority] 행들을 GlassesRecommendation 배열로 확장한다.
 * @param {Array<[number, number]>} rows
 * @returns {GlassesRecommendation[]}
 */
function expand(rows) {
  return rows.map(([cat_id, priority]) => ({ ...CATEGORIES[cat_id], priority }))
}

/**
 * 얼굴형과 PD 사이즈에 따른 추천 카테고리 번들을 만든다.
 * @param {FaceShape} face_shape
 * @param {PDSize} pd_size
 * @returns {RecommendationsBundle}
 */
export function build_recommendations(face_shape, pd_size) {
  return {
    face_shape_recommendations: expand(FACE_SHAPE_RECS[face_shape]),
    pd_size_recommendations: expand(PD_SIZE_RECS[pd_size]),
  }
}

/**
 * 측정값을 받아 얼굴형/PD 분류 및 추천을 한 번에 계산해 반환한다.
 * @param {FaceMeasurements} metrics
 * @returns {ClassifyFaceResponse}
 */
export function classify_locally(metrics) {
  const face_shape = classify_face_shape(metrics)
  const pd_ratio = metrics.pd_pixels / metrics.face_width
  const pd_size = classify_pd_size(pd_ratio)
  return {
    success: true,
    face_shape,
    pd_size,
    recommendations: build_recommendations(face_shape, pd_size),
  }
}
