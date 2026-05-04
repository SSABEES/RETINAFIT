import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath, URL } from 'node:url'

// MediaPipe 자산은 public/mediapipe/ 에 정적으로 둔다.
//   - models/ : .task / .tflite (git 커밋)
//   - wasm/   : npm scripts 의 predev/prebuild 가 node_modules 에서 복사 (git 미커밋)
// onnxruntime-web 의 워커/.wasm 은 public/ 에 두지 않는다 — Vite 가 public/ 자산의
// JS-side import() 를 금지하기 때문. 대신 onnxruntime-web 의 자체 import.meta.url 해석에
// 맡기고 (optimizeDeps.exclude 설정), Vite 가 dist/assets/ 로 자동 emit 한다.
// vite 는 public/ 내용을 dev 자동 서빙 + 빌드 시 dist/ 로 복사.
// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // onnxruntime-web 은 런타임에 워커 .mjs 를 await import() 로 동적 로드한다.
  // Vite 가 pre-bundle 하면 그 import 호출이 `?import` 쿼리로 재작성되어 public/ 정적 자산 페치가 깨진다.
  // exclude 하면 ort 의 원본 dynamic import 가 그대로 통과되어 wasmPaths 가 가리키는 same-origin URL 을 정상 페치.
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
})
