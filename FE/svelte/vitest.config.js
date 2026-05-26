import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import { js_aruco2_global_fix } from './scripts/vite_plugin_js_aruco2.js'

export default defineConfig({
  // js-aruco2 의 strict-mode 호환 fix 는 prod build 와 동일하게 test 에서도 적용해야
  // detector/posit 모듈이 globalThis 에 AR/POS/CV/SVD 를 노출한다.
  plugins: [js_aruco2_global_fix()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.js'],
    globals: false,
    // js-aruco2 는 node_modules 안에 있지만 vite transform 파이프를 통과해야 strict-mode fix 가
    // 적용된다 — externalize 비활성화로 plugin 의 transform 이 실제 호출되도록 강제.
    server: {
      deps: {
        inline: [/js-aruco2/],
      },
    },
  },
})
