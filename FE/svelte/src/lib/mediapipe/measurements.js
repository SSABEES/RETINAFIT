/**
 * 안경 피팅에 필요한 6가지 픽셀 측정값 계산.
 * Flutter 프로젝트 src/lib/measurements.ts 에서 포팅.
 *
 * @typedef {import("./face_types.js").FaceMeasurements} FaceMeasurements
 * @typedef {import("@mediapipe/tasks-vision").NormalizedLandmark} NormalizedLandmark
 */

// PD (Pupillary Distance) 는 동공 중심 사이 거리. MediaPipe Face Landmarker 는 478 포인트 (468 face
// + 양 눈 홍채 5점) 를 반환하므로 홍채 중심을 직접 사용한다. 홍채 인덱스가 누락된 모델 결과(< 478)
// 일 때는 안내측각(33/263) × PD_FACTOR fallback.
const RIGHT_PUPIL_IDX = 468 // 우측 눈(코 중심 기준 우측, 즉 263 방향) 홍채 중심
const LEFT_PUPIL_IDX = 473 // 좌측 눈(코 중심 기준 좌측, 즉 33 방향) 홍채 중심
const PD_FACTOR = 0.8

/**
 * 478포인트 정규화 랜드마크 배열에서 픽셀 측정값을 계산한다.
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
 *  - 468/473: 우/좌 동공 중심 → pd_pixels, right_pd_pixels, left_pd_pixels
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} width
 * @param {number} height
 * @returns {FaceMeasurements | null}
 */
export function compute_measurements(landmarks, width, height) {
  if (!landmarks || landmarks.length < 468) return null
  const has_iris = landmarks.length >= 478

  const face_width = Math.abs(landmarks[454].x - landmarks[234].x) * width
  const face_height = Math.abs(landmarks[152].y - landmarks[10].y) * height
  const eye_distance = Math.abs(landmarks[263].x - landmarks[33].x) * width
  const nose_width = Math.abs(landmarks[358].x - landmarks[129].x) * width
  const jaw_width = Math.abs(landmarks[397].x - landmarks[172].x) * width
  const forehead_width = Math.abs(landmarks[297].x - landmarks[67].x) * width
  const cheekbone_width = Math.abs(landmarks[345].x - landmarks[116].x) * width

  // PD — 동공-동공 수평 거리. iris 가 있으면 정확값, 없으면 안내측각 기반 추정.
  // 단안 PD 는 nasion(168, 코뼈 시작점 — 눈선과 거의 같은 수직 위치) 기준 좌/우 분리.
  const nose_midline_x = landmarks[168].x * width
  const right_pupil_x = (has_iris ? landmarks[RIGHT_PUPIL_IDX].x : landmarks[263].x) * width
  const left_pupil_x = (has_iris ? landmarks[LEFT_PUPIL_IDX].x : landmarks[33].x) * width
  const pd_pixels = has_iris ? Math.abs(right_pupil_x - left_pupil_x) : eye_distance * PD_FACTOR
  const right_pd_pixels = Math.abs(right_pupil_x - nose_midline_x)
  const left_pd_pixels = Math.abs(nose_midline_x - left_pupil_x)

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
 *  - pd:              [좌 동공, 우 동공]     (홍채 중심 — 478 포인트 모델 시 [473, 468])
 *  - right_pd:        [nasion(168), 우 동공]
 *  - left_pd:         [좌 동공, nasion(168)]
 *  - face_width:      [234, 454]   (얼굴 좌우 최외곽)
 *  - face_height:     [10, 152]    (이마/턱끝)
 *  - jaw_width:       [172, 397]   (턱 외곽)
 *  - forehead_width:  [67, 297]    (눈썹 위 이마 좌우)
 *  - cheekbone_width: [116, 345]   (광대뼈 정점)
 *
 * iris 인덱스가 누락된 모델 결과(< 478)면 PD 점은 안내측각(33/263) 으로 fallback.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} width
 * @param {number} height
 * @returns {Record<string, [import('./face_types.js').Point2D, import('./face_types.js').Point2D]> | null}
 */
export function compute_measurement_points(landmarks, width, height) {
  if (!landmarks || landmarks.length < 468) return null
  const has_iris = landmarks.length >= 478
  const right_pupil_idx = has_iris ? RIGHT_PUPIL_IDX : 263
  const left_pupil_idx = has_iris ? LEFT_PUPIL_IDX : 33
  /**
   * @param {number} idx
   * @returns {import('./face_types.js').Point2D}
   */
  const px = (idx) => ({ x: landmarks[idx].x * width, y: landmarks[idx].y * height })
  // 단안 PD 의 코 정중선 점 — x 좌표는 nasion(168) 로 하되 y 좌표를 동공 y 와 같이 맞춰 측정선이
  // 수평으로 보이게 한다. 광학 표준 단안 PD 는 수평 거리만 사용하므로 y 좌표를 옮겨도 수치 영향 없음.
  const nose_midline_x = landmarks[168].x * width
  const right_midline = { x: nose_midline_x, y: landmarks[right_pupil_idx].y * height }
  const left_midline = { x: nose_midline_x, y: landmarks[left_pupil_idx].y * height }
  return {
    pd: [px(left_pupil_idx), px(right_pupil_idx)],
    face_width: [px(234), px(454)],
    face_height: [px(10), px(152)],
    jaw_width: [px(172), px(397)],
    forehead_width: [px(67), px(297)],
    cheekbone_width: [px(116), px(345)],
    right_pd: [right_midline, px(right_pupil_idx)],
    left_pd: [px(left_pupil_idx), left_midline],
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
