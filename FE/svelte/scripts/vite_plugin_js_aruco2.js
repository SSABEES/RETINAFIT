/**
 * js-aruco2 의 CJS 스크립트는 `var X = X || {}; this.X = X;` 패턴으로 전역에 export 한다.
 * ESM/strict-mode 환경에서는 top-level `this` 가 undefined 라 그대로 import 하면 깨진다.
 * 빌드 시점에 `this.X` → `globalThis.X` 로 치환해 strict ESM 에서도 동작하게 한다.
 * require('./xxx') 콜은 같은 globalThis fallback 으로 변환 (실제 모듈 인스턴스는 side-effect import 로 채워짐).
 *
 * vite.config.js (prod build) 와 vitest.config.js (test) 양쪽에서 import 해 같은 변환을 적용.
 *
 * @returns {{ name: string, enforce: 'pre', transform: (code: string, id: string) => { code: string, map: null } | null }}
 */
export function js_aruco2_global_fix() {
  return {
    name: 'js-aruco2-global-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('js-aruco2/src/')) return null
      const out = code
        .replace(/\bthis\.(AR|POS|CV|SVD)\b/g, 'globalThis.$1')
        .replace(/=\s*require\(['"][^'"]+['"]\)\.(AR|POS|CV|SVD)/g, '= globalThis.$1')
      return { code: out, map: null }
    },
  }
}
