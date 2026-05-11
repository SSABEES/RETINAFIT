package com.example.virtualfitting.arcore.fitting

import dev.romainguy.kotlin.math.Quaternion
import dev.romainguy.kotlin.math.dot
import dev.romainguy.kotlin.math.normalize
import dev.romainguy.kotlin.math.slerp
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.max

/**
 * 안경 회전에 One Euro Filter 를 적용해 정지 시 미세떨림을 제거한다.
 *
 * 설계 의도 (왜 회전만 필터링하는가):
 *  - centerPose 의 회전 jitter (~±0.3°) 가 GLB pivot offset (~14cm) 을 통해 lever-arm 으로 증폭돼
 *    안경 위치에 ~1mm 의 가시적 떨림으로 나타남.
 *  - 위치(translation) 에 LPF 를 걸면 평행 이동 시 "안경이 머리를 천천히 따라오는" lag 발생.
 *    이전 시도(2026-05 이전) 에서 위치 필터로 인한 lag 가 사용자 체감 가능한 수준이었음 → 위치는 raw 유지.
 *  - 순수 평행 이동 시엔 회전이 거의 변하지 않으므로, 회전 필터가 출력에 lag 를 추가하지 않음.
 *  - 빠른 head turn 에선 One Euro 의 적응형 cutoff (beta * angularSpeed) 가 cutoff 를 끌어올려
 *    raw 추종으로 전환 → 회전 자체에도 lag 가 최소화됨.
 *
 * 시작 파라미터 튜닝 가이드:
 *  - 정지 시 떨림이 아직 보이면 → minCutoff 를 낮춤 (0.5~0.8)
 *  - 빠른 head turn 에서 lag 가 체감되면 → beta 를 키움 (0.4~0.8)
 */
class RotationSmoother(
    private val minCutoff: Float = MIN_CUTOFF_HZ,
    private val beta: Float = BETA,
    private val dCutoff: Float = D_CUTOFF_HZ,
) {
    private var prevQuat: Quaternion? = null
    private var prevAngularSpeed: Float = 0f
    private var prevTimestampNs: Long = 0L

    /**
     * @param raw ARCore centerPose 합성 transform 의 회전 부분
     * @param timestampNs `com.google.ar.core.Frame.getTimestamp()` 의 ns 단위 timestamp
     * @return 스무딩된 회전. 첫 호출이거나 reset 직후엔 raw 그대로 반환.
     */
    fun filter(raw: Quaternion, timestampNs: Long): Quaternion {
        val rawNormalized = normalize(raw)
        val prev = prevQuat
        if (prev == null) {
            prevQuat = rawNormalized
            prevTimestampNs = timestampNs
            prevAngularSpeed = 0f
            return rawNormalized
        }

        val dtNs = timestampNs - prevTimestampNs
        if (dtNs <= 0L) {
            // 같은 프레임 재호출 / 시계 역행 방어 — 이전 필터 출력 그대로.
            return prev
        }
        val dt = dtNs / 1_000_000_000f

        // Hemisphere alignment: SLERP 가 짧은 경로를 택하도록 raw 의 부호를 prev 와 맞춤.
        // 안 하면 머리를 빠르게 돌릴 때 안경이 한 바퀴 빙 돌아가는 아티팩트 발생.
        val aligned = if (dot(prev, rawNormalized) < 0f) {
            Quaternion(
                x = -rawNormalized.x,
                y = -rawNormalized.y,
                z = -rawNormalized.z,
                w = -rawNormalized.w,
            )
        } else {
            rawNormalized
        }

        // 각속도 추정. |dot(q1, q2)| = cos(θ/2) → θ = 2 * acos(|dot|).
        val d = abs(dot(prev, aligned)).coerceIn(0f, 1f)
        val angleDelta = 2f * acos(d)
        val instantAngularSpeed = angleDelta / dt

        // 각속도 자체도 dCutoff 로 1차 스무딩 (One Euro 표준).
        val alphaD = smoothingFactor(dt, dCutoff)
        val smoothedSpeed = alphaD * instantAngularSpeed + (1f - alphaD) * prevAngularSpeed

        // 적응형 cutoff = minCutoff + beta * angularSpeed.
        val cutoff = minCutoff + beta * smoothedSpeed
        val alpha = smoothingFactor(dt, cutoff)

        val filtered = normalize(slerp(prev, aligned, alpha))

        prevQuat = filtered
        prevAngularSpeed = smoothedSpeed
        prevTimestampNs = timestampNs
        return filtered
    }

    /**
     * 트래킹 lost → regain 사이에 호출. 이전 회전 state 가 남아 있으면 재트래킹 시
     * 안경이 옛 회전으로 "스르륵" 미끄러져 들어오는 시각적 아티팩트가 생긴다.
     */
    fun reset() {
        prevQuat = null
        prevAngularSpeed = 0f
        prevTimestampNs = 0L
    }

    private fun smoothingFactor(dt: Float, cutoff: Float): Float {
        val safeCutoff = max(cutoff, 1e-3f)
        val tau = 1f / (2f * PI.toFloat() * safeCutoff)
        return 1f / (1f + tau / dt)
    }

    companion object {
        const val MIN_CUTOFF_HZ = 1.0f
        const val BETA = 0.4f
        const val D_CUTOFF_HZ = 1.0f
    }
}
