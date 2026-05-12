import { writable } from 'svelte/store'

// 방문 목록 갱신 신호 — increment 할 때마다 [id].svelte 가 목록을 다시 불러온다.
export const visit_list_reload_signal = writable(0)

export function trigger_visit_list_reload() {
  visit_list_reload_signal.update((n) => n + 1)
}
