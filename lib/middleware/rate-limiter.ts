import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/redis'
import { getTenantFromRequest } from './tenant-context'

// 테넌트별 Rate Limiting 설정
interface RateLimitConfig {
  windowMs: number // 시간 윈도우 (밀리초)
  maxRequests: number // 최대 요청 수
  skipSuccessfulRequests?: boolean // 성공한 요청은 카운트하지 않음
  skipFailedRequests?: boolean // 실패한 요청은 카운트하지 않음
  keyGenerator?: (req: NextRequest) => string // 커스텀 키 생성
}

// 기본 Rate Limit 설정 (테넌트별)
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // API 전체 제한
  api: {
    windowMs: 15 * 60 * 1000, // 15분
    maxRequests: 1000, // 15분에 1000개 요청
  },

  // 업체 관리 API
  companies: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 60, // 1분에 60개 요청
  },

  // 담당자 관리 API
  contacts: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 60, // 1분에 60개 요청
  },

  // 알림 발송 API
  notifications: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 30, // 1분에 30개 요청
  },

  // 대시보드/통계 API
  dashboard: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 120, // 1분에 120개 요청
  },

  // 인증 API
  auth: {
    windowMs: 15 * 60 * 1000, // 15분
    maxRequests: 10, // 15분에 10개 요청 (보안)
  },

  // 결제/구독 API
  billing: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 10, // 1분에 10개 요청
  },
}

// 플랜별 Rate Limit 배수
const PLAN_MULTIPLIERS: Record<string, number> = {
  FREE_TRIAL: 0.5, // 기본의 50%
  STARTER: 1, // 기본 100%
  PROFESSIONAL: 2, // 기본의 200%
  BUSINESS: 5, // 기본의 500%
  ENTERPRISE: 10, // 기본의 1000%
}

// 테넌트별 Rate Limiter 미들웨어
export function createTenantRateLimiter(
  rateLimitType: keyof typeof DEFAULT_RATE_LIMITS,
  customConfig?: Partial<RateLimitConfig>
) {
  return async (req: NextRequest) => {
    try {
      // 테넌트 정보 추출
      const tenantInfo = await getTenantFromRequest(req)
      if (!tenantInfo) {
        // 테넌트 정보가 없으면 IP 기반 제한
        return await ipBasedRateLimit(req, rateLimitType, customConfig)
      }

      const { tenantId, subscriptionPlan } = tenantInfo

      // Rate Limit 설정 가져오기
      const baseConfig = { ...DEFAULT_RATE_LIMITS[rateLimitType], ...customConfig }
      const planMultiplier = PLAN_MULTIPLIERS[subscriptionPlan] || 1

      // 플랜에 따른 제한 조정
      const adjustedLimit = Math.floor(baseConfig.maxRequests * planMultiplier)

      // Rate Limit 키 생성
      const rateLimitKey = customConfig?.keyGenerator
        ? customConfig.keyGenerator(req)
        : `tenant:${tenantId}:${rateLimitType}`

      // Rate Limit 확인
      const result = await rateLimit.check(rateLimitKey, adjustedLimit, baseConfig.windowMs)

      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: 'RATE_LIMIT_EXCEEDED',
            message: `테넌트별 요청 제한을 초과했습니다. ${Math.ceil(baseConfig.windowMs / 1000)}초 후 다시 시도해주세요.`,
            retryAfter: Math.ceil((result.resetTime.getTime() - Date.now()) / 1000),
            limit: adjustedLimit,
            remaining: result.remaining,
            resetTime: result.resetTime.toISOString(),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': adjustedLimit.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetTime.toISOString(),
              'Retry-After': Math.ceil((result.resetTime.getTime() - Date.now()) / 1000).toString(),
            },
          }
        )
      }

      // 성공한 경우 헤더에 Rate Limit 정보 추가
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', adjustedLimit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.resetTime.toISOString())

      return response
    } catch (error) {
      console.error('Rate Limiter 오류:', error)
      // 오류 발생 시 요청 허용 (fail-open)
      return NextResponse.next()
    }
  }
}

// IP 기반 Rate Limiting (테넌트 정보가 없는 경우)
async function ipBasedRateLimit(
  req: NextRequest,
  rateLimitType: keyof typeof DEFAULT_RATE_LIMITS,
  customConfig?: Partial<RateLimitConfig>
) {
  const clientIP = getClientIP(req)
  const config = { ...DEFAULT_RATE_LIMITS[rateLimitType], ...customConfig }

  const rateLimitKey = `ip:${clientIP}:${rateLimitType}`

  const result = await rateLimit.check(
    rateLimitKey,
    Math.floor(config.maxRequests * 0.1), // IP 기반은 더 엄격하게 (10%)
    config.windowMs
  )

  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `요청 제한을 초과했습니다. ${Math.ceil(config.windowMs / 1000)}초 후 다시 시도해주세요.`,
        retryAfter: Math.ceil((result.resetTime.getTime() - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((result.resetTime.getTime() - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return NextResponse.next()
}

// 클라이언트 IP 추출
function getClientIP(req: NextRequest): string {
  // 프록시를 통한 실제 IP 확인
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const cfIP = req.headers.get('cf-connecting-ip')

  if (cfIP) return cfIP
  if (realIP) return realIP
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return req.ip || '127.0.0.1'
}

// 특정 경로에 대한 Rate Limit 적용
export function withTenantRateLimit(
  rateLimitType: keyof typeof DEFAULT_RATE_LIMITS,
  customConfig?: Partial<RateLimitConfig>
) {
  return createTenantRateLimiter(rateLimitType, customConfig)
}

// 동적 Rate Limit (사용량 기반)
export async function checkDynamicRateLimit(
  tenantId: string,
  action: 'email' | 'notification' | 'api',
  currentUsage: number,
  monthlyLimit: number
) {
  const usageRatio = currentUsage / monthlyLimit

  // 사용량이 높을수록 Rate Limit 강화
  let rateLimitMultiplier = 1

  if (usageRatio > 0.9) {
    // 90% 초과시 Rate Limit 50% 감소
    rateLimitMultiplier = 0.5
  } else if (usageRatio > 0.8) {
    // 80% 초과시 Rate Limit 25% 감소
    rateLimitMultiplier = 0.75
  } else if (usageRatio > 0.7) {
    // 70% 초과시 Rate Limit 10% 감소
    rateLimitMultiplier = 0.9
  }

  return rateLimitMultiplier
}

// Rate Limit 상태 조회
export async function getRateLimitStatus(
  tenantId: string,
  rateLimitType: keyof typeof DEFAULT_RATE_LIMITS
) {
  const rateLimitKey = `tenant:${tenantId}:${rateLimitType}`
  const config = DEFAULT_RATE_LIMITS[rateLimitType]

  return await rateLimit.check(rateLimitKey, config.maxRequests, config.windowMs)
}

// 테넌트 Rate Limit 리셋 (관리자용)
export async function resetTenantRateLimit(
  tenantId: string,
  rateLimitType?: keyof typeof DEFAULT_RATE_LIMITS
) {
  const { cache } = await import('@/lib/redis')

  if (rateLimitType) {
    await cache.deletePattern(`rate_limit:tenant:${tenantId}:${rateLimitType}:*`)
  } else {
    await cache.deletePattern(`rate_limit:tenant:${tenantId}:*`)
  }
}

export default createTenantRateLimiter
