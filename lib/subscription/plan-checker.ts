/**
 * 플랜 권한 검증 유틸리티
 * 모든 경로(수집·조회·발신·설정 API)에서 일관되게 플랜 권한을 체크
 */

import { SubscriptionPlan, PLAN_LIMITS, PlanFeatures } from './plans'

// 메일 수신 모드
export type MailMode = 'ORDER_ONLY' | 'FULL_INBOX'

// 플랜별 메일 기능 권한
export interface MailFeaturePermissions {
  // 발주 메일만 수신 (모든 플랜)
  canReceiveOrderEmails: boolean
  // 전체 메일 수신 (프로페셔널+)
  canReceiveAllEmails: boolean
  // 메일 발신 (프로페셔널+)
  canSendEmails: boolean
  // 메일 모드 변경 가능 여부
  canChangeMailMode: boolean
  // 발신 기능 활성화 가능 여부
  canEnableMailSending: boolean
}

// 플랜별 메일 기능 정의
const MAIL_FEATURE_BY_PLAN: Record<SubscriptionPlan, MailFeaturePermissions> = {
  [SubscriptionPlan.FREE_TRIAL]: {
    canReceiveOrderEmails: true,
    canReceiveAllEmails: false,
    canSendEmails: false,
    canChangeMailMode: false,
    canEnableMailSending: false,
  },
  [SubscriptionPlan.STARTER]: {
    canReceiveOrderEmails: true,
    canReceiveAllEmails: false,
    canSendEmails: false,
    canChangeMailMode: false,
    canEnableMailSending: false,
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    canReceiveOrderEmails: true,
    canReceiveAllEmails: true,
    canSendEmails: true,
    canChangeMailMode: true,
    canEnableMailSending: true,
  },
  [SubscriptionPlan.BUSINESS]: {
    canReceiveOrderEmails: true,
    canReceiveAllEmails: true,
    canSendEmails: true,
    canChangeMailMode: true,
    canEnableMailSending: true,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    canReceiveOrderEmails: true,
    canReceiveAllEmails: true,
    canSendEmails: true,
    canChangeMailMode: true,
    canEnableMailSending: true,
  },
}

/**
 * 플랜의 메일 기능 권한 조회
 */
export function getMailPermissions(plan: SubscriptionPlan): MailFeaturePermissions {
  return MAIL_FEATURE_BY_PLAN[plan] || MAIL_FEATURE_BY_PLAN[SubscriptionPlan.FREE_TRIAL]
}

/**
 * 전체 메일 수신이 가능한지 확인
 */
export function canAccessFullMailbox(plan: SubscriptionPlan): boolean {
  return getMailPermissions(plan).canReceiveAllEmails
}

/**
 * 메일 발신이 가능한지 확인
 */
export function canSendMail(plan: SubscriptionPlan): boolean {
  return getMailPermissions(plan).canSendEmails
}

/**
 * 메일 모드 변경이 가능한지 확인
 */
export function canChangeMailMode(plan: SubscriptionPlan): boolean {
  return getMailPermissions(plan).canChangeMailMode
}

/**
 * 발신 기능 활성화가 가능한지 확인
 */
export function canEnableMailSending(plan: SubscriptionPlan): boolean {
  return getMailPermissions(plan).canEnableMailSending
}

/**
 * 특정 플랜 기능이 활성화되어 있는지 확인
 */
export function hasPlanFeature(
  plan: SubscriptionPlan,
  feature: keyof PlanFeatures
): boolean {
  const limits = PLAN_LIMITS[plan]
  return limits?.features?.[feature] ?? false
}

/**
 * 메일 모드 유효성 검사
 * - ORDER_ONLY: 모든 플랜에서 허용
 * - FULL_INBOX: 프로페셔널 이상 플랜에서만 허용
 */
export function isValidMailMode(plan: SubscriptionPlan, mode: MailMode): boolean {
  if (mode === 'ORDER_ONLY') {
    return true
  }
  if (mode === 'FULL_INBOX') {
    return canAccessFullMailbox(plan)
  }
  return false
}

/**
 * 메일 발신 활성화 유효성 검사
 */
export function isValidMailSendingEnabled(
  plan: SubscriptionPlan,
  enabled: boolean
): boolean {
  if (!enabled) {
    return true // 비활성화는 항상 허용
  }
  return canEnableMailSending(plan)
}

/**
 * 플랜 업그레이드 필요 여부 및 최소 필요 플랜 반환
 */
export function getRequiredPlanForFeature(
  feature: 'fullMailbox' | 'mailSending'
): SubscriptionPlan {
  switch (feature) {
    case 'fullMailbox':
    case 'mailSending':
      return SubscriptionPlan.PROFESSIONAL
    default:
      return SubscriptionPlan.FREE_TRIAL
  }
}

/**
 * 사용량 제한 체크 (메일 발신용)
 */
export function checkEmailSendingLimit(
  plan: SubscriptionPlan,
  currentUsage: number,
  toSend: number = 1
): { allowed: boolean; remaining: number; limit: number } {
  const limits = PLAN_LIMITS[plan]
  const limit = limits.maxEmailsPerMonth

  // 무제한인 경우
  if (limit === -1) {
    return { allowed: true, remaining: -1, limit: -1 }
  }

  const remaining = limit - currentUsage
  const allowed = remaining >= toSend

  return { allowed, remaining, limit }
}

/**
 * 플랜 비교: 현재 플랜이 목표 플랜보다 높거나 같은지 확인
 */
export function isPlanAtLeast(
  currentPlan: SubscriptionPlan,
  requiredPlan: SubscriptionPlan
): boolean {
  const currentPriority = PLAN_LIMITS[currentPlan]?.priority ?? 0
  const requiredPriority = PLAN_LIMITS[requiredPlan]?.priority ?? 0
  return currentPriority >= requiredPriority
}

/**
 * 업그레이드 유도 메시지 생성
 */
export function getUpgradeMessage(
  feature: 'fullMailbox' | 'mailSending'
): { title: string; description: string; requiredPlan: string } {
  const requiredPlan = getRequiredPlanForFeature(feature)

  switch (feature) {
    case 'fullMailbox':
      return {
        title: '전체 메일함 기능',
        description:
          '발주 메일 외 모든 메일을 확인하려면 프로페셔널 플랜 이상이 필요합니다.',
        requiredPlan: '프로페셔널',
      }
    case 'mailSending':
      return {
        title: '메일 발신 기능',
        description:
          '메일 발신 기능을 사용하려면 프로페셔널 플랜 이상이 필요합니다.',
        requiredPlan: '프로페셔널',
      }
    default:
      return {
        title: '프리미엄 기능',
        description: '이 기능을 사용하려면 플랜 업그레이드가 필요합니다.',
        requiredPlan: '프로페셔널',
      }
  }
}
