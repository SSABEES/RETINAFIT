import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath, URL } from 'node:url'

// MediaPipe 자산은 public/mediapipe/ 에 정적으로 둔다.
//   - models/ : .task / .tflite (git 커밋)
//   - wasm/   : npm scripts 의 predev/prebuild 가 node_modules 에서 복사 (git 미커밋)
// vite 는 public/ 내용을 dev 자동 서빙 + 빌드 시 dist/ 로 복사.
// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
