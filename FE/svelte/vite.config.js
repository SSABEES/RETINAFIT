import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath, URL } from 'node:url'
import { createReadStream, existsSync } from 'node:fs'
import { resolve as path_resolve, extname } from 'node:path'
import { js_aruco2_global_fix } from './scripts/vite_plugin_js_aruco2.js'

// dev 서버가 /ort/* 요청을 Vite 의 transform 미들웨어에 흘려보내지 않게 한다.
// onnxruntime-web 의 proxy worker 가 ort-wasm-simd-threaded.jsep.mjs 같은 파일을
// `new Worker(url, { type: 'module' })` 로 동적 로드하는데, public/ 안 .mjs 는
// "should not be imported from source code" 로 차단되는 게 Vite 의 정책. transform 미들웨어
// 진입 전에 raw 정적 응답으로 직접 처리해 우회한다. prod 빌드는 영향 없음 (public/ → dist/ 복사 후
// nginx 등 정적 호스트가 그대로 서빙).
function serve_ort_public_assets() {
  return {
    name: 'serve-ort-public-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const local_url = (req.url ?? '').split('?')[0]
        if (!local_url.startsWith('/ort/')) return next()

        const local_root = server.config.root
        const local_file_path = path_resolve(local_root, 'public', local_url.slice(1))
        if (!existsSync(local_file_path)) return next()

        const local_ext = extname(local_file_path).toLowerCase()
        const local_mime =
          local_ext === '.wasm'
            ? 'application/wasm'
            : local_ext === '.mjs'
              ? 'application/javascript'
              : local_ext === '.js'
                ? 'application/javascript'
                : 'application/octet-stream'

        // server.headers 는 Vite 내부 정적 미들웨어에서 주입되므로, 우리 미들웨어가 먼저 응답하는
        // 경우 COOP/COEP 가 빠진다. cross-origin-isolated 유지를 위해 직접 같은 값으로 추가.
        res.setHeader('Content-Type', local_mime)
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
        createReadStream(local_file_path).pipe(res)
      })
    },
  }
}

// 정적 자산 호스팅 정책:
//   - MediaPipe: public/mediapipe/  (models/ 는 git 커밋, wasm/ 는 predev/prebuild 가 동기화)
//   - onnxruntime-web: public/ort/  (predev/prebuild 의 sync_ort_assets.mjs 가 동기화)
//
// vite 는 public/ 내용을 dev 자동 서빙 + 빌드 시 dist/ 로 복사. 두 라이브러리 모두 워커/wasm
// 자산 경로를 명시(`wasmPaths` / `FilesetResolver.forVisionTasks`) 해 같은 origin 으로 fetch.
// https://vite.dev/config/
export default defineConfig({
  plugins: [js_aruco2_global_fix(), tailwindcss(), svelte(), serve_ort_public_assets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // dev 의 esbuild pre-bundle 단계에서 ort 의 dynamic import 를 그대로 통과시킨다 (`?import`
  // 쿼리로 재작성되면 wasmPaths 의 same-origin fetch 가 깨짐). prod 번들링(아래 manualChunks)엔
  // 영향 없음 — 이건 dev 전용 옵션.
  //
  // js-aruco2 는 `var CV = CV || {}; this.CV = CV;` 패턴 — esbuild pre-bundle 이 ESM strict
  // mode 의 top-level `this === undefined` 를 알고 `(void 0).CV = CV` 로 그대로 emit 해버려서
  // dev 에서 "Cannot set properties of undefined (setting 'CV')" 로 깨진다. js_aruco2_global_fix
  // 플러그인은 Vite/Rollup transform pipeline 에만 걸리고 esbuild deps optimization 전에는 못 끼어들기
  // 때문에, exclude 로 pre-bundle 자체를 건너뛰게 해 plugin 의 `this.X` → `globalThis.X` 변환이
  // dev 에도 적용되게 한다. prod 빌드는 이미 plugin 이 정상 동작하므로 exclude 영향 없음.
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'js-aruco2'],
  },
  // ort 를 main 번들에서 분리해 별도 chunk 로 emit. 분리 안 하면 prod 빌드에서 ort 코드가 main
  // 번들에 인라인되고, ort 의 self-referencing 워커 (proxy 워커 = `new Worker(import.meta.url)`)
  // 가 main 번들 URL 을 워커로 띄움 → Svelte 런타임의 document 접근에서 즉사 → backend init 실패.
  // 분리하면 ort 코드만 담긴 chunk 가 워커로 로드되어 dev 의 모듈 단위 격리와 동일한 효과.
  // 자기참조 워커를 쓰는 라이브러리(comlink, Monaco editor 등)에 공통적으로 쓰이는 정석 패턴.
  // Rolldown 은 manualChunks 를 함수 형태로 받음 (객체 형태 미지원).
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/onnxruntime-web')) return 'ort'
        },
      },
    },
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
