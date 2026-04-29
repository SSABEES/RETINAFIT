# ── 1단계: Svelte 빌드 ──────────────────
FROM node:20-slim AS svelte-build

WORKDIR /svelte

COPY svelte/package*.json ./
RUN npm ci

COPY svelte/ .
RUN npm run build -- --mode prod
# .env.prod 파일 읽음
# svelte/dist/ 생성

# ── 2단계: Nginx 서빙 ────────────────────
FROM nginx:alpine

COPY --from=svelte-build /svelte/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]