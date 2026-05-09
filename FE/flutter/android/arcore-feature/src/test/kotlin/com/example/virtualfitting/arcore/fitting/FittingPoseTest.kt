package com.example.virtualfitting.arcore.fitting

import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import org.junit.Assert.assertEquals
import org.junit.Test

class FittingPoseTest {

    private val basePreset = FaceFitPreset(
        scaleToUnits = 0.16f,
        localPosition = Position(x = 0.074f, y = 0.093f, z = -0.074f),
        localRotation = Rotation(x = 0f, y = 0f, z = 0.8f),
    )

    private val referenceFaceWidth = 0.131f

    @Test
    fun `withCalibration scaleToUnits equals faceWidth times glasses ratio`() {
        val locked = FaceMeasurement(faceWidth = 0.131f, noseTipY = REFERENCE_NOSE_TIP_Y)
        val out = basePreset.withCalibration(locked)

        // 2.04 = FACE_WIDTH_TO_GLASSES_RATIO (private; reproduced here for the assertion)
        assertEquals(0.131f * 2.04f, out.scaleToUnits, 1e-6f)
    }

    @Test
    fun `withCalibration scales linearly with face width`() {
        val narrow = FaceMeasurement(faceWidth = 0.10f, noseTipY = REFERENCE_NOSE_TIP_Y)
        val wide = FaceMeasurement(faceWidth = 0.15f, noseTipY = REFERENCE_NOSE_TIP_Y)

        val outN = basePreset.withCalibration(narrow)
        val outW = basePreset.withCalibration(wide)

        // wide/narrow ratio of scale should equal face-width ratio
        assertEquals(0.15f / 0.10f, outW.scaleToUnits / outN.scaleToUnits, 1e-6f)
    }

    @Test
    fun `withCalibration shifts y by nose delta from reference`() {
        val locked = FaceMeasurement(
            faceWidth = referenceFaceWidth,
            noseTipY = REFERENCE_NOSE_TIP_Y + 0.01f,  // 코가 1cm 더 아래
        )
        val out = basePreset.withCalibration(locked)

        assertEquals(basePreset.localPosition.y + 0.01f, out.localPosition.y, 1e-6f)
    }

    @Test
    fun `withCalibration y is unchanged when nose matches reference`() {
        val locked = FaceMeasurement(faceWidth = 0.13f, noseTipY = REFERENCE_NOSE_TIP_Y)
        val out = basePreset.withCalibration(locked)

        assertEquals(basePreset.localPosition.y, out.localPosition.y, 1e-6f)
    }

    @Test
    fun `withCalibration scales x by pivot ratio and leaves z untouched`() {
        // 2.04 = FACE_WIDTH_TO_GLASSES_RATIO, 2.04 = POSITION_TUNING_RATIO (both private; ratio == 1.0)
        val expectedPivotRatio = 2.04f / 2.04f

        // 두 다른 측정값에서 x 는 비례 스케일, z 는 그대로 (측정값과 무관)
        val a = basePreset.withCalibration(
            FaceMeasurement(faceWidth = 0.10f, noseTipY = REFERENCE_NOSE_TIP_Y),
        )
        val b = basePreset.withCalibration(
            FaceMeasurement(faceWidth = 0.15f, noseTipY = REFERENCE_NOSE_TIP_Y - 0.02f),
        )

        assertEquals(basePreset.localPosition.x * expectedPivotRatio, a.localPosition.x, 1e-5f)
        assertEquals(basePreset.localPosition.x * expectedPivotRatio, b.localPosition.x, 1e-5f)
        assertEquals(basePreset.localPosition.z, a.localPosition.z, 1e-6f)
        assertEquals(basePreset.localPosition.z, b.localPosition.z, 1e-6f)
    }

    @Test
    fun `withCalibration leaves rotation untouched`() {
        val locked = FaceMeasurement(faceWidth = 0.15f, noseTipY = REFERENCE_NOSE_TIP_Y - 0.02f)
        val out = basePreset.withCalibration(locked)

        assertEquals(basePreset.localRotation.x, out.localRotation.x, 1e-6f)
        assertEquals(basePreset.localRotation.y, out.localRotation.y, 1e-6f)
        assertEquals(basePreset.localRotation.z, out.localRotation.z, 1e-6f)
    }
}
