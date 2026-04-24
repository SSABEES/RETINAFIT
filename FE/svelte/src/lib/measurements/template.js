/**
 * 분석 결과 페이지에서 사용자가 채워야 할 고정 측정 항목 템플릿.
 * 향후 최종 요구사항 확정 시 이 배열만 교체하면 전체 UI/스토어가 그대로 동작.
 *
 * @typedef {'front' | 'left_profile' | 'right_profile'} ViewAngle
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
  // 정면 · MediaPipe 자동 채움
  { item_id: 'pd',          label: 'PD (동공간 거리)', view: 'front',         source: 'auto' },
  { item_id: 'face_width',  label: '얼굴 너비',        view: 'front',         source: 'auto' },
  { item_id: 'face_height', label: '얼굴 높이',        view: 'front',         source: 'auto' },
  { item_id: 'jaw_width',   label: '턱 너비',          view: 'front',         source: 'auto' },
  // 정면 · 수동
  { item_id: 'brow_gap',    label: '미간 간격',        view: 'front',         source: 'manual' },
  { item_id: 'mouth_width', label: '입 너비',          view: 'front',         source: 'manual' },
  // 좌측 · 수동
  { item_id: 'left_ear',    label: '귀 위치',          view: 'left_profile',  source: 'manual' },
  { item_id: 'left_temple', label: '안다리 길이',      view: 'left_profile',  source: 'manual' },
  // 우측 · 수동
  { item_id: 'right_ear',   label: '귀 위치',          view: 'right_profile', source: 'manual' },
  { item_id: 'right_temple',label: '안다리 길이',      view: 'right_profile', source: 'manual' },
]
