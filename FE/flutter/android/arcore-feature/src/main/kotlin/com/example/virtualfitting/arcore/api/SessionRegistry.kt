package com.example.virtualfitting.arcore.api

import com.example.virtualfitting.arcore.contract.VirtualFittingRequest
import com.example.virtualfitting.arcore.result.EventDispatcher
import java.util.concurrent.ConcurrentHashMap

/**
 * Launcher 가 요청을 제출하면 ArEntryActivity 가 requestId 로 다시 집어가도록 하는 process-local 레지스트리.
 *
 * Activity 로 Parcelable 전달하지 않는 이유는 `arcore-contract` 가 pure JVM 모듈이기 때문이다.
 * 3단계에서 브리지 레이어가 들어오면 JSON 경유로 바뀔 수 있지만, 그때에도 이 객체가 내부 lookup 을 맡는다.
 */
internal object SessionRegistry {
    private val entries = ConcurrentHashMap<String, Entry>()

    data class Entry(
        val request: VirtualFittingRequest,
        val dispatcher: EventDispatcher,
    )

    fun register(requestId: String, entry: Entry) {
        entries[requestId] = entry
    }

    fun get(requestId: String): Entry? = entries[requestId]

    fun release(requestId: String) {
        // dispatcher.close() 를 즉시 호출하지 않는다. ArEntryActivity.onDestroy 에서
        // emit(Closed) 가 Handler.post 로 큐에 들어간 직후 release() 가 sync 로 close() 호출하면,
        // 큐 lambda 가 실행될 때 closed=true 라 Closed 이벤트가 드랍되는 race 가 있었다.
        // EventDispatcher 는 emit 람다 안에서 Closed/Error 이벤트 전달 후 self-seal 한다.
        entries.remove(requestId)
    }
}
