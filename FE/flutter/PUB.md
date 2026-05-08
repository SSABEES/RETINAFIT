# Android 앱 배포 가이드 (Google Play Store)

> 앱 정보
> - 앱 이름: RetinaFit
> - Bundle ID (Application ID): `com.hebees.retina.fit`
> - 키스토어 위치: `~/retina_fit_release.jks`
> - 키스토어 별칭: `retina_fit`
> - 키스토어 비밀번호: (key.properties 파일 참고)

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [키스토어 관리](#2-키스토어-관리)
3. [버전 관리](#3-버전-관리)
4. [앱 빌드](#4-앱-빌드)
5. [개인정보처리방침 준비](#5-개인정보처리방침-준비)
6. [Google Play Console 업로드](#6-google-play-console-업로드)
7. [심사 및 출시](#7-심사-및-출시)
8. [업데이트 배포](#8-업데이트-배포)
9. [주의사항 및 체크리스트](#9-주의사항-및-체크리스트)

---

## 1. 사전 준비

### 필요한 계정 및 도구
- [ ] **Google Play Console 계정** — https://play.google.com/console
  - 최초 1회 등록비 $25 (일회성) 결제 필요
- [ ] **Flutter SDK** 설치 완료
- [ ] **Java (keytool)** 설치 완료 — 키스토어 생성에 사용

### 프로젝트 경로
```
/Users/starlits/ai/S14P31S107/FE/flutter
```

---

## 2. 키스토어 관리

> 키스토어는 앱의 신원을 증명하는 디지털 서명 파일입니다.
> **분실 시 앱 업데이트가 영구적으로 불가능**하므로 반드시 안전하게 백업하세요.

### 키스토어 파일 위치
```
~/retina_fit_release.jks
```

### 키스토어 설정 파일
`android/key.properties` — 아래 내용으로 구성됨 (git에 포함되지 않음)
```properties
storePassword=<비밀번호>
keyPassword=<비밀번호>
keyAlias=retina_fit
storeFile=/Users/starlits/retina_fit_release.jks
```

### 키스토어 백업 방법
```bash
# 안전한 외부 저장소(USB, 클라우드 암호화 폴더 등)에 복사
cp ~/retina_fit_release.jks <백업경로>/retina_fit_release.jks
```

### 키스토어 유효성 확인
```bash
keytool -list -keystore ~/retina_fit_release.jks -storepass <비밀번호>
```

> ⚠️ `key.properties` 파일은 절대 git에 커밋하지 마세요. `.gitignore`에 이미 등록되어 있습니다.

---

## 3. 버전 관리

### 버전 정보 위치
`pubspec.yaml` 파일의 `version` 항목

```yaml
version: 1.0.0+2
#        ^^^^^  ↑
#        |      내부 버전 코드 (versionCode) — Play Store 업로드마다 반드시 증가
#        버전 이름 (versionName) — 사용자에게 표시
```

### 버전 코드 규칙
- 업로드할 때마다 **반드시 이전 값보다 큰 숫자**로 변경해야 함
- 같은 버전 코드로 재업로드 불가

### 버전 변경 예시
| 상황 | 변경 예시 |
|------|----------|
| 최초 배포 | `1.0.0+1` |
| 버그 수정 | `1.0.1+2` |
| 기능 추가 | `1.1.0+3` |
| 대규모 업데이트 | `2.0.0+4` |

---

## 4. 앱 빌드

### 빌드 전 체크
```bash
# 프로젝트 디렉토리로 이동
cd /Users/starlits/ai/S14P31S107/FE/flutter

# 의존성 최신화
flutter pub get
```

### AAB 빌드 (Play Store 배포용 — 권장)
```bash
flutter build appbundle --release
```
- 결과물: `build/app/outputs/bundle/release/app-release.aab`
- Play Store 신규 앱은 AAB 형식 필수

### APK 빌드 (직접 설치용)
```bash
flutter build apk --release
```
- 결과물: `build/app/outputs/flutter-apk/app-release.apk`
- 기기에 직접 설치하거나 사내 배포 시 사용

### 빌드 초기화 (오류 발생 시)
```bash
flutter clean && flutter pub get && flutter build appbundle --release
```

---

## 5. 개인정보처리방침 준비

> 카메라 권한(`android.permission.CAMERA`)을 사용하므로 **필수** 항목입니다.
> 공개 접근 가능한 URL이 있어야 합니다.

### 빠르게 만들기
아래 사이트에서 앱 정보를 입력하면 자동 생성:
- https://app-privacy-policy-generator.nisrulz.com

### 필수 포함 내용
- [ ] 카메라 사용 목적
- [ ] 수집 데이터의 저장·전송 여부
- [ ] 제3자 공유 여부
- [ ] 데이터 보관 기간
- [ ] 문의 연락처 (이메일)

### 호스팅 방법 (무료)
- **GitHub Pages**: GitHub 저장소에 HTML 파일 업로드 후 Pages 활성화
- **Google Sites**: sites.google.com에서 페이지 생성
- **Notion**: 페이지 공개 후 링크 사용

---

## 6. Google Play Console 업로드

### 6-1. 앱 등록 (최초 1회)

1. https://play.google.com/console 접속
2. **앱 만들기** 클릭
3. 아래 정보 입력:
   - 앱 이름: `RetinaFit`
   - 기본 언어: `한국어`
   - 앱 또는 게임: `앱`
   - 유료 또는 무료: 선택
4. **앱 만들기** 완료

### 6-2. 앱 콘텐츠 설정

왼쪽 메뉴 → **정책** → **앱 콘텐츠** 에서 아래 항목 순서대로 완료:

| 항목 | 내용 |
|------|------|
| 개인정보처리방침 | 준비한 URL 입력 |
| 광고 | 광고 없음 선택 (해당 시) |
| 앱 액세스 권한 | 카메라 권한 설명 입력 |
| 콘텐츠 등급 | 설문 완료 후 등급 받기 |
| 타겟층 | 연령대 선택 |
| 뉴스 앱 여부 | 아니요 선택 (해당 시) |
| COVID-19 | 해당 없음 선택 (해당 시) |

### 6-3. 스토어 등록 정보 입력

왼쪽 메뉴 → **스토어 존재 여부** → **기본 스토어 등록 정보**

- [ ] 앱 이름: `RetinaFit`
- [ ] 간단한 설명 (80자 이내)
- [ ] 자세한 설명 (4000자 이내)
- [ ] 앱 아이콘 (512×512 PNG)
- [ ] 그래픽 이미지 (1024×500 PNG)
- [ ] 스크린샷 (최소 2장, 폰/태블릿)

### 6-4. AAB 파일 업로드

1. 왼쪽 메뉴 → **출시** → **프로덕션**
2. **새 버전 만들기** 클릭
3. **App Bundle 추가** → `app-release.aab` 파일 선택
4. 출시 노트 입력 (예: `최초 출시`)
5. **저장** → **검토** → **출시 시작**

---

## 7. 심사 및 출시

### 심사 소요 시간
- 최초 심사: 보통 **1~3일** (길면 7일)
- 업데이트 심사: 보통 **수 시간 ~ 1일**

### 심사 결과 확인
- Play Console 대시보드에서 상태 확인
- 등록한 이메일로 결과 알림 수신

### 심사 거절 시 주요 원인
- 개인정보처리방침 URL 누락 또는 접근 불가
- 스크린샷 품질 미달
- 앱 콘텐츠 등급 미완료
- 권한 사용 목적 설명 부족

---

## 8. 업데이트 배포

### 업데이트 배포 순서

```bash
# 1. pubspec.yaml 버전 코드 증가
# version: 1.0.0+2 → 1.0.1+3 (예시)

# 2. AAB 빌드
flutter build appbundle --release

# 3. Play Console → 프로덕션 → 새 버전 만들기 → AAB 업로드
```

### 단계별 출시 (권장)
리스크를 줄이기 위해 전체 사용자에게 한 번에 배포하지 않고 단계적으로 출시:
- **내부 테스트** → **비공개 테스트** → **공개 테스트** → **프로덕션 (단계적 출시 10% → 50% → 100%)**

---

## 9. 주의사항 및 체크리스트

### 배포 전 최종 체크리스트

**키스토어**
- [ ] `~/retina_fit_release.jks` 파일 존재 확인
- [ ] `android/key.properties` 파일 존재 확인
- [ ] 키스토어 백업 완료

**버전**
- [ ] `pubspec.yaml`의 버전 코드가 이전 배포보다 높은지 확인

**빌드**
- [ ] `flutter build appbundle --release` 성공 확인
- [ ] `app-release.aab` 파일 생성 확인

**Play Console**
- [ ] 개인정보처리방침 URL 등록 완료
- [ ] 앱 콘텐츠 항목 전체 완료 (초록색 체크)
- [ ] 스토어 등록 정보 완료

### 절대 하지 말 것
- `key.properties` 파일을 git에 커밋
- `retina_fit_release.jks` 파일을 git에 커밋
- 키스토어 비밀번호를 코드에 하드코딩
- 버전 코드를 낮추거나 동일하게 유지한 채 업로드

---

**최종 수정:** 2026-05-08
