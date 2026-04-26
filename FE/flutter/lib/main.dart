import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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

  @override
  void initState() {
    super.initState();

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
  });

  final String message;
  final String url;
  final VoidCallback onRetry;

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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
