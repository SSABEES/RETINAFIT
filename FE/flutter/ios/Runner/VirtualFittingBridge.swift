import Flutter
import Foundation

// iOS 측 Virtual Fitting 브리지 스텁.
// 안드로이드의 ARCore 기반 구현이 아직 iOS 로 포팅되지 않았으므로,
// Svelte WebView 가 같은 채널을 호출했을 때 깨지지 않도록 같은 인터페이스로
// 응답만 해주고, 실제 AR 은 비활성 상태(UNSUPPORTED_DEVICE) 로 알린다.
final class VirtualFittingBridge: NSObject {
    static let methodChannelName = "retinal/virtual_fitting/method"
    static let eventChannelName = "retinal/virtual_fitting/events"

    private var methodChannel: FlutterMethodChannel?
    private var eventChannel: FlutterEventChannel?
    private var eventSink: FlutterEventSink?

    func register(with messenger: FlutterBinaryMessenger) {
        let localMethodChannel = FlutterMethodChannel(
            name: VirtualFittingBridge.methodChannelName,
            binaryMessenger: messenger
        )
        localMethodChannel.setMethodCallHandler { [weak self] call, result in
            self?.handleMethod(call: call, result: result)
        }
        self.methodChannel = localMethodChannel

        let localEventChannel = FlutterEventChannel(
            name: VirtualFittingBridge.eventChannelName,
            binaryMessenger: messenger
        )
        localEventChannel.setStreamHandler(self)
        self.eventChannel = localEventChannel
    }

    private func handleMethod(call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "checkAvailability":
            // iOS 는 ARKit 포팅 전까지 UNSUPPORTED_DEVICE 로 통일.
            result("UNSUPPORTED_DEVICE")

        case "launch":
            let localArgsObj = call.arguments as? [String: Any] ?? [:]
            let localProductId = (localArgsObj["productId"] as? String) ?? ""
            let localRequestId = "vf-ios-\(Int(Date().timeIntervalSince1970 * 1000))"

            // Svelte 측은 launch 의 반환값을 requestId 로 사용한다. 같은 값을 즉시 돌려준다.
            result(localRequestId)

            // 그리고 곧바로 error 이벤트를 흘려 호출부가 토스트 등으로 fallback 하게 한다.
            DispatchQueue.main.async { [weak self] in
                self?.emitUnsupportedError(requestId: localRequestId, productId: localProductId)
            }

        case "cancel":
            result(nil)

        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func emitUnsupportedError(requestId: String, productId: String) {
        guard let localSink = eventSink else { return }
        localSink([
            "requestId": requestId,
            "event": "error",
            "data": [
                "code": "UNSUPPORTED_DEVICE",
                "message": "iOS does not support virtual fitting yet (productId=\(productId))."
            ]
        ])
    }
}

extension VirtualFittingBridge: FlutterStreamHandler {
    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        self.eventSink = events
        return nil
    }

    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        self.eventSink = nil
        return nil
    }
}
