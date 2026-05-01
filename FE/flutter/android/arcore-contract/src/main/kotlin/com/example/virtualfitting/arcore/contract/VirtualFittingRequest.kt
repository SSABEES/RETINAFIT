package com.example.virtualfitting.arcore.contract

data class VirtualFittingRequest(
    val session: SessionRef,
    val product: ProductRef,
    val asset: AssetSource,
    val fitting: FittingConfig = FittingConfig(),
    val ui: UiConfig = UiConfig(),
    val windowLayout: WindowLayout? = null,
)

/**
 * AR Activity 의 window 위치/크기 (device px 기준).
 * null 이면 기본 동작 (full screen 또는 좌측 패널 fallback).
 */
data class WindowLayout(
    val originXPx: Int,
    val originYPx: Int,
    val widthPx: Int,
    val heightPx: Int,
)

data class SessionRef(
    val sessionId: String,
    val requestId: String,
)

data class ProductRef(
    val productId: String,
    val productName: String,
)

sealed interface AssetSource {
    data class RemoteModel(
        val modelUrl: String,
        val cacheKey: String,
        val textureUrl: String? = null,
        val headers: Map<String, String> = emptyMap(),
        val checksum: String? = null,
        val expiresAt: Long? = null,
    ) : AssetSource

    data class LocalAsset(
        val assetPath: String,
    ) : AssetSource
}

data class FittingConfig(
    val preferredCamera: CameraPreference = CameraPreference.FRONT,
    val scale: Float = 1f,
    val offsetX: Float = 0f,
    val offsetY: Float = 0f,
    val offsetZ: Float = 0f,
    val rotationX: Float = 0f,
    val rotationY: Float = 0f,
    val rotationZ: Float = 0f,
)

enum class CameraPreference {
    FRONT,
    BACK,
}

data class UiConfig(
    val showCloseButton: Boolean = true,
    val showDebugOverlay: Boolean = false,
    val fullScreen: Boolean = true,
)
