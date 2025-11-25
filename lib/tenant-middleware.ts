import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { AsyncLocalStorage } from 'async_hooks'
import { getKSTStartOfMonth } from '@/lib/utils/date'

// 요청별 테넌트 컨텍스트 저장소 (Race Condition 방지)
interface TenantContextData {
  tenantId: string
  userId?: string
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContextData>()

// 테넌트 컨텍스트 관리
export class TenantContext {
  private static instance: TenantContext

  private constructor() {}

  static getInstance(): TenantContext {
    if (!TenantContext.instance) {
      TenantContext.instance = new TenantContext()
    }
    return TenantContext.instance
  }

  /**
   * 새로운 요청 컨텍스트를 생성하고 콜백을 실행
   * AsyncLocalStorage를 사용하여 요청별 격리 보장
   */
  run<T>(tenantId: string, userId: string | undefined, callback: () => T): T {
    const context: TenantContextData = { tenantId, userId }
    logger.debug('Tenant context run', { tenantId, userId })
    return asyncLocalStorage.run(context, callback)
  }

  setTenant(tenantId: string, userId?: string): void {
    const store = asyncLocalStorage.getStore()
    if (store) {
      store.tenantId = tenantId
      store.userId = userId
      logger.debug('Tenant context updated', { tenantId, userId })
    } else {
      logger.warn('Attempted to set tenant outside of async context')
    }
  }

  getTenantId(): string | null {
    const store = asyncLocalStorage.getStore()
    return store?.tenantId || null
  }

  getUserId(): string | null {
    const store = asyncLocalStorage.getStore()
    return store?.userId || null
  }

  clear(): void {
    const store = asyncLocalStorage.getStore()
    if (store) {
      store.tenantId = ''
      store.userId = undefined
      logger.debug('Tenant context cleared')
    }
  }
}

// 멀티테넌트 지원 모델 목록 (Prisma는 PascalCase를 사용함)
// ⚠️ CRITICAL: schema.prisma에서 tenantId를 가진 모든 모델을 포함해야 함!
// ⚠️ EXCEPTION: TenantMember, TenantInvitation은 제외 (테넌트 컨텍스트 설정 전에 조회 필요)
const TENANT_MODELS = [
  'Company',
  'Contact',
  'DeliveryRule',
  'Holiday',
  'EmailLog',
  'EmailAccount',      // ✅ 추가됨
  'NotificationLog',
  'SystemConfig',
  'MessageTemplate',
  'Subscription',
  'Invoice',           // ✅ 추가됨
] as const

// Super Admin 모델 (테넌트 격리 없음) (Prisma는 PascalCase를 사용함)
// TenantMember, TenantInvitation도 여기에 포함 (테넌트 컨텍스트 설정 전 조회 가능해야 함)
const SUPER_ADMIN_MODELS = [
  'Tenant',
  'User',
  'Account',
  'Session',
  'VerificationToken',
  'TenantMember',      // ✅ 테넌트 컨텍스트 설정에 사용됨
  'TenantInvitation',  // ✅ 테넌트 컨텍스트 설정에 사용됨
] as const

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
        // 현재 월의 이메일 처리 수 (KST 기준)
        const startOfMonth = getKSTStartOfMonth()

        current = await prisma.emailLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        })
        limit = tenant.maxEmails
        break
      case 'notifications':
        // 현재 월의 알림 발송 수 (KST 기준)
        const startOfCurrentMonth = getKSTStartOfMonth()

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
