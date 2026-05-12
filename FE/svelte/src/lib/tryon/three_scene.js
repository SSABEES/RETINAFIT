/**
 * 안경 try-on 검증 페이지의 three.js scene/camera/renderer 셋업·해제 헬퍼.
 * test.svelte 에서 1회 init → rAF 마다 render → 언마운트 시 dispose.
 */
import {
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  AxesHelper,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'

// 객체와 자식들의 geometry/material/texture 를 안전하게 dispose 한다.
function dispose_subtree(root) {
  root.traverse((obj) => {
    if (obj.geometry?.dispose) obj.geometry.dispose()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (m.map?.dispose) m.map.dispose()
        if (m.dispose) m.dispose()
      }
    }
  })
}

// 한 face 용 try-on hierarchy (glasses_root → face_occluder, head_back_occluder, face_anchor_offset_group
// (그 자식 marker)) 를 만들어 반환한다. multi-face 검출 시 N 개를 만든다. geometry / material 은
// 호출자가 제공한 shared assets 를 모두 share — N 배 메모리 절약 + OBJ 비동기 로드 후 모든 face_set
// 의 face_occluder geometry 가 동시에 교체된다 (caller 가 set 의 face_occluder ref 를 traverse).
function create_face_set(scene, shared) {
  const glasses_root_obj = new Object3D()
  glasses_root_obj.matrixAutoUpdate = false
  glasses_root_obj.visible = false
  scene.add(glasses_root_obj)

  const axes_helper = new AxesHelper(5)
  axes_helper.visible = false
  glasses_root_obj.add(axes_helper)

  const face_occluder = new Mesh(shared.face_geo, shared.face_occluder_mat)
  face_occluder.position.set(0, 0, -1)
  face_occluder.renderOrder = -1
  glasses_root_obj.add(face_occluder)

  const head_back_occluder = new Mesh(shared.head_geo, shared.head_occluder_mat)
  head_back_occluder.scale.set(8, 11, 14)
  head_back_occluder.position.set(0, 0, -2)
  head_back_occluder.renderOrder = -1
  glasses_root_obj.add(head_back_occluder)

  const face_anchor_offset_group = new Object3D()
  face_anchor_offset_group.position.set(0, 3.27, 5.24)
  glasses_root_obj.add(face_anchor_offset_group)

  const face_anchor_marker = new Mesh(shared.marker_geo, shared.marker_mat)
  face_anchor_marker.visible = false
  face_anchor_marker.renderOrder = 999
  face_anchor_offset_group.add(face_anchor_marker)

  return {
    glasses_root_obj,
    axes_helper,
    face_occluder,
    head_back_occluder,
    face_anchor_offset_group,
    face_anchor_marker,
  }
}

// scene/camera/renderer/안경 root/디버그 axes 를 한 번에 만들어 컨트롤 핸들을 반환한다.
// num_face_sets 가 1 보다 크면 multi-face 모드 — N 개의 face_set 을 만들어 face_sets array 로 노출.
// face_sets[0] 의 단일 ref 들은 backward-compat 용으로 평면 export 도 같이 한다.
/**
 * @param {{ canvas: HTMLCanvasElement, fov_deg?: number, num_face_sets?: number }} opts
 */
export function init_three_scene({ canvas, fov_deg = 63, num_face_sets = 1 }) {
  const scene = new Scene()
  // 안경 메탈 / 플라스틱 표면이 어둡게 보이지 않게 약간의 ambient + 정면 directional.
  scene.add(new AmbientLight(0xffffff, 0.7))
  const dir = new DirectionalLight(0xffffff, 0.6)
  dir.position.set(0, 50, 200)
  scene.add(dir)

  const camera = new PerspectiveCamera(fov_deg, 1, 1, 10000)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio || 1)
  renderer.setClearColor(0x000000, 0)
  // face_occluder 의 좌우 절반을 yaw 따라 잘라낼 수 있게 local clipping 활성화. mesh.material.
  // clippingPlanes 에 plane 을 넣으면 그 plane 의 음수 영역이 그려지지 않음.
  renderer.localClippingEnabled = true

  // 공유 geometry / material — N 개의 face_set 이 모두 share.
  //   face_geo : 처음엔 작은 placeholder. canonical_face_model.obj 로드 후 모든 face_occluder mesh 의
  //              geometry 를 새 face mesh geometry 로 동시 교체한다.
  //   head_geo : ellipsoid base (radius=1) — face_set 별 scale 은 mesh.scale 로 조정.
  //   face_occluder_mat, head_occluder_mat : depth-only material (colorWrite=false, depthWrite=true).
  //     별도 instance 라 face 만 clipping plane 걸어도 head 영향 없음.
  //   marker_geo / marker_mat : 디버그 anchor 표시용 빨간 작은 sphere.
  const shared = {
    face_geo: new SphereGeometry(0.001),
    head_geo: new SphereGeometry(1, 24, 24, Math.PI, Math.PI),
    face_occluder_mat: new MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    head_occluder_mat: new MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    marker_geo: new SphereGeometry(0.25, 12, 12),
    marker_mat: new MeshBasicMaterial({ color: 0xff3366, depthTest: false, depthWrite: false }),
  }

  const face_sets = []
  for (let i = 0; i < num_face_sets; i++) {
    face_sets.push(create_face_set(scene, shared))
  }

  // canonical face mesh 비동기 로드 → shared face_geo 자체를 새 geometry 로 교체할 수 없으니, 모든
  // face_set 의 face_occluder.geometry 에 새 geometry 를 일괄 set. canonical 좌표계가 face pose
  // canonical 과 동일하므로 추가 transform 불필요.
  const obj_loader = new OBJLoader()
  obj_loader
    .loadAsync(`${import.meta.env.BASE_URL}mediapipe/models/canonical_face_model.obj`)
    .then((root) => {
      let new_geo = null
      root.traverse((child) => {
        if (!new_geo && child.isMesh && child.geometry) new_geo = child.geometry
      })
      if (!new_geo) return
      shared.face_geo.dispose()
      shared.face_geo = new_geo
      for (const set of face_sets) {
        set.face_occluder.geometry = new_geo
      }
    })
    .catch((err) => {
      console.warn('[try-on] canonical face mesh load failed', err)
    })

  // face_sets[0] 을 단일 ref 로도 export — backward-compat 용. 단일 face 호출자 (try_on_fallback,
  // camera_view 측의 기존 코드) 가 그대로 동작.
  const first = face_sets[0]

  return {
    scene,
    camera,
    renderer,
    face_sets,
    glasses_root_obj: first.glasses_root_obj,
    axes_helper: first.axes_helper,
    face_occluder: first.face_occluder,
    head_back_occluder: first.head_back_occluder,
    face_anchor_offset_group: first.face_anchor_offset_group,
    face_anchor_marker: first.face_anchor_marker,
    // 비디오 해상도에 맞춰 renderer / camera aspect 갱신.
    /**
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
      if (width <= 0 || height <= 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    // FOV 슬라이더 변경 등으로 카메라 시야각을 갱신한다.
    /**
     * @param {number} deg
     */
    set_fov(deg) {
      camera.fov = deg
      camera.updateProjectionMatrix()
    },
    // 매 프레임 렌더 호출.
    render() {
      renderer.render(scene, camera)
    },
    // GLB 자식들의 geometry/material/texture 까지 포함해 GPU 자원을 모두 해제한다.
    dispose() {
      dispose_subtree(scene)
      renderer.dispose()
    },
  }
}

// glasses_root_obj 의 자식(이전 안경 그룹)을 안전하게 교체한다 — 이전 자식 전부 dispose.
/**
 * @param {import('three').Object3D} glasses_root_obj
 * @param {import('three').Object3D | null} new_align_group
 * @param {import('three').AxesHelper} axes_helper
 */
export function swap_glasses_child(parent_obj, new_child, ...preserved_arr) {
  // preserved 는 그대로 두고 나머지 자식만 dispose + remove.
  const protected_set = new Set(preserved_arr.filter(Boolean))
  const removable = parent_obj.children.filter((c) => !protected_set.has(c))
  for (const c of removable) {
    dispose_subtree(c)
    parent_obj.remove(c)
  }
  if (new_child) parent_obj.add(new_child)
}
