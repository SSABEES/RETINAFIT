import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Group, Mesh, BufferGeometry, BufferAttribute, MeshBasicMaterial } from 'three'
import {
  __reset_cache_for_test,
  ensure_glasses_loaded,
  instantiate_glasses,
} from './glasses_loader.js'

beforeEach(() => __reset_cache_for_test())

describe('ensure_glasses_loaded', () => {
  it('동일 URL 재요청 시 두 번째는 캐시 hit (loader 재호출 없음)', async () => {
    const fake_scene = new Group()
    const fake_loader = { loadAsync: vi.fn().mockResolvedValue({ scene: fake_scene }) }
    const r1 = await ensure_glasses_loaded('https://x/a.glb', { loader: fake_loader })
    const r2 = await ensure_glasses_loaded('https://x/a.glb', { loader: fake_loader })
    expect(fake_loader.loadAsync).toHaveBeenCalledTimes(1)
    expect(r1.scene).toBe(fake_scene)
    expect(r2.scene).toBe(fake_scene)
    expect(r1.calibration).toBeDefined()
  })

  it('로드 실패 시 캐시에서 entry 제거 → 다음 호출은 재시도', async () => {
    const err = new Error('network fail')
    const fake_loader = {
      loadAsync: vi.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({ scene: new Group() }),
    }
    await expect(ensure_glasses_loaded('https://x/b.glb', { loader: fake_loader })).rejects.toBe(err)
    await expect(ensure_glasses_loaded('https://x/b.glb', { loader: fake_loader })).resolves.toBeDefined()
    expect(fake_loader.loadAsync).toHaveBeenCalledTimes(2)
  })

  it('빈 URL 은 즉시 reject', async () => {
    await expect(ensure_glasses_loaded('')).rejects.toThrow(/url/i)
  })
})

describe('instantiate_glasses', () => {
  it('호출마다 새 scene clone 을 반환하고 calibration 은 동일 참조 유지', async () => {
    // 실제 mesh 가 있는 scene 을 clone 하는지 검증 위해 Mesh 1개 포함.
    const fake_scene = new Group()
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3))
    fake_scene.add(new Mesh(geo, new MeshBasicMaterial()))
    const fake_loader = { loadAsync: vi.fn().mockResolvedValue({ scene: fake_scene }) }
    const result = await ensure_glasses_loaded('https://x/c.glb', { loader: fake_loader })

    const i1 = instantiate_glasses(result)
    const i2 = instantiate_glasses(result)

    // 매번 다른 scene 인스턴스
    expect(i1.scene).not.toBe(result.scene)
    expect(i2.scene).not.toBe(result.scene)
    expect(i1.scene).not.toBe(i2.scene)
    // calibration 은 동일 참조 (불변)
    expect(i1.calibration).toBe(result.calibration)
    expect(i2.calibration).toBe(result.calibration)
  })
})
