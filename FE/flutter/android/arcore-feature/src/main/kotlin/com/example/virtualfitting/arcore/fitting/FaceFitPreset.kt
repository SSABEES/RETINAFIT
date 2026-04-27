package com.example.virtualfitting.arcore.fitting

import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation

data class FaceFitPreset(
    val scaleToUnits: Float,
    val localPosition: Position,
    val localRotation: Rotation,
)
