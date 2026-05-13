/**
 * 안경 GLB lazy fetch + URL 캐시.
 * 같은 URL 재선택 시 즉시 resolve. 실패 시 entry 제거해 재시도 허용.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { compute_auto_calibration } from './face_alignment.js'

/** @type {Map<string, Promise<{scene: import('three').Object3D, calibration: ReturnType<typeof compute_auto_calibration>}>>} */
const g_cache = new Map()

let g_default_loader = null
let g_draco_loader = null

// Draco 압축 GLB 디코더 — lazy 하게 한 번만 생성. /draco/ 에서 wasm + wrapper 가져옴
// (public/draco/draco_decoder.wasm, draco_wasm_wrapper.js, draco_decoder.js — three.js GLTF 전용 사본).
function get_draco_loader() {
  if (!g_draco_loader) {
    g_draco_loader = new DRACOLoader()
    g_draco_loader.setDecoderPath('/draco/')
  }
  return g_draco_loader
}

// 기본 GLTFLoader 인스턴스를 lazy 하게 생성한다. Draco 압축 GLB 도 같이 풀 수 있도록 DRACOLoader 부착.
function get_default_loader() {
  if (!g_default_loader) {
    g_default_loader = new GLTFLoader()
    g_default_loader.setDRACOLoader(get_draco_loader())
  }
  return g_default_loader
}

// URL 캐시를 통해 GLB 를 받아오고 자동 정렬 calibration 을 합쳐 반환한다.
/**
 * @param {string} url
 * @param {{ loader?: { loadAsync: (url: string) => Promise<{scene: import('three').Object3D}> } }} [opts]
 * @returns {Promise<{scene: import('three').Object3D, calibration: ReturnType<typeof compute_auto_calibration>}>}
 */
export function ensure_glasses_loaded(url, opts = {}) {
  if (!url) return Promise.reject(new Error('glasses url is empty'))
  if (g_cache.has(url)) return g_cache.get(url)
  const loader = opts.loader ?? get_default_loader()
  const p = (async () => {
    const gltf = await loader.loadAsync(url)
    const calibration = compute_auto_calibration(gltf.scene)
    return { scene: gltf.scene, calibration }
  })()
  g_cache.set(url, p)
  p.catch(() => g_cache.delete(url))
  return p
}

// 캐시된 GLB scene 을 깊은 복제해 attach 가능한 인스턴스를 만든다 (cache 원본은 보존).
// forward_flip 시 vertex z 좌표 + normal z 좌표 + triangle winding + anchor.z 모두 반전.
// anchor 도 같이 반전 안 하면 align_group 이 *반전된 z 좌표계* 의 anchor 를 잘못 잡아 안경이
// face 에서 멀리 떨어진 위치에 자리잡고, 머리 회전 시 큰 호를 그려 회전이 과장돼 보인다.
/**
 * @param {{scene: import('three').Object3D, calibration: ReturnType<typeof compute_auto_calibration>}} cached
 * @returns {{scene: import('three').Object3D, calibration: ReturnType<typeof compute_auto_calibration>}}
 */
export function instantiate_glasses(cached) {
  const scene = cached.scene.clone(true)
  let calibration = cached.calibration
  if (cached.calibration.forward_flip) {
    flip_geometry_z(scene)
    calibration = {
      ...cached.calibration,
      anchor: cached.calibration.anchor.clone().setZ(-cached.calibration.anchor.z),
    }
  }
  return { scene, calibration }
}

// scene 의 모든 mesh 의 geometry 를 z 축 기준 reflection 한다 (clone 된 인스턴스에만 적용).
function flip_geometry_z(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    const geo = child.geometry
    if (!geo) return
    // BufferGeometry clone — 원본 cache 의 geometry 는 보존되어야 하므로 새 인스턴스로.
    const new_geo = geo.clone()
    const pos = new_geo.attributes.position
    if (pos) {
      for (let i = 0; i < pos.count; i++) pos.setZ(i, -pos.getZ(i))
      pos.needsUpdate = true
    }
    const nrm = new_geo.attributes.normal
    if (nrm) {
      for (let i = 0; i < nrm.count; i++) nrm.setZ(i, -nrm.getZ(i))
      nrm.needsUpdate = true
    }
    // triangle winding 반전 — z reflection 후 정면/뒷면이 뒤바뀌므로 face culling 정합 필요.
    const idx = new_geo.index
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const tmp = idx.getX(i + 1)
        idx.setX(i + 1, idx.getX(i + 2))
        idx.setX(i + 2, tmp)
      }
      idx.needsUpdate = true
    }
    child.geometry = new_geo
  })
}

// 단위 테스트 격리를 위한 캐시 리셋 헬퍼.
export function __reset_cache_for_test() {
  g_cache.clear()
  g_default_loader = null
  if (g_draco_loader) {
    g_draco_loader.dispose()
    g_draco_loader = null
  }
}
