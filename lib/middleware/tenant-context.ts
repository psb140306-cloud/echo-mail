import { NextRequest, NextResponse } from 'next/server'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db'

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'dev-tenant-id'
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? 'Development Tenant'
const DEFAULT_TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? 'dev'
const DEFAULT_TENANT_PLAN = process.env.DEFAULT_TENANT_PLAN ?? 'PROFESSIONAL'

export interface TenantInfo {
  id: string
  name: string
  subdomain: string
  customDomain?: string
  subscriptionPlan: string
}

export interface TenantFromRequest {
  tenantId: string
  tenant: any
  subscriptionPlan: string
}

/**
 * 요청에서 테넌트를 식별하는 함수
 * 1. 커스텀 도메인으로 매핑
 * 2. 서브도메인으로 식별 (tenant.echomail.co.kr)
 * 3. API 키/토큰에서 테넌트 정보 추출
 */
export async function identifyTenant(request: NextRequest): Promise<TenantInfo | null> {
  const host = request.headers.get('host')
  const url = new URL(request.url)

  if (!host) {
    return null
  }

  try {
    // 0. Vercel 기본/프리뷰 도메인 처리
    if (host.endsWith('.vercel.app')) {
      const subdomain = host.replace('.vercel.app', '')

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ subdomain }, { customDomain: host }],
        },
      })

      if (tenant) {
        logger.debug('Vercel domain tenant found', { host, tenantId: tenant.id })
        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain || undefined,
          subscriptionPlan: tenant.subscriptionPlan,
        }
      }

      // Vercel에서 테넌트를 찾지 못한 경우 null 반환
      // 사용자 세션의 tenantId를 사용하도록 함
      logger.debug('No tenant found for Vercel domain - will use user session', { host, subdomain })
      return null
    }

    // 1. 커스텀 도메인 체크
    if (!host.includes('echomail.co.kr') && !host.includes('localhost')) {
      // 커스텀 도메인으로 테넌트 조회
      const tenant = await prisma.tenant.findFirst({
        where: { customDomain: host },
      })

      if (tenant) {
        logger.debug('Custom domain tenant found', { host, tenantId: tenant.id })
        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain || undefined,
          subscriptionPlan: tenant.subscriptionPlan,
        }
      }
    }

    // 2. 서브도메인 추출
    const subdomain = extractSubdomain(host)
    if (subdomain) {
      // 서브도메인으로 테넌트 조회
      const tenant = await prisma.tenant.findFirst({
        where: { subdomain },
      })

      if (tenant) {
        logger.debug('Subdomain tenant found', { subdomain, tenantId: tenant.id })
        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain || undefined,
          subscriptionPlan: tenant.subscriptionPlan,
        }
      }

      // 개발 환경에서 기본 테넌트
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Development tenant detected', { subdomain })
        return {
          id: 'dev-tenant-id',
          name: `${subdomain} Company`,
          subdomain,
          subscriptionPlan: 'PROFESSIONAL',
        }
      }
    }

    // 3. API 키에서 테넌트 정보 추출
    const apiKey = request.headers.get('x-api-key')
    if (apiKey) {
      // API 키로 테넌트 조회
      // TODO: 실제 API 키 검증 및 테넌트 조회 구현
      logger.debug('API key detected', { apiKey: apiKey.substring(0, 8) + '...' })
      return null // 임시로 null 반환
    }

    // 4. 개발 환경에서 기본 테넌트
    if (
      process.env.NODE_ENV === 'development' &&
      (host.includes('localhost') || host.includes('127.0.0.1'))
    ) {
      // 로컬 개발에서도 사용자 세션의 tenantId 사용
      logger.debug('Localhost - will use user session tenant', { host })
      return null
    }

    logger.debug('No tenant identified', { host, url: url.pathname })
    return null
  } catch (error) {
    logger.error('Tenant identification failed', {
      host,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}

/**
 * 요청에서 테넌트 정보 추출 (Rate Limiter용)
 */
export async function getTenantFromRequest(
  request: NextRequest
): Promise<TenantFromRequest | null> {
  try {
    const tenantInfo = await identifyTenant(request)
    if (!tenantInfo) {
      return null
    }

    return {
      tenantId: tenantInfo.id,
      tenant: tenantInfo,
      subscriptionPlan: tenantInfo.subscriptionPlan,
    }
  } catch (error) {
    logger.error('Get tenant from request failed', { error })
    return null
  }
}

/**
 * 호스트에서 서브도메인 추출
 */
function extractSubdomain(host: string): string | null {
  try {
    // localhost 처리
    if (host.includes('localhost')) {
      return null
    }

    // echomail.co.kr 도메인에서 서브도메인 추출
    if (host.endsWith('.echomail.co.kr')) {
      const subdomain = host.replace('.echomail.co.kr', '')
      return subdomain.includes('.') ? null : subdomain
    }

    // vercel.app 기본/프리뷰 도메인 처리
    if (host.endsWith('.vercel.app')) {
      const subdomain = host.replace('.vercel.app', '')
      if (!subdomain) {
        return null
      }
      const [firstSegment] = subdomain.split('.')
      return firstSegment || null
    }

    return null
  } catch (error) {
    logger.error('Subdomain extraction failed', { host, error })
    return null
  }
}

/**
 * API 라우트용 테넌트 컨텍스트 미들웨어
 * ⚠️ SECURITY: 반드시 사용자의 멤버십을 검증하여 크로스 테넌트 접근 방지
 */
export async function withTenantContext<T>(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<T>
): Promise<T> {
  const tenantContext = TenantContext.getInstance()

  try {
    // 1. Supabase Auth 세션 먼저 확인
    let authUser: any = null
    let userTenantId: string | null = null

    try {
      const { createServerClient } = await import('@supabase/ssr')
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set() {},
            remove() {},
          },
        }
      )

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (user) {
        authUser = user

        // 사용자의 멤버십에서 tenantId 가져오기
        const membership = await prisma.tenantMember.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
          },
          include: {
            tenant: true,
          },
        })

        if (membership) {
          userTenantId = membership.tenantId
          logger.debug('User membership found', {
            userId: user.id,
            tenantId: userTenantId,
            role: membership.role,
          })
        }
      }
    } catch (error) {
      logger.error('Failed to get user session', { error })
    }

    // 2. 호스트에서 테넌트 식별
    let tenant = await identifyTenant(request)

    // 3. CRITICAL: 호스트에서 식별된 테넌트와 사용자 멤버십 일치 검증
    if (tenant && authUser && userTenantId) {
      if (tenant.id !== userTenantId) {
        logger.error('🚨 SECURITY: Tenant mismatch detected!', {
          hostTenantId: tenant.id,
          userTenantId,
          userId: authUser.id,
          host: request.headers.get('host'),
        })

        // 멤버십 없는 테넌트 접근 시도 차단
        throw new Error('Unauthorized: You are not a member of this tenant')
      }
    }

    // 4. 도메인에서 tenant를 찾지 못했지만 사용자에게 멤버십이 있는 경우
    if (!tenant && userTenantId && authUser) {
      // 멤버십에서 테넌트 조회
      const membership = await prisma.tenantMember.findFirst({
        where: {
          userId: authUser.id,
          tenantId: userTenantId,
          status: 'ACTIVE',
        },
        include: {
          tenant: true,
        },
      })

      if (membership?.tenant) {
        tenant = {
          id: membership.tenant.id,
          name: membership.tenant.name,
          subdomain: membership.tenant.subdomain,
          customDomain: membership.tenant.customDomain || undefined,
          subscriptionPlan: membership.tenant.subscriptionPlan,
        }
        logger.info('✅ Tenant found from user membership', {
          userId: authUser.id,
          tenantId: tenant.id,
        })
      }
    }

    if (tenant) {
      // AsyncLocalStorage를 사용하여 요청별 격리된 컨텍스트에서 실행
      return tenantContext.run(tenant.id, authUser?.id, async () => {
        logger.debug('Tenant context set in AsyncLocalStorage', {
          tenantId: tenant.id,
          tenantName: tenant.name,
          userId: authUser?.id,
        })
        return await handler(request)
      })
    } else {
      // 인증되지 않은 요청이거나 Super Admin API
      logger.debug('No tenant context - unauthenticated or super admin')
      return await handler(request)
    }
  } catch (error) {
    logger.error('Tenant context middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
  // ⚠️ AsyncLocalStorage 사용으로 finally 블록 제거
  // 컨텍스트는 자동으로 정리됨
}

/**
 * 테넌트별 사용량 체크 미들웨어
 */
export async function checkTenantUsageLimit(
  tenantId: string,
  resource: 'companies' | 'contacts' | 'emails' | 'notifications'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    })

    if (!tenant) {
      return { allowed: false, current: 0, limit: 0 }
    }

    // 리소스별 현재 사용량 조회
    let current = 0
    let limit = 0

    switch (resource) {
      case 'companies':
        current = await prisma.company.count({ where: { tenantId } })
        limit = tenant.maxCompanies
        break
      case 'contacts':
        current = await prisma.contact.count({ where: { tenantId } })
        limit = tenant.maxContacts
        break
      case 'emails':
        // 이번 달 이메일 처리 수
        const thisMonth = new Date()
        thisMonth.setDate(1)
        thisMonth.setHours(0, 0, 0, 0)

        current = await prisma.emailLog.count({
          where: {
            tenantId,
            createdAt: { gte: thisMonth },
          },
        })
        limit = tenant.maxEmails
        break
      case 'notifications':
        // 이번 달 알림 발송 수
        const currentMonth = new Date()
        currentMonth.setDate(1)
        currentMonth.setHours(0, 0, 0, 0)

        current = await prisma.notificationLog.count({
          where: {
            tenantId,
            createdAt: { gte: currentMonth },
          },
        })
        limit = tenant.maxNotifications
        break
    }

    return {
      allowed: current < limit,
      current,
      limit,
    }
  } catch (error) {
    logger.error('Usage limit check failed', { tenantId, resource, error })
    return { allowed: false, current: 0, limit: 0 }
  }
}

/**
 * 테넌트 권한 체크 헬퍼 함수
 */
export function requireTenant(): string {
  const tenantContext = TenantContext.getInstance()
  const tenantId = tenantContext.getTenantId()

  if (!tenantId) {
    throw new Error('Tenant context required')
  }

  return tenantId
}

/**
 * Super Admin 권한 체크
 */
export function isSuperAdmin(): boolean {
  const tenantContext = TenantContext.getInstance()
  return tenantContext.getTenantId() === null
}
