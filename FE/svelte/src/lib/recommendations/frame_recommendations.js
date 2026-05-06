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
 * @property {string} label           // 칩에 표시할 컬러 명 (예: '골드')
 * @property {string} tone_class      // Tailwind/임의값 단색 배경 (작은 dot/preview 용도)
 * @property {string} gradient_class  // 칸 전체를 채우는 선형 그라데이션 (밝은 톤 → 진한 톤)
 * @property {string} text_class      // 그라데이션 위 라벨 색 (어두운 끝쪽 기준 가독성)
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
// gradient_class 는 디자인 시안의 보라(#933ABC→#330046)와 동일한 결의 컬러별 변형 —
// 칩 색을 from(밝은 변형), to(매우 어두운 변형)로 두어 톱-레프트→바텀-라이트 방향으로 깊어진다.
// text_class 는 어두운 끝 톤을 기준으로 가독성이 보장되도록 모두 흰색으로 통일.
export const SKIN_TONE_FRAME_COLOR_MAP = {
  WARM: [
    {
      label: '골드',
      tone_class: 'bg-[#D4A63F]',
      gradient_class: 'bg-gradient-to-br from-[#E0B85C] to-[#4A3812]',
      text_class: 'text-white',
    },
    {
      label: '브라운',
      tone_class: 'bg-[#8B5E3C]',
      gradient_class: 'bg-gradient-to-br from-[#A37852] to-[#3A2614]',
      text_class: 'text-white',
    },
    {
      label: '버건디',
      tone_class: 'bg-[#7A1E3A]',
      gradient_class: 'bg-gradient-to-br from-[#9B2D4D] to-[#2E0A14]',
      text_class: 'text-white',
    },
    {
      label: '토트이즈',
      tone_class: 'bg-[#B86B2C]',
      gradient_class: 'bg-gradient-to-br from-[#CF8344] to-[#4D2D11]',
      text_class: 'text-white',
    },
  ],
  COOL: [
    {
      label: '실버',
      tone_class: 'bg-[#B0BAC8]',
      gradient_class: 'bg-gradient-to-br from-[#CDD4DE] to-[#6B7A8D]',
      text_class: 'text-white',
    },
    {
      label: '블랙',
      tone_class: 'bg-[#1A1D2E]',
      gradient_class: 'bg-gradient-to-br from-[#2E3248] to-[#0A0B10]',
      text_class: 'text-white',
    },
    {
      label: '블루',
      tone_class: 'bg-[#4B55D4]',
      gradient_class: 'bg-gradient-to-br from-[#6874E8] to-[#1E2672]',
      text_class: 'text-white',
    },
    {
      label: '보라',
      tone_class: 'bg-[#7B54B5]',
      gradient_class: 'bg-gradient-to-br from-[#9B6FD6] to-[#3D1A6B]',
      text_class: 'text-white',
    },
  ],
  NEUTRAL: [
    {
      label: '모든 색상 가능',
      tone_class: 'bg-[#64748B]',
      gradient_class: 'bg-gradient-to-br from-[#7B8AA1] to-[#2A3140]',
      text_class: 'text-white',
    },
    {
      label: '고객 선호 반영',
      tone_class: 'bg-[#9A1BFF]',
      gradient_class: 'bg-gradient-to-br from-[#B14EFF] to-[#330046]',
      text_class: 'text-white',
    },
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
  const local_value = String(skin_tone_value ?? '')
    .trim()
    .toUpperCase()
  if (local_value === 'COOL' || local_value.includes('쿨')) return 'COOL'
  if (local_value === 'NEUTRAL' || local_value.includes('뉴트럴') || local_value.includes('중성')) {
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
  const local_key = String(face_shape_key ?? '')
    .trim()
    .toLowerCase()
  return FACE_SHAPE_FRAME_MAP[/** @type {FaceShapeKey} */ (local_key)] ?? []
}

// FACE_SHAPE_FRAME_MAP 의 한글 이름과, 안경 객체의 frame_style 값(영문) 사이 매핑.
// admin 의 g_frame_style_option_arr 기준.
/** @type {Record<string, string>} */
const FRAME_STYLE_NAME_TO_VALUE = {
  라운드: 'round',
  오벌: 'oval',
  스퀘어: 'square',
  직사각: 'rectangle',
  직사각형: 'rectangle',
  보잉: 'aviator',
  캣아이: 'cat_eye',
  브로우라인: 'browline',
}

/**
 * 칩 객체에서 배경 클래스를 반환한다.
 * gradient_class 가 없을 때 tone_class 로 폴백하므로 어떤 칩이 와도 안전하게 렌더링된다.
 * @param {FrameColorChip} chip_obj
 * @returns {string}
 */
export function get_chip_bg_class(chip_obj) {
  return chip_obj.gradient_class || chip_obj.tone_class || 'bg-slate-400'
}

/**
 * 칩 객체에서 텍스트 색상 클래스를 반환한다.
 * text_class 가 없을 때 흰색으로 폴백.
 * @param {FrameColorChip} chip_obj
 * @returns {string}
 */
export function get_chip_text_class(chip_obj) {
  return chip_obj.text_class || 'text-white'
}

/**
 * 얼굴형에 적합한 frame_style 값(영문) 집합을 반환.
 * @param {string | null | undefined} face_shape_value
 * @returns {Set<string>}
 */
function get_face_shape_frame_style_value_set(face_shape_value) {
  const local_entry_arr = get_frame_styles_for_face_shape(face_shape_value)
  const local_set = new Set()
  for (const local_entry of local_entry_arr) {
    const local_value = FRAME_STYLE_NAME_TO_VALUE[local_entry.name]
    if (local_value) local_set.add(local_value)
  }
  return local_set
}

/**
 * 피부톤에 적합한 안경 색상 라벨 배열을 반환. NEUTRAL 은 빈 배열(=모든 색 허용).
 * @param {string | null | undefined} skin_tone_value
 * @returns {string[]}
 */
function get_skin_tone_color_label_arr(skin_tone_value) {
  const local_key = normalize_skin_tone_key(skin_tone_value)
  if (local_key === 'NEUTRAL') return []
  return SKIN_TONE_FRAME_COLOR_MAP[local_key].map((local_chip) => local_chip.label)
}

/**
 * 안경 색상 문자열이 추천 라벨 중 하나와 매칭되는지 (양방향 부분 매칭).
 * @param {string | null | undefined} glass_color_value
 * @param {string[]} recommended_label_arr
 * @returns {boolean}
 */
function does_glass_color_match(glass_color_value, recommended_label_arr) {
  if (recommended_label_arr.length === 0) return true
  if (!glass_color_value) return false
  const local_color = String(glass_color_value).trim().toLowerCase()
  if (!local_color) return false
  return recommended_label_arr.some((local_label) => {
    const local_lower = local_label.toLowerCase()
    return local_color.includes(local_lower) || local_lower.includes(local_color)
  })
}

/**
 * 배열에서 무작위 한 개를 뽑아 반환. 비어있으면 null.
 * @template T
 * @param {readonly T[]} arr
 * @returns {T | null}
 */
function pick_random_one(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * @typedef {{ id: number | string, frame_style?: string, color?: string }} GlassLike
 */

/**
 * 안경 목록을 얼굴형 추천 frame_style 로 필터링한 새 배열을 반환.
 * 얼굴형 정보가 없거나 매칭 0개면 빈 배열.
 *
 * @template {GlassLike} T
 * @param {readonly T[]} glass_arr
 * @param {string | null | undefined} face_shape_value
 * @returns {T[]}
 */
function filter_glasses_by_face_shape(glass_arr, face_shape_value) {
  const local_style_value_set = get_face_shape_frame_style_value_set(face_shape_value)
  if (local_style_value_set.size === 0) return []
  return glass_arr.filter((local_glass) => local_style_value_set.has(local_glass.frame_style ?? ''))
}

/**
 * 안경 목록을 피부톤 추천 색상으로 필터링한 새 배열을 반환.
 * 피부톤 정보 자체가 비어있으면 빈 배열 (호출부에서 전체로 폴백).
 *
 * @template {GlassLike} T
 * @param {readonly T[]} glass_arr
 * @param {string | null | undefined} skin_tone_value
 * @returns {T[]}
 */
function filter_glasses_by_skin_tone(glass_arr, skin_tone_value) {
  if (!skin_tone_value || !String(skin_tone_value).trim()) return []
  const local_color_label_arr = get_skin_tone_color_label_arr(skin_tone_value)
  return glass_arr.filter((local_glass) =>
    does_glass_color_match(local_glass.color, local_color_label_arr),
  )
}

/**
 * 추천 안경 3개를 뽑는다.
 *
 * 슬롯별 후보 리스트:
 *   - 슬롯 0: 얼굴형에 맞는 안경 목록 (정보 없거나 매칭 0개면 전체로 폴백)
 *   - 슬롯 1: 얼굴톤에 맞는 안경 목록 (정보 없거나 매칭 0개면 전체로 폴백)
 *   - 슬롯 2: 불러온 전체 안경 목록
 *
 * 각 슬롯에서 랜덤 1개씩 뽑되, 같은 안경이 두 슬롯에 노출되지 않도록 id 기준 dedup.
 * 슬롯 후보가 모두 이미 다른 슬롯에 뽑혀 있으면 전체 목록의 미사용 안경으로 폴백.
 *
 * @template {GlassLike} T
 * @param {readonly T[]} glass_arr
 * @param {string | null | undefined} face_shape_value
 * @param {string | null | undefined} skin_tone_value
 * @returns {T[]}
 */
export function pick_recommended_glasses_arr(glass_arr, face_shape_value, skin_tone_value) {
  if (!Array.isArray(glass_arr) || glass_arr.length === 0) return []

  // 1) 슬롯별 후보 리스트 빌드 — 사용자 spec: 각 슬롯에 "안경 목록" 을 복사
  const local_face_match_arr = filter_glasses_by_face_shape(glass_arr, face_shape_value)
  const local_tone_match_arr = filter_glasses_by_skin_tone(glass_arr, skin_tone_value)

  /** @type {readonly T[][]} */
  const local_slot_candidate_arr_arr = [
    local_face_match_arr.length > 0 ? local_face_match_arr : glass_arr,
    local_tone_match_arr.length > 0 ? local_tone_match_arr : glass_arr,
    glass_arr,
  ]

  // 2) 각 슬롯에서 dedup 하며 랜덤 1개씩
  /** @type {Set<T['id']>} */
  const local_used_id_set = new Set()
  /** @type {T[]} */
  const local_result_arr = []

  for (const local_candidate_arr of local_slot_candidate_arr_arr) {
    const local_unused_arr = local_candidate_arr.filter(
      (local_glass) => !local_used_id_set.has(local_glass.id),
    )
    let local_pick = pick_random_one(local_unused_arr)

    // 후보가 모두 중복돼서 못 뽑으면 전체에서 미사용 안경으로 폴백
    if (!local_pick) {
      const local_global_unused_arr = glass_arr.filter(
        (local_glass) => !local_used_id_set.has(local_glass.id),
      )
      local_pick = pick_random_one(local_global_unused_arr)
    }

    if (local_pick) {
      local_result_arr.push(local_pick)
      local_used_id_set.add(local_pick.id)
    }
  }

  return local_result_arr
}
