package com.example.virtualfitting.arcore.contract

/**
 * 외부에서 가상 피팅 기능을 호출하는 최소 공개 API.
 *
 * 구현은 `arcore-feature` 모듈이 제공한다. 이 인터페이스를 통해 bridge/테스트 레이어는
 * ARCore/Android SDK 의존 없이 대상할 수 있다.
 */
interface VirtualFittingLauncher {
    fun checkAvailability(): AvailabilityStatus

    fun launch(
        request: VirtualFittingRequest,
        onEvent: (VirtualFittingEvent) -> Unit,
    ): Ticket

    interface Ticket {
        val requestId: String
        fun cancel()
    }
}
