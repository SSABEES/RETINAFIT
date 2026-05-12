/**
 * /test 검증 페이지 전용 — 로컬 디스크의 GLB 안경 폴더를 dev 서버로 노출.
 *
 * 폴더 구조:
 *   <root>/<번호>.<한글이름>/<파일>.glb     예: 1.라운드 뿔테 클리어/라운드_뿔테_클리어.glb
 * 폴더당 GLB 정확히 1개 가정. 폴더명의 숫자 prefix 가 glasses_no 역할.
 *
 * 두 endpoint:
 *   GET /local-glasses/manifest.json   → 카탈로그 JSON (load_normalized_glasses 와 동일 형태)
 *   GET /local-glasses/<n>.glb          → 해당 폴더의 GLB 파일 stream
 *
 * 루트 경로는 환경에 따라 자동 탐지 (WSL `/mnt/c/...` vs Windows `C:\\...`). 두 후보 모두
 * 존재하지 않으면 빈 manifest 반환 — 다른 개발자 환경에서 자연스럽게 비활성화된다.
 *
 * dev only — `configureServer` 에만 걸리므로 prod 빌드는 영향 없음.
 */

import { existsSync, readdirSync, createReadStream } from 'node:fs'
import { join } from 'node:path'

const CANDIDATE_ROOTS = [
  '/mnt/c/Users/SSAFY/Desktop/glb_all_55',
  'C:\\Users\\SSAFY\\Desktop\\glb_all_55',
]

// 후보 경로 중 처음으로 존재하는 디렉터리 반환 (없으면 null).
function find_root_dir() {
  for (const local_path of CANDIDATE_ROOTS) {
    try {
      if (existsSync(local_path)) return local_path
    } catch {
      /* ignore — Windows 경로를 Linux 에서 시도하면 ENOENT 가 throw 될 수 있음 */
    }
  }
  return null
}

// 루트 디렉터리를 스캔해 카탈로그 manifest 와 내부용 file_path 매핑을 함께 만든다.
function build_manifest(root_dir) {
  if (!root_dir) return []

  const dir_arr = readdirSync(root_dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const out_arr = []
  for (const dir_name of dir_arr) {
    const folder_path = join(root_dir, dir_name)
    let glb_files = []
    try {
      glb_files = readdirSync(folder_path).filter((f) => f.toLowerCase().endsWith('.glb'))
    } catch {
      continue
    }
    if (glb_files.length === 0) continue

    const m = dir_name.match(/^(\d+)\.(.+)$/)
    const glasses_no = m ? Number(m[1]) : out_arr.length + 1
    const model = m ? m[2].trim() : dir_name

    out_arr.push({
      glasses_no,
      brand: '로컬',
      model,
      glasses_3d_url: `/local-glasses/${glasses_no}.glb`,
      img_url: '',
      _file_path: join(folder_path, glb_files[0]),
    })
  }
  return out_arr
}

// vite plugin — /local-glasses/* 요청을 manifest/GLB 로 응답한다.
export function local_glasses_middleware() {
  return {
    name: 'local-glasses-middleware',
    configureServer(server) {
      // 매 요청마다 디스크 스캔하면 비싸지만, 같은 dev 세션 동안 폴더가 바뀌어도 즉시 반영하려면
      // refresh 가 필요. 절충: manifest.json 호출 시 강제 rescan, GLB 요청은 캐시된 매핑 사용.
      let cache_obj = null
      const refresh_cache = () => {
        const local_root = find_root_dir()
        cache_obj = { root: local_root, manifest: build_manifest(local_root) }
        return cache_obj
      }
      const get_cache = () => cache_obj ?? refresh_cache()

      server.middlewares.use((req, res, next) => {
        const local_url = (req.url ?? '').split('?')[0]
        if (!local_url.startsWith('/local-glasses/')) return next()

        if (local_url === '/local-glasses/manifest.json') {
          const local_cache_obj = refresh_cache()
          const safe_arr = local_cache_obj.manifest.map(({ _file_path, ...rest }) => rest)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(safe_arr))
          return
        }

        const m = local_url.match(/^\/local-glasses\/(\d+)\.glb$/)
        if (m) {
          const glasses_no = Number(m[1])
          const local_cache_obj = get_cache()
          const item = local_cache_obj.manifest.find((i) => i.glasses_no === glasses_no)
          if (!item) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          res.setHeader('Content-Type', 'model/gltf-binary')
          res.setHeader('Cache-Control', 'no-store')
          createReadStream(item._file_path).pipe(res)
          return
        }

        next()
      })
    },
  }
}
