/**
 * 얼굴 측정 결과를 백엔드에 저장하는 API 클라이언트.
 *
 * 흐름 (온보딩 진행 클릭 시):
 * 1. 사진 6장(또는 3장)을 S3 에 업로드해 URL 받기
 *    - S3 통신 API (S14P31S107-95) 가 presigned URL 을 발급한다고 가정
 * 2. POST /visits/{visit_no}/face 로 메타 + S3 URL 들 저장
 *    - BE: app/modules/analysis/router.py 의 save_face_analysis
 *
 * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
 */

import { apiRequest } from '@/lib/api/client'

/**
 * BE 의 presigned URL 발급 엔드포인트 호출.
 * S3 통신 API (S14P31S107-95) 가 아직 진행 중이라 엔드포인트 경로/응답 형태는 임시 가정.
 * 실제 명세 확정되면 이 함수만 갱신하면 된다.
 *
 * @param {string[]} keys  업로드 대상 식별자 (예: 'front_no_glasses')
 * @returns {Promise<Record<string, { upload_url: string, file_url: string }>>}
 * @throws {Error} apiRequest 가 비-2xx 응답이거나 네트워크 오류 시
 */
export async function request_presigned_urls(keys) {
  // TODO(S14P31S107-95): 실제 엔드포인트 확정 시 경로/응답 형태 업데이트.
  return apiRequest('/uploads/presigned-urls', {
    method: 'POST',
    body: { keys },
  })
}

/**
 * Blob 을 presigned URL 로 직접 PUT 한다 (FE → S3 직접 통신).
 * BE 를 거치지 않으므로 BE 대역폭/메모리 부담 없음.
 * Content-Type 은 blob.type 우선, 없으면 image/jpeg 로 강제 지정한다.
 *
 * @param {string} upload_url  presigned PUT URL
 * @param {Blob} blob          업로드할 파일 바이너리
 * @returns {Promise<void>}    성공 시 void, 실패 시 throw
 * @throws {Error} S3 응답이 비-2xx 인 경우 status 를 포함한 메시지를 던진다.
 */
export async function upload_blob_to_s3(upload_url, blob) {
  const response = await fetch(upload_url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
  })
  if (!response.ok) {
    throw new Error(`S3 업로드 실패 (status ${response.status})`)
  }
}

/**
 * 캡쳐 6장 (또는 3장) 을 병렬로 S3 에 업로드하고 file_url 매핑을 반환한다.
 * Promise.all 로 fan-out 하므로 한 장이라도 실패하면 전체가 reject 된다.
 *
 * @param {Record<string, Capture>} captures_obj  step_id → Capture
 * @returns {Promise<Record<string, string>>}     step_id → file_url
 * @throws {Error} presigned URL 누락, S3 PUT 실패, 또는 BE presigned 호출 실패 시
 */
export async function upload_captures_to_s3(captures_obj) {
  const keys = Object.keys(captures_obj)
  const presigned_map = await request_presigned_urls(keys)

  /** @type {Record<string, string>} */
  const file_url_map = {}
  await Promise.all(
    keys.map(async (key) => {
      const presigned = presigned_map[key]
      if (!presigned) {
        throw new Error(`'${key}' presigned URL 누락`)
      }
      await upload_blob_to_s3(presigned.upload_url, captures_obj[key].blob)
      file_url_map[key] = presigned.file_url
    }),
  )
  return file_url_map
}

/**
 * 얼굴 측정 결과를 BE 에 저장한다.
 * BE 스키마: BE/app/modules/analysis/schemas.py 의 FaceAnalysisRequest
 *  - main_file:    정면 사진 URL (필수)
 *  - test_file_arr: 측정 사진 URL 배열
 *  - test_json:    측정값 + 평가 + 메타 dict
 *
 * @param {number} visit_no  방문 ID (URL path 매개변수)
 * @param {{ main_file: string, test_file_arr: string[], test_json: Record<string, unknown> }} body
 * @returns {Promise<{ visit_no: number, [k: string]: any }>}  저장된 방문 정보
 * @throws {Error} BE 가 비-2xx 응답을 주거나 검증 실패 시
 */
export async function save_face_analysis(visit_no, body) {
  return apiRequest(`/visits/${visit_no}/face`, {
    method: 'POST',
    body,
  })
}
