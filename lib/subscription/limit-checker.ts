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
    // 현재 월의 시작일 계산 (한국 시간 기준)
    const now = new Date()
    const koreaOffset = 9 * 60 // UTC+9
    const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000)

    const startOfMonth = new Date(Date.UTC(
      koreaTime.getUTCFullYear(),
      koreaTime.getUTCMonth(),
      1,
      0, 0, 0, 0
    ))
    // UTC 기준으로 9시간 빼기 (한국 시간 1일 00:00 = UTC 전날 15:00)
    startOfMonth.setHours(startOfMonth.getHours() - 9)

    // 디버깅을 위한 상세 로그
    logger.info('[getTenantUsage] 날짜 계산 디버깅', {
      tenantId,
      now_UTC: now.toISOString(),
      koreaTime_UTC: koreaTime.toISOString(),
      startOfMonth_UTC: startOfMonth.toISOString(),
      year: koreaTime.getUTCFullYear(),
      month: koreaTime.getUTCMonth() + 1, // 0-indexed이므로 +1
    })

    const [companies, contacts, emailsThisMonth, notificationsThisMonth] = await Promise.all([
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

      // 이번 달 알림 발송량 (성공한 것만)
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
          status: 'SENT',
        },
      }),
    ])

    // 결과 로그
    logger.info('[getTenantUsage] 집계 결과', {
      tenantId,
      companies,
      contacts,
      emailsThisMonth,
      notificationsThisMonth,
    })

    return {
      companies,
      contacts,
      emailsThisMonth,
      notificationsThisMonth,
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

    logger.info('[업체 수 체크]', {
      tenantId,
      currentCompanies: usage.companies,
      maxCompanies: limits.maxCompanies,
      unlimited: isUnlimited(limits.maxCompanies),
    })

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

    const emailPercentage = isUnlimited(limits.maxEmailsPerMonth)
      ? 0
      : Math.round((usage.emailsThisMonth / limits.maxEmailsPerMonth) * 100)
    const smsPercentage = isUnlimited(limits.maxNotificationsPerMonth)
      ? 0
      : Math.round((usage.notificationsThisMonth / limits.maxNotificationsPerMonth) * 100)

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
          percentage: emailPercentage,
        },
        notificationsThisMonth: {
          current: usage.notificationsThisMonth,
          limit: limits.maxNotificationsPerMonth,
          percentage: smsPercentage,
        },
      },
      // 대시보드용 summary 필드 추가
      summary: {
        email: {
          current: usage.emailsThisMonth,
          limit: limits.maxEmailsPerMonth,
          percentage: emailPercentage,
        },
        sms: {
          current: usage.notificationsThisMonth,
          limit: limits.maxNotificationsPerMonth,
          percentage: smsPercentage,
        },
        kakao: {
          current: 0,
          limit: limits.maxNotificationsPerMonth,
          percentage: 0,
        },
        api: {
          current: 0,
          limit: 10000,
          percentage: 0,
        },
        hasWarning: emailPercentage >= 80 || smsPercentage >= 80,
        hasExceeded: emailPercentage >= 100 || smsPercentage >= 100,
      },
      features: limits.features,
    }
  } catch (error) {
    logger.error('Failed to get tenant usage report', { tenantId, error })
    throw error
  }
}
