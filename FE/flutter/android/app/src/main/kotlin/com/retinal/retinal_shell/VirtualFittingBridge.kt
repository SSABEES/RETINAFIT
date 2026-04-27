package com.retinal.retinal_shell

import android.content.Context
import android.util.Log
import com.example.virtualfitting.arcore.api.DefaultVirtualFittingLauncher
import com.example.virtualfitting.arcore.contract.AssetSource
import com.example.virtualfitting.arcore.contract.ProductRef
import com.example.virtualfitting.arcore.contract.SessionRef
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent
import com.example.virtualfitting.arcore.contract.VirtualFittingLauncher
import com.example.virtualfitting.arcore.contract.VirtualFittingRequest
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

private const val TAG = "VirtualFittingBridge"
private const val METHOD_CHANNEL = "retinal/virtual_fitting/method"
private const val EVENT_CHANNEL = "retinal/virtual_fitting/events"

class VirtualFittingBridge(context: Context) {

    private val launcher: VirtualFittingLauncher =
        DefaultVirtualFittingLauncher(context.applicationContext)

    private var eventSink: EventChannel.EventSink? = null
    private var currentTicket: VirtualFittingLauncher.Ticket? = null

    fun register(engine: FlutterEngine) {
        val messenger = engine.dartExecutor.binaryMessenger

        MethodChannel(messenger, METHOD_CHANNEL)
            .setMethodCallHandler(::handleMethod)

        EventChannel(messenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    Log.d(TAG, "EventChannel onListen")
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                    Log.d(TAG, "EventChannel onCancel")
                }
            })
    }

    private fun handleMethod(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "checkAvailability" -> handleCheckAvailability(result)
            "launch" -> handleLaunch(call, result)
            "cancel" -> handleCancel(result)
            else -> result.notImplemented()
        }
    }

    private fun handleCheckAvailability(result: MethodChannel.Result) {
        result.success(launcher.checkAvailability().name)
    }

    private fun handleLaunch(call: MethodCall, result: MethodChannel.Result) {
        val productId = call.argument<String>("productId")
        val assetPath = call.argument<String>("assetPath")

        if (productId.isNullOrBlank() || assetPath.isNullOrBlank()) {
            result.error(
                "INVALID_ARGUMENT",
                "productId and assetPath are required",
                mapOf("productId" to productId, "assetPath" to assetPath),
            )
            return
        }

        val productName = call.argument<String>("productName") ?: productId

        // 동시 1세션만 지원: 새 launch 가 들어오면 직전 ticket 을 정리.
        currentTicket?.cancel()

        val requestId = "vf-${System.currentTimeMillis()}"
        val request = VirtualFittingRequest(
            session = SessionRef(sessionId = "session-shell", requestId = requestId),
            product = ProductRef(productId = productId, productName = productName),
            asset = AssetSource.LocalAsset(assetPath = assetPath),
        )

        currentTicket = launcher.launch(request) { event -> sendEvent(event) }
        result.success(requestId)
    }

    private fun handleCancel(result: MethodChannel.Result) {
        currentTicket?.cancel()
        currentTicket = null
        result.success(null)
    }

    private fun sendEvent(event: VirtualFittingEvent) {
        val sink = eventSink
        if (sink == null) {
            Log.w(TAG, "Event dropped (no listener): $event")
            return
        }
        val payload = mutableMapOf<String, Any?>("requestId" to event.requestId)
        when (event) {
            is VirtualFittingEvent.AvailabilityChecked -> {
                payload["event"] = "availability_checked"
                payload["data"] = mapOf("status" to event.status.name)
            }
            is VirtualFittingEvent.PreparingAssets -> {
                payload["event"] = "preparing_assets"
                payload["data"] = mapOf("progress" to event.progress)
            }
            is VirtualFittingEvent.AssetsReady -> {
                payload["event"] = "assets_ready"
                payload["data"] = emptyMap<String, Any>()
            }
            is VirtualFittingEvent.Started -> {
                payload["event"] = "started"
                payload["data"] = emptyMap<String, Any>()
            }
            is VirtualFittingEvent.TrackingActive -> {
                payload["event"] = "tracking_active"
                payload["data"] = emptyMap<String, Any>()
            }
            is VirtualFittingEvent.TrackingLost -> {
                payload["event"] = "tracking_lost"
                payload["data"] = emptyMap<String, Any>()
            }
            is VirtualFittingEvent.Closed -> {
                payload["event"] = "closed"
                payload["data"] = mapOf("reason" to event.reason.name)
            }
            is VirtualFittingEvent.Error -> {
                payload["event"] = "error"
                payload["data"] = mapOf(
                    "code" to event.code.name,
                    "message" to event.message,
                )
            }
        }
        sink.success(payload)
    }
}
