import 'dart:async';

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
