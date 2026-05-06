# AR 피팅 — S3 GLB 연동 작업 정리

태블릿 AR 피팅이 로컬 샘플 GLB(`assets/fixtures/glasses/sample_glasses/glasses.glb`)에서만 동작하고, S3 업로드한 안경의 GLB로는 안 되던 문제를 해결한 작업.

## 증상

- 안경 카드 선택 → AR 화면 진입 → status overlay에 `error: ASSET_DOWNLOAD_FAILED / Remote model download failed` 만 표시
- 로컬 샘플(`asset_path` 매칭되는 안경)은 정상
- S3 URL은 브라우저로 직접 열면 GLB가 멀쩡히 다운로드됨 → 인터넷, 버킷 권한, URL 모두 정상

## 원인 — 두 단계에서 막힘

### 1. 다운로드 단계: 메인 스레드에서 동기 HTTP 호출

`FaceFittingScreen.kt`의 Compose `remember { ... }` 블록은 **컴포지션 스레드(=메인 스레드)에서 즉시 실행**됨. 그 안에서 `DefaultAssetResolver.resolve()`를 호출했고, RemoteModel 분기는 `HttpURLConnection.connect()`를 동기 호출 → 안드로이드가 메인 스레드 네트워크 호출을 막아 `NetworkOnMainThreadException` 발생.

이 예외는 message가 null이라, AssetResolver의 `recoverCatching` 분기가 fallback 텍스트(`"Remote model download failed"`)만 emit하게 됨. 그래서 진짜 원인이 가려졌다.

### 2. 렌더 단계: `rememberModelInstance`가 절대 경로를 못 읽음

다운로드가 성공해도 `rememberModelInstance(modelLoader, "/data/user/0/.../cache/glasses-1.glb")`에 절대 파일 경로를 그대로 넘기면 Sceneview가 `AssetManager`로 읽으려고 시도 → APK assets 폴더에는 그런 파일이 없으니 silent하게 null 반환.

상대 경로(`fixtures/...`)는 APK 내부 assets 영역에서 잘 찾지만, 캐시 디렉토리는 안드로이드의 별개 영역이라 `AssetManager`로는 접근 불가능.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `flutter/android/arcore-feature/src/main/kotlin/com/example/virtualfitting/arcore/rendering/FaceFittingScreen.kt` | 1. asset resolve를 `produceState` + `Dispatchers.IO`로 백그라운드 실행<br>2. 다운로드 중 status overlay에 "Downloading model..." 표시<br>3. 로딩 status 문구 정정 ("sample" 표현 제거) |
| `flutter/android/arcore-feature/src/main/kotlin/com/example/virtualfitting/arcore/assets/AssetResolver.kt` | 1. RemoteModel 결과 경로에 `file://` prefix 추가<br>2. wrapping 예외에 throwable 클래스명을 메시지로 노출 (디버깅용) |

(같이 따라간 svelte 쪽 부수 변경: `lib/api/admin_glasses.js` `get_uploaded_file_url`이 host 포함 full URL이 아닌 S3 object key만 반환하도록 수정. 이전에는 백엔드가 host prefix를 다시 붙여서 더블 host가 되는 문제가 있었음.)

## 변경 상세

### 1) `FaceFittingScreen.kt` — 다운로드 백그라운드화

```kotlin
import androidx.compose.runtime.produceState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
```

```kotlin
// 전: remember 블록에서 동기 resolve → 메인 스레드에서 HTTP → 폭발
val resolution = remember(request.asset, context) {
    DefaultAssetResolver(context).resolve(request.asset)
}

// 후: produceState 로 IO 디스패처에서 resolve, 결과만 state 로 노출
val resolution by produceState<Result<ResolvedAsset>?>(
    initialValue = null,
    request.asset,
    context,
) {
    value = withContext(Dispatchers.IO) {
        DefaultAssetResolver(context).resolve(request.asset)
    }
}

if (resolution == null) {
    // 다운로드 진행 중에 표시할 오버레이
    StatusOverlay(... statusMessage = "Downloading model...")
    return
}
```

`produceState`의 producer 람다는 suspend 컨텍스트라 `withContext(Dispatchers.IO) { ... }`로 IO 스레드에서 안전하게 블로킹 호출 가능. 결과가 들어오면 자동 recompose → 그 다음 단계 진행.

### 2) `AssetResolver.kt` — `file://` URI prefix

```kotlin
is AssetSource.RemoteModel -> runCatching {
    val localFile = downloadRemoteModel(source)
    // Sceneview 의 rememberModelInstance 는 asset 상대경로 또는 file:// URI 만 인식한다.
    // 절대 파일경로 그대로 넘기면 null 로 떨어져서 modelInstance 가 영영 안 만들어진다.
    ResolvedAsset.LocalAssetPath("file://${localFile.absolutePath}")
}
```

LocalAsset 분기는 그대로 (asset 상대경로 유지). RemoteModel만 file URI scheme으로 감싼다.

### 3) `AssetResolver.kt` — 에러 메시지 클래스명 노출

```kotlin
}.recoverCatching { throwable ->
    throw when (throwable) {
        is AssetException -> throwable
        else -> {
            // 디버깅을 위해 throwable 클래스명까지 메시지에 담는다.
            // (NetworkOnMainThreadException 등은 message 가 null 이라 fallback 만 보이면 원인 파악 불가)
            val localCauseText = "${throwable.javaClass.simpleName}: ${throwable.message ?: "no message"}"
            AssetException(ErrorCode.ASSET_DOWNLOAD_FAILED, localCauseText)
        }
    }
}
```

이전에는 message가 null인 throwable이 들어오면 `"Remote model download failed"`라는 일반 문구만 표시되어 원인 추적이 막혔다. 이제 `"NetworkOnMainThreadException: no message"` 같이 클래스명까지 같이 찍힌다.

## 다운로드 / 캐싱 흐름

1. Svelte → Flutter bridge `launch` 호출 (`product_id`, `model_url`, `cache_key` 전달)
2. `VirtualFittingBridge.handleLaunch` → `AssetSource.RemoteModel`로 변환
3. `FaceFittingScreen` composable 진입 → `produceState`가 IO 스레드에서:
   1. `context.cacheDir/virtual-fitting-models/{cacheKey}.glb`에 파일 존재 확인
   2. 있으면 즉시 캐시 hit
   3. 없으면 `HttpURLConnection.GET`으로 S3에서 받아 디스크에 쓰기
4. 결과 경로를 `file://` URI로 감싸서 ResolvedAsset 반환
5. `rememberModelInstance(modelLoader, "file:///data/user/0/.../glasses-1.glb")` → Filament이 정상 로드
6. 얼굴 트래킹 시작되면 ModelNode가 face transform 따라감

캐시 위치 (앱 패키지 기준):
```
/data/user/0/com.retinafit.retinafit_shell/cache/virtual-fitting-models/{cacheKey}.glb
```

캐시 키는 Svelte에서 `glasses-{id}` 형태로 생성. 같은 안경 재선택 시 다운로드 재실행 안 함.

캐시 비우려면:
```bash
adb shell run-as com.retinafit.retinafit_shell rm -rf cache/virtual-fitting-models
```

## 빌드 / 테스트

Kotlin 네이티브 변경은 hot reload(`r`)나 hot restart(`R`)로 반영 안 됨. **풀 리빌드 필수**.

```bash
# flutter run 콘솔에서
q

# 다시 실행
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173
```

캐시 꼬임 의심 시:
```bash
flutter.bat clean
flutter.bat pub get
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173
```

기대 흐름:
1. 안경 선택 → "Downloading model..." (1~3초)
2. → "ARCore ready. Loading GLB..."
3. → "Point the front camera at a face."
4. 얼굴 잡으면 → 안경 렌더링 / yaw 디버그 status

## 디버깅 단서

| status overlay 메시지 | 의미 |
|---|---|
| `Downloading model...` | IO 스레드에서 GLB 다운로드 중 |
| `ARCore ready. Loading GLB...` | 다운로드 완료, Filament가 GLB 파싱 중 |
| `Point the front camera at a face.` | 모델 로드 완료, 얼굴 감지 대기 |
| `GLB attached to N face(s)` 또는 `yaw=...` | 정상 렌더링 |
| `error: ASSET_DOWNLOAD_FAILED / {ClassName}: {message}` | 다운로드 단계에서 실패. 클래스명으로 원인 추적 |
| `error: ASSET_DOWNLOAD_FAILED / Remote model download failed` (정확히 이 문구) | 빌드된 APK가 옛날 코드. 풀 리빌드 안 됨 |

native 쪽 raw 로그 보려면:
```bash
adb logcat -s VirtualFittingBridge:* AndroidRuntime:E System.err:W FaceFittingScreen:*
```

## 남은 한계 / 추후 작업

- **버킷이 private으로 바뀌면 즉시 깨짐**: 현재 raw S3 URL을 GET 요청. 버킷이 private이 되면 백엔드가 GET용 presigned URL을 발급하는 API가 필요하고, Flutter 쪽 다운로드 흐름도 그 URL을 받아 쓰도록 바꿔야 함.
- **`file://` 프리픽스가 Sceneview 4.0.1에서 안 먹는 케이스 발견 시**: byte 직접 로딩 fallback 필요. `produceState`로 `File(path).readBytes()` → `modelLoader.createModel(bytes)` 패턴으로 한 단계 더 내려가야 함.
- **다운로드 진행률 표시 없음**: 현재는 단순 "Downloading model..." 텍스트. 큰 GLB는 체감 대기 길어질 수 있음. `connection.contentLength`로 progress 이벤트(`PreparingAssets`) 흘리는 작업 가능.
- **캐시 무효화 정책 없음**: 같은 cacheKey면 영원히 캐시 사용. S3 측에서 안경 GLB가 교체되어도 클라이언트에서 안 받아옴. ETag 또는 Last-Modified 헤더로 비교해 갱신하는 로직이 필요할 수 있음.
- **에러 시 자동 재시도 없음**: 첫 다운로드 실패 시 onClose로 빠져나옴. 사용자가 다시 안경 선택해야 재시도. 일시적 네트워크 오류 자동 재시도 가치 검토.
