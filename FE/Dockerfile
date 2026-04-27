# ── 1단계: Svelte 빌드 ──────────────────
FROM node:20-slim AS svelte-build

WORKDIR /svelte

COPY svelte/package*.json ./
RUN npm ci

COPY svelte/ .
RUN npm run build
# svelte/dist/ 생성


# ── 2단계: Flutter 웹 빌드 ──────────────
FROM ghcr.io/cirruslabs/flutter:stable AS flutter-build

WORKDIR /flutter

COPY flutter/ .

# Svelte 빌드 결과물을 Flutter web 폴더로 복사
COPY --from=svelte-build /svelte/dist/ ./web/svelte/

RUN flutter pub get
RUN flutter build web --release
# flutter/build/web/ 생성


# ── 3단계: Nginx 서빙 ────────────────────
FROM nginx:alpine

COPY --from=flutter-build /flutter/build/web/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]