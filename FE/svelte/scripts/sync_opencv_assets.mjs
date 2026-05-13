// node_modules 의 @techstark/opencv-js 번들을 public/opencv 로 동기화한다.
// dev/build 시 자동 실행 (package.json 의 predev / prebuild 훅).
//
// public/opencv/opencv.js 는 자동 생성물이므로 .gitignore 에 등록되어 있다.
// public/opencv/oh_worker.js 는 직접 커밋된 worker 소스라 sync 대상 아님.

import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const project_root = resolve(__dirname, '..')
const src = resolve(project_root, 'node_modules/@techstark/opencv-js/dist/opencv.js')
const dest_dir = resolve(project_root, 'public/opencv')
const dest = resolve(dest_dir, 'opencv.js')

await mkdir(dest_dir, { recursive: true })
await cp(src, dest, { force: true })
console.log(`[opencv] opencv.js synced → ${dest}`)
