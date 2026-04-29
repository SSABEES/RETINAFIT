/**
 * 안경 피팅에 필요한 6가지 픽셀 측정값 계산.
 * Flutter 프로젝트 src/lib/measurements.ts 에서 포팅.
 *
 * @typedef {import("./face_types.js").FaceMeasurements} FaceMeasurements
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 */

// 안내측각(inter-canthal) 거리 대비 동공 거리(PD) 비율의 경험 규칙.
// 원본 Flutter 프로젝트의 측정 검증에서 유도됨. 추후 실측 보정 시 후보 상수.
const PD_FACTOR = 0.8

/**
 * 478포인트 정규화 랜드마크 배열에서 8가지 픽셀 측정값을 계산한다.
 * 측정값 중 하나라도 0 이하이면 측정 실패로 null 을 반환한다.
 *
 * 랜드마크 인덱스:
 *  - 454/234: 얼굴 좌우 최외곽(zygomatic arch) → face_width
 *  - 152/10: 턱끝/이마 → face_height
 *  - 263/33: 안내측각 → eye_distance
 *  - 358/129: 콧날 → nose_width
 *  - 397/172: 턱 외곽(턱각 근처) → jaw_width
 *  - 297/67: 눈썹 위 이마 좌우 → forehead_width
 *  - 345/116: 광대뼈 정점(cheekbone prominence) → cheekbone_width
 *
 * PD ≈ eye_distance × 0.8 (원본 프로젝트 경험 규칙)
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} width
 * @param {number} height
 * @returns {FaceMeasurements | null}
 */
export function compute_measurements(landmarks, width, height) {
  if (!landmarks || landmarks.length < 468) return null

  const face_width = Math.abs(landmarks[454].x - landmarks[234].x) * width
  const face_height = Math.abs(landmarks[152].y - landmarks[10].y) * height
  const eye_distance = Math.abs(landmarks[263].x - landmarks[33].x) * width
  const nose_width = Math.abs(landmarks[358].x - landmarks[129].x) * width
  const jaw_width = Math.abs(landmarks[397].x - landmarks[172].x) * width
  const forehead_width = Math.abs(landmarks[297].x - landmarks[67].x) * width
  const cheekbone_width = Math.abs(landmarks[345].x - landmarks[116].x) * width
  const pd_pixels = eye_distance * PD_FACTOR

  // 단안 PD: 코 중심선(168) 의 x 를 기준으로 좌/우 분리.
  // 안과 광학 표준 — 168 은 nasion(코뼈 시작점) 으로 눈선과 거의 같은 수직 위치라 X 투영 왜곡 최소.
  const nose_midline_x = landmarks[168].x * width
  const right_eye_x = landmarks[263].x * width
  const left_eye_x = landmarks[33].x * width
  const right_pd_pixels = Math.abs(right_eye_x - nose_midline_x)
  const left_pd_pixels = Math.abs(nose_midline_x - left_eye_x)

  if (face_width <= 0 || face_height <= 0 || eye_distance <= 0) return null

  return {
    face_width: Math.round(face_width),
    face_height: Math.round(face_height),
    eye_distance: Math.round(eye_distance),
    pd_pixels: Math.round(pd_pixels),
    nose_width: Math.round(nose_width),
    jaw_width: Math.round(jaw_width),
    forehead_width: Math.round(forehead_width),
    cheekbone_width: Math.round(cheekbone_width),
    right_pd_pixels: Math.round(right_pd_pixels),
    left_pd_pixels: Math.round(left_pd_pixels),
  }
}

/**
 * 자동 측정에 사용된 랜드마크 인덱스 쌍을 픽셀 좌표로 변환해 반환한다.
 * measurement_list 의 auto 항목 points 필드에 그대로 세팅 가능.
 *
 * 매핑 (measurement_utils 의 템플릿 item_id 와 1:1):
 *  - pd:              [33, 263]    (안내측각 — eye_distance 기반, factor 0.8 은 거리만 축소)
 *  - right_pd:        [168, 263]   (nasion → 우측 동공)
 *  - left_pd:         [33,  168]   (좌측 동공 → nasion)
 *  - face_width:      [234, 454]   (얼굴 좌우 최외곽)
 *  - face_height:     [10, 152]    (이마/턱끝)
 *  - jaw_width:       [172, 397]   (턱 외곽)
 *  - forehead_width:  [67, 297]    (눈썹 위 이마 좌우)
 *  - cheekbone_width: [116, 345]   (광대뼈 정점)
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} width
 * @param {number} height
 * @returns {Record<string, [import('./face_types.js').Point2D, import('./face_types.js').Point2D]> | null}
 */
export function compute_measurement_points(landmarks, width, height) {
  if (!landmarks || landmarks.length < 468) return null
  /**
   * @param {number} idx
   * @returns {import('./face_types.js').Point2D}
   */
  const px = (idx) => ({ x: landmarks[idx].x * width, y: landmarks[idx].y * height })
  return {
    pd:              [px(33),  px(263)],
    face_width:      [px(234), px(454)],
    face_height:     [px(10),  px(152)],
    jaw_width:       [px(172), px(397)],
    forehead_width:  [px(67),  px(297)],
    cheekbone_width: [px(116), px(345)],
    right_pd:        [px(168), px(263)],
    left_pd:         [px(33),  px(168)],
  }
}

/**
 * FaceDetector 6 keypoint 와 이미지 높이로 귀 높이(이주점 — 눈선 수직 편차) 를 계산한다.
 * 부호 유지: + 면 귀가 눈선보다 아래 위치.
 *
 * @param {import('./face_types.js').FaceDetectorKeypoints} keypoints
 * @param {number} image_height
 * @returns {{ right_y_offset_px: number, left_y_offset_px: number }}
 */
export function compute_ear_offsets(keypoints, image_height) {
  const eye_avg_y_norm = (keypoints.right_eye.y + keypoints.left_eye.y) * 0.5
  const eye_avg_y_px = eye_avg_y_norm * image_height
  return {
    right_y_offset_px: keypoints.right_ear_tragion.y * image_height - eye_avg_y_px,
    left_y_offset_px: keypoints.left_ear_tragion.y * image_height - eye_avg_y_px,
  }
}
