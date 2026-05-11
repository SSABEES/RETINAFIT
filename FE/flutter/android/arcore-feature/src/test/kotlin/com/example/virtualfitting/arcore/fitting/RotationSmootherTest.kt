package com.example.virtualfitting.arcore.fitting

import dev.romainguy.kotlin.math.Quaternion
import dev.romainguy.kotlin.math.dot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import org.junit.Test

class RotationSmootherTest {

    private fun quatY(angleRad: Float): Quaternion =
        Quaternion(x = 0f, y = sin(angleRad / 2f), z = 0f, w = cos(angleRad / 2f))

    @Test
    fun `first call returns raw input`() {
        val smoother = RotationSmoother()
        val raw = quatY(0.3f)
        val out = smoother.filter(raw, timestampNs = 1_000_000_000L)
        // 첫 호출엔 이전 state 가 없어 raw 그대로 (정규화된 형태로) 통과해야 한다.
        assertQuatClose(raw, out, tol = 1e-5f)
    }

    @Test
    fun `constant input converges to that input`() {
        val smoother = RotationSmoother()
        val raw = quatY(0.5f)
        var out = raw
        // 동일 입력을 충분히 반복하면 필터 출력이 입력으로 수렴.
        for (i in 0 until 100) {
            out = smoother.filter(raw, timestampNs = i * 33_000_000L)
        }
        assertQuatClose(raw, out, tol = 1e-3f)
    }

    @Test
    fun `non-monotonic timestamp returns previous output`() {
        val smoother = RotationSmoother()
        val q0 = quatY(0.0f)
        val q1 = quatY(0.2f)
        smoother.filter(q0, timestampNs = 1_000_000_000L)
        val out1 = smoother.filter(q1, timestampNs = 1_033_000_000L)
        // 같은 / 이전 timestamp 로 재호출 시 이전 출력을 그대로 반환 (필터 갱신 X).
        val outSame = smoother.filter(q1, timestampNs = 1_033_000_000L)
        assertQuatClose(out1, outSame, tol = 1e-6f)
    }

    @Test
    fun `reset clears state so next call returns raw`() {
        val smoother = RotationSmoother()
        smoother.filter(quatY(0f), timestampNs = 0L)
        smoother.filter(quatY(0.5f), timestampNs = 33_000_000L)
        smoother.reset()

        val raw = quatY(1.0f)
        val out = smoother.filter(raw, timestampNs = 100L)
        // reset 직후엔 새 인스턴스처럼 동작 → raw 그대로 통과.
        assertQuatClose(raw, out, tol = 1e-5f)
    }

    @Test
    fun `slow change is smoothed - output lags raw`() {
        // 느린 회전: 각 프레임 0.005 rad 씩 증가. minCutoff 1Hz 가 충분히 스무딩.
        val smoother = RotationSmoother(minCutoff = 1f, beta = 0.0f, dCutoff = 1f)
        var lastRaw = quatY(0f)
        var lastOut = quatY(0f)
        for (i in 0 until 30) {
            val angle = i * 0.005f
            lastRaw = quatY(angle)
            lastOut = smoother.filter(lastRaw, timestampNs = i * 33_000_000L)
        }
        // beta=0 으로 적응 끄고 minCutoff 만 작동: 출력이 raw 보다 작은 각도여야 함 (lag).
        val rawAngle = 2f * kotlin.math.acos(lastRaw.w.coerceIn(-1f, 1f))
        val outAngle = 2f * kotlin.math.acos(lastOut.w.coerceIn(-1f, 1f))
        assertTrue("expected output to lag raw, raw=$rawAngle out=$outAngle", outAngle < rawAngle)
    }

    @Test
    fun `fast change with high beta tracks raw closely`() {
        // 빠른 회전: 각 프레임 0.1 rad. 큰 beta 가 cutoff 를 끌어올려 raw 추종.
        val smoother = RotationSmoother(minCutoff = 1f, beta = 5.0f, dCutoff = 1f)
        var lastRaw = quatY(0f)
        var lastOut = quatY(0f)
        for (i in 0 until 30) {
            val angle = i * 0.1f
            lastRaw = quatY(angle)
            lastOut = smoother.filter(lastRaw, timestampNs = i * 33_000_000L)
        }
        val rawAngle = 2f * kotlin.math.acos(lastRaw.w.coerceIn(-1f, 1f))
        val outAngle = 2f * kotlin.math.acos(lastOut.w.coerceIn(-1f, 1f))
        // 적응형 cutoff 가 작동해서 raw 와 출력 차이가 작아야 함 (10% 이내).
        val gap = abs(rawAngle - outAngle)
        assertTrue("expected output to follow raw closely, gap=$gap", gap < 0.1f * rawAngle)
    }

    @Test
    fun `hemisphere flip is handled - output stays close to previous`() {
        // 같은 회전을 부호만 뒤집은 quaternion 으로 줘도 출력이 갑자기 점프하면 안 됨.
        val smoother = RotationSmoother()
        val q = quatY(0.3f)
        smoother.filter(q, timestampNs = 0L)
        val flipped = Quaternion(x = -q.x, y = -q.y, z = -q.z, w = -q.w)
        val out = smoother.filter(flipped, timestampNs = 33_000_000L)
        // hemisphere alignment 가 작동하면 출력은 q (또는 -q 중 q 와 같은 회전) 와 가까워야 함.
        // dot 의 절대값으로 확인 (부호 무관 동일성).
        val similarity = abs(dot(q, out))
        assertTrue("expected similarity ~1, got $similarity", similarity > 0.999f)
    }

    private fun assertQuatClose(expected: Quaternion, actual: Quaternion, tol: Float) {
        // 쿼터니언 동일성은 부호 무관 — |dot| 이 1 에 가까우면 같은 회전.
        val sim = abs(dot(expected, actual))
        assertEquals(1f, sim, tol)
    }
}
