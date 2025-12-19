/**
 * SaaS 구독 플랜 정의 및 제한 사항
 */

export enum SubscriptionPlan {
  FREE_TRIAL = 'FREE_TRIAL',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL', // 무료 체험 중
  ACTIVE = 'ACTIVE', // 활성 구독
  PAST_DUE = 'PAST_DUE', // 결제 연체
  CANCELLED = 'CANCELLED', // 취소됨
  UNPAID = 'UNPAID', // 미납(최종 실패)
  INCOMPLETE = 'INCOMPLETE', // 결제 미완료
}

// 플랜별 제한 사항 인터페이스
export interface PlanLimits {
  maxCompanies: number // 최대 업체 수
  maxContacts: number // 최대 담당자 수
  maxEmailsPerMonth: number // 월 최대 이메일 처리량
  maxNotificationsPerMonth: number // 월 최대 알림 발송량
  maxUsers: number // 최대 사용자 수
  retentionDays: number // 데이터 보관 기간 (일)
  features: PlanFeatures // 기능별 활성화 여부
  priority: number // 우선순위 (높을수록 좋음)
}

// 플랜별 기능 활성화 여부
export interface PlanFeatures {
  emailIntegration: boolean // 이메일 연동
  smsNotifications: boolean // SMS 알림
  kakaoNotifications: boolean // 카카오톡 알림
  customDomain: boolean // 커스텀 도메인
  apiAccess: boolean // API 액세스
  exportData: boolean // 데이터 내보내기
  multipleUsers: boolean // 다중 사용자
  customBranding: boolean // 브랜딩 커스터마이징
  prioritySupport: boolean // 우선 지원
  sla: boolean // SLA 보장
  // 메일 기능 (Phase 7 추가)
  fullMailboxAccess: boolean // 전체 메일함 접근 (발주 외 메일)
  mailSending: boolean // 메일 발신 기능
}

// 플랜별 제한 사항 정의
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE_TRIAL]: {
    maxCompanies: 10,
    maxContacts: 50,
    maxEmailsPerMonth: 100,
    maxNotificationsPerMonth: 100,
    maxUsers: 1,
    retentionDays: 30,
    features: {
      emailIntegration: true,
      smsNotifications: false,
      kakaoNotifications: false,
      customDomain: false,
      apiAccess: false,
      exportData: false,
      multipleUsers: false,
      customBranding: false,
      prioritySupport: false,
      sla: false,
      fullMailboxAccess: false, // 발주 메일만
      mailSending: false,
    },
    priority: 1,
  },

  [SubscriptionPlan.STARTER]: {
    maxCompanies: 10,
    maxContacts: 50,
    maxEmailsPerMonth: 500,
    maxNotificationsPerMonth: 500,
    maxUsers: 2,
    retentionDays: 90,
    features: {
      emailIntegration: true,
      smsNotifications: true,
      kakaoNotifications: true,
      customDomain: false,
      apiAccess: false,
      exportData: true,
      multipleUsers: false,
      customBranding: false,
      prioritySupport: false,
      sla: false,
      fullMailboxAccess: false, // 발주 메일만
      mailSending: false,
    },
    priority: 2,
  },

  [SubscriptionPlan.PROFESSIONAL]: {
    maxCompanies: 50,
    maxContacts: 300,
    maxEmailsPerMonth: 2000,
    maxNotificationsPerMonth: 2000,
    maxUsers: 5,
    retentionDays: 180,
    features: {
      emailIntegration: true,
      smsNotifications: true,
      kakaoNotifications: true,
      customDomain: true,
      apiAccess: true,
      exportData: true,
      multipleUsers: true,
      customBranding: false,
      prioritySupport: true,
      sla: false,
      fullMailboxAccess: true, // 전체 메일함 (옵션)
      mailSending: true, // 메일 발신 (옵션)
    },
    priority: 3,
  },

  [SubscriptionPlan.BUSINESS]: {
    maxCompanies: -1, // 무제한
    maxContacts: -1, // 무제한
    maxEmailsPerMonth: 10000,
    maxNotificationsPerMonth: 10000,
    maxUsers: 20,
    retentionDays: 365,
    features: {
      emailIntegration: true,
      smsNotifications: true,
      kakaoNotifications: true,
      customDomain: true,
      apiAccess: true,
      exportData: true,
      multipleUsers: true,
      customBranding: true,
      prioritySupport: true,
      sla: true,
      fullMailboxAccess: true, // 전체 메일함 (옵션)
      mailSending: true, // 메일 발신 (옵션)
    },
    priority: 4,
  },

  [SubscriptionPlan.ENTERPRISE]: {
    maxCompanies: -1, // 무제한
    maxContacts: -1, // 무제한
    maxEmailsPerMonth: -1, // 무제한
    maxNotificationsPerMonth: -1, // 무제한
    maxUsers: -1, // 무제한
    retentionDays: -1, // 무제한
    features: {
      emailIntegration: true,
      smsNotifications: true,
      kakaoNotifications: true,
      customDomain: true,
      apiAccess: true,
      exportData: true,
      multipleUsers: true,
      customBranding: true,
      prioritySupport: true,
      sla: true,
      fullMailboxAccess: true, // 전체 메일함 (옵션)
      mailSending: true, // 메일 발신 (옵션)
    },
    priority: 5,
  },
}

// 플랜 가격 정보 인터페이스
export interface PlanPricing {
  monthly: number
  yearly: number
  currency: string
}

// 플랜별 가격 정보 (원화)
export const PLAN_PRICING: Record<SubscriptionPlan, PlanPricing> = {
  [SubscriptionPlan.FREE_TRIAL]: {
    monthly: 0,
    yearly: 0,
    currency: 'KRW',
  },
  [SubscriptionPlan.STARTER]: {
    monthly: 29900,
    yearly: 299000, // 2개월 할인
    currency: 'KRW',
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    monthly: 79900,
    yearly: 799000, // 2개월 할인
    currency: 'KRW',
  },
  [SubscriptionPlan.BUSINESS]: {
    monthly: 199900,
    yearly: 1999000, // 2개월 할인
    currency: 'KRW',
  },
  [SubscriptionPlan.ENTERPRISE]: {
    monthly: -1, // 별도 문의
    yearly: -1, // 별도 문의
    currency: 'KRW',
  },
}

// 플랜 이름 한글 변환
export function getPlanDisplayName(plan: SubscriptionPlan): string {
  const names = {
    [SubscriptionPlan.FREE_TRIAL]: '무료 체험',
    [SubscriptionPlan.STARTER]: '스타터',
    [SubscriptionPlan.PROFESSIONAL]: '프로페셔널',
    [SubscriptionPlan.BUSINESS]: '비즈니스',
    [SubscriptionPlan.ENTERPRISE]: '엔터프라이즈',
  }
  return names[plan] || plan
}

// 플랜 설명
export function getPlanDescription(plan: SubscriptionPlan): string {
  const descriptions = {
    [SubscriptionPlan.FREE_TRIAL]: '14일 무료 체험으로 Echo Mail을 경험해보세요',
    [SubscriptionPlan.STARTER]: '소규모 비즈니스를 위한 기본 플랜',
    [SubscriptionPlan.PROFESSIONAL]: '성장하는 비즈니스를 위한 전문가 플랜',
    [SubscriptionPlan.BUSINESS]: '대규모 운영을 위한 비즈니스 플랜',
    [SubscriptionPlan.ENTERPRISE]: '맞춤형 솔루션이 필요한 대기업을 위한 플랜',
  }
  return descriptions[plan] || ''
}

// 제한이 무제한인지 확인
export function isUnlimited(value: number): boolean {
  return value === -1
}

// 제한값 표시 문자열
export function formatLimit(value: number, suffix: string = ''): string {
  if (isUnlimited(value)) {
    return '무제한'
  }
  return `${value.toLocaleString()}${suffix}`
}

// 플랜 비교: planA가 planB보다 상위 플랜인지 확인
export function isPlanHigherThan(planA: SubscriptionPlan, planB: SubscriptionPlan): boolean {
  return PLAN_LIMITS[planA].priority > PLAN_LIMITS[planB].priority
}

// 플랜 비교: planA가 planB보다 하위 플랜인지 확인
export function isPlanLowerThan(planA: SubscriptionPlan, planB: SubscriptionPlan): boolean {
  return PLAN_LIMITS[planA].priority < PLAN_LIMITS[planB].priority
}
