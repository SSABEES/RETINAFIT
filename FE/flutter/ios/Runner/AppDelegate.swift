import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  // VirtualFittingBridge 는 method/event handler 를 보유하므로 strong reference 로 유지한다.
  private let virtualFittingBridge = VirtualFittingBridge()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // 안드로이드의 VirtualFittingBridge 와 동일한 channel 명으로 등록.
    // iOS 는 ARKit 포팅 전까지 UNSUPPORTED_DEVICE 로 응답하는 스텁이다.
    if let localRegistrar = engineBridge.pluginRegistry.registrar(forPlugin: "VirtualFittingBridge") {
      virtualFittingBridge.register(with: localRegistrar.messenger())
    }
  }
}
