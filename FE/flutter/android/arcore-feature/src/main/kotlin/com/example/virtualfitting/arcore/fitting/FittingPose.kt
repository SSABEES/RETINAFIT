package com.example.virtualfitting.arcore.fitting

import com.example.virtualfitting.arcore.contract.FittingConfig
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation

/**
 * 안경 GLB 의 기본 프리셋(샘플 모델용).
 *
 * Augmented Faces 좌표계: 원점 = 코 뒤, Z+ = 코 방향 forward, Y+ = 위, X+ = 왼쪽. meter 단위.
 * 모델마다 origin/scale 이 다르므로 per-product 로 override 가능하도록 `FittingConfig.scale`
 * 및 offset/rotation 필드로 추가 보정이 들어간다.
 */
private val defaultPreset = FaceFitPreset(
    scaleToUnits = 0.16f,
    localPosition = Position(x = 0.074f, y = 0.095f, z = -0.08f),
    localRotation = Rotation(x = 0f, y = 0f, z = 0.8f),
)

fun FittingConfig.toPreset(base: FaceFitPreset = defaultPreset): FaceFitPreset = FaceFitPreset(
    scaleToUnits = base.scaleToUnits * scale,
    localPosition = Position(
        x = base.localPosition.x + offsetX,
        y = base.localPosition.y + offsetY,
        z = base.localPosition.z + offsetZ,
    ),
    localRotation = Rotation(
        x = base.localRotation.x + rotationX,
        y = base.localRotation.y + rotationY,
        z = base.localRotation.z + rotationZ,
    ),
)

/**
 * 안경 GLB 의 폭 = 얼굴 폭 × 이 비율. GLB 모델 자체의 속성이지 사용자별 차이가 아니다.
 * 샘플 GLB 기준으로 1.0 = 이마 폭 동일, 2.04 = 안경이 이마 폭보다 약 2배.
 * 다른 GLB 로 바뀌면 이 값도 재튜닝 필요 (후속: per-glasses FittingConfig override).
 */
private const val FACE_WIDTH_TO_GLASSES_RATIO: Float = 2.04f

/**
 * defaultPreset.localPosition (x, z) 가 튜닝됐을 때의 RATIO. GLB pivot 보정 좌표가 이 RATIO
 * 기준으로 베이크돼 있으므로, 현재 RATIO 가 다르면 비례 보정 필요.
 * RATIO 가 바뀌어도 원래 튜닝의 정합성 유지하기 위함.
 */
private const val POSITION_TUNING_RATIO: Float = 2.04f

/**
 * 개발자(나) 의 얼굴 코끝 Y 측정값. localPosition.y 가 이 코 위치 기준으로 튜닝됨.
 * 다른 사용자의 코 Y 가 이 값보다 크면(아래) 안경도 그만큼 아래로, 작으면(위) 위로 이동.
 *
 * 측정 절차: docs/superpowers/plans/2026-05-07-ar-fitting-per-user-calibration.md Task 7 참조.
 */
const val REFERENCE_NOSE_TIP_Y: Float = -0.008f  // 2026-05-07 측정 (개발자 얼굴, lockedNoseTipY)

/**
 * lock 된 measurement 로 preset 보정.
 * - scaleToUnits: 측정한 얼굴 폭 × FACE_WIDTH_TO_GLASSES_RATIO 로 절대 산출
 *   (사용자 얼굴 폭 그대로 반영 — 좁은 얼굴엔 작은 안경, 넓은 얼굴엔 큰 안경)
 * - localPosition.x: GLB pivot 의 좌우 비대칭 보정값 → 모델 스케일과 비례 보정.
 * - localPosition.y: 얼굴-로컬 위치 spec (스케일 무관) + REFERENCE_NOSE_TIP_Y 대비 코 Y 보정.
 * - localPosition.z: 안경이 코 앞에 위치하는 깊이 spec (스케일 무관) → 그대로.
 * - rotation: 그대로.
 */
fun FaceFitPreset.withCalibration(locked: FaceMeasurement): FaceFitPreset {
    val newScaleToUnits = locked.faceWidth * FACE_WIDTH_TO_GLASSES_RATIO
    val pivotScaleRatio = FACE_WIDTH_TO_GLASSES_RATIO / POSITION_TUNING_RATIO
    val yCorrection = locked.noseTipY - REFERENCE_NOSE_TIP_Y
    return copy(
        scaleToUnits = newScaleToUnits,
        localPosition = Position(
            x = localPosition.x * pivotScaleRatio,
            y = localPosition.y + yCorrection,
            z = localPosition.z,
        ),
    )
}
