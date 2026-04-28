// node_modules 의 MediaPipe WASM 번들을 public/mediapipe/wasm 으로 동기화한다.
// dev/build 시 자동 실행 (package.json 의 predev / prebuild 훅).
//
// public/mediapipe/wasm 은 자동 생성물이므로 .gitignore 에 등록되어 있다.
// 모델 파일(.task / .tflite)은 public/mediapipe/models/ 에 직접 커밋되어 별도 처리 X.

import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const project_root = resolve(__dirname, '..')
const src = resolve(project_root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = resolve(project_root, 'public/mediapipe/wasm')

await mkdir(dirname(dest), { recursive: true })
await cp(src, dest, { recursive: true, force: true })
console.log(`[mediapipe] wasm synced → ${dest}`)
