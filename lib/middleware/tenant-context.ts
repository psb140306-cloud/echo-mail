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

      logger.debug('Falling back to default tenant for Vercel domain', { host, subdomain })
      return {
        id: DEFAULT_TENANT_ID,
        name: DEFAULT_TENANT_NAME,
        subdomain: subdomain || DEFAULT_TENANT_SUBDOMAIN,
        subscriptionPlan: DEFAULT_TENANT_PLAN,
      }
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
      return {
        id: 'dev-tenant-id',
        name: 'Development Tenant',
        subdomain: 'dev',
        subscriptionPlan: 'PROFESSIONAL',
      }
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
 */
export async function withTenantContext<T>(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<T>
): Promise<T> {
  const tenantContext = TenantContext.getInstance()

  try {
    // 테넌트 식별
    const tenant = await identifyTenant(request)

    if (tenant) {
      // 테넌트 컨텍스트 설정
      tenantContext.setTenant(tenant.id)
      logger.debug('Tenant context set', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
      })
    } else {
      // Super Admin이나 공용 API의 경우 컨텍스트 클리어
      tenantContext.clear()
      logger.debug('Tenant context cleared - no tenant identified')
    }

    // 핸들러 실행
    return await handler(request)
  } catch (error) {
    logger.error('Tenant context middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  } finally {
    // 요청 처리 후 컨텍스트 정리
    tenantContext.clear()
  }
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
