/**
 * 분석 결과 페이지에서 사용자가 채워야 할 고정 측정 항목 템플릿.
 * 향후 최종 요구사항 확정 시 이 배열만 교체하면 전체 UI/스토어가 그대로 동작.
 *
 * view 키는 6값 (정면/좌측/우측 × 안경/미착용). 분석 리포트 화면의 view 키와
 * 1:1 매칭되며 캡쳐 step_id 와도 동일하다.
 *
 * @typedef {'front_glasses' | 'front_no_glasses' | 'left_glasses' | 'left_no_glasses' | 'right_glasses' | 'right_no_glasses'} ViewAngle
 * @typedef {'auto' | 'manual'} MeasurementSource
 *
 * @typedef {object} MeasurementTemplateEntry
 * @property {string} item_id
 * @property {string} label
 * @property {ViewAngle} view
 * @property {MeasurementSource} source
 */

/** @type {MeasurementTemplateEntry[]} */
export const MEASUREMENT_TEMPLATE = [
  // 정면 미착용 · MediaPipe 자동 채움
  { item_id: 'pd',          label: 'PD (동공간 거리)', view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_width',  label: '얼굴 너비',        view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_height', label: '얼굴 높이',        view: 'front_no_glasses', source: 'auto' },
  { item_id: 'jaw_width',   label: '턱 너비',          view: 'front_no_glasses', source: 'auto' },
  // 정면 미착용 · 수동
  { item_id: 'brow_gap',    label: '미간 간격',        view: 'front_no_glasses', source: 'manual' },
  { item_id: 'mouth_width', label: '입 너비',          view: 'front_no_glasses', source: 'manual' },
  // 정면 안경 착용 · 수동 (프레임 측정)
  { item_id: 'frame_width', label: '프레임 전체 너비', view: 'front_glasses',    source: 'manual' },
  { item_id: 'lens_width',  label: '렌즈 너비',        view: 'front_glasses',    source: 'manual' },
  { item_id: 'bridge_width',label: '브릿지 너비',      view: 'front_glasses',    source: 'manual' },
  // 좌측 미착용 · 수동
  { item_id: 'left_ear',    label: '귀 위치',          view: 'left_no_glasses',  source: 'manual' },
  // 좌측 안경 착용 · 수동
  { item_id: 'left_temple', label: '안다리 길이',      view: 'left_glasses',     source: 'manual' },
  // 우측 미착용 · 수동
  { item_id: 'right_ear',   label: '귀 위치',          view: 'right_no_glasses', source: 'manual' },
  // 우측 안경 착용 · 수동
  { item_id: 'right_temple',label: '안다리 길이',      view: 'right_glasses',    source: 'manual' },
]
