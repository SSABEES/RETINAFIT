import { describe, it, expect } from 'vitest'
import { evaluate_ring_buffer } from './oh_capture_gate.js'

describe('evaluate_ring_buffer', () => {
  it('fails with buffer_underfull when fewer than 3 frames', () => {
    const result = evaluate_ring_buffer([
      { oh: 18, confidence: 0.5 },
      { oh: 18.1, confidence: 0.5 },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('buffer_underfull')
    expect(result.details.size).toBe(2)
    expect(result.details.required).toBe(3)
  })

  it('passes with stable 3 frames within range and confidence', () => {
    const result = evaluate_ring_buffer([
      { oh: 18.0, confidence: 0.5 },
      { oh: 18.1, confidence: 0.5 },
      { oh: 18.2, confidence: 0.5 },
    ])
    expect(result.ok).toBe(true)
    expect(result.reason).toBe(null)
    expect(result.mean).toBeCloseTo(18.1, 1)
    expect(result.std).toBeGreaterThanOrEqual(0)
  })

  it('fails with out_of_range when OH outside [10, 30]mm', () => {
    const result = evaluate_ring_buffer([
      { oh: 35, confidence: 0.5 },
      { oh: 35, confidence: 0.5 },
      { oh: 35, confidence: 0.5 },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('out_of_range')
    expect(result.details.idx).toBe(0)
    expect(result.details.oh).toBe(35)
  })

  it('fails with low_confidence when below MIN_CONFIDENCE', () => {
    const result = evaluate_ring_buffer([
      { oh: 18, confidence: 0.2 },
      { oh: 18, confidence: 0.2 },
      { oh: 18, confidence: 0.2 },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('low_confidence')
    expect(result.details.confidence).toBe(0.2)
  })

  it('fails with high_std and still exposes mean/std', () => {
    const result = evaluate_ring_buffer([
      { oh: 15, confidence: 0.5 },
      { oh: 18, confidence: 0.5 },
      { oh: 22, confidence: 0.5 },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('high_std')
    expect(result.mean).toBeCloseTo((15 + 18 + 22) / 3, 5)
    expect(result.std).toBeGreaterThan(1.0)
    expect(result.details.std).toBe(result.std)
  })

  it('fails with nan_value when oh is NaN', () => {
    const result = evaluate_ring_buffer([
      { oh: NaN, confidence: 0.5 },
      { oh: 18, confidence: 0.5 },
      { oh: 18, confidence: 0.5 },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('nan_value')
    expect(result.details.idx).toBe(0)
  })

  it('returns buffer_underfull (not crash) on non-array input', () => {
    const result = evaluate_ring_buffer(null)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('buffer_underfull')
    expect(result.details.size).toBe(0)
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
