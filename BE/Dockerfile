FROM python:3.12-slim

# uv 공식 이미지에서 바이너리 복사 (pip 불필요 & 더 가볍고 빠름)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 패키지 먼저 설치 (캐싱 최적화 / uv.lock 파일을 그대로 사용함으로써 버전 고정)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# 소스코드 복사
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
