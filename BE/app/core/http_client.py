import httpx

# 앱 전체에서 공유하는 HTTP 클라이언트 (싱글톤)
http_client = httpx.AsyncClient()