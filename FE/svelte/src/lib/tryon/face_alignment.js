/**
 * MediaPipe FaceLandmarker 의 facialTransformationMatrixes 4x4 (row-major mm)
 * 와 three.js Object3D 사이의 변환 + GLB 자동 정렬 알고리즘.
 */
import { Matrix4, Quaternion, Vector3 } from 'three'

/**
 * @typedef {object} AutoCalibration
 * @property {Quaternion} axes_quat
 * @property {Vector3} anchor
 * @property {number} scale
 * @property {boolean} forward_flip
 * @property {{
 *   axes_map: string,
 *   vertex_count: number,
 *   width_in_model_units: number,
 *   sym_scores: { x: number, y: number, z: number } | null,
 * }} debug_obj
 */

// MediaPipe column-major Float32Array(16) head pose 를 Object3D.matrix 에 주입한다.
/**
 * MediaPipe facialTransformationMatrixes[0].data 는 column-major. three.js Matrix4.elements
 * 도 column-major 라 fromArray 로 그대로 복사 — transpose 는 안 한다.
 *
 * 셀피 UX 를 위해 video / three canvas 둘 다 CSS scaleX(-1) 로 미러링된다. 부호 보정:
 *   - yaw (Y 축 회전) 부호: image space 와 사용자 perception 이 반대 → 반전 필요
 *   - roll (Z 축 회전) 부호: 그대로 정합 → 보존
 *   - translation X: three canvas 도 미러되므로 image space 그대로 함께 미러됨 → 보존
 *
 * yaw 만 반전하는 방법: R_y(θ) 의 sin 항은 r02 (e[8]) 와 r20 (e[2]) 에만 들어간다 (R_z 의
 * sin 은 r01·r10, R_x 의 sin 은 r12·r21 에). 따라서 e[2] · e[8] 만 부호 반전하면 yaw 만
 * 부호가 뒤집히고 roll/pitch/translation 은 보존된다. 단순한 mirror sandwich 와 달리 X-Y
 * plane 의 off-diagonal (e[1]·e[4]) 은 건드리지 않는다.
 *
 * 호출 측은 obj.matrixAutoUpdate = false 로 두어야 한다.
 *
 * @param {import('three').Object3D} obj
 * @param {Float32Array} m4_data column-major 16 floats
 */
export function apply_face_pose(obj, m4_data) {
  obj.matrix.fromArray(m4_data)
  const e = obj.matrix.elements
  e[2] = -e[2] // r20: yaw 의 sin 부호
  e[8] = -e[8] // r02: yaw 의 sin 부호
  obj.matrixWorldNeedsUpdate = true
}

// MediaPipe FaceLandmarker 의 canonical face model 은 cm 단위 (canonical_face_model.fbx).
// 따라서 facialTransformationMatrixes translation 도 cm 단위. 안경 폭도 같은 단위로 정렬해야
// scale mismatch 로 안경이 frustum 밖으로 벗어나지 않는다 — 일반 성인 안경 가로 폭 ≈ 14cm.
const CANONICAL_FRAME_WIDTH_CM = 14

// GLB 의 vertex 분포로부터 축 매핑·브릿지 anchor·스케일·forward_flip 을 1회 계산한다.
/**
 * GLB scene 의 vertex 를 순회해 한 번만 자동 정렬 파라미터를 계산한다.
 * @param {import('three').Object3D} glb_scene
 * @returns {AutoCalibration}
 */
export function compute_auto_calibration(glb_scene) {
  const verts = collect_world_vertices(glb_scene)
  if (verts.length === 0) {
    console.warn('[try-on] auto-calibration: vertex 0, identity 사용')
    return {
      axes_quat: new Quaternion(),
      anchor: new Vector3(),
      scale: 1,
      forward_flip: false,
      debug_obj: {
        axes_map: 'identity',
        vertex_count: 0,
        width_in_model_units: 0,
        sym_scores: null,
      },
    }
  }

  // 1. AABB 측정
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const v of verts) { min.min(v); max.max(v) }
  const size = new Vector3().subVectors(max, min)
  const size_obj = { x: size.x, y: size.y, z: size.z }
  const center_obj = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  }

  // 2. 축 매핑 결정 — bbox 비율만으로는 안경 폭과 다리 길이를 구별 못 한다 (둘 다 ~14cm). 대신:
  //   • 가장 짧은 축 = Y (위/아래) — 안경 높이는 거의 항상 폭/다리보다 명확히 짧다 (~4cm)
  //   • 남은 두 축 중 좌우 대칭이 더 강한 = X (좌우, 거울 대칭축의 normal)
  //   • 마지막 = Z (앞/뒤, 다리 길이 — 한쪽으로만 뻗어 비대칭)
  //
  // asymmetry_score: bbox 중심 기준 양쪽의 vertex 개수와 평균 거리 균형. 0=완벽 대칭, 클수록 비대칭.
  const sym_scores = {
    x: asymmetry_score(verts, 'x', center_obj.x),
    y: asymmetry_score(verts, 'y', center_obj.y),
    z: asymmetry_score(verts, 'z', center_obj.z),
  }
  const axes_by_size_asc = ['x', 'y', 'z'].sort((a, b) => size_obj[a] - size_obj[b])
  const target_y_axis = axes_by_size_asc[0]
  const remaining = axes_by_size_asc.slice(1)
  remaining.sort((a, b) => sym_scores[a] - sym_scores[b])
  const target_x_axis = remaining[0]
  const target_z_axis = remaining[1]
  const axes_quat = build_axes_remap_quaternion(target_x_axis, target_y_axis, target_z_axis)
  const axes_map = `${target_x_axis}${target_y_axis}${target_z_axis}`

  // 매핑 후 좌표계로 vertex 변환
  const remapped = verts.map((v) => v.clone().applyQuaternion(axes_quat))

  // 3. 좌우 대칭축 — 매핑 후 X 중심
  const rmin = new Vector3(Infinity, Infinity, Infinity)
  const rmax = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const v of remapped) { rmin.min(v); rmax.max(v) }
  const x_center = (rmin.x + rmax.x) / 2
  const width = rmax.x - rmin.x

  // 4. 브릿지 anchor — |x - center| < width*0.05 인 vertex 들의 *평균* (브릿지 중간 = 코걸이 위치).
  // 이전엔 Y 상위 5% (브릿지 *상단*) 을 anchor 로 썼는데, 그러면 face origin (≈ nasion = 코뼈 위쪽)
  // 보다 안경이 위로 뜬다. 평균을 쓰면 브릿지의 가운데가 anchor 가 되어 코걸이가 nasion 에 닿는
  // 자연 정합이 된다. 안경알은 X 양쪽이라 center_band 에 안 들어와 평균이 브릿지에 집중됨.
  const center_band = remapped.filter((v) => Math.abs(v.x - x_center) < width * 0.05)
  let anchor = new Vector3(x_center, (rmin.y + rmax.y) / 2, (rmin.z + rmax.z) / 2)
  if (center_band.length > 0) {
    anchor = new Vector3()
    for (const v of center_band) anchor.add(v)
    anchor.divideScalar(center_band.length)
  }

  // 5. forward_flip — 안경다리 끝점들(|x| > width*0.4) 의 평균 Z 가 *음수* 면 flip.
  // canonical face 의 +Z = forward(카메라 쪽). 안경 다리는 face *뒤* (-Z) 로 뻗어야 정상.
  // 매핑 후 좌표계에서 다리 끝의 평균 Z 가 음수 = 안경 forward 가 +Z (face forward 와 일치) → flip.
  // 양수 = 안경 forward 가 -Z (face forward 반대) → 그대로 face 향함, flip 불필요.
  // (사용자 피드백: 기존 부호가 반대였음 — rot_y -180 으로 보정해야 했음.)
  const wing_band = remapped.filter((v) => Math.abs(v.x - x_center) > width * 0.4)
  let mean_z = 0
  if (wing_band.length > 0) {
    for (const v of wing_band) mean_z += v.z
    mean_z /= wing_band.length
  }
  const forward_flip = mean_z < 0

  // 6. 스케일 — 매핑 후 X 폭을 canonical 14cm 에 맞춤. GLB 좌표 단위 무관 (m 이든 mm 이든
  // 결과가 cm 단위로 일관되게 정렬됨).
  const scale = width > 0 ? CANONICAL_FRAME_WIDTH_CM / width : 1

  return {
    axes_quat,
    anchor,
    scale,
    forward_flip,
    debug_obj: {
      axes_map,
      vertex_count: verts.length,
      width_in_model_units: width,
      sym_scores,
    },
  }
}

// 자동 정렬 통계용으로 충분한 vertex 샘플 수 — 18만 vertex GLB 도 main thread 차단 없이 처리 가능.
const MAX_SAMPLE_VERTEX_COUNT = 5000

// GLB 의 mesh vertex 를 world 좌표로 모은다. 총량이 MAX_SAMPLE_VERTEX_COUNT 를 넘으면 stride 샘플링.
/**
 * @param {import('three').Object3D} root
 * @returns {Vector3[]}
 */
// 좌우 대칭 정도를 측정한다. bbox 중심 기준 양쪽 vertex 들의 *평균 절댓값 거리* 균형.
// 0 = 완벽 대칭, 클수록 한쪽으로 치우침. count 균형은 origin 위치에 너무 민감해서 안 씀
// (예: 브릿지 vertex 가 중심선 위에 모이면 한쪽 count 만 부풀려짐).
/**
 * @param {Vector3[]} verts
 * @param {'x'|'y'|'z'} axis_key
 * @param {number} center
 * @returns {number}
 */
function asymmetry_score(verts, axis_key, center) {
  let l_count = 0
  let r_count = 0
  let l_sum_abs = 0
  let r_sum_abs = 0
  for (const v of verts) {
    const d = v[axis_key] - center
    if (d < 0) {
      l_count++
      l_sum_abs += -d
    } else if (d > 0) {
      r_count++
      r_sum_abs += d
    }
  }
  const lm = l_count > 0 ? l_sum_abs / l_count : 0
  const rm = r_count > 0 ? r_sum_abs / r_count : 0
  const max_mean = Math.max(lm, rm)
  return max_mean > 0 ? Math.abs(lm - rm) / max_mean : 0
}

function collect_world_vertices(root) {
  root.updateMatrixWorld(true)
  // 1단계: 총 vertex 수 카운트해서 stride 결정 (18만 vertex 모델이라도 5천 샘플로 통계는 충분).
  let total = 0
  root.traverse((child) => {
    const geo = child.geometry
    if (!child.isMesh || !geo?.attributes?.position) return
    total += geo.attributes.position.count
  })
  if (total === 0) return []
  const stride = Math.max(1, Math.floor(total / MAX_SAMPLE_VERTEX_COUNT))

  // 2단계: stride 마다 1개씩 샘플. 메시 경계와 무관하게 전역 카운터로 균등 샘플링.
  const out = []
  let global_index = 0
  root.traverse((child) => {
    const geo = child.geometry
    if (!child.isMesh || !geo?.attributes?.position) return
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      if (global_index++ % stride !== 0) continue
      const v = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld)
      out.push(v)
    }
  })
  return out
}

// compute_auto_calibration 결과를 Group 의 transform 에 일괄 적용한다.
/**
 * Group 자식(GLB scene)을 매핑된 좌표계 + anchor 원점 + mm 스케일로 굳혀준다.
 * forward_flip 은 여기서 처리하지 않는다 — Y축 180° 회전을 transform 으로 끼워 넣으면
 * face pose 의 yaw rotation 과 합성되어 yaw 부호가 반전되는 부수효과가 생긴다 (R_y(θ)·Y_FLIP =
 * R_y(-θ)). 대신 GLB geometry 의 vertex z 좌표 자체를 반전 (glasses_loader.instantiate_glasses)
 * 해 transform 합성에 영향 없이 모델 forward 만 뒤집는다.
 *
 * @param {import('three').Object3D} group
 * @param {ReturnType<typeof compute_auto_calibration>} cal
 */
export function apply_auto_alignment(group, cal) {
  group.quaternion.copy(cal.axes_quat)
  group.scale.setScalar(cal.scale)
  group.position.copy(cal.anchor).multiplyScalar(-cal.scale).applyQuaternion(cal.axes_quat)
  group.updateMatrix()
}

// 모델 좌표축 (tx, ty, tz) ∈ {x,y,z} 를 정규 (X=좌우, Y=상하, Z=앞뒤) 로 매핑하는 quaternion 을 만든다.
/**
 * 입력이 ('x','y','z') 면 identity.
 * @param {'x'|'y'|'z'} tx
 * @param {'x'|'y'|'z'} ty
 * @param {'x'|'y'|'z'} tz
 * @returns {Quaternion}
 */
function build_axes_remap_quaternion(tx, ty, tz) {
  // 모델축 단위 벡터를 정규 X/Y/Z 로 보내는 회전 행렬.
  // 행 = normal 축 (X=0, Y=1, Z=2), 열 = model 축 (x=0, y=1, z=2)
  // M · e[tx] = e_X 이므로 M 의 'tx' 컬럼 'X' 행에 1.
  const m = new Matrix4()
  const idx = { x: 0, y: 1, z: 2 }
  // elements 는 column-major: e[col*4 + row]
  // 회전 부분(3x3) 0 으로 초기화
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      m.elements[col * 4 + row] = 0
    }
  }
  m.elements[idx[tx] * 4 + 0] = 1 // model tx → normal X
  m.elements[idx[ty] * 4 + 1] = 1 // model ty → normal Y
  m.elements[idx[tz] * 4 + 2] = 1 // model tz → normal Z
  m.elements[15] = 1

  // 홀수 permutation 은 reflection (det=-1) 이라 setFromRotationMatrix 에서 깨진다.
  // 가장 짧은 축(model tz → normal Z) 컬럼을 부호 반전해 proper rotation 으로 만든다.
  if (compute_det3(m) < 0) {
    const col = idx[tz]
    m.elements[col * 4 + 0] *= -1
    m.elements[col * 4 + 1] *= -1
    m.elements[col * 4 + 2] *= -1
  }
  return new Quaternion().setFromRotationMatrix(m)
}

// 3x3 부분의 행렬식 계산 (column-major Matrix4 의 좌상단 3x3).
/**
 * @param {Matrix4} m
 * @returns {number}
 */
function compute_det3(m) {
  const e = m.elements
  // col0 = (e[0], e[1], e[2]), col1 = (e[4], e[5], e[6]), col2 = (e[8], e[9], e[10])
  const a = e[0], b = e[4], c = e[8]
  const d = e[1], ee = e[5], f = e[9]
  const g = e[2], h = e[6], i = e[10]
  return a * (ee * i - f * h) - b * (d * i - f * g) + c * (d * h - ee * g)
}
