/**
 * 측정 임계값과 경고 코드 단일 정의 모듈.
 *
 * 출처 분류:
 *  - GUIDEBOOK: FE/svelte/docs/guidebook-mirror/MEASUREMENT_INDEX.md (2026-04-26)
 *  - MOCK: 가이드북 미정의 — 광학사 피드백/실측 분포 들어오면 교체.
 *
 * grep 한 방으로 미캘리브레이션 지점 식별:
 *   grep -r "THRESHOLD_SOURCE.MOCK" FE/svelte/src
 */

// === GUIDEBOOK: MEASUREMENT_INDEX.md §2 (2026-04-26) ===

// 단안 PD 좌우 차 — 2mm 이상이면 좌우 개별 가공 필요.
export const MONO_PD_DIFF_THRESHOLD_MM = 2.0

// 귀 높이 좌우 차 — 4mm 이상이면 안경 다리 각도 좌우 조정 필요.
export const EAR_HEIGHT_DIFF_THRESHOLD_MM = 4.0

// === MOCK: 가이드북 미정의 ===

// OH(Optical Height) 좌우 차 — 1mm 이상이면 좌우 동공 높이 처방 보정 권장.
// 일반 안경학 표준 placeholder. 매장 매뉴얼 확정 시 GUIDEBOOK 으로 승격.
export const OH_DIFF_THRESHOLD_MM = 1.0

// 비대칭 IoU 점수 매핑 — IOU_FLOOR 이하면 0점, IOU_CEIL 이상이면 100점.
// 일반인 자연 비대칭은 IoU 0.92~0.97 → 49~85점 범위.
export const ASYMMETRY_IOU_FLOOR = 0.85
export const ASYMMETRY_IOU_CEIL = 0.99

// 비대칭 IoU 산출용 binary mask 캔버스 해상도.
export const ASYMMETRY_CANVAS_W = 200
export const ASYMMETRY_CANVAS_H = 250

// 피부 톤 hue 분류 임계값 (도 단위).
//   [0, COOL_MAX] ∪ [360-COOL_MAX, 360) → COOL
//   (COOL_MAX, WARM_MIN)                 → NEUTRAL
//   [WARM_MIN, WARM_MAX]                 → WARM
export const SKIN_HUE_COOL_MAX = 15
export const SKIN_HUE_WARM_MIN = 30
export const SKIN_HUE_WARM_MAX = 65

// 피부 톤 패치 크기/위치 상수.
export const SKIN_PATCH_SIZE = 30
export const SKIN_FOREHEAD_Y_OFFSET_PX = -40
export const SKIN_TRIM_FRACTION = 0.25

// 패치 신뢰도 게이트 — 평균 RGB 의 HSV 환산값으로 너무 어둡거나 채도가 낮은 패치는 분류에서 제외.
// 그늘/머리카락 그림자/안경 그림자 등이 섞이면 hue 가 노이즈가 돼 결과가 한쪽으로 쏠리는 문제 완화.
export const SKIN_MIN_SAT_FOR_CLASSIFY = 0.12
export const SKIN_MIN_VAL_FOR_CLASSIFY = 0.15

// CIELAB h*ab(= atan2(b*, a*)) 기준 분류 임계값 (도, 0-360 환산).
// 피부는 a*>0 / b*>0 영역이라 실제 분포는 0-90° 사이. 화장품 업계의 웜/쿨 정의에 직접 대응:
//   - h*ab >= WARM_MIN : WARM (노란기 우세)
//   - h*ab <= COOL_MAX : COOL (분홍/빨간기 우세)
//   - 그 외           : NEUTRAL
export const SKIN_LAB_HAB_COOL_MAX = 42
export const SKIN_LAB_HAB_WARM_MIN = 52

// === enum ===

/** @typedef {'GUIDEBOOK' | 'MOCK'} ThresholdSource */
export const THRESHOLD_SOURCE = Object.freeze({
  GUIDEBOOK: 'GUIDEBOOK',
  MOCK: 'MOCK',
})

/** @typedef {'MONO_PD_DIFF_HIGH' | 'EAR_HEIGHT_DIFF_HIGH' | 'OH_DIFF_HIGH'} WarningCode */
export const WARNING_CODE = Object.freeze({
  MONO_PD_DIFF_HIGH: 'MONO_PD_DIFF_HIGH',
  EAR_HEIGHT_DIFF_HIGH: 'EAR_HEIGHT_DIFF_HIGH',
  OH_DIFF_HIGH: 'OH_DIFF_HIGH',
})
