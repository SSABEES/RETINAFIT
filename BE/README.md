# Backend - RETINA FIT

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| Language | Python | 3.12+ |
| Framework | FastAPI | 0.136.0 |
| ORM | SQLAlchemy (비동기) | 2.0.49 |
| DB Driver | aiomysql | 0.3.2 |
| Database | MySQL | - |
| Storage | AWS S3 | - |
| 인증 | python-jose (JWT) | 3.5.0 |
| HTTP 클라이언트 | httpx | 0.28.1 |
| ASGI 서버 | uvicorn | 0.46.0 |
| 패키지 매니저 | uv | 0.10.4 |

---

## 로컬 개발환경 세팅

### Prerequisites
- Python 3.12+
- Docker & Docker Compose
- uv

### 설치 및 실행

```bash
# 1. 의존성 설치
uv sync

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local 값 채우기

# 3. Docker 실행 (MySQL)
docker-compose -f docker-compose.local.yml up -d

# 4. DB 초기화 (최초 1회)
python -m app.init_db

# 5. 서버 실행
uv run uvicorn app.main:app --reload
```

---

## 환경변수

`.env.example` 참고

---

## 폴더 구조

```
BE/
├── .env.local
├── app/
│   ├── api/router.py
│   ├── common/
│   │   ├── error_codes.py
│   │   ├── exceptions.py
│   │   ├── handlers.py
│   │   └── s3_utils.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── main.py
│   └── modules/
│       ├── auth/
│       ├── files/
│       ├── fitting/
│       ├── glasses/
│       ├── recommendations/
│       └── visit/
├── app/sql/init.sql
└── app/init_db.py
```

---

## API 문서

- 로컬: http://localhost:8000/docs
- 배포 환경에서는 Swagger 비활성화 (보안)

---

## 인프라

> TODO: 인프라 담당자 작성