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
  - Flutter 쪽 AR 브리지 호출 래퍼
- `android/app/src/main/kotlin/.../VirtualFittingBridge.kt`
  - Android native AR 브리지 구현

## 실행 전제

- `FE/svelte` dev server가 떠 있어야 한다.
- `BE` 서버가 `8000` 포트에서 떠 있어야 한다.
- Android 태블릿이 `adb devices`에서 `device` 상태여야 한다.
- 태블릿 테스트 시 `adb reverse`로 `5173`, `8000`을 연결해야 한다.

## 실행 순서

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

### 3. 포트 reverse 연결

아무 폴더에서:

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

중요:

- `--dart-define`는 중간에 띄어쓰면 안 된다.
- 태블릿 실기기 테스트에서는 `127.0.0.1:5173` 사용을 권장한다.
- 이 값은 `adb reverse tcp:5173 tcp:5173`를 전제로 한다.

## 왜 `127.0.0.1`를 쓰는가

Svelte 카메라 기능은 `getUserMedia`를 사용한다.
Android WebView에서는 `http://노트북IP:5173`보다 `http://127.0.0.1:5173`가 더 안정적으로 동작한다.

즉:

- Svelte 화면 접근: `127.0.0.1:5173`
- 백엔드 API 접근: `127.0.0.1:8000`
- 둘 다 `adb reverse`로 태블릿에서 노트북으로 연결

## WebView URL 설정

`lib/main.dart`에서 기본값은 아래다:

```dart
const String _defaultWebAppUrl = 'http://10.0.2.2:5173';
```

이 값은 Android 에뮬레이터용 기본값이다.
실기기 태블릿에서는 실행 시 아래처럼 덮어쓴다:

```bash
--dart-define=WEB_APP_URL=http://127.0.0.1:5173
```

## Svelte <-> Flutter 브리지

Flutter는 WebView 안에 `window.__retinal_flutter_bridge__`를 주입한다.

Svelte 쪽 브리지 코드는 아래에 있다:

- `FE/svelte/src/lib/flutter/bridge.js`
- `FE/svelte/src/lib/flutter/asset_map.js`

지원 메서드:

- `checkAvailability`
- `launch`
- `cancel`

Flutter 쪽 채널 이름:

- `RetinalFlutterBridgeChannel`

이벤트 이름:

- `retinal:flutter_event`

## AR 피팅 관련 메모

- `arfitting.svelte`는 현재 Flutter native AR 버튼과 Web 카메라 캡처를 함께 가진다.
- Flutter native AR은 `asset_map.js`의 asset 경로 매핑이 맞아야 동작한다.
- 안경 목록 조회는 Svelte가 백엔드 `/api/v1/glasses`를 호출하므로, `8000` reverse가 빠지면 목록이 비어 보일 수 있다.

## 자주 나는 문제

### 1. `Svelte app is not reachable`

확인:

- `FE/svelte` dev server 실행 여부
- `adb reverse tcp:5173 tcp:5173`
- `WEB_APP_URL=http://127.0.0.1:5173`

### 2. 로그인 안 됨

대부분 `8000` reverse가 빠진 경우다.

```bash
adb reverse tcp:8000 tcp:8000
```

### 3. 카메라가 안 켜짐

확인:

- 태블릿 앱 권한에서 카메라 허용
- `127.0.0.1:5173`로 실행했는지
- Svelte dev server가 실제로 반영된 최신 코드인지

### 4. 뒤로가기 안 됨

WebView history가 비어 있으면 `history.back()`이 동작하지 않는다.
현재 `arfitting` 페이지는 fallback으로 `analysisLensConsult`로 이동하도록 보완돼 있다.

## 빠른 재실행 명령

```bash
adb reverse tcp:5173 tcp:5173
adb reverse tcp:8000 tcp:8000
```

```bash
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173
```
