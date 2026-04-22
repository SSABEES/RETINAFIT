import { writable } from 'svelte/store'

const default_admin_arr = [
  { id: 1, name: '박점장', position: '지점장', password: '1111' },
  { id: 2, name: '김매니저', position: '매니저', password: '2222' },
  { id: 3, name: '이관리자', position: '관리자', password: '3333' },
]

export const admin_arr = writable(default_admin_arr)
export const selected_admin_obj = writable(default_admin_arr[0])
