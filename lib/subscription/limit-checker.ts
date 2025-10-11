/**
 * SaaS 플랜별 제한 체크 서비스
 * 테넌트의 현재 사용량과 플랜 제한을 비교하여 초과 여부를 확인
 */

import { prisma } from '@/lib/db'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  SubscriptionPlan,
  SubscriptionStatus,
  PLAN_LIMITS,
  isUnlimited,
  PlanLimits,
  PlanFeatures,
} from './plans'

export interface UsageStats {
  companies: number
  contacts: number
  emailsThisMonth: number
  notificationsThisMonth: number
  users: number
}

export interface LimitCheckResult {
  allowed: boolean
  currentUsage: number
  limit: number
  isUnlimited: boolean
  message?: string
  upgradeRequired?: boolean
  suggestedPlan?: SubscriptionPlan
}

/**
 * 테넌트의 현재 구독 정보 조회
 */
export async function getTenantSubscription(tenantId: string) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    // 활성 구독이 없으면 무료 체험으로 간주
    const subscription = tenant.subscriptions[0] || {
      plan: SubscriptionPlan.FREE_TRIAL,
      status: SubscriptionStatus.TRIAL,
    }

    return {
      tenant,
      subscription,
      plan: subscription.plan as SubscriptionPlan,
      limits: PLAN_LIMITS[subscription.plan as SubscriptionPlan],
    }
  } catch (error) {
    logger.error('Failed to get tenant subscription', { tenantId, error })
    throw error
  }
}

/**
 * 테넌트의 현재 사용량 조회
 */
export async function getTenantUsage(tenantId: string): Promise<UsageStats> {
  try {
    // 현재 월의 시작일 계산
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [companies, contacts, emailsThisMonth, notificationsThisMonth, users] = await Promise.all(
      [
        // 업체 수
        prisma.company.count({
          where: { tenantId },
        }),

        // 담당자 수
        prisma.contact.count({
          where: { tenantId },
        }),

        // 이번 달 이메일 처리량
        prisma.emailLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        }),

        // 이번 달 알림 발송량
        prisma.notificationLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        }),

        // 사용자 수
        prisma.user.count({
          where: { tenantId },
        }),
      ]
    )

    return {
      companies,
      contacts,
      emailsThisMonth,
      notificationsThisMonth,
      users,
    }
  } catch (error) {
    logger.error('Failed to get tenant usage', { tenantId, error })
    throw error
  }
}

/**
 * 업체 추가 가능 여부 체크
 */
export async function checkCompanyLimit(tenantId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await getTenantSubscription(tenantId)
    const usage = await getTenantUsage(tenantId)

    const unlimited = isUnlimited(limits.maxCompanies)
    const allowed = unlimited || usage.companies < limits.maxCompanies

    return {
      allowed,
      currentUsage: usage.companies,
      limit: limits.maxCompanies,
      isUnlimited: unlimited,
      message: allowed
        ? undefined
        : `업체 수 한도에 도달했습니다. (${usage.companies}/${limits.maxCompanies})`,
      upgradeRequired: !allowed,
      suggestedPlan: !allowed ? getSuggestedPlan('companies', usage.companies) : undefined,
    }
  } catch (error) {
    logger.error('Failed to check company limit', { tenantId, error })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      isUnlimited: false,
      message: '제한 확인 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 담당자 추가 가능 여부 체크
 */
export async function checkContactLimit(tenantId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await getTenantSubscription(tenantId)
    const usage = await getTenantUsage(tenantId)

    const unlimited = isUnlimited(limits.maxContacts)
    const allowed = unlimited || usage.contacts < limits.maxContacts

    return {
      allowed,
      currentUsage: usage.contacts,
      limit: limits.maxContacts,
      isUnlimited: unlimited,
      message: allowed
        ? undefined
        : `담당자 수 한도에 도달했습니다. (${usage.contacts}/${limits.maxContacts})`,
      upgradeRequired: !allowed,
      suggestedPlan: !allowed ? getSuggestedPlan('contacts', usage.contacts) : undefined,
    }
  } catch (error) {
    logger.error('Failed to check contact limit', { tenantId, error })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      isUnlimited: false,
      message: '제한 확인 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 이메일 처리 가능 여부 체크
 */
export async function checkEmailLimit(tenantId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await getTenantSubscription(tenantId)
    const usage = await getTenantUsage(tenantId)

    const unlimited = isUnlimited(limits.maxEmailsPerMonth)
    const allowed = unlimited || usage.emailsThisMonth < limits.maxEmailsPerMonth

    return {
      allowed,
      currentUsage: usage.emailsThisMonth,
      limit: limits.maxEmailsPerMonth,
      isUnlimited: unlimited,
      message: allowed
        ? undefined
        : `이번 달 이메일 처리 한도에 도달했습니다. (${usage.emailsThisMonth}/${limits.maxEmailsPerMonth})`,
      upgradeRequired: !allowed,
      suggestedPlan: !allowed ? getSuggestedPlan('emails', usage.emailsThisMonth) : undefined,
    }
  } catch (error) {
    logger.error('Failed to check email limit', { tenantId, error })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      isUnlimited: false,
      message: '제한 확인 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 알림 발송 가능 여부 체크
 */
export async function checkNotificationLimit(tenantId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await getTenantSubscription(tenantId)
    const usage = await getTenantUsage(tenantId)

    const unlimited = isUnlimited(limits.maxNotificationsPerMonth)
    const allowed = unlimited || usage.notificationsThisMonth < limits.maxNotificationsPerMonth

    return {
      allowed,
      currentUsage: usage.notificationsThisMonth,
      limit: limits.maxNotificationsPerMonth,
      isUnlimited: unlimited,
      message: allowed
        ? undefined
        : `이번 달 알림 발송 한도에 도달했습니다. (${usage.notificationsThisMonth}/${limits.maxNotificationsPerMonth})`,
      upgradeRequired: !allowed,
      suggestedPlan: !allowed
        ? getSuggestedPlan('notifications', usage.notificationsThisMonth)
        : undefined,
    }
  } catch (error) {
    logger.error('Failed to check notification limit', { tenantId, error })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      isUnlimited: false,
      message: '제한 확인 중 오류가 발생했습니다.',
    }
  }
}

/**
 * 기능 사용 가능 여부 체크
 */
export async function checkFeatureAccess(
  tenantId: string,
  feature: keyof PlanFeatures
): Promise<boolean> {
  try {
    const { limits } = await getTenantSubscription(tenantId)
    return limits.features[feature] || false
  } catch (error) {
    logger.error('Failed to check feature access', { tenantId, feature, error })
    return false
  }
}

/**
 * 추천 플랜 계산
 */
function getSuggestedPlan(
  limitType: 'companies' | 'contacts' | 'emails' | 'notifications',
  currentUsage: number
): SubscriptionPlan {
  // 현재 사용량을 수용할 수 있는 최소 플랜 찾기
  const plans = Object.entries(PLAN_LIMITS).sort(([, a], [, b]) => a.priority - b.priority)

  for (const [plan, limits] of plans) {
    let limit: number

    switch (limitType) {
      case 'companies':
        limit = limits.maxCompanies
        break
      case 'contacts':
        limit = limits.maxContacts
        break
      case 'emails':
        limit = limits.maxEmailsPerMonth
        break
      case 'notifications':
        limit = limits.maxNotificationsPerMonth
        break
    }

    if (isUnlimited(limit) || currentUsage < limit) {
      return plan as SubscriptionPlan
    }
  }

  return SubscriptionPlan.ENTERPRISE
}

/**
 * 테넌트의 전체 사용량 및 제한 정보 조회
 */
export async function getTenantUsageReport(tenantId: string) {
  try {
    const { subscription, limits } = await getTenantSubscription(tenantId)
    const usage = await getTenantUsage(tenantId)

    return {
      plan: subscription.plan,
      status: subscription.status,
      usage,
      limits: {
        companies: {
          current: usage.companies,
          limit: limits.maxCompanies,
          percentage: isUnlimited(limits.maxCompanies)
            ? 0
            : Math.round((usage.companies / limits.maxCompanies) * 100),
        },
        contacts: {
          current: usage.contacts,
          limit: limits.maxContacts,
          percentage: isUnlimited(limits.maxContacts)
            ? 0
            : Math.round((usage.contacts / limits.maxContacts) * 100),
        },
        emailsThisMonth: {
          current: usage.emailsThisMonth,
          limit: limits.maxEmailsPerMonth,
          percentage: isUnlimited(limits.maxEmailsPerMonth)
            ? 0
            : Math.round((usage.emailsThisMonth / limits.maxEmailsPerMonth) * 100),
        },
        notificationsThisMonth: {
          current: usage.notificationsThisMonth,
          limit: limits.maxNotificationsPerMonth,
          percentage: isUnlimited(limits.maxNotificationsPerMonth)
            ? 0
            : Math.round((usage.notificationsThisMonth / limits.maxNotificationsPerMonth) * 100),
        },
        users: {
          current: usage.users,
          limit: limits.maxUsers,
          percentage: isUnlimited(limits.maxUsers)
            ? 0
            : Math.round((usage.users / limits.maxUsers) * 100),
        },
      },
      features: limits.features,
    }
  } catch (error) {
    logger.error('Failed to get tenant usage report', { tenantId, error })
    throw error
  }
}
