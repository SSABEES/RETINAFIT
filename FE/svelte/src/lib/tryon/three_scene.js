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

// scene/camera/renderer/안경 root/디버그 axes 를 한 번에 만들어 컨트롤 핸들을 반환한다.
/**
 * @param {{ canvas: HTMLCanvasElement, fov_deg?: number }} opts
 */
export function init_three_scene({ canvas, fov_deg = 63 }) {
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

  // 안경 root — matrix 직접 주입 (matrixAutoUpdate=false)
  const glasses_root_obj = new Object3D()
  glasses_root_obj.matrixAutoUpdate = false
  glasses_root_obj.visible = false
  scene.add(glasses_root_obj)

  // 디버그용 axes (5cm). 디폴트로 hidden, 토글 시 visible=true.
  const axes_helper = new AxesHelper(5)
  axes_helper.visible = false
  glasses_root_obj.add(axes_helper)

  // 얼굴 occluder — MediaPipe canonical_face_model.obj (468 vertices, 898 triangles, cm 단위)
  // 를 비동기 로드해 face 모양 mesh 로 정확히 가린다. 색은 안 쓰고 depth buffer 만 채워서
  // (colorWrite=false, depthWrite=true) 그 뒤로 들어간 안경 다리가 자동으로 카메라에서 가려진다.
  // 로드 전엔 작은 placeholder geometry. 로드 실패 시엔 사용자에게 콘솔 경고.
  const placeholder_geo = new SphereGeometry(0.001)
  const occluder_mat = new MeshBasicMaterial({ colorWrite: false, depthWrite: true })
  const face_occluder = new Mesh(placeholder_geo, occluder_mat)
  face_occluder.position.set(0, 0, 0)
  face_occluder.renderOrder = -1
  glasses_root_obj.add(face_occluder)
  // canonical face mesh 비동기 로드 → geometry 만 교체. canonical 좌표계가 face pose canonical
  // 과 동일하므로 추가 transform 불필요 (face_occluder 가 glasses_root_obj 자식 = face pose 적용).
  const obj_loader = new OBJLoader()
  obj_loader
    .loadAsync(`${import.meta.env.BASE_URL}mediapipe/models/canonical_face_model.obj`)
    .then((root) => {
      let replaced = false
      root.traverse((child) => {
        if (replaced || !child.isMesh || !child.geometry) return
        face_occluder.geometry.dispose()
        face_occluder.geometry = child.geometry
        replaced = true
      })
    })
    .catch((err) => {
      console.warn('[try-on] canonical face mesh load failed', err)
    })

  // face anchor offset — face pose origin (MediaPipe canonical face 의 어떤 점) 에서 우리가
  // 안경 브릿지를 정합하고 싶은 *face mesh 점* (눈 사이 = 미간) 까지의 offset. 이 group 의 자식이
  // 실제 안경 (override_group → align_group → GLB clone). face pose rotation 이 적용된 layer 라
  // 슬라이더 값은 canonical face *local* 좌표계 — 머리가 회전해도 안경이 같은 점에 붙는다.
  const face_anchor_offset_group = new Object3D()
  // default = canonical_face_model.obj 의 landmark 168 (nasion = 코뼈 위쪽 = 안경 코걸이가 닿는 점).
  // 직접 OBJ 에서 추출: v 0.000000 3.271027 5.236015. 양 눈 안쪽 corner 중점 (0, 2.585, 3.758) 보다
  // 약간 위 + 앞이라 안경 브릿지가 face 표면 위에 자연스럽게 얹히는 위치.
  face_anchor_offset_group.position.set(0, 3.27, 5.24)
  glasses_root_obj.add(face_anchor_offset_group)

  // anchor 위치 마커 — 작은 빨간 점. 디버그 토글 ON 시 visible 해서 사용자가 슬라이더 조정 중
  // anchor 가 화면에서 어느 face 점에 위치하는지 직접 확인 가능. depth test 끄고 renderOrder 999
  // 로 위에 강제 렌더 — 안경에 가려지지 않게.
  const marker_geo = new SphereGeometry(0.25, 12, 12)
  const marker_mat = new MeshBasicMaterial({ color: 0xff3366, depthTest: false, depthWrite: false })
  const face_anchor_marker = new Mesh(marker_geo, marker_mat)
  face_anchor_marker.visible = false
  face_anchor_marker.renderOrder = 999
  face_anchor_offset_group.add(face_anchor_marker)

  return {
    scene,
    camera,
    renderer,
    glasses_root_obj,
    axes_helper,
    face_occluder,
    face_anchor_offset_group,
    face_anchor_marker,
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
