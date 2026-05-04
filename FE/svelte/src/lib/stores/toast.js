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
 */
export function push_toast(message, type = 'info') {
  const local_text = String(message ?? '').trim()
  if (!local_text) return

  toast_obj_store.set({ message: local_text, type })

  if (g_clear_timer !== null) clearTimeout(g_clear_timer)
  g_clear_timer = setTimeout(() => {
    toast_obj_store.set(null)
    g_clear_timer = null
  }, TOAST_DURATION_MS)
}

/** @param {string | null | undefined} message */
export function push_error_toast(message) {
  push_toast(message, 'error')
}

/** @param {string | null | undefined} message */
export function push_success_toast(message) {
  push_toast(message, 'success')
}
