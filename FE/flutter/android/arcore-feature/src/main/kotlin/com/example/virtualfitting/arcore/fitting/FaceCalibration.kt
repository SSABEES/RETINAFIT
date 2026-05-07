package com.example.virtualfitting.arcore.fitting

import com.google.ar.core.AugmentedFace
import com.google.ar.core.Pose
import kotlin.math.sqrt

/**
 * 한 프레임의 얼굴 측정값. centerPose-relative 좌표가 아닌 단순 스칼라 두 개.
 * - faceWidth: 좌/우 이마 region 의 월드 공간 거리 (meter, rotation-invariant).
 * - noseTipY: 코끝 region 과 centerPose 간 Y 축 거리 (face-local approximation).
 */
data class FaceMeasurement(
    val faceWidth: Float,
    val noseTipY: Float,
)

fun List<FaceMeasurement>.average(): FaceMeasurement {
    if (isEmpty()) return FaceMeasurement(0f, 0f)
    var w = 0f
    var y = 0f
    for (m in this) {
        w += m.faceWidth
        y += m.noseTipY
    }
    val n = size.toFloat()
    return FaceMeasurement(faceWidth = w / n, noseTipY = y / n)
}

/**
 * 두 채널 (faceWidth, noseTipY) 의 분산을 합쳐 단일 스칼라로 반환.
 * lock 안정성 판단용. 두 채널이 모두 안정될 때만 작은 값.
 */
fun variance(samples: List<FaceMeasurement>): Float {
    if (samples.size < 2) return Float.MAX_VALUE
    val avg = samples.average()
    var sumSqW = 0f
    var sumSqY = 0f
    for (m in samples) {
        val dw = m.faceWidth - avg.faceWidth
        val dy = m.noseTipY - avg.noseTipY
        sumSqW += dw * dw
        sumSqY += dy * dy
    }
    val n = samples.size.toFloat()
    return sumSqW / n + sumSqY / n
}

/**
 * 사용자 얼굴 측정값을 누적해서 충분히 안정될 때 1회 lock.
 *
 * 사용 패턴:
 * 1. 매 프레임 [submit] 호출. trackingState 가 TRACKING 일 때만.
 * 2. [locked] 이 non-null 이 되면 그 값을 preset 보정에 사용.
 * 3. 한 번 lock 되면 같은 인스턴스에서 다시 풀리지 않음. 재 calibration 이 필요하면 새 인스턴스.
 *
 * 분산 기반 silent 감지: 정면 정지 자세에서만 분산이 작아져 lock 됨. 옆얼굴/움직임 중엔
 * lock 미뤄짐. 정해진 [timeoutMs] 가 지나도 안정 안 되면 모은 샘플의 평균으로 폴백 lock.
 */
class FaceCalibration(
    private val minSamples: Int = MIN_SAMPLES,
    private val windowSize: Int = WINDOW_SIZE,
    private val varianceThreshold: Float = VARIANCE_THRESHOLD,
    private val timeoutMs: Long = TIMEOUT_MS,
) {
    private val samples = mutableListOf<FaceMeasurement>()
    private var startMs: Long = 0L

    var locked: FaceMeasurement? = null
        private set

    /** [nowMs] 는 단위 테스트의 시간 주입용. 실제 호출 시 `System.currentTimeMillis()` 전달. */
    fun submit(measurement: FaceMeasurement, nowMs: Long) {
        if (locked != null) return
        if (samples.isEmpty()) startMs = nowMs
        samples.add(measurement)

        if (samples.size >= minSamples) {
            val recent = if (samples.size > windowSize) samples.takeLast(windowSize) else samples
            val v = if (recent.size == 1) 0f else variance(recent)
            if (v < varianceThreshold) {
                locked = recent.average()
                return
            }
        }
        if (nowMs - startMs > timeoutMs) {
            locked = samples.average()
        }
    }

    companion object {
        const val MIN_SAMPLES = 15
        const val WINDOW_SIZE = 30
        const val VARIANCE_THRESHOLD = 1e-5f
        const val TIMEOUT_MS = 3_000L
    }
}

/**
 * 한 프레임의 face 에서 측정값 추출.
 *
 * - faceWidth: 좌/우 이마 region pose 의 월드 거리. rotation-invariant (둘 다 face 에 묶여 함께 회전).
 * - noseTipY: centerPose 기준 noseTip 의 face-local Y. centerPose.inverse() ∘ noseTipPose 로 변환.
 *   Y 는 Augmented Faces 좌표계상 "위쪽 (이마 방향)" 양수.
 */
fun measure(face: AugmentedFace): FaceMeasurement {
    val left = face.getRegionPose(AugmentedFace.RegionType.FOREHEAD_LEFT)
    val right = face.getRegionPose(AugmentedFace.RegionType.FOREHEAD_RIGHT)
    val nose = face.getRegionPose(AugmentedFace.RegionType.NOSE_TIP)

    val dx = left.tx() - right.tx()
    val dy = left.ty() - right.ty()
    val dz = left.tz() - right.tz()
    val faceWidth = sqrt(dx * dx + dy * dy + dz * dz)

    // centerPose-local 좌표계로 변환: noseTip 의 face-local Y.
    val noseLocal: Pose = face.centerPose.inverse().compose(nose)
    return FaceMeasurement(faceWidth = faceWidth, noseTipY = noseLocal.ty())
}
