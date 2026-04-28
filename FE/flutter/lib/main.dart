import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'native/virtual_fitting.dart';

const String _defaultWebAppUrl = 'http://10.0.2.2:5173';
const String _webAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: _defaultWebAppUrl,
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RetinalShellApp());
}

class RetinalShellApp extends StatelessWidget {
  const RetinalShellApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RETINAL',
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

class _WebShellPageState extends State<WebShellPage> {
  static const _bridge_channel_name = 'RetinalFlutterBridgeChannel';
  static const _flutter_event_name = 'retinal:flutter_event';

  late final WebViewController _controller;
  var _loadingProgress = 0;
  String? _loadError;
  String? _lastArEvent;
  StreamSubscription<VirtualFittingEvent>? _arEventSub;

  @override
  void initState() {
    super.initState();

    _arEventSub = VirtualFittingChannel.events.listen((event) {
      // ignore: avoid_print
      print('[AR] $event');
      unawaited(_broadcast_ar_event(event));
      if (mounted) {
        setState(() => _lastArEvent = '${event.event}: ${event.data}');
      }
    });

    _controller =
        WebViewController(
            onPermissionRequest: (request) {
              request.grant();
            },
          )
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.white)
          ..addJavaScriptChannel(
            _bridge_channel_name,
            onMessageReceived: (message) {
              unawaited(_handle_bridge_message(message.message));
            },
          )
          ..setNavigationDelegate(
            NavigationDelegate(
              onProgress: (progress) {
                if (mounted) {
                  setState(() => _loadingProgress = progress);
                }
              },
              onPageStarted: (_) {
                if (mounted) {
                  setState(() => _loadError = null);
                }
              },
              onPageFinished: (_) {
                unawaited(_install_flutter_bridge());
              },
              onWebResourceError: (error) {
                if (error.isForMainFrame == true && mounted) {
                  setState(() => _loadError = error.description);
                }
              },
            ),
          )
          ..loadRequest(Uri.parse(_webAppUrl));
  }

  @override
  void dispose() {
    _arEventSub?.cancel();
    super.dispose();
  }

  // WebView 안의 Svelte 앱이 Promise 기반으로 호출할 Flutter 브리지를 주입한다.
  Future<void> _install_flutter_bridge() async {
    await _controller.runJavaScript('''
      (() => {
        const g_pending_request_map_obj = new Map()

        window.__retinal_flutter_bridge__ = {
          is_ready: true,
          invoke(method_name, params_obj = {}) {
            return new Promise((resolve, reject) => {
              const local_request_id =
                (globalThis.crypto?.randomUUID?.() ?? 'req-' + Date.now() + '-' + Math.random())

              g_pending_request_map_obj.set(local_request_id, { resolve, reject })

              ${_bridge_channel_name}.postMessage(
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

  // JS 채널 요청을 기존 VirtualFittingChannel 메서드로 연결한다.
  Future<void> _handle_bridge_message(String raw_message) async {
    String local_request_id = '';

    try {
      final local_payload_obj = jsonDecode(raw_message) as Map<String, dynamic>;
      local_request_id = local_payload_obj['request_id'] as String? ?? '';
      final local_method_name = local_payload_obj['method'] as String? ?? '';
      final local_params_obj =
          Map<String, dynamic>.from(local_payload_obj['params'] as Map? ?? const {});

      switch (local_method_name) {
        case 'checkAvailability':
          final local_availability = await VirtualFittingChannel.checkAvailability();
          await _send_bridge_success(
            request_id: local_request_id,
            result: local_availability,
          );
          break;
        case 'launch':
          final local_launch_request_id = await VirtualFittingChannel.launch(
            productId: local_params_obj['productId'] as String? ?? '',
            productName: local_params_obj['productName'] as String? ?? '',
            assetPath: local_params_obj['assetPath'] as String? ?? '',
            modelUrl: local_params_obj['modelUrl'] as String? ?? '',
            cacheKey: local_params_obj['cacheKey'] as String? ?? '',
          );
          await _send_bridge_success(
            request_id: local_request_id,
            result: local_launch_request_id,
          );
          break;
        case 'cancel':
          await VirtualFittingChannel.cancel();
          await _send_bridge_success(
            request_id: local_request_id,
            result: null,
          );
          break;
        default:
          await _send_bridge_error(
            request_id: local_request_id,
            message: 'Unsupported bridge method: $local_method_name',
          );
      }
    } catch (local_error) {
      await _send_bridge_error(
        request_id: local_request_id,
        message: local_error.toString(),
      );
    }
  }

  // Flutter 처리 결과를 WebView Promise resolve 로 돌려준다.
  Future<void> _send_bridge_success({
    required String request_id,
    required Object? result,
  }) async {
    if (request_id.isEmpty) {
      return;
    }

    final local_payload_text = jsonEncode({
      'result': result,
    });

    await _controller.runJavaScript('''
      window.__retinal_flutter_bridge__?.resolve_request(
        ${jsonEncode(request_id)},
        $local_payload_text,
      )
    ''');
  }

  // Flutter 처리 오류를 WebView Promise reject 로 돌려준다.
  Future<void> _send_bridge_error({
    required String request_id,
    required String message,
  }) async {
    if (request_id.isEmpty) {
      return;
    }

    final local_payload_text = jsonEncode({
      'message': message,
    });

    await _controller.runJavaScript('''
      window.__retinal_flutter_bridge__?.reject_request(
        ${jsonEncode(request_id)},
        $local_payload_text,
      )
    ''');
  }

  // Native AR 이벤트를 DOM CustomEvent 로 브로드캐스트해 Svelte 에서 구독하게 한다.
  Future<void> _broadcast_ar_event(VirtualFittingEvent event) async {
    final local_payload_text = jsonEncode({
      'requestId': event.requestId,
      'event': event.event,
      'data': event.data,
    });

    await _controller.runJavaScript('''
      window.dispatchEvent(
        new CustomEvent(
          ${jsonEncode(_flutter_event_name)},
          { detail: $local_payload_text },
        ),
      )
    ''');
  }

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
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_loadingProgress < 100)
              LinearProgressIndicator(value: _loadingProgress / 100),
            if (_loadError != null)
              _WebLoadError(
                message: _loadError!,
                url: _webAppUrl,
                onRetry: () => _controller.reload(),
                onLaunchAr: _launchArDebug,
                lastArEvent: _lastArEvent,
              ),
          ],
        ),
      ),
    );
  }
}

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
