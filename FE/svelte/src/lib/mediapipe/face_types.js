/**
 * MediaPipe 얼굴 랜드마크 공용 타입 정의 (JSDoc typedef).
 * Flutter 프로젝트 src/lib/types.ts 에서 포팅.
 */

/** @typedef {"ROUND" | "LONG" | "OVAL" | "TRIANGLE" | "SQUARE"} FaceShape */
/** @typedef {"NARROW" | "MEDIUM" | "WIDE"} PDSize */

/**
 * @typedef {object} Point2D
 * @property {number} x
 * @property {number} y
 */

/**
 * 백엔드 POST /api/classify-face 가 기대하는 픽셀 단위 측정값.
 * @typedef {object} FaceMeasurements
 * @property {number} face_width
 * @property {number} face_height
 * @property {number} eye_distance
 * @property {number} pd_pixels
 * @property {number} nose_width
 * @property {number} jaw_width
 */

/**
 * @typedef {object} GlassesRecommendation
 * @property {number} id
 * @property {string} category_name
 * @property {string} category_type
 * @property {string} description
 * @property {number} priority
 */

/**
 * @typedef {object} RecommendationsBundle
 * @property {GlassesRecommendation[]} face_shape_recommendations
 * @property {GlassesRecommendation[]} pd_size_recommendations
 */

/**
 * @typedef {object} ClassifyFaceResponse
 * @property {boolean} success
 * @property {FaceShape} face_shape
 * @property {PDSize} pd_size
 * @property {RecommendationsBundle} recommendations
 */

/**
 * @typedef {object} FrontalCheck
 * @property {boolean} is_frontal
 * @property {"yaw" | "pitch" | "roll" | null} reason
 * @property {number} yaw
 * @property {number} pitch
 * @property {number} roll
 */

/**
 * @typedef {object} CompletenessCheck
 * @property {boolean} is_complete
 * @property {"out-of-frame" | null} reason
 */

/**
 * @typedef {object} DetectResult
 * @property {import("@mediapipe/tasks-vision").NormalizedLandmark[]} landmarks
 * @property {number} image_width
 * @property {number} image_height
 */

/** @type {Record<FaceShape, string>} */
export const FACE_SHAPE_LABELS_KO = {
  ROUND: '둥근형',
  LONG: '긴형',
  OVAL: '계란형',
  TRIANGLE: '하트형',
  SQUARE: '사각형',
}

/** @type {Record<FaceShape, string>} */
export const FACE_SHAPE_LABELS_EN = {
  ROUND: 'Round',
  LONG: 'Oblong',
  OVAL: 'Oval',
  TRIANGLE: 'Heart',
  SQUARE: 'Square',
}

/** @type {Record<FaceShape, string>} */
export const FACE_SHAPE_DESCRIPTIONS_KO = {
  OVAL: '이마가 약간 넓고 턱이 좁게 좁아지는 형태. 선택 폭이 가장 넓어요.',
  ROUND: '얼굴 폭과 길이가 비슷한 원형. 각진 프레임으로 또렷한 인상을 줄 수 있어요.',
  SQUARE: '이마·광대·턱 폭이 비슷하고 각짐. 라운드·오벌 프레임으로 부드러움을 줄 수 있어요.',
  TRIANGLE: '이마가 넓고 턱이 뾰족한 형태. 하단이 넓은 프레임으로 균형을 맞춰요.',
  LONG: '얼굴 길이가 폭보다 긴 형태. 가로로 넓은 프레임으로 비율을 보완해요.',
}

/** @type {Record<PDSize, string>} */
export const PD_SIZE_LABELS_KO = {
  NARROW: '좁은 PD',
  MEDIUM: '표준 PD',
  WIDE: '넓은 PD',
}
