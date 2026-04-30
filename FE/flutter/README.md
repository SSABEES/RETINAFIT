# RETINAL Flutter Shell

`FE/flutter`는 독립 Flutter UI 앱이 아니라 `FE/svelte`를 `WebView`로 감싸는 셸 앱이다.

## 역할

- Svelte 앱을 Android 태블릿에서 앱 형태로 실행한다.
- WebView 카메라 권한을 허용한다.
- Svelte와 Flutter native AR 브리지를 연결한다.
- 필요 시 Flutter native AR 화면을 실행한다.

## 구조

- `lib/main.dart`
  - 앱 진입점
  - `WebViewWidget`으로 Svelte 앱을 로드
  - JS 브리지 채널 등록
  - Svelte <-> Flutter 메시지 연결
- `lib/native/virtual_fitting.dart`
  - Flutter 쪽 AR 브리지 호출 헬퍼
- `android/app/src/main/kotlin/.../VirtualFittingBridge.kt`
  - Android native AR 브리지 구현

## 기본 WebView 주소

현재 Flutter WebView 기본 주소는 아래 배포 사이트로 고정되어 있다.

```text
https://k14s107.p.ssafy.io/
```

코드 위치:

- `FE/flutter/lib/main.dart`

즉 `flutter run` 시 `--dart-define=WEB_APP_URL=...`를 주지 않으면 기본적으로 배포 사이트를 연다.

## 기본 실행

`FE/flutter` 폴더에서:

```bash
flutter.bat run -d R54M900AEVJ
```

## 다른 주소로 override

특정 환경에서만 다른 웹 주소를 열고 싶으면 `WEB_APP_URL`을 덮어쓰면 된다.

예시:

```bash
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=https://k14s107.p.ssafy.io/
```

## 로컬 개발 서버로 테스트할 때

로컬 Svelte dev server를 WebView로 띄우고 싶으면 아래처럼 override 한다.

### 1. 백엔드 실행

`BE` 폴더에서:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Svelte 실행

`FE/svelte` 폴더에서:

```bash
npm.cmd run dev -- --host 0.0.0.0
```

### 3. adb reverse 연결

프로젝트 루트 등 아무 폴더에서:

```bash
adb reverse tcp:5173 tcp:5173
adb reverse tcp:8000 tcp:8000
```

확인:

```bash
adb reverse --list
```

정상 예시:

```text
tcp:5173 tcp:5173
tcp:8000 tcp:8000
```

### 4. Flutter 실행

`FE/flutter` 폴더에서:

```bash
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173
```

주의:

- `--dart-define`는 중간에 띄어쓰면 안 된다.
- 로컬 테스트에서는 `adb reverse`가 전제다.
- 카메라/WebView 환경 때문에 실기기 테스트 시 `127.0.0.1:5173`가 가장 안정적이다.

## WebView URL 설정

`lib/main.dart` 기본값:

```dart
const String _defaultWebAppUrl = 'https://k14s107.p.ssafy.io/';
```

실행 시 override 예시:

```bash
--dart-define=WEB_APP_URL=http://127.0.0.1:5173
```

## Svelte <-> Flutter 브리지

Flutter는 WebView 안에 `window.__retinal_flutter_bridge__`를 주입한다.

Svelte 쪽 브리지 코드는 아래에 있다.

- `FE/svelte/src/lib/flutter/bridge.js`
- `FE/svelte/src/lib/flutter/asset_map.js`

지원 메서드:

- `checkAvailability`
- `launch`
- `cancel`

Flutter 채널 이름:

- `RetinalFlutterBridgeChannel`

이벤트 이름:

- `retinal:flutter_event`

## AR 피팅 메모

- `arfitting.svelte`는 현재 Flutter native AR 버튼과 Web 카메라 캡처를 함께 가진다.
- Flutter native AR은 `asset_map.js`의 asset 경로 매핑이 맞아야 동작한다.
- 안경 목록 조회는 Svelte가 백엔드 `/api/v1/glasses`를 호출하므로, 로컬 테스트에서는 `8000` reverse가 비면 목록이 비어 보일 수 있다.

## 자주 하는 문제

### 1. `Svelte app is not reachable`

배포 고정 모드라면:

- 배포 사이트가 실제로 열리는지
- 태블릿 네트워크에서 해당 도메인 접근이 되는지

로컬 override 모드라면:

- `FE/svelte` dev server 실행 여부
- `adb reverse tcp:5173 tcp:5173`
- `WEB_APP_URL=http://127.0.0.1:5173`

### 2. 로그인/API 실패

로컬 테스트라면 대부분 `8000` reverse 문제다.

```bash
adb reverse tcp:8000 tcp:8000
```

배포 사이트 고정 사용 중이면 백엔드 배포 주소와 CORS 설정을 확인한다.

### 3. 카메라가 안 켜짐

확인:

- 태블릿 앱 권한에서 카메라 허용
- 로컬 테스트면 `127.0.0.1:5173`로 실행했는지
- 배포 사이트면 HTTPS인지

### 4. 뒤로가기가 안 됨

WebView history가 비어 있으면 `history.back()`이 동작하지 않는다.
현재 `arfitting` 페이지는 fallback으로 `analysisLensConsult`로 이동하도록 보완되어 있다.

## 빠른 명령 모음

배포 사이트 고정 실행:

```bash
flutter.bat run -d R54M900AEVJ
```

로컬 웹으로 override 실행:

```bash
adb reverse tcp:5173 tcp:5173
adb reverse tcp:8000 tcp:8000
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173
```
