import { describe, it, expect } from 'vitest'
import { evaluate_ring_buffer } from './oh_capture_gate.js'

describe('evaluate_ring_buffer', () => {
  it('returns null when buffer has fewer than 3 frames', () => {
    expect(evaluate_ring_buffer([
      { oh: 18, confidence: 0.5 },
      { oh: 18.1, confidence: 0.5 },
    ])).toBe(null)
  })
  it('passes with stable 3 frames within range and confidence', () => {
    const result = evaluate_ring_buffer([
      { oh: 18.0, confidence: 0.5 },
      { oh: 18.1, confidence: 0.5 },
      { oh: 18.2, confidence: 0.5 },
    ])
    expect(result).not.toBe(null)
    expect(result.mean).toBeCloseTo(18.1, 1)
  })
  it('rejects out of range OH', () => {
    expect(evaluate_ring_buffer([
      { oh: 35, confidence: 0.5 },
      { oh: 35, confidence: 0.5 },
      { oh: 35, confidence: 0.5 },
    ])).toBe(null)
  })
  it('rejects low confidence', () => {
    expect(evaluate_ring_buffer([
      { oh: 18, confidence: 0.2 },
      { oh: 18, confidence: 0.2 },
      { oh: 18, confidence: 0.2 },
    ])).toBe(null)
  })
  it('rejects unstable buffer (std > 1mm)', () => {
    expect(evaluate_ring_buffer([
      { oh: 15, confidence: 0.5 },
      { oh: 18, confidence: 0.5 },
      { oh: 22, confidence: 0.5 },
    ])).toBe(null)
  })
})

import { compute_mm_per_px_fallback } from './oh_capture_gate.js'

describe('compute_mm_per_px_fallback', () => {
  it('returns mm_per_px from pupil pixel distance and assumed PD', () => {
    const pupil_right = { x: 100, y: 50 }
    const pupil_left = { x: 150, y: 50 }
    expect(compute_mm_per_px_fallback(pupil_right, pupil_left)).toBeCloseTo(63 / 50, 3)
  })
  it('returns null when pupils overlap', () => {
    const p = { x: 100, y: 50 }
    expect(compute_mm_per_px_fallback(p, p)).toBe(null)
  })
  it('returns null when input is missing', () => {
    expect(compute_mm_per_px_fallback(null, { x: 100, y: 50 })).toBe(null)
  })
})
