/**
 * Face analysis upload/save API helpers.
 *
 * Flow:
 * 1. Request presigned URLs for bare and/or glasses capture groups.
 * 2. Upload capture blobs directly to S3 with PUT.
 * 3. Save uploaded file URLs and analysis JSON to the visit face endpoint.
 *
 * @typedef {import('@/lib/stores/capture_session.svelte.js').Capture} Capture
 */

import { apiRequest } from '@/lib/api/client'
import { get_session_auth_headers } from '@/lib/api/session_auth'

/**
 * @typedef {'bare' | 'glasses'} TestFileType
 */

/**
 * @typedef {{
 *   type: TestFileType,
 *   front_url: string,
 *   left_url: string,
 *   right_url: string,
 *   front_key: string,
 *   left_key: string,
 *   right_key: string,
 * }} TestFilePresignedResponse
 */

/**
 * Request presigned URLs for one 3-photo face-analysis capture group.
 * @param {number} visit_no
 * @param {TestFileType} type
 * @returns {Promise<TestFilePresignedResponse>}
 */
export async function request_presigned_urls(visit_no, type) {
  return apiRequest(`/api/v1/visits/${visit_no}/files/test`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body: { type },
  })
}

/**
 * Upload a blob directly to S3 with a presigned PUT URL.
 * @param {string} upload_url
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
export async function upload_blob_to_s3(upload_url, blob) {
  const response = await fetch(upload_url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed (status ${response.status})`)
  }
}

/**
 * @param {string} upload_url
 * @returns {string}
 */
function get_uploaded_file_url(upload_url) {
  return String(upload_url).split('?')[0]
}

/**
 * @param {Record<string, Capture>} captures_obj
 * @param {string} key
 * @returns {boolean}
 */
function has_capture(captures_obj, key) {
  return Boolean(captures_obj[key]?.blob)
}

/**
 * @param {TestFileType} type
 * @returns {{ front: string, left: string, right: string }}
 */
function get_capture_key_map(type) {
  if (type === 'bare') {
    return {
      front: 'front_no_glasses',
      left: 'left_no_glasses',
      right: 'right_no_glasses',
    }
  }

  return {
    front: 'front_glasses',
    left: 'left_glasses',
    right: 'right_glasses',
  }
}

/**
 * Upload one 3-photo capture group and return a step-id to uploaded-file-url map.
 * @param {Record<string, Capture>} captures_obj
 * @param {number} visit_no
 * @param {TestFileType} type
 * @returns {Promise<Record<string, string>>}
 */
async function upload_capture_group(captures_obj, visit_no, type) {
  const capture_key_map = get_capture_key_map(type)
  const front_capture = captures_obj[capture_key_map.front]
  const left_capture = captures_obj[capture_key_map.left]
  const right_capture = captures_obj[capture_key_map.right]

  if (!front_capture || !left_capture || !right_capture) {
    throw new Error(`${type} capture set requires front/left/right images.`)
  }

  const presigned = await request_presigned_urls(visit_no, type)

  await Promise.all([
    upload_blob_to_s3(presigned.front_url, front_capture.blob),
    upload_blob_to_s3(presigned.left_url, left_capture.blob),
    upload_blob_to_s3(presigned.right_url, right_capture.blob),
  ])

  return {
    [capture_key_map.front]: get_uploaded_file_url(presigned.front_url),
    [capture_key_map.left]: get_uploaded_file_url(presigned.left_url),
    [capture_key_map.right]: get_uploaded_file_url(presigned.right_url),
  }
}

/**
 * Upload all captured face-analysis photos to S3 and return a step-id to file-url map.
 * Supports one bare group, one glasses group, or both.
 * @param {Record<string, Capture>} captures_obj
 * @param {number} visit_no
 * @returns {Promise<Record<string, string>>}
 */
export async function upload_captures_to_s3(captures_obj, visit_no) {
  /** @type {Record<string, string>} */
  const file_url_map = {}

  if (
    has_capture(captures_obj, 'front_no_glasses') ||
    has_capture(captures_obj, 'left_no_glasses') ||
    has_capture(captures_obj, 'right_no_glasses')
  ) {
    Object.assign(file_url_map, await upload_capture_group(captures_obj, visit_no, 'bare'))
  }

  if (
    has_capture(captures_obj, 'front_glasses') ||
    has_capture(captures_obj, 'left_glasses') ||
    has_capture(captures_obj, 'right_glasses')
  ) {
    Object.assign(file_url_map, await upload_capture_group(captures_obj, visit_no, 'glasses'))
  }

  return file_url_map
}

/**
 * Save face-analysis metadata to the visit.
 * @param {number} visit_no
 * @param {{ main_file: string, test_file_arr: string[], test_json: Record<string, unknown> }} body
 * @returns {Promise<{ visit_no: number, [k: string]: any }>}
 */
export async function save_face_analysis(visit_no, body) {
  return apiRequest(`/api/v1/visits/${visit_no}/face`, {
    method: 'POST',
    headers: get_session_auth_headers(),
    body,
  })
}
