/**
 * 캡쳐 세션 측정값을 sessionStorage 에 자동 미러링하는 유틸.
 *
 * 사용 시나리오: 사용자가 측정 작업 도중 새로고침/실수 이탈 시 자동 복원.
 * BE 영구 저장은 "온보딩 진행" 시점에만 발생하므로 그 전까지의 데이터 보호용.
 *
 * 주의: sessionStorage 는 탭 단위 수명. 탭을 닫으면 사라진다.
 *       다른 디바이스 동기화는 안 됨 (안경점 단일 세션 가정).
 */

const STORAGE_KEY = 'retinal_capture_session_mirror'

/**
 * @typedef {import('@/lib/measurements/measurement_utils.js').MeasurementItem} MeasurementItem
 * @typedef {import('@/lib/stores/capture_session.svelte.js').ScaleInfo} ScaleInfo
 * @typedef {import('@/lib/stores/capture_session.svelte.js').FaceShapeResult} FaceShapeResult
 *
 * @typedef {object} MirroredSession
 * @property {Record<string, MeasurementItem>} measurements_obj
 * @property {ScaleInfo | null} scale
 * @property {FaceShapeResult | null} face_shape_result
 * @property {string | null} active_item_id
 * @property {number} mirrored_at        Unix ms — 디버그/만료 판단용
 */

/**
 * sessionStorage 사용 가능 여부를 안전하게 확인한다.
 * SSR 또는 일부 브라우저 시크릿 모드에서 sessionStorage 접근이 막힌 경우 false.
 * @returns {boolean}
 */
function is_available() {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * 측정 관련 세션 일부를 sessionStorage 에 직렬화 저장한다.
 * 캡쳐 Blob/ObjectURL 은 직렬화 불가하므로 measurements 와 평가용 메타데이터만 저장.
 *
 * @param {MirroredSession} snapshot
 */
export function write_mirror(snapshot) {
  if (!is_available()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // QuotaExceededError 등 — 미러링 실패는 사용자 흐름에 영향 없음, 조용히 무시.
  }
}

/**
 * sessionStorage 에 저장된 측정 미러를 읽어 복원 가능한 객체로 반환한다.
 * 없거나 파싱 실패면 null.
 * @returns {MirroredSession | null}
 */
export function read_mirror() {
  if (!is_available()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 미러를 명시적으로 제거한다. 세션 reset 시점에 호출.
 */
export function clear_mirror() {
  if (!is_available()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시.
  }
}
