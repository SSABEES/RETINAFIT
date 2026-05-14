import { apiRequest } from '@/lib/api/client'

/**
 * 서버 헬스 체크. BE /health 응답 예시:
 * {
 *   status: 'ok',
 *   env: 'development',
 *   uptime_seconds: 123,
 *   checks: {
 *     database: 'ok' | 'error: ...',
 *     s3: 'ok' | 'error: ...',
 *     cloudfront: { enabled: boolean, domain: string | null }
 *   }
 * }
 * 인증 헤더 불필요 — 누구나 호출 가능한 상태 점검 엔드포인트.
 */
export const get_health = () => {
  return apiRequest('/health')
}
