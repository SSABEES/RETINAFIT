import { writable } from 'svelte/store'

const TOAST_DURATION_MS = 2800

/**
 * @typedef {{ message: string, type: 'success' | 'error' | 'info' }} ToastObj
 */

/** @type {import('svelte/store').Writable<ToastObj | null>} */
export const toast_obj_store = writable(/** @type {ToastObj | null} */ (null))

/** @type {ReturnType<typeof setTimeout> | null} */
let g_clear_timer = null

/**
 * 토스트 메시지를 화면에 띄우고 일정 시간 후 자동 제거.
 * 동일 시점에 여러 번 push 되면 마지막 메시지로 갱신되고 타이머가 리셋된다.
 *
 * @param {string | null | undefined} message
 * @param {'success' | 'error' | 'info'} [type]
 * @param {number} [duration_ms] 표시 시간(ms), 미지정 시 기본값 사용
 */
export function push_toast(message, type = 'info', duration_ms = TOAST_DURATION_MS) {
  const local_text = String(message ?? '').trim()
  if (!local_text) return

  toast_obj_store.set({ message: local_text, type })

  if (g_clear_timer !== null) clearTimeout(g_clear_timer)
  g_clear_timer = setTimeout(() => {
    toast_obj_store.set(null)
    g_clear_timer = null
  }, duration_ms)
}

/**
 * @param {string | null | undefined} message
 * @param {number} [duration_ms]
 */
export function push_error_toast(message, duration_ms) {
  push_toast(message, 'error', duration_ms)
}

/**
 * @param {string | null | undefined} message
 * @param {number} [duration_ms]
 */
export function push_success_toast(message, duration_ms) {
  push_toast(message, 'success', duration_ms)
}
