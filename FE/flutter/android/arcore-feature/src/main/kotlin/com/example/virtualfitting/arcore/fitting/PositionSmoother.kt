package com.example.virtualfitting.arcore.fitting

import io.github.sceneview.math.Position
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max

/**
 * Scalar 신호용 One Euro Filter. 정지 시엔 minCutoff 로 강하게 스무딩, 빠르게 변할 땐
 * cutoff = minCutoff + beta * |derivative| 로 즉시 상승해 raw 추종.
 *
 * 사용처: per-axis position smoothing.
 */
class OneEuroFilter(
    private val minCutoff: Float,
    private val beta: Float,
    private val dCutoff: Float,
) {
    private var prev: Float? = null
    private var prevDeriv: Float = 0f
    private var prevTimeNs: Long = 0L

    fun filter(value: Float, timestampNs: Long): Float {
        val prevValue = prev
        if (prevValue == null) {
            prev = value
            prevTimeNs = timestampNs
            prevDeriv = 0f
            return value
        }
        val dtNs = timestampNs - prevTimeNs
        if (dtNs <= 0L) return prevValue
        val dt = dtNs / 1_000_000_000f

        val instantDeriv = (value - prevValue) / dt
        val alphaD = smoothingFactor(dt, dCutoff)
        val smoothedDeriv = alphaD * instantDeriv + (1f - alphaD) * prevDeriv

        val cutoff = minCutoff + beta * abs(smoothedDeriv)
        val alpha = smoothingFactor(dt, cutoff)
        val filtered = alpha * value + (1f - alpha) * prevValue

        prev = filtered
        prevDeriv = smoothedDeriv
        prevTimeNs = timestampNs
        return filtered
    }

    fun reset() {
        prev = null
        prevDeriv = 0f
        prevTimeNs = 0L
    }

    private fun smoothingFactor(dt: Float, cutoff: Float): Float {
        val safeCutoff = max(cutoff, 1e-3f)
        val tau = 1f / (2f * PI.toFloat() * safeCutoff)
        return 1f / (1f + tau / dt)
    }
}

/**
 * 안경 위치에 One Euro Filter 를 적용해 정지 시 sub-mm 떨림을 잡는다.
 *
 * 설계 의도 (이전 위치 LPF 시도와 다른 점):
 *  - 이전 시도는 고정 알파 EMA → 평행 이동 시 안경이 머리를 천천히 따라오는 lag 발생, 원복.
 *  - 이번엔 적응형 One Euro Filter. beta 를 매우 크게 (3.0) 잡아서 머리 움직임 감지 즉시
 *    cutoff 가 끌어올려져 raw 추종. 평행 이동에서 lag 가 사실상 없음.
 *  - 정지 시엔 minCutoff=1Hz 만 작동 → 1mm 미만의 미세 떨림이 잡힘 (얼굴에 "착 달라붙는" 느낌).
 *
 * 만약 평행 이동에서 lag 감지되면: `POSITION_SMOOTHING_ENABLED = false` 한 줄로 즉시 비활성.
 *
 * 파라미터 튜닝:
 *  - 떨림이 아직 보이면 → minCutoff 낮춤 (0.5)
 *  - 평행 이동에서 lag 느껴지면 → beta 키움 (5.0~8.0)
 */
class PositionSmoother(
    minCutoff: Float = MIN_CUTOFF_HZ,
    beta: Float = BETA,
    dCutoff: Float = D_CUTOFF_HZ,
) {
    private val filterX = OneEuroFilter(minCutoff, beta, dCutoff)
    private val filterY = OneEuroFilter(minCutoff, beta, dCutoff)
    private val filterZ = OneEuroFilter(minCutoff, beta, dCutoff)

    /**
     * @param raw ARCore 가 추정한 안경 위치 (face.centerPose 기반 합성된 world position)
     * @param timestampNs ARCore Frame.getTimestamp() — ns 단위
     */
    fun filter(raw: Position, timestampNs: Long): Position = Position(
        x = filterX.filter(raw.x, timestampNs),
        y = filterY.filter(raw.y, timestampNs),
        z = filterZ.filter(raw.z, timestampNs),
    )

    /** 트래킹 lost / regain 사이에 호출. 이전 위치 state 가 남아 있으면 swoop 아티팩트. */
    fun reset() {
        filterX.reset()
        filterY.reset()
        filterZ.reset()
    }

    companion object {
        const val MIN_CUTOFF_HZ = 1.0f
        // beta 와 dCutoff 를 공격적으로 잡는 이유: head turn 시작 시점에 derivative 가
        // 0 → 큰 값으로 급변하는데, dCutoff 가 작으면 derivative 자체의 LPF 때문에 cutoff
        // 적응이 1~2 프레임 늦어져 안경이 "미끌리듯이" 따라오는 시각적 lag 발생.
        // BETA 키우면 같은 속도에서도 cutoff 가 가파르게 상승, D_CUTOFF_HZ 키우면 derivative
        // 자체가 빠르게 갱신됨 → 첫 프레임 lag 최소화.
        const val BETA = 10.0f
        const val D_CUTOFF_HZ = 5.0f
    }
}
