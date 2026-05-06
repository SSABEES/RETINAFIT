# Svelte ↔ Flutter 브릿지 통신 프로토콜

> RetinaFit 앱의 Svelte (WebView) 와 Flutter / 네이티브 ARCore 모듈 사이에서 오가는
> **모든 문자열 메시지** 와 그 효과를 정리한 레퍼런스.
>
> 모든 통신은 **JSON 또는 JS 코드 텍스트 직렬화** — 양쪽 런타임이 다르므로 객체 레퍼런스 직접 공유 불가.
> Svelte 입장에서는 `await bridge.invoke('method', params)` 한 줄로 보이지만 내부적으로는 다음 흐름.

---

## 0. 전체 통신 사슬

```
[Svelte (WebView)]
   ↕  ① JS 채널 postMessage (요청)            ② CustomEvent (이벤트 푸시)
[lib/main.dart  — Flutter 측 단일 진입점]
   ↕  MethodChannel + EventChannel
[lib/native/virtual_fitting.dart  — Dart wrapper]
   ↕
[android/app/.../VirtualFittingBridge.kt  — Kotlin 어댑터]
   ↕
[android/arcore-feature/  — 실제 ARCore Face Tracking]
```

브릿지의 본체 (요청-응답 + 이벤트 푸시 로직) 는 `lib/main.dart` 에 있습니다. 그 외 다른 Dart 파일은
Svelte 와 직접 통신하지 않습니다.

---

## 1. 채널 식별자 (양쪽이 정확히 일치해야 함)

| 식별자 | 정의 위치 (Flutter) | 사용 위치 (Svelte) | 역할 |
| --- | --- | --- | --- |
| `'RetinafitFlutterBridgeChannel'` | `lib/main.dart:104` (`_bridge_channel_name`) | `_install_flutter_bridge` 가 주입한 IIFE 안 | JS → Dart 메시지 채널 (`addJavaScriptChannel` 이름) |
| `'retinafit:flutter_event'` | `lib/main.dart:107` (`_flutter_event_name`) | `svelte/src/lib/flutter/bridge.js:4` (`g_flutter_event_name`) | Dart → JS 푸시 이벤트의 `CustomEvent` 이름 |
| `'retinafit/virtual_fitting/method'` | `lib/native/virtual_fitting.dart:3` | (Svelte 직접 사용 안 함) | Dart ↔ Kotlin/Swift MethodChannel |
| `'retinafit/virtual_fitting/events'` | `lib/native/virtual_fitting.dart:4` | (Svelte 직접 사용 안 함) | Dart ↔ Kotlin/Swift EventChannel |
| `window.__retinafit_flutter_bridge__` | `_install_flutter_bridge` 에서 주입 | `svelte/src/lib/flutter/bridge.js:18` | JS 측 글로벌 브릿지 객체 |

---

## 2. Svelte → Dart — 요청 메시지 (3 종)

Svelte 쪽 호출 패턴은 항상 동일:

```js
const result = await window.__retinafit_flutter_bridge__.invoke(method_name, params_obj)
```

내부적으로 다음 모양의 **JSON 문자열** 한 덩어리가 `RetinafitFlutterBridgeChannel.postMessage(...)` 로
Dart 의 `_handle_bridge_message` 에 도착합니다.

```json
{
  "request_id": "<UUID>",
  "method": "<...>",
  "params": { ... }
}
```

`method` 가 다음 3 개 중 하나가 아니면 즉시 `'Unsupported bridge method: xxx'` 로 reject.

### 2-A. `"method": "checkAvailability"`

**용도**: 디바이스의 ARCore 가용성 즉시 조회.

| 항목 | 값 |
| --- | --- |
| `params` | `{}` (없음) |
| 내부 호출 | `VirtualFittingChannel.checkAvailability()` → MethodChannel `'checkAvailability'` → Kotlin `launcher.checkAvailability()` → `ArCoreApk.getInstance().checkAvailability(context)` |
| 응답 `result` | 다음 5 가지 문자열 중 하나 |
| Svelte 호출 위치 | `arfitting.svelte` 의 `g_flutter_availability` 결정 |

**응답 매핑** (`arcore-feature/.../availability/ArCoreAvailabilityChecker.kt`):

| ARCore 응답 | 우리 result | 의미 |
| --- | --- | --- |
| `SUPPORTED_INSTALLED` | `"SUPPORTED"` | ✅ 디바이스 지원 + ARCore 설치됨 |
| `SUPPORTED_NOT_INSTALLED` | `"AR_SERVICES_MISSING"` | ARCore 미설치 |
| `SUPPORTED_APK_TOO_OLD` | `"AR_SERVICES_OUTDATED"` | ARCore 버전 낡음 |
| `UNSUPPORTED_DEVICE_NOT_CAPABLE` | `"UNSUPPORTED_DEVICE"` | 하드웨어 비지원 |
| `UNKNOWN_*` | `"UNKNOWN"` | 일시 상태 (재시도 권장) |

### 2-B. `"method": "launch"`

**용도**: AR 가상 피팅 화면을 띄움. 사용자가 안경을 가상 착용.

| 항목 | 값 |
| --- | --- |
| `params` | 다음 객체 |

```jsonc
{
  "productId":   "string (필수, 비어있으면 INVALID_ARGUMENT 에러)",
  "productName": "string",
  "assetPath":   "fixtures/glasses/.../xxx.glb",   // 로컬 GLB (안드로이드 assets 기준 상대경로)
  "modelUrl":    "https://.../glasses.glb",        // 원격 GLB URL
  "cacheKey":    "glasses-<id>",                   // 원격 모델 캐시 키 (생략 시 productId 가 기본값)
  "originXPx":   0, "originYPx": 0,                // 화면 내 placeholder 영역 좌표 (전체 화면이면 0)
  "widthPx":     0, "heightPx":  0
}
```

`assetPath` 와 `modelUrl` 중 **둘 중 하나는 반드시** 있어야 함. 둘 다 비어있으면 Kotlin 측에서
`INVALID_ARGUMENT` 에러.

| 항목 | 값 |
| --- | --- |
| 내부 호출 | `VirtualFittingChannel.launch(...)` → MethodChannel `'launch'` → Kotlin `handleLaunch` → `DefaultVirtualFittingLauncher.launch(request)` → `ArEntryActivity` 띄움 |
| 응답 `result` | native 가 발급한 **requestId** 문자열 (예: `"vf-1714900000000"`). 이후 푸시 이벤트가 같은 ID 로 라벨 |
| Svelte 호출 위치 | `arfitting.svelte:on_click_select_glasses` (안경 카드 클릭) |

### 2-C. `"method": "cancel"`

**용도**: 진행 중인 AR 세션을 즉시 종료.

| 항목 | 값 |
| --- | --- |
| `params` | `{}` |
| 내부 호출 | `VirtualFittingChannel.cancel()` → MethodChannel `'cancel'` → Kotlin `currentTicket?.cancel()` |
| 응답 `result` | `null` |
| Svelte 호출 위치 | (현재 explicit 호출 없음 — pose target 변경 시 launcher 가 직접 ticket 정리) |

---

## 3. Dart → Svelte — 4 가지 응답/이벤트 형태

Dart 는 `_controller.runJavaScript('...')` 로 **JS 소스 코드 텍스트** 를 WebView 에 주입.
WebView 는 그 코드를 자기 컨텍스트에서 eval 해 효과 발생. 모든 변수는 `jsonEncode` 로 안전하게
직렬화 (큰따옴표 escape, JS injection 방어).

### 3-A. 브릿지 객체 설치 (`_install_flutter_bridge`)

| 항목 | 값 |
| --- | --- |
| 호출 시점 | 페이지 로드 완료 (`onPageFinished`). SPA 라우팅 후 매 페이지마다 재주입 |
| 주입되는 코드 | `(() => { ... window.__retinafit_flutter_bridge__ = { is_ready, invoke, resolve_request, reject_request } })()` |
| Svelte 측 효과 | `window.__retinafit_flutter_bridge__` 사용 가능 |

**브릿지 객체의 메서드:**

| 메서드 | Svelte 가 호출 | 역할 |
| --- | --- | --- |
| `is_ready: true` | (필드, 호출 X) | 브릿지 준비 여부 (`bridge.js:is_flutter_bridge_ready` 가 검사) |
| `invoke(method, params)` | ✅ | 위 2-A/2-B/2-C 호출. Promise 반환 |
| `resolve_request(id, payload)` | (Dart 가 호출, Svelte 직접 X) | pending Promise resolve |
| `reject_request(id, payload)` | (Dart 가 호출, Svelte 직접 X) | pending Promise reject |

### 3-B. 성공 응답 (`_send_bridge_success`)

| 항목 | 값 |
| --- | --- |
| 호출 시점 | 위 2-A/2-B/2-C 메서드가 정상 처리 완료 |
| 주입되는 코드 | `window.__retinafit_flutter_bridge__?.resolve_request("<id>", { "result": <값> })` |
| JS 측 효과 | 해당 `request_id` 의 `resolve` 호출 → Svelte 의 `await invoke(...)` 가 그 값으로 풀림 |

### 3-C. 실패 응답 (`_send_bridge_error`)

| 항목 | 값 |
| --- | --- |
| 호출 시점 | JSON 파싱 실패 / 알 수 없는 method / 네이티브 호출 throw |
| 주입되는 코드 | `window.__retinafit_flutter_bridge__?.reject_request("<id>", { "message": "<에러>" })` |
| JS 측 효과 | pending Promise reject → Svelte 의 `try/catch` 가 받음 |

### 3-D. 푸시 이벤트 (`_broadcast_ar_event`)

요청-응답이 아닌 **일방향 이벤트**. launch 가 시작된 뒤 도착하는 모든 native 이벤트를 그대로 push.

| 항목 | 값 |
| --- | --- |
| 호출 시점 | `VirtualFittingChannel.events` 스트림이 emit 할 때마다 |
| 주입되는 코드 | `window.dispatchEvent(new CustomEvent('retinafit:flutter_event', { detail: { requestId, event, data } }))` |
| Svelte 측 수신 | `window.addEventListener('retinafit:flutter_event', e => e.detail)` (또는 wrapper `add_virtual_fitting_event_listener`) |

`detail` 의 모양은 항상 평탄하게 `{ requestId, event, data }` 표준화. Svelte 는 `event` 이름으로 분기.

---

## 4. 푸시 이벤트의 `event` 종류 (9 가지)

`VirtualFittingBridge.kt` 의 `sendEvent` 가 sealed class `VirtualFittingEvent` 별로 다음 문자열 생성:

| `event` | `data` 구조 | 발생 시점 / 의미 |
| --- | --- | --- |
| `"availability_checked"` | `{ status: "SUPPORTED" \| ... }` | ARCore 가용성 결과 (2-A 응답과 별개로 비동기 푸시되는 경우) |
| `"preparing_assets"` | `{ progress: 0..100 }` | 원격 GLB 모델 다운로드/준비 진행률 |
| `"assets_ready"` | `{}` | 모델 에셋 준비 완료 — 곧 `started` 가 따라옴 |
| `"started"` | `{}` | AR 화면 띄워짐, 카메라 활성화 |
| `"tracking_active"` | `{}` | 얼굴 추적 시작됨 |
| `"tracking_lost"` | `{}` | 얼굴 추적 끊김 (사용자가 카메라 밖으로 벗어남 등) |
| `"captured"` | `{ slot: "front"\|"left"\|"right", image_base64: "..." }` | AR 화면에서 사용자가 사진 1 장 캡쳐. **가장 무거운 이벤트** — base64 이미지 전송 |
| `"closed"` | `{ reason: "USER_CLOSED"\|"COMPLETED"\|"CANCELLED" }` | AR 화면 닫힘 |
| `"error"` | `{ code: "...", message: "..." }` | 에러 발생 |

---

## 5. 한 사이클 예시 — 측면 1 장 캡쳐

```
┌──────────────────────────────── Svelte (WebView) ────────────────────────────────┐
│ const id = await window.__retinafit_flutter_bridge__.invoke('launch', {           │
│   productId: '42', assetPath: '...glb', cacheKey: 'glasses-42'                    │
│ })                                                                                │
└────────────────────────────────────┬──────────────────────────────────────────────┘
                                     │
                  postMessage(JSON 2-B)
                                     ▼
┌──────────────────────────────── lib/main.dart ────────────────────────────────────┐
│ _handle_bridge_message(JSON) → switch 'launch'                                    │
│   → VirtualFittingChannel.launch(productId, assetPath, ...)                       │
└────────────────────────────────────┬──────────────────────────────────────────────┘
                                     │
                  MethodChannel invokeMethod('launch', args)
                                     ▼
┌──────────── android/app/.../VirtualFittingBridge.kt ──────────────────────────────┐
│ handleLaunch → launcher.launch(request) { event -> sendEvent(event) }             │
│ result.success("vf-17150...")                                                     │
└────────────────────────────────────┬──────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────── android/arcore-feature/  — ArEntryActivity / ARCore Session ──────────┐
│ AR 화면 띄움, Face Tracking 시작                                                    │
└────────────────────────────────────┬──────────────────────────────────────────────┘
                                     │
              MethodChannel result → Dart → JS resolve_request:
              window.__retinafit_flutter_bridge__?.resolve_request("<id>",
                  { result: "vf-17150..." })
                                     ▼
┌──────────────────────── Svelte: await 풀림, requestId 반환 ──────────────────────┐
│ // 이제 AR 화면 진행 중. 푸시 이벤트들이 도착하기 시작                              │
└────────────────────────────────────┬──────────────────────────────────────────────┘

(Native ARCore 가 진행 상태 이벤트 송신)

[Kotlin] EventChannel.success({ event:"started", data:{} })
[Dart]   _arEventSub.listen → _broadcast_ar_event
            window.dispatchEvent(new CustomEvent('retinafit:flutter_event',
                { detail: { requestId, event:'started', data:{} } }))
[Svelte] window.addEventListener('retinafit:flutter_event', ...) 가 받아 로깅

[Kotlin] 사용자 촬영 → EventChannel.success({
            event:"captured",
            data:{ slot:"left", image_base64:"..." }
         })
[Dart]   동일 broadcast 경로
[Svelte] arfitting.svelte:on_native_captured → atob(base64) → Blob → File →
         g_capture_slot_arr[1] = { file_obj, object_url, ... }
```

요청-응답 사이클 (2-B → 3-B) 한 번 + 푸시 이벤트 (3-D) 여러 번이 한 launch 의 라이프사이클.

---

## 6. 빠른 참조 표 — 무엇을 보내면 무엇이 일어나는가

### Svelte → Dart (3 종)

| 보내는 method 문자열 | 받는 result | 결과 |
| --- | --- | --- |
| `"checkAvailability"` | `"SUPPORTED"` / `"AR_SERVICES_MISSING"` / `"AR_SERVICES_OUTDATED"` / `"UNSUPPORTED_DEVICE"` / `"UNKNOWN"` | 디바이스 ARCore 가용성 |
| `"launch"` | requestId 문자열 (`"vf-..."`) | AR 화면 띄움. 이후 푸시 이벤트 시작 |
| `"cancel"` | `null` | 진행 중 AR 세션 종료 |

### Dart → Svelte (이벤트 — 9 종)

| `event` 문자열 | data | 의미 |
| --- | --- | --- |
| `"availability_checked"` | `{ status }` | ARCore 가용성 비동기 통지 |
| `"preparing_assets"` | `{ progress }` | 모델 다운로드 진행 |
| `"assets_ready"` | `{}` | 모델 준비 완료 |
| `"started"` | `{}` | AR 화면 시작 |
| `"tracking_active"` | `{}` | 얼굴 추적 시작 |
| `"tracking_lost"` | `{}` | 얼굴 추적 끊김 |
| `"captured"` | `{ slot, image_base64 }` | 사용자 캡쳐 — base64 이미지 |
| `"closed"` | `{ reason }` | AR 화면 닫힘 |
| `"error"` | `{ code, message }` | 에러 |

### 정리

- **method (Svelte → Dart)**: `checkAvailability` / `launch` / `cancel` — 3 가지 동사
- **event (Dart → Svelte)**: 위 9 가지 — 비동기 진행 상태/결과
- **합쳐서 12 가지 동사** 가 양쪽이 약속한 프로토콜

---

## 7. 코드 위치 요약

| 역할 | 파일 |
| --- | --- |
| Flutter 측 단일 통신 진입점 | `lib/main.dart` |
| Dart ↔ Native MethodChannel/EventChannel wrapper | `lib/native/virtual_fitting.dart` |
| Kotlin 어댑터 (MethodChannel handler) | `android/app/src/main/kotlin/com/hebees/retina/fit/VirtualFittingBridge.kt` |
| ARCore 가용성 검사 본체 | `android/arcore-feature/.../availability/ArCoreAvailabilityChecker.kt` |
| AR 화면 Activity | `android/arcore-feature/.../entry/ArEntryActivity.kt` |
| Face Tracking + 모델 렌더 | `android/arcore-feature/.../rendering/FaceFittingScreen.kt` |
| Svelte 측 브릿지 wrapper | `svelte/src/lib/flutter/bridge.js` |
| Svelte 측 호출자 | `svelte/src/router/analysis/arfitting.svelte` |

---

## 8. 디버그 팁

- **JS → Dart 방향 메시지 추적**: `lib/main.dart:_handle_bridge_message` 에 print 추가 — 어떤 method/params 가 오는지 확인
- **Dart → JS 방향 추적**: WebView 에서 `chrome://inspect` (디버그 빌드 + Android) 로 console 보기. `window.addEventListener('retinafit:flutter_event', e => console.log(e.detail))` 임시 등록 가능
- **Native AR 이벤트 추적**: `lib/main.dart:131` 의 `print('[AR] $event')` 가 logcat 에 모든 이벤트 출력
- **브릿지 미준비 케이스**: `bridge.js:is_flutter_bridge_ready()` 가 false 면 `window.__retinafit_flutter_bridge__.is_ready` 가 아직 설정 안 됨 — 페이지 로드 직후 잠깐 false 일 수 있어 `wait_for_flutter_bridge()` 로 짧게 polling
