// onnxruntime-web 의 WASM 런타임 자산 (.wasm 본체 + 멀티쓰레드 pthread .mjs) 을
// public/ort 로 동기화한다. dev/build 시 자동 실행 (package.json 의 predev / prebuild 훅).
//
// 역할: ort 가 InferenceSession 생성 시 WASM 컴파일 + (crossOriginIsolated 시) pthread 워커
// 풀 가동을 위해 이 자산들을 fetch. inference.js 의 wasmPaths 가 이 디렉터리를 가리키며,
// 운영 nginx 가 정적 서빙해 안정적인 same-origin URL 을 보장.
//
// 참고: ort 의 proxy 워커 격리는 이 스크립트가 다루지 않는다 (vite.config.js 의 manualChunks
// 가 ort 자체를 별도 chunk 로 emit 해 처리). 이 스크립트는 WASM 런타임 자산만 책임.
//
// public/ort 는 자동 생성물이라 .gitignore 에 등록되어 있다.

import { cp, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const project_root = resolve(__dirname, '..')
const src = resolve(project_root, 'node_modules/onnxruntime-web/dist')
const dest = resolve(project_root, 'public/ort')

await mkdir(dest, { recursive: true })

// ort 가 자동 선택해 로드하는 모든 변형(.jsep / .jspi / .asyncify / 기본)을 함께 복사.
// 브라우저는 그 중 하나만 실제로 로드하지만, ort 가 fallback 시 다른 변형을 시도할 수 있어
// 누락되면 또 다른 404 → init 실패로 이어지므로 페어를 모두 보장한다.
const files = await readdir(src)
const targets = files.filter((f) => /^ort-wasm-simd-threaded(\.[a-z0-9]+)?\.(mjs|wasm)$/i.test(f))

for (const file of targets) {
  await cp(join(src, file), join(dest, file), { force: true })
}
console.log(`[ort] ${targets.length} assets synced → ${dest}`)
