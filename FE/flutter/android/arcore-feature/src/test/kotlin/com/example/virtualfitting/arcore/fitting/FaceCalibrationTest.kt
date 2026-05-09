package com.example.virtualfitting.arcore.fitting

import org.junit.Assert.assertEquals
import org.junit.Test

class FaceCalibrationTest {

    @Test
    fun `average of measurements computes per-field mean`() {
        val samples = listOf(
            FaceMeasurement(faceWidth = 0.10f, noseTipY = 0.04f),
            FaceMeasurement(faceWidth = 0.12f, noseTipY = 0.05f),
            FaceMeasurement(faceWidth = 0.14f, noseTipY = 0.06f),
        )

        val avg = samples.average()

        assertEquals(0.12f, avg.faceWidth, 1e-6f)
        assertEquals(0.05f, avg.noseTipY, 1e-6f)
    }

    @Test
    fun `average of empty list returns zero measurement`() {
        val avg = emptyList<FaceMeasurement>().average()
        assertEquals(0f, avg.faceWidth, 1e-6f)
        assertEquals(0f, avg.noseTipY, 1e-6f)
    }

    @Test
    fun `variance is zero when all samples identical`() {
        val samples = List(10) { FaceMeasurement(faceWidth = 0.13f, noseTipY = 0.05f) }
        assertEquals(0f, variance(samples), 1e-6f)
    }

    @Test
    fun `variance grows with sample spread`() {
        val tight = listOf(
            FaceMeasurement(0.130f, 0.050f),
            FaceMeasurement(0.131f, 0.051f),
            FaceMeasurement(0.130f, 0.050f),
        )
        val loose = listOf(
            FaceMeasurement(0.10f, 0.04f),
            FaceMeasurement(0.15f, 0.07f),
            FaceMeasurement(0.12f, 0.05f),
        )
        assert(variance(tight) < variance(loose)) {
            "tight (${variance(tight)}) should be smaller than loose (${variance(loose)})"
        }
    }

    @Test
    fun `calibration locks when variance drops below threshold`() {
        val cal = FaceCalibration(
            minSamples = 5,
            windowSize = 5,
            varianceThreshold = 1e-4f,
            timeoutMs = 10_000L,
        )
        // 안정된 측정 5개 → lock
        repeat(5) {
            cal.submit(FaceMeasurement(0.131f, 0.052f), nowMs = it * 33L)
        }
        assertEquals(0.131f, cal.locked!!.faceWidth, 1e-3f)
        assertEquals(0.052f, cal.locked!!.noseTipY, 1e-3f)
    }

    @Test
    fun `calibration does not lock while variance stays high`() {
        val cal = FaceCalibration(
            minSamples = 3,
            windowSize = 3,
            varianceThreshold = 1e-7f,  // 매우 엄격
            timeoutMs = 10_000L,
        )
        repeat(10) {
            // 매 프레임 값이 출렁임
            val w = if (it % 2 == 0) 0.10f else 0.15f
            cal.submit(FaceMeasurement(w, 0.05f), nowMs = it * 33L)
        }
        assertEquals(null, cal.locked)
    }

    @Test
    fun `calibration falls back to average on timeout`() {
        val cal = FaceCalibration(
            minSamples = 3,
            windowSize = 3,
            varianceThreshold = 1e-7f,  // 절대 안정 안 될 만큼 엄격
            timeoutMs = 100L,
        )
        repeat(5) {
            cal.submit(FaceMeasurement(0.10f + it * 0.01f, 0.05f), nowMs = it * 30L)
        }
        // nowMs = 30, 60, 90, 120 (>100ms 경과) → 폴백 lock 발생해야 함
        assert(cal.locked != null) { "should fallback-lock after timeout" }
    }

    @Test
    fun `submitting after lock is no-op`() {
        val cal = FaceCalibration(minSamples = 1, windowSize = 1, varianceThreshold = 1f, timeoutMs = 10_000L)
        cal.submit(FaceMeasurement(0.10f, 0.05f), nowMs = 0L)
        val firstLock = cal.locked!!
        cal.submit(FaceMeasurement(0.20f, 0.10f), nowMs = 100L)
        assertEquals(firstLock.faceWidth, cal.locked!!.faceWidth, 1e-6f)
        assertEquals(firstLock.noseTipY, cal.locked!!.noseTipY, 1e-6f)
    }
}
