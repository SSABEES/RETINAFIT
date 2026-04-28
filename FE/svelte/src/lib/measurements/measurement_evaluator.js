/**
 * 1차 측정값(거리/각도)을 받아 평가 텍스트(적정/주의/경고 등)를 매기는 모듈.
 *
 * MOCK 단계: 임계값은 임시 값으로 시작. 광학사 입력이 들어오면 이 파일만 교체.
 * threshold_source 필드로 임계값의 출처를 추적할 수 있게 한다.
 *
 * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
 *
 * @typedef {'emerald' | 'amber' | 'red' | 'slate'} EvaluationTone
 *
 * @typedef {object} EvaluationItem
 * @property {string} key                       평가 항목 ID (예: 'face_to_frame_ratio')
 * @property {string} label                     UI 표시명
 * @property {string} value_text                평가어 (예: '적정', '주의', '경고')
 * @property {EvaluationTone} tone              표시 색상 톤
 * @property {string[]} depends_on              계산에 사용된 1차 측정 item_id 들
 * @property {'MOCK' | 'GUIDEBOOK'} threshold_source   임계값 출처
 * @property {string | null} [warning_code]     경고 코드 (가이드북 enum) — 정상이면 null
 * @property {number | null} [raw_value]        원시 계산값 (디버깅/추적용)
 */

import {
  MONO_PD_DIFF_THRESHOLD_MM,
  THRESHOLD_SOURCE,
  WARNING_CODE,
} from './thresholds.js'

/**
 * 비율을 받아 적정 범위면 '적정', 좁으면 '주의', 더 좁으면 '경고' 식으로 매핑.
 * @param {number} ratio
 * @param {{ ok_min: number, ok_max: number, warn_min: number, warn_max: number }} thresholds
 * @returns {{ value_text: string, tone: EvaluationTone }}
 */
function evaluate_ratio(ratio, thresholds) {
  if (ratio >= thresholds.ok_min && ratio <= thresholds.ok_max) {
    return { value_text: '적정', tone: 'emerald' }
  }
  if (ratio >= thresholds.warn_min && ratio <= thresholds.warn_max) {
    return { value_text: '주의', tone: 'amber' }
  }
  return { value_text: '경고', tone: 'red' }
}

/**
 * 1차 측정값으로부터 2차 평가를 계산한다.
 * 의존하는 측정값이 부족한 평가는 결과에서 제외한다 (호출 측에서 미평가로 처리).
 *
 * @param {Record<string, MeasurementItem>} measurements_obj
 * @returns {Record<string, EvaluationItem>}
 */
export function compute_evaluations(measurements_obj) {
  /** @type {Record<string, EvaluationItem>} */
  const result = {}

  // 얼굴 대비 프레임 비율: frame_width / face_width.
  // 적정 0.95~1.05, 주의 0.88~1.12, 그 외 경고.
  const frame_width = measurements_obj.frame_width?.value_px
  const face_width = measurements_obj.face_width?.value_px
  if (frame_width && face_width) {
    const ratio = frame_width / face_width
    const { value_text, tone } = evaluate_ratio(ratio, {
      ok_min: 0.95,
      ok_max: 1.05,
      warn_min: 0.88,
      warn_max: 1.12,
    })
    result.face_to_frame_ratio = {
      key: 'face_to_frame_ratio',
      label: '얼굴 대비 프레임 비율',
      value_text,
      tone,
      depends_on: ['frame_width', 'face_width'],
      threshold_source: THRESHOLD_SOURCE.MOCK,
      raw_value: ratio,
    }
  }

  // 렌즈 정렬: PD 의 절반과 렌즈 중심 거리의 비교.
  // MOCK: 두 값 모두 있으면 무조건 '양호' 로 표시 (실측 임계값 들어오기 전).
  const pd = measurements_obj.pd?.value_px
  const bridge_width = measurements_obj.bridge_width?.value_px
  if (pd && bridge_width) {
    result.lens_alignment = {
      key: 'lens_alignment',
      label: '렌즈 중심과 눈동자 정렬',
      value_text: '양호',
      tone: 'emerald',
      depends_on: ['pd', 'bridge_width'],
      threshold_source: THRESHOLD_SOURCE.MOCK,
      raw_value: null,
    }
  }

  // 얼굴 비율: face_height / face_width. "1:1.41" 식으로 표시.
  // 적정 1.30~1.50 (이상형), 그 외엔 표시만 하고 평가 톤은 중립.
  const face_height = measurements_obj.face_height?.value_px
  if (face_width && face_height) {
    const ratio = face_height / face_width
    const is_ideal = ratio >= 1.3 && ratio <= 1.5
    result.face_ratio = {
      key: 'face_ratio',
      label: '얼굴 비율',
      value_text: `1:${ratio.toFixed(2)}${is_ideal ? ' (이상형)' : ''}`,
      tone: is_ideal ? 'emerald' : 'slate',
      depends_on: ['face_width', 'face_height'],
      threshold_source: THRESHOLD_SOURCE.MOCK,
      raw_value: ratio,
    }
  }


  // 단안 PD 좌우 차 — GUIDEBOOK 임계값 2mm.
  // mm 값이 모두 있어야 평가. value_mm 은 PD 63mm 가정 환산이므로
  // 환산 비율이 있는 세션(scale 보유)에서만 동작.
  const right_pd_mm = measurements_obj.right_pd?.value_mm
  const left_pd_mm = measurements_obj.left_pd?.value_mm
  if (right_pd_mm !== null && right_pd_mm !== undefined && left_pd_mm !== null && left_pd_mm !== undefined) {
    const diff = Math.abs(right_pd_mm - left_pd_mm)
    const flagged = diff >= MONO_PD_DIFF_THRESHOLD_MM
    result.mono_pd_diff = {
      key: 'mono_pd_diff',
      label: '단안 PD 좌우 차',
      value_text: flagged
        ? `${diff.toFixed(1)} mm (좌우 차이 큼)`
        : `${diff.toFixed(1)} mm`,
      tone: flagged ? 'amber' : 'emerald',
      depends_on: ['right_pd', 'left_pd'],
      threshold_source: THRESHOLD_SOURCE.GUIDEBOOK,
      warning_code: flagged ? WARNING_CODE.MONO_PD_DIFF_HIGH : null,
      raw_value: diff,
    }
  }

  return result
}
