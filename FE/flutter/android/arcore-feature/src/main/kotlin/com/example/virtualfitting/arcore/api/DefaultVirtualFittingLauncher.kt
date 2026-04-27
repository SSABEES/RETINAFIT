package com.example.virtualfitting.arcore.api

import android.content.Context
import android.content.Intent
import com.example.virtualfitting.arcore.availability.ArCoreAvailabilityChecker
import com.example.virtualfitting.arcore.contract.AvailabilityStatus
import com.example.virtualfitting.arcore.contract.CloseReason
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent
import com.example.virtualfitting.arcore.contract.VirtualFittingLauncher
import com.example.virtualfitting.arcore.contract.VirtualFittingRequest
import com.example.virtualfitting.arcore.entry.ArEntryActivity
import com.example.virtualfitting.arcore.result.EventDispatcher

class DefaultVirtualFittingLauncher(context: Context) : VirtualFittingLauncher {

    private val appContext = context.applicationContext

    override fun checkAvailability(): AvailabilityStatus =
        ArCoreAvailabilityChecker(appContext).check()

    override fun launch(
        request: VirtualFittingRequest,
        onEvent: (VirtualFittingEvent) -> Unit,
    ): VirtualFittingLauncher.Ticket {
        val requestId = request.session.requestId
        val dispatcher = EventDispatcher(onEvent)
        SessionRegistry.register(
            requestId,
            SessionRegistry.Entry(request = request, dispatcher = dispatcher),
        )

        val intent = Intent(appContext, ArEntryActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(ArEntryActivity.EXTRA_REQUEST_ID, requestId)
        appContext.startActivity(intent)

        return TicketImpl(requestId, dispatcher)
    }

    private class TicketImpl(
        override val requestId: String,
        private val dispatcher: EventDispatcher,
    ) : VirtualFittingLauncher.Ticket {
        override fun cancel() {
            dispatcher.emit(
                VirtualFittingEvent.Closed(requestId = requestId, reason = CloseReason.CANCELLED)
            )
            SessionRegistry.release(requestId)
        }
    }
}
