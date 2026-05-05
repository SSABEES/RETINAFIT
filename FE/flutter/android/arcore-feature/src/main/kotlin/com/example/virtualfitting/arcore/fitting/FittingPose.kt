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
    localPosition = Position(x = 0.074f, y = 0.093f, z = -0.074f),
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
