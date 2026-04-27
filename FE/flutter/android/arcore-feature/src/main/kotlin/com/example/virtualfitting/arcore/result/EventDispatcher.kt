package com.example.virtualfitting.arcore.result

import android.os.Handler
import android.os.Looper
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent

/**
 * `(VirtualFittingEvent) -> Unit` 콜백을 main thread 로 보정하고, terminal event
 * (Closed / Error) 이후 들어오는 후속 이벤트를 드롭한다.
 */
class EventDispatcher(private val sink: (VirtualFittingEvent) -> Unit) {
    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    private var closed = false

    fun emit(event: VirtualFittingEvent) {
        if (closed) return
        handler.post {
            if (closed) return@post
            sink(event)
            if (event is VirtualFittingEvent.Closed || event is VirtualFittingEvent.Error) {
                closed = true
            }
        }
    }

    fun close() {
        closed = true
    }
}
