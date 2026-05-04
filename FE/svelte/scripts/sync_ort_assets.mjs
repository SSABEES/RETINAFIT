// onnxruntime-web 의 워커 .mjs / .wasm 페어를 public/ort 로 동기화한다.
// dev/build 시 자동 실행 (package.json 의 predev / prebuild 훅).
//
// 배경: prod 빌드에서 Vite/Rolldown 가 ort 의 워커 동적 import 를 main 번들에 인라인해
// 버리는 문제 — ort 가 워커를 띄우면 main 번들이 워커 컨텍스트에서 실행되며 Svelte 런타임
// 의 document 참조에서 즉사 → "no available backend" 로 연쇄. wasmPaths 를 명시 (inference.js)
// 하고 자산을 public 경로에서 직접 서빙해 main 번들 인라인을 우회한다.
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
