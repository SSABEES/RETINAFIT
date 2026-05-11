// ============================================================================
// RetinaFit Flutter 셸 — 진입점 (lib/main.dart)
// ----------------------------------------------------------------------------
// 이 앱의 정체:
//   - UI/도메인 로직은 모두 Svelte 웹앱(`_webAppUrl`) 에 있고, 이 Flutter 앱은
//     WebView 로 그 사이트를 띄우는 "셸" 역할만 한다.
//   - 추가로 WebView ↔ Flutter ↔ 네이티브 ARCore 모듈 사이의 양방향 메시지
//     브릿지를 제공한다 (이 파일 안의 _install_flutter_bridge / _handle_bridge_message
//     / _send_bridge_* / _broadcast_ar_event 4 인방).
//
// WebView 패키지:
//   - flutter_inappwebview 6.x — webview_flutter 4.x 에서 이주.
//   - 이유: wide-viewport / loadWithOverviewMode 옵션을 dart 측에서 직접 켤 수 있어
//     안드로이드 WebView 의 기본값 (useWideViewPort=false) 으로 인한 CSS viewport 축소
//     (디바이스 실폭 1463 → 948 로 layout) 문제를 해결.
//
// 통신 사슬:
//   Svelte (WebView)
//      ↕  JS handler (RetinafitFlutterBridgeChannel)  +  CustomEvent 'retinafit:flutter_event'
//   Flutter / Dart  (이 파일)
//      ↕  MethodChannel + EventChannel  (lib/native/virtual_fitting.dart)
//   Kotlin/Swift 네이티브 모듈  (android/app/.../VirtualFittingBridge.kt)
//      ↕  ARCore feature 모듈
// ============================================================================

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:permission_handler/permission_handler.dart';

import 'native/virtual_fitting.dart';

// 운영 Svelte 사이트 URL (HTTPS). dev/staging 은 빌드 시점에 갈아끼움:
//   flutter build apk --dart-define=WEB_APP_URL=https://staging.example.com
// `String.fromEnvironment` 는 컴파일 타임 상수만 읽기 때문에 핫리로드로는 못 바꿈.
const String _defaultWebAppUrl = 'https://fit.adminschool.net/';
const String _webAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: _defaultWebAppUrl,
);

void main() async {
  // Flutter 엔진의 plugin 채널이 활성화되기 전에 await 를 쓰면 안 되므로 먼저 ensure 호출.
  WidgetsFlutterBinding.ensureInitialized();

  // 가로 모드 강제 — Svelte UI 가 가로 기준으로만 디자인되어 있어 세로 회전 차단.
  // landscapeLeft / landscapeRight 모두 허용해 디바이스를 어느 방향으로 잡아도 가로 유지.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // 디버그 빌드에서 chrome://inspect → "Inspect" 로 WebView 안 콘솔/네트워크 까보기 가능.
  // 릴리즈 빌드에선 보안상 비활성화 (kDebugMode = false).
  if (kDebugMode && defaultTargetPlatform == TargetPlatform.android) {
    await InAppWebViewController.setWebContentsDebuggingEnabled(true);
  }

  // 앱 첫 화면이 그려지기 전에 카메라 권한을 미리 잡아둔다 — WebView 안의 getUserMedia 가
  // OS 레벨 권한이 없으면 시스템 다이얼로그도 못 띄우고 즉시 실패하는 환경 (특히 Android 13+) 대비.
  await _ensure_camera_permission();

  runApp(const RetinafitShellApp());
}

// 카메라 권한 상태 머신:
//   - granted / limited : 이미 허용 → 그대로 반환 (재요청 안 함, 사용자 흐름 방해 X)
//   - permanentlyDenied : OS 가 시스템 다이얼로그 재요청을 차단한 상태 → 그대로 반환해서
//                         호출부가 이를 보고 "설정으로 이동" 다이얼로그 (_show_open_settings_dialog) 를 띄움
//   - 그 외 (denied / restricted / 첫 진입) : Permission.camera.request() 로 시스템 다이얼로그 띄움
//
// 반환값은 호출부가 분기에 사용. 이 함수 자체는 다이얼로그를 띄우지 않는다 — UI 가 없는 시점
// (main() 진입 직후, runApp 전) 에도 호출되기 때문에 부수효과를 분리.
Future<PermissionStatus> _ensure_camera_permission() async {
  final local_status = await Permission.camera.status;
  if (local_status.isGranted || local_status.isLimited) {
    return local_status;
  }
  if (local_status.isPermanentlyDenied) {
    return local_status;
  }
  return Permission.camera.request();
}

class RetinafitShellApp extends StatelessWidget {
  const RetinafitShellApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RetinaFit',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const WebShellPage(),
    );
  }
}

class WebShellPage extends StatefulWidget {
  const WebShellPage({super.key});

  @override
  State<WebShellPage> createState() => _WebShellPageState();
}

class _WebShellPageState extends State<WebShellPage> with WidgetsBindingObserver {
  // ───── 브릿지 프로토콜 식별자 (Svelte 와 정확히 일치해야 함) ─────
  // JS → Dart 메시지를 받을 JavaScript handler 이름. Svelte 측 _install_flutter_bridge 에서
  // `flutter_inappwebview.callHandler('RetinafitFlutterBridgeChannel', JSON)` 로 호출.
  static const _bridge_channel_name = 'RetinafitFlutterBridgeChannel';
  // Dart → JS 푸시 이벤트 (CustomEvent) 의 이름. Svelte 는
  // `window.addEventListener('retinafit:flutter_event', e => e.detail ...)` 로 구독.
  static const _flutter_event_name = 'retinafit:flutter_event';

  // WebView 컨트롤러. InAppWebView 의 onWebViewCreated 콜백에서 채워진다.
  InAppWebViewController? _controller;
  // 0~100 페이지 로딩 진행률 — 상단 LinearProgressIndicator 표시용.
  var _loadingProgress = 0;
  // 메인 프레임 로드가 실패하면 _WebLoadError 풀스크린 fallback 노출.
  String? _loadError;
  // 디버그 화면 (_WebLoadError) 의 마지막 AR 이벤트 텍스트. 운영에서는 거의 안 보임.
  String? _lastArEvent;
  // 네이티브 AR 이벤트 스트림 구독. dispose 에서 cancel 안 하면 leak.
  StreamSubscription<VirtualFittingEvent>? _arEventSub;
  // "설정으로 이동" 다이얼로그를 동시에 두 번 띄우지 않기 위한 가드 (lifecycle resumed 가
  // 짧게 두 번 발생하는 케이스 등).
  bool _settings_dialog_showing = false;

  // ───── InAppWebView initialSettings ─────
  // wide-viewport / loadWithOverviewMode: 안드로이드 WebView 가 viewport meta 의
  // `width=device-width` 를 그대로 따르도록 한다. 끄면 기본 980px 로 layout 되어
  // 디바이스 실폭(예: 1463) 과 어긋나 화면이 1.75배 zoom 된 형태로 보임.
  // mediaPlaybackRequiresUserGesture: getUserMedia/AR 트리거를 사용자 제스처 없이도 시작.
  // javaScriptEnabled: Svelte SPA 동작 필수.
  // transparentBackground: 페이지 로드 전 잠깐 보이는 배경 깜빡임 회피.
  // allowsInlineMediaPlayback (iOS): 풀스크린 강제 없이 inline 비디오 재생.
  // iframeAllowFullscreen: Svelte 내부 iframe 사용 시 대비.
  final InAppWebViewSettings _webview_settings = InAppWebViewSettings(
    javaScriptEnabled: true,
    useWideViewPort: true,
    loadWithOverviewMode: true,
    mediaPlaybackRequiresUserGesture: false,
    allowsInlineMediaPlayback: true,
    transparentBackground: false,
    supportZoom: false,
    builtInZoomControls: false,
    iframeAllowFullscreen: true,
  );

  @override
  void initState() {
    super.initState();
    // 앱 라이프사이클 (resumed/paused/...) 알림을 받기 위한 옵저버 등록.
    // didChangeAppLifecycleState 에서 시스템 설정 다녀온 직후 권한 재확인에 사용.
    WidgetsBinding.instance.addObserver(this);

    // ───── ① 네이티브 AR 이벤트 구독 — WebView 보다 먼저 ─────
    // 이유: launch() 가 호출되자마자 첫 이벤트(`Started` 등) 가 도착할 수 있어, listen 등록이
    //      늦으면 첫 이벤트를 놓칠 수 있다. WebView 띄우기 전 미리 구독해 두는 패턴.
    _arEventSub = VirtualFittingChannel.events.listen((event) {
      // ignore: avoid_print
      print('[AR] $event'); // 디버그 로깅 (릴리즈도 출력되지만 logcat 만 봄)
      // 모든 이벤트를 그대로 WebView 안 Svelte 로 push 한다.
      unawaited(_broadcast_ar_event(event));
      // _WebLoadError 디버그 화면 표시용 — 운영 화면엔 영향 없음.
      if (mounted) {
        setState(() => _lastArEvent = '${event.event}: ${event.data}');
      }
    });

    // 첫 frame 이 그려진 직후 권한 상태를 재확인 — main() 의 _ensure_camera_permission 결과가
    // permanentlyDenied 였다면 여기서 비로소 "설정으로 이동" 다이얼로그를 띄울 수 있다 (UI 활성화 후).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_check_camera_permission_and_prompt());
    });
  }

  @override
  void dispose() {
    // 누수 방지 — 등록 순서의 역순으로 정리.
    WidgetsBinding.instance.removeObserver(this);
    _arEventSub?.cancel();
    super.dispose();
  }

  // 앱이 background → foreground 로 돌아올 때 호출. 사용자가 시스템 설정에서 권한을 바꾸고
  // 돌아온 케이스를 잡기 위함 — 거부→허용으로 바뀌었으면 자연스럽게 동작 시작, 거부 유지면
  // 다시 안내 다이얼로그.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_check_camera_permission_and_prompt());
    }
  }

  // 권한 상태를 확인하고, 영구 거부면 (= 시스템 다이얼로그가 더 안 뜨는 상태) 사용자에게
  // "설정으로 이동" 안내를 띄운다. 그 외 상태는 _ensure_camera_permission 가 알아서 처리.
  Future<void> _check_camera_permission_and_prompt() async {
    final local_status = await _ensure_camera_permission();
    if (!mounted) return;
    if (local_status.isPermanentlyDenied) {
      await _show_open_settings_dialog();
    }
  }

  // 카메라 권한이 영구 거부 상태일 때 시스템 설정으로 보내는 안내 다이얼로그.
  // - barrierDismissible: false → 바깥 탭으로 닫지 못하도록 (선택을 강제)
  // - "나중에" / "설정 열기" 두 가지 액션
  // - openAppSettings() 는 permission_handler 의 헬퍼 — 안드로이드 앱 정보 화면으로 직행
  // - _settings_dialog_showing 가드로 동시에 두 번 띄우지 않게 함 (resumed 가 짧게 두 번
  //   발생하는 OS 도 있어서)
  Future<void> _show_open_settings_dialog() async {
    if (!mounted || _settings_dialog_showing) return;
    _settings_dialog_showing = true;
    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialog_ctx) => AlertDialog(
          title: const Text('카메라 권한이 필요합니다'),
          content: const Text(
            '안경 가상 피팅과 시선 측정을 위해 카메라 권한이 필요합니다.\n'
            '설정에서 RetinaFit 앱의 카메라 권한을 허용해주세요.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialog_ctx).pop(),
              child: const Text('나중에'),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.of(dialog_ctx).pop();
                await openAppSettings();
              },
              child: const Text('설정 열기'),
            ),
          ],
        ),
      );
    } finally {
      _settings_dialog_showing = false;
    }
  }

  // ========================================================================
  // _install_flutter_bridge — 페이지 로드 후 JS 측 브릿지 객체 주입
  // ------------------------------------------------------------------------
  // Svelte 입장에서는 그냥 `await window.__retinafit_flutter_bridge__.invoke('launch', {...})`
  // 한 줄로 끝나도록 만든 추상화. 내부적으로는 메시지 큐 + Promise 매핑 로직.
  //
  // 동작 단계:
  //   1) Svelte: bridge.invoke(method, params) 호출
  //   2) JS: requestId 생성, pending Map 에 {resolve, reject} 저장, callHandler 로 Dart 에 송신,
  //          Promise 반환
  //   3) Dart: addJavaScriptHandler('RetinafitFlutterBridgeChannel', ...) 가 메시지 받음,
  //           method 실행, 결과를 _send_bridge_* 통해 다시 JS 의 resolve_request/reject_request 호출
  //   4) JS: pending Map 에서 해당 requestId 의 resolve/reject 꺼내 호출 → Svelte 의 await 풀림
  //
  // flutter_inappwebview 의 callHandler 는 인자 배열을 전달하므로 첫 번째 인자에 JSON 문자열을
  // 그대로 넣어 Dart 측에선 args[0] 으로 받는다.
  // ========================================================================
  Future<void> _install_flutter_bridge() async {
    final local_controller = _controller;
    if (local_controller == null) return;
    await local_controller.evaluateJavascript(source: '''
      (() => {
        const g_pending_request_map_obj = new Map()

        window.__retinafit_flutter_bridge__ = {
          is_ready: true,
          invoke(method_name, params_obj = {}) {
            return new Promise((resolve, reject) => {
              const local_request_id =
                (globalThis.crypto?.randomUUID?.() ?? 'req-' + Date.now() + '-' + Math.random())

              g_pending_request_map_obj.set(local_request_id, { resolve, reject })

              window.flutter_inappwebview.callHandler(
                ${jsonEncode(_bridge_channel_name)},
                JSON.stringify({
                  request_id: local_request_id,
                  method: method_name,
                  params: params_obj,
                }),
              )
            })
          },
          resolve_request(request_id, payload_obj) {
            const local_pending_obj = g_pending_request_map_obj.get(request_id)
            if (!local_pending_obj) return
            g_pending_request_map_obj.delete(request_id)
            local_pending_obj.resolve(payload_obj?.result ?? null)
          },
          reject_request(request_id, payload_obj) {
            const local_pending_obj = g_pending_request_map_obj.get(request_id)
            if (!local_pending_obj) return
            g_pending_request_map_obj.delete(request_id)
            local_pending_obj.reject(new Error(payload_obj?.message ?? 'Flutter bridge error'))
          },
        }
      })()
    ''');
  }

  // ========================================================================
  // _handle_bridge_message — Svelte 가 보낸 메시지를 받아 라우팅
  // ------------------------------------------------------------------------
  // 받는 메시지 모양 (JSON 문자열):
  //   { request_id: string, method: 'checkAvailability'|'launch'|'cancel', params: {...} }
  //
  // method 별로 VirtualFittingChannel (lib/native/virtual_fitting.dart) 의 정적 메서드를 호출.
  // 그 메서드들은 다시 MethodChannel 을 통해 Kotlin/Swift 의 VirtualFittingBridge 로 들어간다.
  //
  // 결과는 _send_bridge_success / _send_bridge_error 로 JS 측 Promise 에 돌려보낸다.
  // ========================================================================
  Future<void> _handle_bridge_message(String raw_message) async {
    // try 안에서 변수가 정의되기 전 throw 가 일어나도 catch 가 답을 보낼 수 있도록 외부 선언.
    String local_request_id = '';

    try {
      // JSON 디코드 + 안전 캐스팅 — 잘못된 페이로드면 catch 로 빠지고 reject 됨.
      final local_payload_obj = jsonDecode(raw_message) as Map<String, dynamic>;
      local_request_id = local_payload_obj['request_id'] as String? ?? '';
      final local_method_name = local_payload_obj['method'] as String? ?? '';
      final local_params_obj =
          Map<String, dynamic>.from(local_payload_obj['params'] as Map? ?? const {});

      switch (local_method_name) {
        // ARCore 사용 가능 상태 확인 (인스턴트). 디바이스 미지원 시 'UNSUPPORTED_DEVICE' 등 반환.
        case 'checkAvailability':
          final local_availability = await VirtualFittingChannel.checkAvailability();
          await _send_bridge_success(
            request_id: local_request_id,
            result: local_availability,
          );
          break;
        // AR 화면 띄우기. 결과 반환값은 native 가 발급한 requestId — 이후 같은 ID 로 이벤트 도착.
        // params 는 Svelte 의 build_flutter_fitting_payload 가 생성한 객체와 1:1 일치.
        case 'launch':
          final local_launch_request_id = await VirtualFittingChannel.launch(
            productId: local_params_obj['productId'] as String? ?? '',
            productName: local_params_obj['productName'] as String? ?? '',
            assetPath: local_params_obj['assetPath'] as String? ?? '',
            modelUrl: local_params_obj['modelUrl'] as String? ?? '',
            cacheKey: local_params_obj['cacheKey'] as String? ?? '',
            originXPx: (local_params_obj['originXPx'] as num? ?? 0).toInt(),
            originYPx: (local_params_obj['originYPx'] as num? ?? 0).toInt(),
            widthPx: (local_params_obj['widthPx'] as num? ?? 0).toInt(),
            heightPx: (local_params_obj['heightPx'] as num? ?? 0).toInt(),
          );
          await _send_bridge_success(
            request_id: local_request_id,
            result: local_launch_request_id,
          );
          break;
        // 진행 중 fitting 강제 종료. 결과값 없음 (null).
        case 'cancel':
          await VirtualFittingChannel.cancel();
          await _send_bridge_success(
            request_id: local_request_id,
            result: null,
          );
          break;
        // 정의되지 않은 method — Svelte 측 오타 방지용 명시적 에러.
        default:
          await _send_bridge_error(
            request_id: local_request_id,
            message: 'Unsupported bridge method: $local_method_name',
          );
      }
    } catch (local_error) {
      // JSON 파싱 실패 / 네이티브 Method 채널 에러 / arg 타입 미스매치 등 모두 여기로.
      // request_id 가 비어있을 수도 있는데, 그 경우 _send_bridge_error 가 자체적으로 noop 처리.
      await _send_bridge_error(
        request_id: local_request_id,
        message: local_error.toString(),
      );
    }
  }

  // Dart → JS: 성공 응답을 JS 측 pending Promise 의 resolve 로 보낸다.
  // jsonEncode(request_id) 는 큰따옴표를 안전하게 escape — 사용자/서버에서 온 문자열이라
  // raw 삽입하면 JS 인젝션 위험. result 도 동일 이유로 jsonEncode 처리.
  Future<void> _send_bridge_success({
    required String request_id,
    required Object? result,
  }) async {
    // request_id 가 비어있으면 보낼 곳이 없음 — JSON 파싱 실패 등으로 ID 가 누락된 케이스.
    if (request_id.isEmpty) return;

    final local_controller = _controller;
    if (local_controller == null) return;

    final local_payload_text = jsonEncode({
      'result': result,
    });

    await local_controller.evaluateJavascript(source: '''
      window.__retinafit_flutter_bridge__?.resolve_request(
        ${jsonEncode(request_id)},
        $local_payload_text,
      )
    ''');
  }

  // Dart → JS: 실패 응답을 JS 측 pending Promise 의 reject 로 보낸다.
  // Svelte 측에선 try/catch 로 받아 toast 등 에러 핸들링.
  Future<void> _send_bridge_error({
    required String request_id,
    required String message,
  }) async {
    if (request_id.isEmpty) return;

    final local_controller = _controller;
    if (local_controller == null) return;

    final local_payload_text = jsonEncode({
      'message': message,
    });

    await local_controller.evaluateJavascript(source: '''
      window.__retinafit_flutter_bridge__?.reject_request(
        ${jsonEncode(request_id)},
        $local_payload_text,
      )
    ''');
  }

  // ========================================================================
  // _broadcast_ar_event — Native AR 이벤트를 Svelte 로 push (요청-응답이 아님)
  // ------------------------------------------------------------------------
  // launch() 가 시작된 뒤 도착하는 모든 이벤트 (Started / TrackingActive / Captured /
  // Closed / Error 등) 를 그대로 DOM CustomEvent 로 브로드캐스트한다.
  //
  // Svelte 측 수신 (예시):
  //   window.addEventListener('retinafit:flutter_event', (e) => {
  //     const { requestId, event, data } = e.detail   // 표준화된 평탄 모양
  //     if (event === 'captured') { /* data.slot, data.image_base64 */ }
  //   })
  // ========================================================================
  Future<void> _broadcast_ar_event(VirtualFittingEvent event) async {
    final local_controller = _controller;
    if (local_controller == null) return;

    final local_payload_text = jsonEncode({
      'requestId': event.requestId,
      'event': event.event,
      'data': event.data,
    });

    await local_controller.evaluateJavascript(source: '''
      window.dispatchEvent(
        new CustomEvent(
          ${jsonEncode(_flutter_event_name)},
          { detail: $local_payload_text },
        ),
      )
    ''');
  }

  // 디버그 화면 (_WebLoadError) 의 "AR 테스트" 버튼이 호출하는 핸들러.
  // 실 운영 흐름엔 진입하지 않음 — Svelte 페이지가 못 떴을 때 native 단독으로 ARCore 까지 갈 수
  // 있는지 확인하는 용도. 사용 시 fixtures/glasses/ssample_glasses/ssample_glass.glb 에셋 필요.
  Future<void> _launchArDebug() async {
    try {
      final id = await VirtualFittingChannel.launch(
        productId: 'debug-001',
        productName: 'Debug Sample (ssample_glass)',
        assetPath: 'fixtures/glasses/ssample_glasses/ssample_glass.glb',
      );
      if (mounted) {
        setState(() => _lastArEvent = 'launched requestId=$id');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _lastArEvent = 'launch error: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // 레이아웃: WebView 가 풀스크린 + 그 위에 진행률 바 + (실패 시) fallback UI 가 겹쳐 그려짐.
    // 통상은 WebView 만 보이고, 페이지 로딩 중 짧게 LinearProgressIndicator, 로드 실패 시
    // _WebLoadError 가 전면 노출.
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(url: WebUri(_webAppUrl)),
              initialSettings: _webview_settings,
              // 컨트롤러 핸들 확보 + JS 채널 등록.
              onWebViewCreated: (controller) {
                _controller = controller;
                controller.addJavaScriptHandler(
                  handlerName: _bridge_channel_name,
                  callback: (args) async {
                    // Svelte 가 보낸 첫 인자는 JSON 문자열. 이외 인자는 무시.
                    final raw = args.isNotEmpty ? args.first?.toString() ?? '' : '';
                    await _handle_bridge_message(raw);
                    // callHandler 의 응답값은 안 쓰지만, 어쨌든 무언가 반환해야 Promise 가 settle.
                    return null;
                  },
                );
              },
              // 0~100 진행률.
              onProgressChanged: (controller, progress) {
                if (mounted) setState(() => _loadingProgress = progress);
              },
              // 페이지 시작될 때마다 이전 에러 fallback 화면 해제.
              onLoadStart: (controller, url) {
                if (mounted) setState(() => _loadError = null);
              },
              // 페이지 로드 완료 시점에 JS 측 브릿지 객체 주입. SPA 라우팅 후에도 매번 재주입.
              onLoadStop: (controller, url) async {
                await _install_flutter_bridge();
              },
              // 메인 프레임 로드 실패 — 풀스크린 _WebLoadError 노출.
              onReceivedError: (controller, request, error) {
                if (request.isForMainFrame == true && mounted) {
                  setState(() => _loadError = error.description);
                }
              },
              // 카메라/마이크 등 권한 요청. OS 권한이 잡혀 있으면 grant, 아니면 deny + 설정 안내.
              onPermissionRequest: (controller, request) async {
                final local_status = await _ensure_camera_permission();
                if (local_status.isGranted || local_status.isLimited) {
                  return PermissionResponse(
                    resources: request.resources,
                    action: PermissionResponseAction.GRANT,
                  );
                }
                if (local_status.isPermanentlyDenied) {
                  unawaited(_show_open_settings_dialog());
                }
                return PermissionResponse(
                  resources: request.resources,
                  action: PermissionResponseAction.DENY,
                );
              },
            ),
            if (_loadingProgress < 100)
              LinearProgressIndicator(value: _loadingProgress / 100),
            if (_loadError != null)
              _WebLoadError(
                message: _loadError!,
                url: _webAppUrl,
                onRetry: () => _controller?.reload(),
                onLaunchAr: _launchArDebug,
                lastArEvent: _lastArEvent,
              ),
          ],
        ),
      ),
    );
  }
}

// Svelte 사이트 로드가 실패했을 때 표시하는 풀스크린 fallback. 운영에선 거의 보이지 않지만,
// 네트워크 단절 / SSL 만료 / 도메인 변경 등 예외 상황에서 사용자에게 retry + 디버그용 AR 호출
// 진입점을 제공한다. lastArEvent 텍스트로 native 브릿지 동작 여부도 확인 가능.
class _WebLoadError extends StatelessWidget {
  const _WebLoadError({
    required this.message,
    required this.url,
    required this.onRetry,
    required this.onLaunchAr,
    required this.lastArEvent,
  });

  final String message;
  final String url;
  final VoidCallback onRetry;
  final VoidCallback onLaunchAr;
  final String? lastArEvent;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Svelte app is not reachable',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  '$url\n\n$message',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                FilledButton(onPressed: onRetry, child: const Text('Retry')),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 12),
                Text(
                  'Native bridge debug',
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: onLaunchAr,
                  child: const Text('AR 테스트 (ssample_glass.glb)'),
                ),
                const SizedBox(height: 8),
                Text(
                  lastArEvent ?? '(이벤트 없음)',
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
