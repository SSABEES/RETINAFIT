import 'package:flutter/services.dart';

const _methodChannel = MethodChannel('retinal/virtual_fitting/method');
const _eventChannel = EventChannel('retinal/virtual_fitting/events');

/// Native ARCore 가상 피팅 모듈을 호출하는 dart 측 클라이언트.
///
/// Phase 6a: 로컬 GLB asset 만 지원 (`assetPath` 인자).
/// Phase 6b 에서 `modelUrl`/`cacheKey` 등 remote 인자 추가 예정.
class VirtualFittingChannel {
  VirtualFittingChannel._();

  static Stream<VirtualFittingEvent>? _cachedEvents;

  /// AR fitting 의 모든 이벤트를 수신하는 broadcast stream.
  ///
  /// `launch()` 호출 전에 미리 listen 해두는 것이 안전하다 — 첫 이벤트
  /// (`Started` 등) 가 등록 후 도착하도록.
  static Stream<VirtualFittingEvent> get events {
    return _cachedEvents ??= _eventChannel
        .receiveBroadcastStream()
        .map<VirtualFittingEvent>((raw) {
          final map = Map<String, dynamic>.from(raw as Map);
          return VirtualFittingEvent.fromMap(map);
        });
  }

  /// AR 가상 피팅 화면을 띄운다.
  ///
  /// - [productId] / [productName] : 표시 용도, 이벤트 타고 dart 로 다시 돌아옴.
  /// - [assetPath] : `app/src/main/assets/` 기준 상대 경로
  ///   (예: `fixtures/glasses/ssample_glasses/ssample_glass.glb`).
  ///
  /// 반환값은 native 가 발급한 requestId. 이후 같은 ID 로 이벤트가 도착.
  static Future<String> launch({
    required String productId,
    required String productName,
    required String assetPath,
  }) async {
    final result = await _methodChannel.invokeMethod<String>('launch', {
      'productId': productId,
      'productName': productName,
      'assetPath': assetPath,
    });
    return result ?? '';
  }

  /// 진행 중인 fitting 을 native 측에서 중단.
  static Future<void> cancel() async {
    await _methodChannel.invokeMethod<void>('cancel');
  }

  /// ARCore 사용 가능 상태를 즉시 확인.
  ///
  /// 반환값 (예시): `SUPPORTED`, `UNSUPPORTED_DEVICE`, `AR_SERVICES_MISSING`,
  /// `AR_SERVICES_OUTDATED`, `UNKNOWN`.
  static Future<String> checkAvailability() async {
    final result = await _methodChannel.invokeMethod<String>('checkAvailability');
    return result ?? 'UNKNOWN';
  }
}

/// Native 에서 도착한 단일 가상 피팅 이벤트.
class VirtualFittingEvent {
  const VirtualFittingEvent({
    required this.requestId,
    required this.event,
    required this.data,
  });

  /// `launch()` 가 발급한 requestId.
  final String requestId;

  /// 이벤트 종류. 예: `started`, `tracking_active`, `tracking_lost`,
  /// `closed`, `error`, `availability_checked`, `preparing_assets`,
  /// `assets_ready`.
  final String event;

  /// 이벤트 종류별 추가 필드.
  /// - `closed` → `{reason: "USER_CLOSED" | "COMPLETED" | "CANCELLED"}`
  /// - `error` → `{code: String, message: String?}`
  /// - `preparing_assets` → `{progress: int (0~100)}`
  /// - 그 외 → `{}`
  final Map<String, dynamic> data;

  factory VirtualFittingEvent.fromMap(Map<String, dynamic> map) {
    final rawData = map['data'];
    return VirtualFittingEvent(
      requestId: map['requestId'] as String? ?? '',
      event: map['event'] as String? ?? 'unknown',
      data: rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : <String, dynamic>{},
    );
  }

  @override
  String toString() => 'VirtualFittingEvent($event, requestId=$requestId, data=$data)';
}
