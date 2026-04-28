/**
 * 얼굴 측정 결과를 백엔드에 저장하는 API 클라이언트.
 *
 * 흐름 (온보딩 진행 클릭 시):
 * 1. 사진을 S3 에 업로드해 URL 받기
 *    - BE 가 type='bare' / 'glasses' 별로 3장(front/left/right) presigned PUT URL 묶음 발급
 *    - BE: app/modules/analysis/file_router.py 의 get_test_file_presigned_urls
 * 2. POST /visits/{visit_no}/face 로 메타 + S3 URL 들 저장
 *    - BE: app/modules/analysis/router.py 의 save_face_analysis
 *
 * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
 *
 * @typedef {'bare' | 'glasses'} TestFileType
 * @typedef {'front' | 'left' | 'right'} TestFileSlot
 *
 * @typedef {object} TestFilePresignedResponse
 * @property {TestFileType} type
 * @property {string} front_url
 * @property {string} left_url
 * @property {string} right_url
 * @property {string} front_key
 * @property {string} left_key
 * @property {string} right_key
 */

import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * 캡쳐 세션의 step_id 를 BE Test 엔드포인트의 type/slot 매핑으로 변환한다.
 * BE 는 'bare' / 'glasses' 두 그룹에 front/left/right 슬롯만 있다.
 * 해당 매핑이 없는 step_id 는 null 을 반환해 호출 측이 무시할 수 있게 한다.
 *
 * @param {string} step_id
 * @returns {{ type: TestFileType, slot: TestFileSlot } | null}
 */
function map_step_id_to_slot(step_id) {
  switch (step_id) {
    case 'front_no_glasses': return { type: 'bare', slot: 'front' }
    case 'left_no_glasses':  return { type: 'bare', slot: 'left' }
    case 'right_no_glasses': return { type: 'bare', slot: 'right' }
    case 'front_glasses':    return { type: 'glasses', slot: 'front' }
    case 'left_glasses':     return { type: 'glasses', slot: 'left' }
    case 'right_glasses':    return { type: 'glasses', slot: 'right' }
    default: return null
  }
}

/**
 * BE 의 test 파일 presigned PUT URL 묶음을 발급받는다.
 * type 당 한 번 호출하면 front/left/right 3슬롯이 함께 발급된다.
 *
 * @param {number | string} visit_no
 * @param {TestFileType} type
 * @returns {Promise<TestFilePresignedResponse>}
 * @throws {Error} BE 가 비-2xx 응답을 줄 때
 */
export async function request_test_presigned_urls(visit_no, type) {
  return apiRequest(`/api/v1/visits/${visit_no}/files/test`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: { type },
  })
}

/**
 * S3 object key 로부터 공개 GET URL 을 조립한다.
 * 환경변수 VITE_S3_PUBLIC_HOST 에
 * 'https://{bucket}.s3.{region}.amazonaws.com' 형식의 호스트를 넣어둔다.
 *
 * @param {string} key
 * @returns {string}
 * @throws {Error} 환경변수가 비어 있을 때
 */
function build_public_file_url(key) {
  const host = import.meta.env.VITE_S3_PUBLIC_HOST
  if (!host || typeof host !== 'string') {
    throw new Error('VITE_S3_PUBLIC_HOST 가 .env.local 에 설정되지 않았습니다.')
  }
  return `${host.replace(/\/+$/, '')}/${key}`
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
 * 캡쳐들을 BE Test 엔드포인트의 'bare'/'glasses' 그룹으로 분리해
 * presigned 발급 → S3 PUT 까지 수행하고, step_id → 공개 GET URL 매핑을 반환한다.
 *
 * Promise.all 로 fan-out 하므로 한 장이라도 실패하면 전체가 reject 된다.
 * 알 수 없는 step_id 는 매핑에서 무시된다 (워크플로우 변경에 강건하게).
 *
 * @param {number | string} visit_no
 * @param {Record<string, Capture>} captures_obj
 * @returns {Promise<Record<string, string>>}  step_id → file_url
 * @throws {Error} BE presigned 호출 실패, S3 PUT 실패, 응답 슬롯 누락 등
 */
export async function upload_captures_to_s3(visit_no, captures_obj) {
  /** @type {Record<TestFileType, Array<{ step_id: string, slot: TestFileSlot }>>} */
  const groups = { bare: [], glasses: [] }
  for (const step_id of Object.keys(captures_obj)) {
    const local_mapping = map_step_id_to_slot(step_id)
    if (!local_mapping) continue
    groups[local_mapping.type].push({ step_id, slot: local_mapping.slot })
  }

  /** @type {Record<string, string>} */
  const file_url_map = {}

  /** @type {TestFileType[]} */
  const types_to_upload = ['bare', 'glasses']

  await Promise.all(
    types_to_upload
      .filter((type) => groups[type].length > 0)
      .map(async (type) => {
        const presigned = await request_test_presigned_urls(visit_no, type)
        await Promise.all(
          groups[type].map(async ({ step_id, slot }) => {
            const upload_url = presigned[`${slot}_url`]
            const object_key = presigned[`${slot}_key`]
            if (!upload_url || !object_key) {
              throw new Error(`'${step_id}' presigned 응답 슬롯 누락 (${type}/${slot})`)
            }
            await upload_blob_to_s3(upload_url, captures_obj[step_id].blob)
            file_url_map[step_id] = build_public_file_url(object_key)
          }),
        )
      }),
  )

  return file_url_map
}

/**
 * 얼굴 측정 결과를 BE 에 저장한다.
 * BE 스키마: BE/app/modules/analysis/schemas.py 의 FaceAnalysisRequest
 *  - main_file:    정면 사진 URL (필수, 빈 문자열 허용)
 *  - test_file_arr: 측정 사진 URL 배열 (필수, 빈 배열 허용)
 *  - test_json:    측정값 + 평가 + 메타 dict
 *
 * @param {number} visit_no  방문 ID (URL path 매개변수)
 * @param {{ main_file: string, test_file_arr: string[], test_json: Record<string, unknown> }} body
 * @returns {Promise<{ visit_no: number, [k: string]: any }>}  저장된 방문 정보
 * @throws {Error} BE 가 비-2xx 응답을 주거나 검증 실패 시
 */
export async function save_face_analysis(visit_no, body) {
  return apiRequest(`/api/v1/visits/${visit_no}/face`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body,
  })
}
