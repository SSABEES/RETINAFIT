import { describe, it, expect, vi } from 'vitest'
import {
  Object3D,
  Matrix4,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Group,
  Quaternion,
  Vector3,
} from 'three'
import {
  apply_face_pose,
  compute_auto_calibration,
  apply_auto_alignment,
} from './face_alignment.js'

describe('apply_face_pose', () => {
  // MediaPipe data 는 column-major. three.js elements 도 column-major. fromArray 로 그대로 복사.
  // 단 셀피 미러 정합을 위해 mirror sandwich (M·R·M, M=diag(-1,1,1,1)) 적용 →
  // 결과적으로 r01/r02/r10/r20 부호 반전 + translation X 부호 반전.
  it('yaw 만 부호 반전: identity matrix 는 그대로 (translation 보존)', () => {
    const obj = new Object3D()
    obj.matrixAutoUpdate = false
    const data = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1,
    ])
    apply_face_pose(obj, data)
    const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]
    for (let i = 0; i < 16; i++) {
      expect(obj.matrix.elements[i]).toBeCloseTo(expected[i], 10)
    }
    expect(obj.matrixWorldNeedsUpdate).toBe(true)
  })

  it('yaw 만 부호 반전: r02 (e[8]) 와 r20 (e[2]) 만 부호 반전, 나머지는 보존', () => {
    const obj = new Object3D()
    obj.matrixAutoUpdate = false
    const data = new Float32Array([
      1, 4, 5, 0,
      2, 6, 7, 0,
      3, 8, 9, 0,
      11, 22, 33, 1,
    ])
    apply_face_pose(obj, data)
    // e[2] (r20=5) → -5, e[8] (r02=3) → -3. 나머지 모두 그대로.
    const expected = [1, 4, -5, 0, 2, 6, 7, 0, -3, 8, 9, 0, 11, 22, 33, 1]
    for (let i = 0; i < 16; i++) {
      expect(obj.matrix.elements[i]).toBeCloseTo(expected[i], 10)
    }
  })

  it('yaw 만 부호 반전: pure R_y(θ) 가 R_y(-θ) 로 변환된다', () => {
    const obj = new Object3D()
    obj.matrixAutoUpdate = false
    const theta = 0.5
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // R_y(θ) column-major: col0=(c,0,-s,0), col1=(0,1,0,0), col2=(s,0,c,0), col3=(0,0,0,1)
    const data = new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ])
    apply_face_pose(obj, data)
    // 결과는 R_y(-θ): col0=(c,0,s,0), col2=(-s,0,c,0)
    expect(obj.matrix.elements[2]).toBeCloseTo(s, 6) // 원래 -s 였는데 부호 반전 → +s
    expect(obj.matrix.elements[8]).toBeCloseTo(-s, 6) // 원래 +s 였는데 부호 반전 → -s
  })

  it('yaw 만 부호 반전: pure R_z(θ) 는 변하지 않는다 (roll 보존)', () => {
    const obj = new Object3D()
    obj.matrixAutoUpdate = false
    const theta = 0.5
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // R_z(θ) column-major: col0=(c,s,0,0), col1=(-s,c,0,0), col2=(0,0,1,0)
    const data = new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])
    apply_face_pose(obj, data)
    // R_z 는 e[2]=0, e[8]=0 이라 부호 반전 영향 없음. 그대로.
    expect(obj.matrix.elements[1]).toBeCloseTo(s, 6)
    expect(obj.matrix.elements[4]).toBeCloseTo(-s, 6)
    expect(obj.matrix.elements[2]).toBeCloseTo(0, 6)
    expect(obj.matrix.elements[8]).toBeCloseTo(0, 6)
  })
})

/**
 * 합성 안경 메시. 새 알고리즘 (대칭 기반 X 결정) 검증을 위해 *현실적인* 비율로 작성:
 * 좌우 대칭 폭(140) ≈ 다리 길이(135, 비대칭) > 높이(40).
 *   - body: x ∈ [-70, 70], y ∈ [-20, 20], z ∈ [-3, 3]
 *   - 다리(2개): x ∈ {-70, 70} 에서 z 가 음수쪽으로 -130 까지 뻗음 (한쪽으로만 — 비대칭)
 *   - 브릿지 상단: (0, 20, 0) 명확히 강조
 */
function make_synthetic_glasses({ swap_xz = false, flipped = false } = {}) {
  const verts = []
  // body box vertex
  for (const x of [-70, 70])
    for (const y of [-20, 20])
      for (const z of [-3, 3]) verts.push([x, y, z])
  // 다리 끝점들 (양쪽 4 점씩, z 가 -130 까지 음수쪽으로만 뻗음 → 좌우 대칭이지만 z 비대칭)
  for (const x of [-70, 70])
    for (const y of [-15, 15])
      for (const z of [-130, -100]) verts.push([x, y, z])
  // 브릿지 상단 명확히 (0, 20, 0) 점 강조
  verts.push([0, 20, 0])
  verts.push([0, 19, 0])
  verts.push([0, 18, 0])

  // 변환 적용
  const transformed = verts.map(([x, y, z]) => {
    let nx = x, ny = y, nz = z
    if (flipped) { nx = -x; nz = -z } // Y 축 180° 회전 (다리가 +Z 로 뻗게)
    if (swap_xz) { const t = nx; nx = nz; nz = t } // X ↔ Z 스왑
    return [nx, ny, nz]
  })

  const flat = new Float32Array(transformed.length * 3)
  transformed.forEach((p, i) => { flat[i*3] = p[0]; flat[i*3+1] = p[1]; flat[i*3+2] = p[2] })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(flat, 3))
  const mesh = new Mesh(geo, new MeshBasicMaterial())
  const group = new Group()
  group.add(mesh)
  return group
}

describe('compute_auto_calibration', () => {
  it('정상 안경: axes_quat ≈ identity, anchor.x ≈ 0, anchor.y 가장 큼', () => {
    const scene = make_synthetic_glasses()
    const cal = compute_auto_calibration(scene)
    expect(cal.axes_quat.x).toBeCloseTo(0, 5)
    expect(cal.axes_quat.y).toBeCloseTo(0, 5)
    expect(cal.axes_quat.z).toBeCloseTo(0, 5)
    expect(Math.abs(cal.axes_quat.w)).toBeCloseTo(1, 5)
    expect(cal.anchor.x).toBeCloseTo(0, 1)
    expect(cal.anchor.y).toBeGreaterThan(15) // 브릿지 상단 ≈ 20
    expect(cal.scale).toBeCloseTo(0.1, 2)    // 폭 140 / CANONICAL_FRAME_WIDTH_CM(14) = 0.1
    // 합성 안경: 다리 z=-130~-100 (face 뒤로 뻗음). 매핑 후 wing_band 평균 z 음수 →
    // 새 알고리즘 (mean_z < 0 → flip) 으로 forward_flip = true.
    expect(cal.forward_flip).toBe(true)
  })

  it('X ↔ Z 스왑된 모델: axes_quat 가 90° 회전을 만든다', () => {
    const scene = make_synthetic_glasses({ swap_xz: true })
    const cal = compute_auto_calibration(scene)
    // axes_quat 적용 후 modelXYZ → (X=좌우, Y=상하, Z=앞뒤) 가 되어야 함.
    // swap_xz 모델의 가장 긴 축은 model z 방향이므로, 그 방향 벡터를 보정하면 world X 가 가장 커야 한다.
    const v = new Vector3(0, 0, 70).applyQuaternion(cal.axes_quat)
    expect(Math.abs(v.x)).toBeGreaterThan(Math.abs(v.z) - 1e-3)
    expect(Math.abs(v.x)).toBeGreaterThan(Math.abs(v.y))
    expect(cal.scale).toBeCloseTo(0.1, 2)  // 동일하게 폭 140 / 14 = 0.1
  })

  it('뒤집힌 모델: forward_flip = false (다리가 +Z 로 뻗음 → flip 불필요)', () => {
    const scene = make_synthetic_glasses({ flipped: true })
    const cal = compute_auto_calibration(scene)
    // 부호 반전된 알고리즘에서 다리가 +Z 로 뻗으면 mean_z 양수 → flip 안 함.
    expect(cal.forward_flip).toBe(false)
  })

  it('vertex 0 인 degenerate scene: identity calibration + warn', () => {
    const empty = new Group()
    const warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cal = compute_auto_calibration(empty)
    expect(cal.axes_quat.equals(new Quaternion())).toBe(true)
    expect(cal.anchor.equals(new Vector3())).toBe(true)
    expect(cal.scale).toBe(1)
    expect(cal.forward_flip).toBe(false)
    expect(warn_spy).toHaveBeenCalled()
    warn_spy.mockRestore()
  })
})

describe('apply_auto_alignment', () => {
  it('calibration 의 회전·anchor·scale 을 Group transform 에 일괄 적용한다 (forward_flip 무관)', () => {
    const g = new Group()
    const cal = {
      axes_quat: new Quaternion(),
      anchor: new Vector3(0, 20, 0),
      scale: 0.5,
      forward_flip: true, // forward_flip 은 transform 에 영향 없음 (geometry vertex 반전으로 처리)
      debug_obj: { axes_map: 'xyz', vertex_count: 1, width_in_model_units: 14 },
    }
    apply_auto_alignment(g, cal)
    expect(g.position.y).toBeCloseTo(-20 * 0.5, 5)
    expect(g.scale.x).toBeCloseTo(0.5, 5)
    // forward_flip 이 transform 에 영향 없으니 quaternion 은 axes_quat 그대로 (identity).
    expect(g.quaternion.x).toBeCloseTo(0, 5)
    expect(g.quaternion.y).toBeCloseTo(0, 5)
    expect(g.quaternion.z).toBeCloseTo(0, 5)
    expect(Math.abs(g.quaternion.w)).toBeCloseTo(1, 5)
  })
})
