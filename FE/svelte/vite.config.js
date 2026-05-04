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
  // crossOriginIsolated 활성화 — onnxruntime-web 이 SharedArrayBuffer 를 쓸 수 있어야
  // multi-threaded WASM (ort.env.wasm.numThreads > 1) 로 6DRepNet360 추론이 코어 수만큼 병렬화.
  //
  // COEP 모드: 'require-corp' 대신 'credentialless' 선택. 차이는 cross-origin 응답이 CORP
  // 헤더 없이도 로드되되, 쿠키 등 credential 없이 페치되는 것. 우리 S3 presigned URL 은 쿼리
  // 파라미터로 인증하므로 쿠키 무관 → credentialless 와 호환. require-corp 였다면 S3 버킷 정책
  // 손대야 했을 텐데 그 비용을 회피.
  //
  // 프로덕션 호스팅도 동일 헤더를 보내야 함 — 정적 호스트(nginx/CDN/Cloudflare 등) 설정에
  // 동일 두 줄을 추가하지 않으면 prod 에서 단일 스레드로 폴백된다.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
