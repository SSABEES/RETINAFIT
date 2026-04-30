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
  // 정면 미착용 · MediaPipe 자동 채움 (랜드마크 인덱스 매핑이 있는 6개 + 단안 PD 2개)
  { item_id: 'pd',              label: 'PD (눈 간격)',     view: 'front_no_glasses', source: 'auto' },
  { item_id: 'right_pd',        label: '우측 PD (단안)',   view: 'front_no_glasses', source: 'auto' },
  { item_id: 'left_pd',         label: '좌측 PD (단안)',   view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_width',      label: '얼굴 너비',         view: 'front_no_glasses', source: 'auto' },
  { item_id: 'face_height',     label: '얼굴 길이',         view: 'front_no_glasses', source: 'auto' },
  { item_id: 'jaw_width',       label: '턱 너비',           view: 'front_no_glasses', source: 'auto' },
  { item_id: 'forehead_width',  label: '이마 너비',         view: 'front_no_glasses', source: 'auto' },
  { item_id: 'cheekbone_width', label: '광대 너비',         view: 'front_no_glasses', source: 'auto' },

  // 정면 안경 착용 · 수동 (프레임 측정)
  // OH = Optical Height. 렌즈 광학 중심 → 프레임 하단 수직 거리. 동공 높이 처방의 기준.
  { item_id: 'frame_width', label: '프레임 전체 너비', view: 'front_glasses', source: 'manual' },
  { item_id: 'lens_width', label: '렌즈 너비', view: 'front_glasses', source: 'manual' },
  { item_id: 'bridge_width', label: '브릿지 너비', view: 'front_glasses', source: 'manual' },
  { item_id: 'lens_height', label: '렌즈 높이', view: 'front_glasses', source: 'manual' },
  { item_id: 'left_oh',  label: 'OH (좌)', view: 'front_glasses', source: 'manual' },
  { item_id: 'right_oh', label: 'OH (우)', view: 'front_glasses', source: 'manual' },

  // 좌측 미착용 측면 · 수동 (안경 패드/노즈 fit 추적용)
  { item_id: 'left_nose_bridge_height', label: '콧대 높이',  view: 'left_no_glasses', source: 'manual' },
  { item_id: 'left_face_depth',         label: '얼굴 깊이',  view: 'left_no_glasses', source: 'manual' },

  // 우측 미착용 측면 · 수동
  { item_id: 'right_nose_bridge_height', label: '콧대 높이', view: 'right_no_glasses', source: 'manual' },
  { item_id: 'right_face_depth',         label: '얼굴 깊이', view: 'right_no_glasses', source: 'manual' },

  // 좌측 안경 착용 · 수동
  // (귀 높이는 정면 자동 측정으로 일원화 — face_shape_result.ear_offsets_obj 에 보관, 본 템플릿에 미포함)
  // BVD = Back Vertex Distance (정점간거리). 각막 정점 → 렌즈 뒷면 수평 거리.
  // 경사각 = pantoscopic tilt. 렌즈 평면이 수직선과 이루는 각도 (안경학 표준 8-12°).
  { item_id: 'left_temple_angle',      label: '템플 각도',         view: 'left_glasses', source: 'manual' },
  { item_id: 'left_temple_length',     label: '템플 길이',         view: 'left_glasses', source: 'manual' },
  { item_id: 'left_frame_tilt',        label: '프레임 기울기',     view: 'left_glasses', source: 'manual' },
  { item_id: 'left_bvd',               label: 'BVD (정점간거리)',  view: 'left_glasses', source: 'manual' },
  { item_id: 'left_pantoscopic_tilt',  label: '경사각',            view: 'left_glasses', source: 'manual' },

  // 우측 안경 착용 · 수동
  { item_id: 'right_temple_angle',     label: '템플 각도',         view: 'right_glasses', source: 'manual' },
  { item_id: 'right_temple_length',    label: '템플 길이',         view: 'right_glasses', source: 'manual' },
  { item_id: 'right_frame_tilt',       label: '프레임 기울기',     view: 'right_glasses', source: 'manual' },
  { item_id: 'right_bvd',              label: 'BVD (정점간거리)',  view: 'right_glasses', source: 'manual' },
  { item_id: 'right_pantoscopic_tilt', label: '경사각',            view: 'right_glasses', source: 'manual' },
]
