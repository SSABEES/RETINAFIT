/**
 * 분석 결과 페이지에서 사용자가 채워야 할 고정 측정 항목 템플릿.
 * 향후 최종 요구사항 확정 시 이 배열만 교체하면 전체 UI/스토어가 그대로 동작.
 *
 * 항목 셋은 report.svelte 의 원본 mock 측정 항목 셋과 1:1 매칭. 분석 리포트
 * 화면이 expect 하는 항목들을 face_measurement 에서 사용자가 직접 측정한다.
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
  // BE test_json 저장 대상 5개 — 모두 정면 미착용 · MediaPipe 자동 측정.
  // 안경 착용/측면 관련 수동 측정 항목들은 현재 스코프 밖이라 제거 (캡처 자체는 유지).
  // jaw_width/forehead_width/cheekbone_width 는 얼굴형 분류기 입력으로만 쓰이므로
  // capture.measurements_obj 파이프라인에 남겨두고 사용자 측정 UI 에서는 제외.
  { item_id: 'pd',          label: 'PD (눈 간격)',   view: 'front_no_glasses', source: 'auto' },
  { item_id: 'right_pd',    label: '우측 PD (단안)', view: 'front_no_glasses', source: 'auto' },
  { item_id: 'left_pd',     label: '좌측 PD (단안)', view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_width',  label: '얼굴 너비',       view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_height', label: '얼굴 길이',       view: 'front_no_glasses', source: 'auto' },
]
