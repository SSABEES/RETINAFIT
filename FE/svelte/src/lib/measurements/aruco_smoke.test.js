import { describe, it, expect } from 'vitest'

// js-aruco2 는 CJS 패턴 (`var X = X || {}; this.X = X;`) 으로 작성돼 ESM strict-mode 에서는
// vite 의 js_aruco2_global_fix 플러그인이 `this.X` → `globalThis.X` 로 치환해야 동작한다.
// vitest 는 vite config 의 plugin 을 그대로 적용하므로 같은 변환이 일어난다.

describe('js-aruco2 smoke (vite plugin globalThis fix)', () => {
  it('AR/POS/CV/SVD 가 globalThis 에 노출된다', async () => {
    await import('js-aruco2/src/cv.js')
    await import('js-aruco2/src/svd.js')
    await import('js-aruco2/src/aruco.js')
    await import('js-aruco2/src/dictionaries/aruco_mip_36h12.js')
    await import('js-aruco2/src/posit2.js')

    /** @type {any} */
    const g = globalThis
    expect(g.AR).toBeDefined()
    expect(typeof g.AR.Detector).toBe('function')
    expect(typeof g.AR.Dictionary).toBe('function')
    expect(g.AR.DICTIONARIES?.ARUCO_MIP_36h12).toBeDefined()
    expect(g.CV).toBeDefined()
    expect(typeof g.CV.Image).toBe('function')
    expect(g.POS).toBeDefined()
    expect(typeof g.POS.Posit).toBe('function')
  })

  it('Detector / Posit instantiation 동작', async () => {
    await import('js-aruco2/src/cv.js')
    await import('js-aruco2/src/svd.js')
    await import('js-aruco2/src/aruco.js')
    await import('js-aruco2/src/dictionaries/aruco_mip_36h12.js')
    await import('js-aruco2/src/posit2.js')
    /** @type {any} */
    const g = globalThis
    const detector = new g.AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' })
    expect(typeof detector.detect).toBe('function')
    const posit = new g.POS.Posit(30, 1500)
    expect(typeof posit.pose).toBe('function')
  })
})
