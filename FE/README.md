# FE

히비스 얼굴 분석 및 AR 안경 피팅 서비스 FE

Flutter 셸 앱이 Android 태블릿에서 Svelte 웹앱을 WebView로 감싸는 구조

```
FE/
├── flutter/
└── svelte/
```

---

## 기술 스택

### Svelte (웹앱)

| 분류          | 항목                      | 버전     |
| ------------- | ------------------------- | -------- |
| 언어 / 런타임 | JavaScript / Node.js      | LTS 권장 |
| 프레임워크    | Svelte                    | 5.55.1   |
| 빌드          | Vite                      | 8.0.4    |
| 스타일링      | Tailwind CSS              | 4.2.2    |
| 라우터        | @maks11060/svelte5-router | 3.2.0    |
| 얼굴 인식     | @mediapipe/tasks-vision   | 0.10.34  |
| AI 추론       | onnxruntime-web           | 1.25.1   |
| UI 아이콘     | lucide-svelte             | 1.0.1    |
| 차트          | chart.js                  | 4.5.1    |

### Flutter (Android 셸)

| 분류            | 항목                    | 버전    |
| --------------- | ----------------------- | ------- |
| 언어            | Dart                    | ^3.11.4 |
| 프레임워크      | Flutter                 | latest  |
| WebView         | webview_flutter         | 4.13.1  |
| WebView Android | webview_flutter_android | 4.0.0   |
| 권한            | permission_handler      | 11.3.1  |
| 타겟 플랫폼     | Android 태블릿          | —       |

---

## 로컬 개발환경 세팅

### Svelte

```bash
cd svelte

# 1. 의존성 설치
npm install

# 2. 환경변수 파일 생성 후 값 채우기
cp .env.example .env.local

# 3. 개발 서버 실행 (태블릿에서 접근 가능하게 host 0.0.0.0으로 열기)
npm run dev -- --host 0.0.0.0
```

### Flutter

```bash
cd flutter

# 1. adb reverse로 태블릿 ↔ 로컬 포트 연결
adb reverse tcp:5173 tcp:5173   # Svelte dev server
adb reverse tcp:8000 tcp:8000   # BE API server

# 2. 로컬 Svelte 서버를 WebView로 띄워 실행
flutter.bat run -d R54M900AEVJ --dart-define=WEB_APP_URL=http://127.0.0.1:5173

# 배포 사이트 고정 실행
flutter.bat run -d R54M900AEVJ
```

> 세부 내용은 `flutter/README.md` 참고

---

## 환경변수 목록

`svelte/.env.example` 참고

---

## 폴더 구조

```
FE/
├── flutter/
│   ├── lib/
│   │   ├── main.dart
│   │   └── native/
│   │       └── virtual_fitting.dart
│   └── android/
│       └── app/src/main/kotlin/
│           └── VirtualFittingBridge.kt
│
└── svelte/
    └── src/
        ├── App.svelte
        ├── app.css
        ├── main.js
        ├── config/
        ├── components/
        ├── router/
        └── lib/
            ├── api/
            ├── flutter/
            ├── mediapipe/
            ├── recommendations/
            ├── sixdrepnet360/
            └── stores/
```

---

## 주요 페이지 목록

### 안경사 플로우

| URL                     | 페이지         | 설명                                                                                   |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------- |
| `/`                     | 홈             | Windows → 관리자 로그인, 그 외(안드로이드 태블릿 등) → 안경사 로그인으로 즉시 redirect |
| `/auth/login`           | 안경사 로그인  | ID·비밀번호 로그인, 자동 로그인 유지                                                   |
| `/auth/optician-select` | 안경사 선택    | 로그인 응답의 안경사 목록에서 선택                                                     |
| `/auth/visit-select`    | 방문 유형 선택 | 첫 방문 / 재방문 분기                                                                  |

### 분석 플로우

| URL                      | 페이지       | 설명                                                                |
| ------------------------ | ------------ | ------------------------------------------------------------------- |
| `/analysis`              | 얼굴 촬영    | 3단계 촬영 (정면 1장·좌측 1장·우측 1장), 실시간 랜드마크, 음성 안내 |
| `/analysis/result`       | 촬영 결과    | 사진 확인 및 S3 업로드, 분석 저장                                   |
| `/analysis/report`       | 분석 리포트  | 얼굴형·피부톤·측정값·AR피팅·AI 인사이트 탭                          |
| `/analysis/lens-consult` | 렌즈 상담    | 라이프스타일 설문 (슬라이더, 다중 선택)                             |
| `/analysis/arfitting`    | AR 가상 피팅 | Flutter 브리지 경유 AR 피팅, 최대 5개 저장                          |

### 대시보드

| URL                                          | 페이지        | 설명                               |
| -------------------------------------------- | ------------- | ---------------------------------- |
| `/dashboard/users`                           | 고객 조회     | 전화번호 검색, 신규 고객 등록      |
| `/dashboard/users/:cust_no/measurement`      | 측정값 상세   | 고객 개별 측정값                   |
| `/dashboard/users/:cust_no/records`          | 방문 이력     | 방문 날짜·상태 목록                |
| `/dashboard/users/:cust_no/analysis-history` | 분석 이력     | 과거 분석 결과 조회                |
| `/dashboard/sales`                           | 매출 대시보드 | 매출 추이, 주문 수, 렌즈 비율 차트 |

### 관리자 (Windows 전용)

| URL            | 페이지              | 설명                                          |
| -------------- | ------------------- | --------------------------------------------- |
| `/admin/login` | 관리자 로그인       | 관리자 전용 로그인                            |
| `/admin/lens`  | 렌즈 상담 항목 관리 | 상담 질문·답변 추가·수정·삭제·순서 변경       |
| `/admin/glass` | 안경 정보 관리      | 안경 등록·수정·삭제, 2D 이미지·3D 모델 업로드 |
