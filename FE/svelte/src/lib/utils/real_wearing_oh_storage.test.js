import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  save_real_wearing_oh,
  read_real_wearing_oh,
  clear_real_wearing_oh,
} from './real_wearing_oh_storage.js'

// 모듈이 STORAGE_KEY 를 export 하지 않으므로(캡슐화 의도) 테스트에서 literal 로 직접 접근.
// 모듈의 STORAGE_KEY 가 바뀌면 여기도 같이 갱신.
const STORAGE_KEY = 'retinal_real_wearing_oh_mirror'

beforeEach(() => {
  const store_map = new Map()
  vi.stubGlobal('sessionStorage', {
    getItem: (k) => store_map.get(k) ?? null,
    setItem: (k, v) => store_map.set(k, v),
    removeItem: (k) => store_map.delete(k),
  })
})

describe('save_real_wearing_oh / read_real_wearing_oh', () => {
  it('round-trips one set under matching visit_id', () => {
    save_real_wearing_oh({
      visit_id: 100,
      sets: [{ set_id: 1, oh_left_mm: 18.4, oh_right_mm: 18.7, oh_source: 'aruco' }],
    })
    const got = read_real_wearing_oh(100)
    expect(got?.sets).toHaveLength(1)
    expect(got?.sets[0].oh_left_mm).toBe(18.4)
  })

  it('returns null when visit_id mismatches (다른 visit 격리)', () => {
    save_real_wearing_oh({
      visit_id: 100,
      sets: [{ set_id: 1, oh_left_mm: 18.4, oh_right_mm: 18.7, oh_source: 'aruco' }],
    })
    expect(read_real_wearing_oh(999)).toBe(null)
  })

  it('returns null when storage is empty', () => {
    expect(read_real_wearing_oh(100)).toBe(null)
  })

  it('handles corrupt JSON gracefully', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-json{{{')
    expect(read_real_wearing_oh(100)).toBe(null)
  })
})

describe('clear_real_wearing_oh', () => {
  it('removes the entry', () => {
    save_real_wearing_oh({ visit_id: 100, sets: [] })
    clear_real_wearing_oh()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(null)
  })
})
