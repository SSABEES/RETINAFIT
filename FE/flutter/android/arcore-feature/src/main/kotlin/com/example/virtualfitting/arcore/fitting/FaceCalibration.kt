package com.example.virtualfitting.arcore.fitting

import com.google.ar.core.AugmentedFace
import com.google.ar.core.Pose
import kotlin.math.sqrt

/**
 * Canonical Face Mesh (468 정점) 의 콧대 정점 인덱스.
 * MediaPipe 표준과 호환되며 ARCore Augmented Faces 도 동일한 인덱스 매핑 사용.
 *  - 6: 코 뿌리 (이마와 코 사이, glabella)
 *  - 197: 콧대 윗부분 (눈썹 사이 아래)
 *  - 195: 콧대 중간
 * 이 정점들은 코뼈 부분이라 광대/입꼬리 등 표정 변화에 거의 무관.
 */
val NOSE_BRIDGE_VERTEX_INDICES: IntArray = intArrayOf(6, 197, 195)

/**
 * 한 프레임의 얼굴 측정값.
 * - faceWidth: 좌/우 이마 region 의 월드 공간 거리 (meter, rotation-invariant).
 * - noseTipY: 코끝 region 과 centerPose 간 Y 축 거리 (face-local approximation).
 * - noseBridgeFaceLocal{X,Y,Z}: 콧대 정점들 face-local 좌표 평균 (표정 무관 anchor 용).
 *   lock 시점의 face-local 콧대 좌표를 보존해, 표정 변화로 인한 mesh deformation
 *   (centerPose 자체가 위/아래로 끌려가고, 콧대 face-local 좌표도 미세 변동) 을 보상.
 */
data class FaceMeasurement(
    val faceWidth: Float,
    val noseTipY: Float,
    val noseBridgeFaceLocalX: Float = 0f,
    val noseBridgeFaceLocalY: Float = 0f,
    val noseBridgeFaceLocalZ: Float = 0f,
)

fun List<FaceMeasurement>.average(): FaceMeasurement {
    if (isEmpty()) return FaceMeasurement(0f, 0f, 0f, 0f, 0f)
    var w = 0f
    var y = 0f
    var bX = 0f
    var bY = 0f
    var bZ = 0f
    for (m in this) {
        w += m.faceWidth
        y += m.noseTipY
        bX += m.noseBridgeFaceLocalX
        bY += m.noseBridgeFaceLocalY
        bZ += m.noseBridgeFaceLocalZ
    }
    val n = size.toFloat()
    return FaceMeasurement(
        faceWidth = w / n,
        noseTipY = y / n,
        noseBridgeFaceLocalX = bX / n,
        noseBridgeFaceLocalY = bY / n,
        noseBridgeFaceLocalZ = bZ / n,
    )
}

/**
 * 세 채널 (faceWidth, noseTipY, noseBridgeFaceLocalY) 의 분산을 합쳐 단일 스칼라로 반환.
 * lock 안정성 판단용.
 */
fun variance(samples: List<FaceMeasurement>): Float {
    if (samples.size < 2) return Float.MAX_VALUE
    val avg = samples.average()
    var sumSqW = 0f
    var sumSqY = 0f
    var sumSqBY = 0f
    for (m in samples) {
        val dw = m.faceWidth - avg.faceWidth
        val dy = m.noseTipY - avg.noseTipY
        val dbY = m.noseBridgeFaceLocalY - avg.noseBridgeFaceLocalY
        sumSqW += dw * dw
        sumSqY += dy * dy
        sumSqBY += dbY * dbY
    }
    val n = samples.size.toFloat()
    return sumSqW / n + sumSqY / n + sumSqBY / n
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

    // 콧대 정점들의 face-local (x, y, z) 평균. face.meshVertices 는 face-local 좌표.
    val bridge = computeNoseBridgeFaceLocal(face)

    return FaceMeasurement(
        faceWidth = faceWidth,
        noseTipY = noseLocal.ty(),
        noseBridgeFaceLocalX = bridge[0],
        noseBridgeFaceLocalY = bridge[1],
        noseBridgeFaceLocalZ = bridge[2],
    )
}

/**
 * face.meshVertices (FloatBuffer of x,y,z triples) 에서 콧대 정점들의 face-local (x, y, z) 평균.
 * 콧대 정점은 표정 변화에 거의 무관하므로, 그들의 face-local 좌표가 매 프레임 거의 일정해야 함.
 * 만약 매 프레임 변하면 ARCore 의 mesh deformation 이 콧대까지 영향 미친다는 신호.
 */
fun computeNoseBridgeFaceLocal(face: AugmentedFace): FloatArray {
    val vertices = face.meshVertices
    var sumX = 0f
    var sumY = 0f
    var sumZ = 0f
    var count = 0
    for (idx in NOSE_BRIDGE_VERTEX_INDICES) {
        val baseIdx = idx * 3
        if (baseIdx + 2 < vertices.limit()) {
            sumX += vertices.get(baseIdx)
            sumY += vertices.get(baseIdx + 1)
            sumZ += vertices.get(baseIdx + 2)
            count++
        }
    }
    return if (count > 0) {
        floatArrayOf(sumX / count, sumY / count, sumZ / count)
    } else {
        floatArrayOf(0f, 0f, 0f)
    }
}

/** Y 만 필요할 때의 편의 함수. logcat 디버그 로깅에서 사용. */
fun computeNoseBridgeFaceLocalY(face: AugmentedFace): Float = computeNoseBridgeFaceLocal(face)[1]

/**
 * 콧대 정점들의 world position (x, y, z) 평균. 매 프레임 anchor 로 사용.
 * 표정 변화 시 centerPose 가 위로 이동해도, 콧대 face-local 좌표가 그만큼 음수로 보정되어
 * world 좌표는 거의 변하지 않는다 (실측에서 확인됨).
 */
fun computeNoseBridgeWorld(face: AugmentedFace): FloatArray {
    val vertices = face.meshVertices
    val centerPose = face.centerPose
    var sumX = 0f
    var sumY = 0f
    var sumZ = 0f
    var count = 0
    val worldPoint = floatArrayOf(0f, 0f, 0f)
    val faceLocal = floatArrayOf(0f, 0f, 0f)
    for (idx in NOSE_BRIDGE_VERTEX_INDICES) {
        val baseIdx = idx * 3
        if (baseIdx + 2 < vertices.limit()) {
            faceLocal[0] = vertices.get(baseIdx)
            faceLocal[1] = vertices.get(baseIdx + 1)
            faceLocal[2] = vertices.get(baseIdx + 2)
            centerPose.transformPoint(faceLocal, 0, worldPoint, 0)
            sumX += worldPoint[0]
            sumY += worldPoint[1]
            sumZ += worldPoint[2]
            count++
        }
    }
    return if (count > 0) {
        floatArrayOf(sumX / count, sumY / count, sumZ / count)
    } else {
        floatArrayOf(0f, 0f, 0f)
    }
}

/** Y 만 필요할 때의 편의 함수. logcat 디버그 로깅에서 사용. */
fun computeNoseBridgeWorldY(face: AugmentedFace): Float = computeNoseBridgeWorld(face)[1]
