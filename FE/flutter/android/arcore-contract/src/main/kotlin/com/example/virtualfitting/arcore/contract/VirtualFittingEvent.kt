package com.example.virtualfitting.arcore.contract

sealed interface VirtualFittingEvent {
    val requestId: String

    data class AvailabilityChecked(
        override val requestId: String,
        val status: AvailabilityStatus,
    ) : VirtualFittingEvent

    data class PreparingAssets(
        override val requestId: String,
        val progress: Int,
    ) : VirtualFittingEvent

    data class AssetsReady(
        override val requestId: String,
    ) : VirtualFittingEvent

    data class Started(
        override val requestId: String,
    ) : VirtualFittingEvent

    data class TrackingActive(
        override val requestId: String,
    ) : VirtualFittingEvent

    data class TrackingLost(
        override val requestId: String,
    ) : VirtualFittingEvent

    data class Captured(
        override val requestId: String,
        val slot: String,
        val imageBase64: String,
    ) : VirtualFittingEvent

    data class Closed(
        override val requestId: String,
        val reason: CloseReason,
    ) : VirtualFittingEvent

    data class Error(
        override val requestId: String,
        val code: ErrorCode,
        val message: String? = null,
    ) : VirtualFittingEvent
}

enum class CloseReason {
    USER_CLOSED,
    COMPLETED,
    CANCELLED,
}

enum class AvailabilityStatus {
    SUPPORTED,
    UNSUPPORTED_DEVICE,
    AR_SERVICES_MISSING,
    AR_SERVICES_OUTDATED,
    UNKNOWN,
}

enum class ErrorCode {
    UNSUPPORTED_DEVICE,
    AR_SERVICES_MISSING,
    AR_SERVICES_OUTDATED,
    CAMERA_PERMISSION_DENIED,
    SESSION_CREATE_FAILED,
    ASSET_URL_INVALID,
    ASSET_DOWNLOAD_FAILED,
    ASSET_PARSE_FAILED,
    TRACKING_UNAVAILABLE,
    USER_CANCELLED,
    UNKNOWN,
}
