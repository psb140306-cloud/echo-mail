import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/utils/logger'

// 테넌트 컨텍스트 저장소
export class TenantContext {
  private static instance: TenantContext
  private tenantId: string | null = null
  private userId: string | null = null

  private constructor() {}

  static getInstance(): TenantContext {
    if (!TenantContext.instance) {
      TenantContext.instance = new TenantContext()
    }
    return TenantContext.instance
  }

  setTenant(tenantId: string, userId?: string): void {
    this.tenantId = tenantId
    this.userId = userId || null
    logger.debug('Tenant context set', { tenantId, userId })
  }

  getTenantId(): string | null {
    return this.tenantId
  }

  getUserId(): string | null {
    return this.userId
  }

  clear(): void {
    this.tenantId = null
    this.userId = null
    logger.debug('Tenant context cleared')
  }
}

// 멀티테넌트 지원 모델 목록
const TENANT_MODELS = [
  'company',
  'contact',
  'deliveryRule',
  'holiday',
  'emailLog',
  'notificationLog',
  'systemConfig',
  'messageTemplate',
  'subscription',
] as const

// Super Admin 모델 (테넌트 격리 없음)
const SUPER_ADMIN_MODELS = ['tenant', 'user', 'account', 'session', 'verificationToken'] as const

/**
 * Prisma 멀티테넌트 미들웨어
 * 모든 쿼리에 자동으로 tenantId 필터를 추가
 */
export function createTenantMiddleware(prisma: PrismaClient) {
  return prisma.$use(async (params, next) => {
    const tenantContext = TenantContext.getInstance()
    const currentTenantId = tenantContext.getTenantId()

    // Super Admin 모델은 테넌트 필터링 없음
    if (SUPER_ADMIN_MODELS.includes(params.model as any)) {
      return next(params)
    }

    // 테넌트 모델인지 확인
    if (TENANT_MODELS.includes(params.model as any)) {
      // 테넌트 컨텍스트가 설정되지 않은 경우 에러
      if (!currentTenantId) {
        logger.error('Tenant context not set for tenant model', {
          model: params.model,
          action: params.action,
        })
        throw new Error(`Tenant context required for ${params.model} operations`)
      }

      // 쿼리에 tenantId 필터 자동 추가
      switch (params.action) {
        case 'findFirst':
        case 'findFirstOrThrow':
        case 'findUnique':
        case 'findUniqueOrThrow':
        case 'findMany':
        case 'count':
        case 'aggregate':
        case 'groupBy':
          params.args.where = {
            ...params.args.where,
            tenantId: currentTenantId,
          }
          break

        case 'create':
          params.args.data = {
            ...params.args.data,
            tenantId: currentTenantId,
          }
          break

        case 'createMany':
          if (Array.isArray(params.args.data)) {
            params.args.data = params.args.data.map((item: any) => ({
              ...item,
              tenantId: currentTenantId,
            }))
          } else {
            params.args.data = {
              ...params.args.data,
              tenantId: currentTenantId,
            }
          }
          break

        case 'update':
        case 'updateMany':
        case 'delete':
        case 'deleteMany':
        case 'upsert':
          params.args.where = {
            ...params.args.where,
            tenantId: currentTenantId,
          }
          break
      }

      logger.debug('Applied tenant filter', {
        model: params.model,
        action: params.action,
        tenantId: currentTenantId,
      })
    }

    return next(params)
  })
}

/**
 * 테넌트 격리 검증 함수
 */
export async function validateTenantAccess(
  prisma: PrismaClient,
  tenantId: string,
  resourceId: string,
  model: string
): Promise<boolean> {
  try {
    const resource = await (prisma as any)[model].findFirst({
      where: {
        id: resourceId,
        tenantId,
      },
    })

    const hasAccess = !!resource
    logger.debug('Tenant access validation', {
      tenantId,
      resourceId,
      model,
      hasAccess,
    })

    return hasAccess
  } catch (error) {
    logger.error('Tenant access validation failed', {
      tenantId,
      resourceId,
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * 사용량 제한 체크 함수
 */
export async function checkUsageLimit(
  prisma: PrismaClient,
  tenantId: string,
  resource: 'companies' | 'contacts' | 'emails' | 'notifications'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  try {
    // 테넌트 정보 조회
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptions: { where: { status: 'ACTIVE' }, take: 1 } },
    })

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    // 현재 사용량 조회
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
        // 현재 월의 이메일 처리 수
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        current = await prisma.emailLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        })
        limit = tenant.maxEmails
        break
      case 'notifications':
        // 현재 월의 알림 발송 수
        const startOfCurrentMonth = new Date()
        startOfCurrentMonth.setDate(1)
        startOfCurrentMonth.setHours(0, 0, 0, 0)

        current = await prisma.notificationLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfCurrentMonth },
          },
        })
        limit = tenant.maxNotifications
        break
    }

    const allowed = current < limit

    logger.debug('Usage limit check', {
      tenantId,
      resource,
      current,
      limit,
      allowed,
    })

    return { allowed, current, limit }
  } catch (error) {
    logger.error('Usage limit check failed', {
      tenantId,
      resource,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return { allowed: false, current: 0, limit: 0 }
  }
}
