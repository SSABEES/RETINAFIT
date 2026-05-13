/**
 * 분석 결과 페이지에서 사용자가 채워야 할 고정 측정 항목 템플릿.
 * 향후 최종 요구사항 확정 시 이 배열만 교체하면 전체 UI/스토어가 그대로 동작.
 *
 * @typedef {'front_glasses' | 'front_no_glasses' | 'left_glasses' | 'left_no_glasses' | 'right_glasses' | 'right_no_glasses'} ViewAngle
 * @typedef {'auto' | 'manual'} MeasurementSource
 * @typedef {'distance' | 'angle'} MeasurementKind
 *
 * @typedef {object} MeasurementTemplateEntry
 * @property {string} item_id
 * @property {string} label
 * @property {MeasurementKind} kind
 * @property {ViewAngle[]} view                   한 항목을 여러 뷰에 노출하려면 배열 (예: 좌·우 측면 공유)
 * @property {MeasurementSource} source
 */

/** @type {MeasurementTemplateEntry[]} */
export const MEASUREMENT_TEMPLATE = [
  // 정면 미착용 자동 측정 항목 — MediaPipe 출력에서 사전 채움.
  {
    item_id: 'pd',
    label: 'PD (눈 간격)',
    kind: 'distance',
    view: ['front_no_glasses'],
    source: 'auto',
  },
  {
    item_id: 'right_pd',
    label: '우측 PD (단안)',
    kind: 'distance',
    view: ['front_no_glasses'],
    source: 'auto',
  },
  {
    item_id: 'left_pd',
    label: '좌측 PD (단안)',
    kind: 'distance',
    view: ['front_no_glasses'],
    source: 'auto',
  },
  {
    item_id: 'face_width',
    label: '얼굴 너비',
    kind: 'distance',
    view: ['front_no_glasses'],
    source: 'auto',
  },
  {
    item_id: 'face_height',
    label: '얼굴 길이',
    kind: 'distance',
    view: ['front_no_glasses'],
    source: 'auto',
  },

  // 측면 — 전경각 (pantoscopic tilt). 좌·우 각각 별개 항목으로 분리해 측면 뷰 전환 시 점 좌표가
  // 서로 덮어쓰지 않도록 한다. (이전엔 단일 'pantoscopic_tilt' 항목을 4개 측면 뷰가 공유해서
  // 좌측 측정 후 우측 탭으로 이동하면 같은 선이 그대로 보였다.)
  // 본래 안경 착용 측면 두 뷰만 대상이지만, 안경 단계 진입 로직이 일시적으로 비활성화된 동안에는
  // 미착용 측면 뷰에서도 측정 가능하도록 두 뷰 모두 view 에 포함.
  // (안경 단계 분기 복구 시 view 배열을 ['left_glasses'] / ['right_glasses'] 로 다시 좁힐 것.)
  {
    item_id: 'pantoscopic_tilt_left',
    label: '전경각',
    kind: 'angle',
    view: ['left_glasses', 'left_no_glasses'],
    source: 'manual',
  },
  {
    item_id: 'pantoscopic_tilt_right',
    label: '전경각',
    kind: 'angle',
    view: ['right_glasses', 'right_no_glasses'],
    source: 'manual',
  },
]
