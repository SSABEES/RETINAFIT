# RETINA FIT 포팅 매뉴얼

> AR 기반 안경 피팅 서비스 — 배포 및 환경 구축 가이드

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [사전 준비사항](#4-사전-준비사항)
5. [환경 변수 설정](#5-환경-변수-설정)
6. [로컬 개발 환경 구축](#6-로컬-개발-환경-구축)
7. [운영 서버 배포](#7-운영-서버-배포)
8. [CI/CD 파이프라인 (Jenkins)](#8-cicd-파이프라인-jenkins)
9. [데이터베이스 초기화](#9-데이터베이스-초기화)
10. [Nginx 설정](#10-nginx-설정)
11. [Systemd 서비스 설정](#11-systemd-서비스-설정)
12. [Flutter 앱 빌드](#12-flutter-앱-빌드)
13. [AWS 인프라 설정](#13-aws-인프라-설정)
14. [배포 체크리스트](#14-배포-체크리스트)
15. [트러블슈팅](#15-트러블슈팅)

---

## 1. 프로젝트 개요

RETINA FIT은 안경점 전용 실시간 AR 안경 피팅 서비스입니다. 웹 브라우저에서 고객의 얼굴을 분석하고, AR 가상 피팅, AI 상담 스크립트 생성, 대시보드 관리 기능을 제공합니다.


### 주요 기능

- 얼굴 3단계 촬영 (정면, 좌측, 우측) 및 자동 랜드마크 분석
- ONNX Runtime Web (6DRepNet360) 기반 브라우저 내 AI 추론
- MediaPipe 얼굴 인식 실시간 처리
- Flutter WebView + JS 브리지를 통한 네이티브 AR 가상 피팅
- Gemini LLM 기반 AI 상담 스크립트 생성
- 고객/방문/매출 관리 대시보드

---

## 2. 기술 스택

### Frontend (FE/svelte)

| 항목 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Svelte | 5.55.1 |
| 빌드 도구 | Vite | 8.0.4 |
| 스타일링 | Tailwind CSS | 4.2.2 |
| 라우터 | @maks11060/svelte5-router | 3.2.0 |
| 얼굴 인식 | @mediapipe/tasks-vision | 0.10.34 |
| AI 추론 | onnxruntime-web | 1.25.1 |
| 3D 렌더링 | three.js | 0.184.0 |
| 차트 | chart.js | 4.5.1 |

### Android 앱 (FE/flutter)

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Dart | 3.11.4 |
| 프레임워크 | Flutter | - |
| WebView | flutter_inappwebview | 6.1.5 |
| 권한 관리 | permission_handler | 11.3.1 |

### Backend (BE)

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.12+ |
| 프레임워크 | FastAPI | 0.115.0 |
| ORM | SQLAlchemy (async) | 2.0.0 |
| DB 드라이버 | aiomysql | 0.3.2 |
| 데이터베이스 | MySQL | 8.0 |
| 인증 | python-jose (JWT) | 3.3.0 |
| 파일 스토리지 | AWS S3 (boto3) | 1.42.96 |
| ASGI 서버 | uvicorn | 0.30.0 |
| 패키지 관리 | uv | latest |

### AI 서버 (AI)

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.12+ |
| 프레임워크 | FastAPI | 0.115.0 |
| LLM | Google Gemini 2.5 Flash Lite | - |
| HTTP 클라이언트 | httpx | 0.27.0 |
| 패키지 관리 | uv | latest |

### 인프라

| 항목 | 기술 |
|------|------|
| 서버 OS | Ubuntu |
| 웹 서버 | Nginx |
| 프로세스 관리 | systemd |
| CI/CD | Jenkins |
| 컨테이너 | Docker (개발환경 DB용) |
| 파일 스토리지 | AWS S3 |
| CDN | AWS CloudFront |

---

## 3. 시스템 아키텍처

```
[Client Browser / Flutter App]
        │
        ▼
    [Nginx]
    ├── /              → FE 정적 파일 (/var/www/html/)
    ├── /api/          → BE (localhost:8000 또는 :8002)
    └── /ai/           → AI 서버 (localhost:8001)
        │
        ├── [BE: FastAPI]  ──────→ [MySQL 8.0]
        │       │                   DB_HOST:3306
        │       └──────────→ [External RETINA API]
        │       └──────────→ [AWS S3 + CloudFront]
        │
        └── [AI: FastAPI]  ──────→ [Google Gemini API]
```

### 디렉터리 구조

```
S14P31S107/
├── FE/
│   ├── svelte/          # Svelte 5 웹 앱
│   └── flutter/         # Android WebView 앱
├── BE/                  # FastAPI 백엔드
├── AI/                  # FastAPI AI 서버
├── Jenkinsfile          # CI/CD 파이프라인
├── docker-compose.local.yml  # 로컬 개발용
└── docker-compose.prod.yml   # 운영 참고용
```

---

## 4. 사전 준비사항

### 운영 서버 필수 소프트웨어

```bash
# Python 3.12+
python3 --version

# uv (Python 패키지 매니저)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Node.js 18+ (FE 빌드용)
node --version
npm --version

# MySQL 8.0
mysql --version

# Nginx
nginx -v

# Jenkins (CI/CD)
# Jenkins 설치는 별도 Jenkins 문서 참조
```

### 로컬 개발 필수 소프트웨어

```bash
# Docker & Docker Compose (로컬 MySQL 컨테이너용)
docker --version
docker compose version

# Python 3.12+
# Node.js 18+
# uv
```

### AWS 준비사항

- AWS S3 버킷 생성
- CloudFront 배포 설정 (S3 오리진)
- CloudFront 서명 키 쌍 생성 (RSA-2048, `.pem` 파일)
- IAM 사용자 생성 (S3 읽기/쓰기 권한)

---

## 5. 환경 변수 설정

### 5-1. Backend 환경 변수 (`BE/.env.prod`)

`BE/.env.example`을 복사하여 작성합니다.

```bash
cp BE/.env.example BE/.env.prod
```

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DB_HOST` | DB 호스트 (Docker 전체: `db`, 호스트 직접: `localhost` 또는 `host.docker.internal`) | `localhost` |
| `DB_PORT` | DB 포트 | `3306` |
| `DB_USER` | DB 사용자명 | `retina_user` |
| `DB_PASSWORD` | DB 비밀번호 | `your_password` |
| `DB_NAME` | DB 이름 | `retina_db` |
| `EXTERNAL_API_BASE_URL` | 외부 RETINA API 주소 | `https://api.example.com` |
| `AI_SERVER_URL` | AI 서버 주소 (Docker 내부: `http://ai:8001`) | `http://localhost:8001` |
| `APP_ENV` | 실행 환경 | `production` |
| `DEBUG` | 디버그 모드 | `false` |
| `ALLOWED_ORIGINS` | CORS 허용 오리진 (쉼표 구분) | `https://k14s107.p.ssafy.io` |
| `MYSQL_DATABASE` | MySQL 컨테이너 DB명 | `your_db` |
| `MYSQL_USER` | MySQL 컨테이너 사용자 | `your_user` |
| `MYSQL_PASSWORD` | MySQL 컨테이너 비밀번호 | `your_password` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 비밀번호 | `your_root_password` |
| `AWS_ACCESS_KEY_ID` | AWS 액세스 키 ID | `...` |
| `AWS_SECRET_ACCESS_KEY` | AWS 시크릿 키 | `...` |
| `AWS_REGION` | AWS 리전 | `...` |
| `S3_BUCKET_NAME` | S3 버킷명 | `your-bucket` |
| `CLOUDFRONT_DOMAIN` | CloudFront 도메인 | `d1234567890.cloudfront.net` |
| `CLOUDFRONT_KEY_ID` | CloudFront 서명 키 ID | `....` |
| `CLOUDFRONT_PRIVATE_KEY_PATH` | CloudFront RSA 개인 키 경로 | `./private_key.pem` |
| `ADMIN_ID` | 관리자 계정 ID | `admin` |
| `ADMIN_PASSWORD` | 관리자 계정 비밀번호 | `your_admin_pw` |
| `SECRET_KEY` | JWT 서명 키 (랜덤 긴 문자열) | `openssl rand -hex 32` 결과값 |

> **주의:** `CLOUDFRONT_PRIVATE_KEY_PATH`에 지정한 경로에 `.pem` 파일을 실제로 배치해야 합니다.

### 5-2. AI 서버 환경 변수 (`AI/.env.prod`)

```bash
cp AI/.env.example AI/.env.prod  # .env.example이 없으면 아래 내용으로 생성
```

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `LLM_ENABLED` | LLM 기능 활성화 여부 | `true` |
| `LLM_PROVIDER` | LLM 제공자 (`dummy` 또는 `gemini`) | `gemini` |
| `LLM_MODEL` | 사용 모델명 | `gemini-2.5-flash-lite` |
| `LLM_API_KEY` | Google AI API 키 | (필수) |
| `LLM_TEMPERATURE` | 추론 temperature | `0.7` |
| `LLM_MAX_TOKENS` | 최대 토큰 수 | `1024` |
| `PROJECT_NAME` | 서비스명 | `RETINA AI` |
| `VERSION` | API 버전 | `1.0.0` |
| `API_PREFIX` | API prefix | `/api/v1` |

### 5-3. Frontend 환경 변수 (`FE/svelte/.env.prod`)

```bash
# FE/svelte/.env.prod
VITE_API_BASE_URL=/api
```

> Nginx에서 `/api` 경로를 BE로 프록시하므로 기본값으로 두면 됩니다.  
> 운영 환경이 별도 도메인을 사용한다면 `https://api.example.com`으로 변경합니다.

---

## 6. 로컬 개발 환경 구축

### 6-1. 저장소 클론

```bash
git clone https://lab.ssafy.com/s14-final/S14P31S107.git
cd S14P31S107
git checkout develop
```

### 6-2. MySQL 컨테이너 시작 (Docker)

```bash
# BE 환경 변수 설정
cp BE/.env.example BE/.env.local
# .env.local 파일에서 DB_HOST=localhost 로 수정 및 각 값 입력

# MySQL 컨테이너 실행
docker compose -f docker-compose.local.yml up -d

# 컨테이너 상태 확인
docker compose -f docker-compose.local.yml ps
```

### 6-3. Backend 실행

```bash
cd BE

# 의존성 설치
uv sync

# DB 초기화 (최초 1회)
uv run python -m app.init_db

# 개발 서버 실행 (http://localhost:8000)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API 문서 확인
# http://localhost:8000/docs
```

### 6-4. AI 서버 실행

```bash
cd AI

# 환경 변수 설정
# AI/.env.local 파일 생성 후 변수 입력

# 의존성 설치
uv sync

# 개발 서버 실행 (http://localhost:8001)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 6-5. Frontend 실행

```bash
cd FE/svelte

# 환경 변수 설정
cp .env.example .env.local
# VITE_API_BASE_URL=http://localhost:8000 으로 수정

# 의존성 설치 (최초 및 패키지 변경 시)
npm ci

# 개발 서버 실행 (http://localhost:5173)
npm run dev
```

> **주의:** `npm run dev` 실행 시 `predev` 스크립트가 먼저 실행되어 MediaPipe, ONNX, OpenCV WASM 에셋을 `public/` 에 복사합니다. 최초 실행 시 시간이 걸릴 수 있습니다.

### 6-6. 개발 서버 포트 정리

| 서비스 | 포트 | URL |
|--------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| AI 서버 (FastAPI) | 8001 | http://localhost:8001 |
| MySQL | 3306 | localhost:3306 |

---

## 7. 운영 서버 배포

### 7-1. 수동 배포 순서

#### 환경 변수 파일 서버에 배치

Jenkins가 참조할 env 파일을 서버에 미리 배치합니다.

```bash
# 서버에서 실행
sudo mkdir -p /home/ubuntu/app/BE
sudo mkdir -p /home/ubuntu/app/FE
sudo mkdir -p /home/ubuntu/app/AI

# 각 .env.prod 파일 업로드 후
# BE용 CloudFront 개인 키도 배치
sudo cp private_key.pem /home/ubuntu/app/BE/private_key.pem
```

#### 코드 클론 및 빌드

```bash
# 코드 클론
git clone https://lab.ssafy.com/s14-final/S14P31S107.git /var/jenkins_home/workspace/retina-pipeline
cd /var/jenkins_home/workspace/retina-pipeline
git checkout develop

# env 파일 복사
cp /home/ubuntu/app/BE/.env.prod BE/.env.prod
cp /home/ubuntu/app/FE/.env.prod FE/svelte/.env.prod
cp /home/ubuntu/app/AI/.env.prod AI/.env.prod
```

#### Frontend 빌드 및 배포

```bash
cd FE/svelte
npm ci
npm run build -- --mode prod
sudo cp -r dist/* /var/www/html/
```

#### Backend 배포

```bash
cd BE
APP_ENV=production /home/ubuntu/.local/bin/uv sync
sudo systemctl restart retina-be
sudo systemctl status retina-be
```

#### AI 서버 배포

```bash
cd AI
APP_ENV=production /home/ubuntu/.local/bin/uv sync
sudo systemctl restart retina-ai
sudo systemctl status retina-ai
```

### 7-2. 운영 포트 정리

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Nginx | 80, 443 | 외부 노출, SSL 종단 |
| Backend | 8000 (또는 8002) | 내부 전용 |
| AI 서버 | 8001 | 내부 전용 |
| MySQL | 3306 | 내부 전용 |

---

## 8. CI/CD 파이프라인 (Jenkins)

### 8-1. 파이프라인 개요

`Jenkinsfile`에 정의된 5단계 파이프라인:

| 단계 | 내용 |
|------|------|
| Clone | GitLab `develop` 브랜치 체크아웃 |
| Prepare | 서버에 저장된 `.env.prod` 파일 복사 |
| Deploy FE | Svelte 빌드 → `/var/www/html/` 복사 |
| Deploy BE | uv sync → systemctl restart retina-be |
| Deploy AI | uv sync → systemctl restart retina-ai |

### 8-2. Jenkins 설정

**필수 설정 항목:**

1. **Credentials 등록**
   - ID: `gitlab-credentials`
   - 종류: Username/Password (GitLab 계정 또는 토큰)

2. **Jenkins 작업 설정**
   - Pipeline 타입
   - GitLab 웹훅 연결 (`develop` 브랜치 푸시 시 자동 트리거)
   - Pipeline script from SCM → `Jenkinsfile` 경로 지정

3. **sudo 권한 설정** (Jenkins가 실행하는 ubuntu 계정)

```bash
# /etc/sudoers.d/jenkins
jenkins ALL=(ALL) NOPASSWD: /bin/cp, /bin/systemctl, /usr/bin/systemctl
```

### 8-3. 환경 변수 경로 (Jenkinsfile 기준)

```
DEPLOY_PATH     = /home/ubuntu/app
WORKSPACE_PATH  = /var/jenkins_home/workspace/retina-pipeline
```

---

## 9. 데이터베이스 초기화

### 9-1. 스키마 생성

```bash
cd BE

# init_db.py 실행 (BE/.env.prod 또는 .env.local 읽어서 DB 연결)
uv run python -m app.init_db
```

`BE/app/sql/init.sql`이 실행되어 아래 테이블이 생성됩니다:

| 테이블 | 설명 |
|--------|------|
| `visited` | 방문 통합 테이블 (측정, 사진, 피팅, 리포트 데이터) |
| `recommend_option` | 렌즈 상담 추천 옵션 (다초점, 변색, 사무직 등) |
| `fitting_criteria` | 피팅 판단 기준 (mm 범위, BELOW/NORMAL/ABOVE) |
| `glasses` | 안경 카탈로그 (제품명, 브랜드, 이미지, 3D URL, 스펙) |

### 9-2. MySQL 계정 및 DB 생성 (운영 서버, 최초 1회)

```sql
-- MySQL 접속 후 실행
CREATE DATABASE retina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'retina_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON retina_db.* TO 'retina_user'@'%';
FLUSH PRIVILEGES;
```

### 9-3. 초기 데이터 (선택)

`recommend_option`, `fitting_criteria`, `glasses` 테이블은 관리자 페이지(`/admin/lens`, `/admin/glass`)에서 UI로 관리 가능합니다.  
초기 데이터가 필요한 경우 SQL INSERT 문으로 삽입하거나 관리자 페이지에서 직접 등록합니다.

---

## 10. Nginx 설정

Nginx 설정 파일 예시 (`/etc/nginx/sites-available/retina-fit`):

```nginx
server {
    listen 80;
    server_name k14s107.p.ssafy.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name k14s107.p.ssafy.io;

    ssl_certificate     /etc/letsencrypt/live/k14s107.p.ssafy.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/k14s107.p.ssafy.io/privkey.pem;

    # Frontend 정적 파일
    root /var/www/html;
    index index.html;

    # SPA 라우팅 (새로고침 지원)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API 프록시
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # AI 서버 프록시 (필요한 경우)
    location /ai/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Cross-Origin Isolation 헤더 (ONNX/MediaPipe SharedArrayBuffer 필수)
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
}
```

```bash
# 심볼릭 링크 생성 및 Nginx 재시작
sudo ln -s /etc/nginx/sites-available/retina-fit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> **중요:** `Cross-Origin-Embedder-Policy: require-corp` 및 `Cross-Origin-Opener-Policy: same-origin` 헤더는 ONNX Runtime Web과 MediaPipe가 `SharedArrayBuffer`를 사용하기 위한 **필수 설정**입니다.

---

## 11. Systemd 서비스 설정

### 11-1. Backend 서비스 (`retina-be`)

```ini
# /etc/systemd/system/retina-be.service
[Unit]
Description=RETINA FIT Backend (FastAPI)
After=network.target mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/jenkins_home/workspace/retina-pipeline/BE
Environment=APP_ENV=production
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 11-2. AI 서버 서비스 (`retina-ai`)

```ini
# /etc/systemd/system/retina-ai.service
[Unit]
Description=RETINA FIT AI Server (FastAPI)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/jenkins_home/workspace/retina-pipeline/AI
Environment=APP_ENV=production
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 등록 및 시작
sudo systemctl daemon-reload
sudo systemctl enable retina-be retina-ai
sudo systemctl start retina-be retina-ai

# 상태 확인
sudo systemctl status retina-be
sudo systemctl status retina-ai
```

---

## 12. Flutter 앱 빌드

### 12-1. 사전 요구사항

- Flutter SDK (Dart 3.11.4+)
- Android SDK (API 21+)
- Android Studio 또는 VS Code

### 12-2. 빌드

```bash
cd FE/flutter

# 의존성 설치
flutter pub get

# 기본 빌드 (운영 URL: https://k14s107.p.ssafy.io/)
flutter build apk --release

# 커스텀 URL 지정 (개발/스테이징)
flutter build apk --release --dart-define=WEB_APP_URL=https://your-domain.com
```

빌드 결과물: `FE/flutter/build/app/outputs/flutter-apk/app-release.apk`

### 12-3. 앱 특징

- 고정 URL(`https://k14s107.p.ssafy.io/`)의 Svelte 앱을 WebView로 래핑
- Svelte ↔ Flutter 간 JS 채널(`window.__retinafit_flutter_bridge__`)로 AR 기능 연동
- 카메라 권한 등 네이티브 권한은 Flutter에서 처리

---

## 13. AWS 인프라 설정

### 13-1. S3 버킷 설정

```bash
# 버킷 생성 (ap-northeast-2 리전)
aws s3 mb s3://your-bucket --region ap-northeast-2

# 버킷 정책 (CloudFront에서만 접근 허용)
# S3 → 버킷 정책에서 CloudFront OAC 설정
```

**사용 경로 구조:**

| 경로 | 용도 |
|------|------|
| `glasses/img/` | 안경 대표 이미지 |
| `glasses/3d/` | 안경 3D 모델 파일 |
| `visits/` | 방문별 고객 얼굴 사진 |

### 13-2. CloudFront 설정

1. S3 버킷을 오리진으로 CloudFront 배포 생성
2. **서명된 URL** 방식 사용 (임시 접근 허용)
3. 서명 키 쌍 생성:
   ```bash
   openssl genrsa -out private_key.pem 2048
   openssl rsa -in private_key.pem -pubout -out public_key.pem
   ```
4. CloudFront 콘솔 → Key groups → 공개 키 등록 → Key group 생성
5. `private_key.pem`을 서버 `BE/` 디렉터리에 배치 (`CLOUDFRONT_PRIVATE_KEY_PATH` 참조)

---

## 14. 배포 체크리스트

### 최초 서버 셋업

- [ ] Python 3.12+, uv 설치
- [ ] Node.js 18+, npm 설치
- [ ] MySQL 8.0 설치 및 DB/사용자 생성
- [ ] Nginx 설치 및 SSL 인증서 발급 (Let's Encrypt)
- [ ] `/var/www/html/` 디렉터리 생성 및 권한 설정
- [ ] `retina-be`, `retina-ai` systemd 서비스 파일 생성 및 등록
- [ ] `/home/ubuntu/app/BE/`, `/FE/`, `/AI/` 디렉터리 생성
- [ ] `.env.prod` 파일 각 디렉터리에 배치
- [ ] `private_key.pem` (CloudFront) `/home/ubuntu/app/BE/` 에 배치
- [ ] DB 스키마 초기화 (`uv run python -m app.init_db`)
- [ ] Jenkins 설치 및 GitLab Credentials 등록
- [ ] Jenkins sudo 권한 설정

### 매 배포 전

- [ ] `develop` 브랜치 최신 상태 확인
- [ ] `.env.prod` 파일 내용 최신화 여부 확인
- [ ] DB 마이그레이션 필요 여부 확인
- [ ] CloudFront `.pem` 파일 유효성 확인

### 배포 후 검증

- [ ] `GET https://[운영URL]/health` — BE 헬스 체크 응답 확인
- [ ] Svelte 앱 정상 로딩 확인
- [ ] 안경사 로그인 동작 확인
- [ ] 얼굴 촬영 및 분석 플로우 확인
- [ ] `systemctl status retina-be` — 오류 없음 확인
- [ ] `systemctl status retina-ai` — 오류 없음 확인
- [ ] Nginx 로그 확인: `sudo tail -f /var/log/nginx/error.log`

---

## 15. 트러블슈팅

### ONNX/MediaPipe SharedArrayBuffer 오류

**증상:** 브라우저 콘솔에 `SharedArrayBuffer is not defined` 또는 WASM 로드 실패  
**원인:** Cross-Origin Isolation 헤더 누락  
**해결:** Nginx 설정에 다음 헤더 추가

```nginx
add_header Cross-Origin-Embedder-Policy "require-corp" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

---

### DB 연결 실패

**증상:** BE 시작 시 `Can't connect to MySQL server`  
**확인 사항:**

```bash
# MySQL 상태 확인
sudo systemctl status mysql

# 연결 테스트
mysql -u retina_user -p -h localhost retina_db

# .env.prod 내 DB_HOST 값 확인
# Docker 내부에서 실행 시 host.docker.internal 또는 172.17.0.1
```

---

### uv sync 실패

**증상:** `uv sync` 실행 시 Python 버전 오류  
**해결:**

```bash
# Python 3.12 설치 확인
python3.12 --version

# uv에 Python 경로 지정
uv sync --python /usr/bin/python3.12
```

---

### Frontend 빌드 오류 (ONNX/MediaPipe 에셋 없음)

**증상:** `npm run build` 시 `public/onnx/` 또는 `public/mediapipe/` 경로 없음  
**원인:** `prebuild` 스크립트가 실행되지 않았거나 node_modules 에 에셋 없음  
**해결:**

```bash
cd FE/svelte
npm ci          # node_modules 재설치
npm run build -- --mode prod
```

---

### Jenkins 권한 오류

**증상:** `sudo: a terminal is required` 또는 `Permission denied`  
**해결:**

```bash
# /etc/sudoers.d/jenkins 파일 생성
echo "jenkins ALL=(ALL) NOPASSWD: /bin/cp, /bin/systemctl" | sudo tee /etc/sudoers.d/jenkins
sudo chmod 440 /etc/sudoers.d/jenkins
```

---

### AI 서버 503 응답

**증상:** AI 리포트 생성 시 503 에러  
**원인:** `LLM_ENABLED=False` 이거나 Gemini API 키 미설정  
**해결:**

```bash
# AI/.env.prod 확인
LLM_ENABLED=true
LLM_PROVIDER=gemini
LLM_API_KEY=your_google_api_key
```

---

### CloudFront 서명 URL 오류

**증상:** S3 이미지/3D 파일 로드 실패, 403 Forbidden  
**확인 사항:**

- `CLOUDFRONT_PRIVATE_KEY_PATH` 경로에 `.pem` 파일 존재 여부
- `CLOUDFRONT_KEY_ID` 가 CloudFront 콘솔의 Key ID와 일치 여부
- CloudFront 배포에서 해당 Key group이 활성화되어 있는지 확인

---

*최종 수정: 2026-05-24*
