/**
 * MediaPipe 얼굴 랜드마크 공용 타입 정의 (JSDoc typedef).
 * Flutter 프로젝트 src/lib/types.ts 에서 포팅.
 */

/** @typedef {"oval" | "round" | "heart" | "square" | "oblong"} FaceShape */
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
 * @property {number} forehead_width
 * @property {number} cheekbone_width
 * @property {number} right_pd_pixels      코 중심선(168) → 우측 동공(263) 수평 거리. 신규.
 * @property {number} left_pd_pixels       좌측 동공(33) → 코 중심선(168) 수평 거리. 신규.
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
  oval: '계란형',
  round: '둥근형',
  heart: '하트형',
  square: '사각형',
  oblong: '긴형',
}

/** @type {Record<FaceShape, string>} */
export const FACE_SHAPE_LABELS_EN = {
  oval: 'Oval',
  round: 'Round',
  heart: 'Heart',
  square: 'Square',
  oblong: 'Oblong',
}

/** @type {Record<FaceShape, string>} */
export const FACE_SHAPE_DESCRIPTIONS_KO = {
  oval: '이마가 약간 넓고 턱이 좁게 좁아지는 형태. 선택 폭이 가장 넓어요.',
  round: '얼굴 폭과 길이가 비슷한 원형. 각진 프레임으로 또렷한 인상을 줄 수 있어요.',
  heart: '이마가 넓고 턱이 뾰족한 형태. 하단이 넓은 프레임으로 균형을 맞춰요.',
  square: '이마·광대·턱 폭이 비슷하고 각짐. 라운드·오벌 프레임으로 부드러움을 줄 수 있어요.',
  oblong: '얼굴 길이가 폭보다 긴 형태. 가로로 넓은 프레임으로 비율을 보완해요.',
}

/**
 * FaceDetector 6 keypoint 결과를 정규화 좌표(0-1) 로 보관.
 * 인덱스 순서는 BlazeFace 표준: right_eye, left_eye, nose_tip, mouth, right_ear_tragion, left_ear_tragion.
 *
 * @typedef {object} FaceDetectorKeypoint
 * @property {number} x
 * @property {number} y
 *
 * @typedef {object} FaceDetectorKeypoints
 * @property {FaceDetectorKeypoint} right_eye
 * @property {FaceDetectorKeypoint} left_eye
 * @property {FaceDetectorKeypoint} nose_tip
 * @property {FaceDetectorKeypoint} mouth
 * @property {FaceDetectorKeypoint} right_ear_tragion
 * @property {FaceDetectorKeypoint} left_ear_tragion
 */

/**
 * 귀 높이 (눈선 기준 수직 편차). 부호 유지 — + 면 귀가 눈선보다 아래.
 * mm 환산은 PD 63mm 가정 mm_per_px 사용.
 *
 * @typedef {object} EarOffsets
 * @property {number | null} right_y_offset_px
 * @property {number | null} left_y_offset_px
 * @property {number | null} right_y_offset_mm
 * @property {number | null} left_y_offset_mm
 */

/**
 * 비대칭 점수 결과. 래스터화 IoU 기반 (FACE_OVAL 36점 binary mask + mirror XOR).
 *
 * @typedef {object} AsymmetryResult
 * @property {number} score                  0-100, 100 = 완전 대칭
 * @property {number} iou                    원시 IoU (0-1)
 * @property {'MOCK'} threshold_source
 */

/** @typedef {'WARM' | 'NEUTRAL' | 'COOL'} SkinTone */

/**
 * 피부 톤 분류 결과.
 *
 * @typedef {object} SkinToneResult
 * @property {SkinTone} tone
 * @property {number} hue_deg                평균 hue (0-360)
 * @property {number} sample_count           실제 샘플 성공한 패치 수 (1-3)
 * @property {'MOCK'} threshold_source
 */

/** @type {Record<PDSize, string>} */
export const PD_SIZE_LABELS_KO = {
  NARROW: '좁은 PD',
  MEDIUM: '표준 PD',
  WIDE: '넓은 PD',
}
