/**
 * 얼굴분석 요약 화면(/analysis/report)에서 사용하는 추천 매핑 모듈.
 *
 * - SKIN_TONE_FRAME_COLOR_MAP : 피부톤별 어울리는 안경테 컬러 칩 배열
 * - FACE_SHAPE_FRAME_MAP      : 얼굴형별 추천 프레임 형태 배열
 *
 * 매칭 리스트(피부톤 → 컬러, 얼굴형 → 프레임 형태) 가 확정되면 본 모듈의
 * 두 매핑 객체만 교체하면 UI / 호출부는 그대로 동작한다.
 *
 * @typedef {'WARM' | 'COOL' | 'NEUTRAL'} SkinToneKey
 * @typedef {'oval' | 'round' | 'heart' | 'square' | 'oblong'} FaceShapeKey
 *
 * @typedef {object} FrameColorChip
 * @property {string} label       // 칩에 표시할 컬러 명 (예: '골드')
 * @property {string} tone_class  // Tailwind/임의값 배경 클래스 (예: 'bg-[#D4A63F]')
 *
 * @typedef {object} FrameStyleEntry
 * @property {string} name                  // 프레임 형태명 (예: '라운드')
 * @property {string} [description]         // (선택) 부가 설명
 * @property {number} [priority]            // (선택) 1=주, 2=보조 — 매칭 리스트 확정 시 활용
 */

/**
 * 피부톤 → 어울리는 안경테 컬러 칩 배열.
 *
 * NOTE: 매칭 리스트 확정 시 이 객체만 교체. 칩 갯수는 자유, label / tone_class 만 유지.
 *
 * @type {Record<SkinToneKey, FrameColorChip[]>}
 */
export const SKIN_TONE_FRAME_COLOR_MAP = {
  WARM: [
    { label: '골드', tone_class: 'bg-[#D4A63F]' },
    { label: '브라운', tone_class: 'bg-[#8B5E3C]' },
    { label: '버건디', tone_class: 'bg-[#7A1E3A]' },
    { label: '토트이즈', tone_class: 'bg-[#B86B2C]' },
  ],
  COOL: [
    { label: '실버', tone_class: 'bg-[#A7B0BC]' },
    { label: '블랙', tone_class: 'bg-[#111827]' },
    { label: '블루', tone_class: 'bg-[#4A6CF7]' },
    { label: '퍼플', tone_class: 'bg-[#8B5CF6]' },
  ],
  NEUTRAL: [
    { label: '모든 색상 가능', tone_class: 'bg-[#64748B]' },
    { label: '고객 선호 반영', tone_class: 'bg-[#9A1BFF]' },
  ],
}

/**
 * 얼굴형 → 추천 프레임 형태 배열.
 *
 * 매트릭스 기호 매핑:
 *   ◎ → priority 1 (최우선 추천)
 *   ○ → priority 2 (적합)
 *   △ → 제외 (권장하지 않음)
 *
 * 출처: 사내 안경 매칭 가이드 (2026-04-28).
 *   라운드   | 오벌 | 스퀘어 | 직사각 | 보잉 | 캣아이
 *   계란형  ◎    ◎     ○      ○      ◎    ○
 *   둥근형  △    ○     ◎      ◎      ○    ◎
 *   사각형  ◎    ◎     △      △      ○    ○
 *   하트형  ○    ○     △      ○      ◎    △
 *   긴형    ○    ○     ○      △      ○    ○
 *
 * @type {Record<FaceShapeKey, FrameStyleEntry[]>}
 */
export const FACE_SHAPE_FRAME_MAP = {
  oval: [
    { name: '라운드', priority: 1 },
    { name: '오벌', priority: 1 },
    { name: '보잉', priority: 1 },
    { name: '스퀘어', priority: 2 },
    { name: '직사각', priority: 2 },
    { name: '캣아이', priority: 2 },
  ],
  round: [
    { name: '스퀘어', priority: 1 },
    { name: '직사각', priority: 1 },
    { name: '캣아이', priority: 1 },
    { name: '오벌', priority: 2 },
    { name: '보잉', priority: 2 },
  ],
  square: [
    { name: '라운드', priority: 1 },
    { name: '오벌', priority: 1 },
    { name: '보잉', priority: 2 },
    { name: '캣아이', priority: 2 },
  ],
  heart: [
    { name: '보잉', priority: 1 },
    { name: '라운드', priority: 2 },
    { name: '오벌', priority: 2 },
    { name: '직사각', priority: 2 },
  ],
  oblong: [
    { name: '라운드', priority: 2 },
    { name: '오벌', priority: 2 },
    { name: '스퀘어', priority: 2 },
    { name: '보잉', priority: 2 },
    { name: '캣아이', priority: 2 },
  ],
}

/**
 * 피부톤 키별 라벨 / 부가 설명 — 카드 헤더 표기용.
 *
 * @type {Record<SkinToneKey, { label: string, detail: string }>}
 */
export const SKIN_TONE_META = {
  WARM: { label: 'WARM', detail: '따뜻한 톤' },
  COOL: { label: 'COOL', detail: '차가운 톤' },
  NEUTRAL: { label: 'NEUTRAL', detail: '중성 톤' },
}

/**
 * 피부톤 문자열을 표준 SkinToneKey 로 정규화한다.
 * 알 수 없는 값은 'WARM' 으로 폴백 (기존 report.svelte 동작 유지).
 *
 * @param {string | null | undefined} skin_tone_value
 * @returns {SkinToneKey}
 */
export function normalize_skin_tone_key(skin_tone_value) {
  const local_value = String(skin_tone_value ?? '').trim().toUpperCase()
  if (local_value === 'COOL' || local_value.includes('쿨')) return 'COOL'
  if (
    local_value === 'NEUTRAL' ||
    local_value.includes('뉴트럴') ||
    local_value.includes('중성')
  ) {
    return 'NEUTRAL'
  }
  return 'WARM'
}

/**
 * 피부톤 입력을 받아 카드 표시용 메타 + 추천 칩 배열을 묶어서 반환한다.
 *
 * @param {string | null | undefined} skin_tone_value
 * @returns {{ key: SkinToneKey, label: string, detail: string, chip_arr: FrameColorChip[] }}
 */
export function get_skin_tone_recommendation(skin_tone_value) {
  const local_key = normalize_skin_tone_key(skin_tone_value)
  return {
    key: local_key,
    ...SKIN_TONE_META[local_key],
    chip_arr: SKIN_TONE_FRAME_COLOR_MAP[local_key],
  }
}

/**
 * 얼굴형 키 입력에 대해 추천 프레임 형태 배열을 반환한다.
 * 미상시 빈 배열을 반환 — 호출부에서 이를 보고 카드 비표시 처리 가능.
 *
 * @param {string | null | undefined} face_shape_key
 * @returns {FrameStyleEntry[]}
 */
export function get_frame_styles_for_face_shape(face_shape_key) {
  const local_key = String(face_shape_key ?? '').trim().toLowerCase()
  return FACE_SHAPE_FRAME_MAP[/** @type {FaceShapeKey} */ (local_key)] ?? []
}
