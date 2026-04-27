package com.example.virtualfitting.arcore.availability

import android.app.Activity
import android.content.Context
import com.example.virtualfitting.arcore.contract.AvailabilityStatus
import com.google.ar.core.ArCoreApk

class ArCoreAvailabilityChecker(private val context: Context) {

    fun check(): AvailabilityStatus =
        ArCoreApk.getInstance().checkAvailability(context).toStatus()

    /**
     * Activity 컨텍스트에서 호출해야 한다. transient 인 경우(UNKNOWN_CHECKING) 호출자가
     * 재시도 루프를 책임진다 — 이 함수는 1회 결과만 돌려준다.
     */
    fun requestInstallIfNeeded(
        activity: Activity,
        userRequestedInstall: Boolean,
    ): InstallOutcome = runCatching {
        val result = ArCoreApk.getInstance().requestInstall(activity, userRequestedInstall)
        when (result) {
            ArCoreApk.InstallStatus.INSTALLED -> InstallOutcome.Installed
            ArCoreApk.InstallStatus.INSTALL_REQUESTED -> InstallOutcome.InstallRequested
        }
    }.getOrElse { InstallOutcome.Failed(it) }

    sealed interface InstallOutcome {
        data object Installed : InstallOutcome
        data object InstallRequested : InstallOutcome
        data class Failed(val cause: Throwable) : InstallOutcome
    }

    private fun ArCoreApk.Availability.toStatus(): AvailabilityStatus = when (this) {
        ArCoreApk.Availability.SUPPORTED_INSTALLED -> AvailabilityStatus.SUPPORTED
        ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> AvailabilityStatus.AR_SERVICES_MISSING
        ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD -> AvailabilityStatus.AR_SERVICES_OUTDATED
        ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE -> AvailabilityStatus.UNSUPPORTED_DEVICE
        ArCoreApk.Availability.UNKNOWN_CHECKING,
        ArCoreApk.Availability.UNKNOWN_ERROR,
        ArCoreApk.Availability.UNKNOWN_TIMED_OUT -> AvailabilityStatus.UNKNOWN
    }
}
