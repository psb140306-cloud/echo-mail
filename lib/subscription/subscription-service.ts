/**
 * 구독 관리 서비스
 * - 구독 생성, 수정, 취소
 * - 플랜 변경
 * - 결제 처리
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TossPaymentService, TossPaymentError } from '@/lib/payment/toss-payments'
import { SubscriptionPlan, SubscriptionStatus, PLAN_PRICING, PLAN_LIMITS } from './plans'
import type { Prisma, Tenant, Subscription, Invoice } from '@prisma/client'

// 구독 생성 요청 인터페이스
export interface CreateSubscriptionRequest {
  tenantId: string
  plan: SubscriptionPlan
  billingCycle: 'monthly' | 'yearly'
  billingKey: string
  customerKey: string
  paymentMethod?: string
}

// 플랜 변경 요청 인터페이스
export interface ChangePlanRequest {
  tenantId: string
  newPlan: SubscriptionPlan
  billingCycle?: 'monthly' | 'yearly'
  immediate?: boolean // 즉시 적용 여부
}

// 구독 취소 요청 인터페이스
export interface CancelSubscriptionRequest {
  tenantId: string
  reason: string
  immediate?: boolean // 즉시 취소 여부
}

// 결제 실패 처리 인터페이스
export interface PaymentFailureInfo {
  subscriptionId: string
  failureReason: string
  retryCount: number
  nextRetryAt: Date
}

/**
 * 구독 관리 서비스 클래스
 */
export class SubscriptionService {
  /**
   * 새 구독 생성
   */
  static async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    logger.info('구독 생성 시작', {
      tenantId: request.tenantId,
      plan: request.plan,
      billingCycle: request.billingCycle,
    })

    try {
      // 기존 활성 구독 확인
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          tenantId: request.tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        },
      })

      if (existingSubscription) {
        throw new Error('이미 활성화된 구독이 존재합니다.')
      }

      // 플랜 가격 정보 가져오기
      const pricing = PLAN_PRICING[request.plan]
      const amount = request.billingCycle === 'yearly' ? pricing.yearly : pricing.monthly

      if (amount <= 0) {
        throw new Error('유효하지 않은 플랜 가격입니다.')
      }

      // 결제 처리 (무료 체험이 아닌 경우)
      let paymentInfo = null
      if (request.plan !== SubscriptionPlan.FREE_TRIAL) {
        const orderId = TossPaymentService.generateOrderId(request.tenantId, 'subscription')
        const orderName = `Echo Mail ${request.plan} 플랜 (${request.billingCycle === 'yearly' ? '연간' : '월간'})`

        paymentInfo = await TossPaymentService.createAutoPayment({
          billingKey: request.billingKey,
          customerKey: request.customerKey,
          amount,
          orderId,
          orderName,
        })

        if (paymentInfo.status !== 'DONE') {
          throw new Error('결제 처리에 실패했습니다.')
        }
      }

      // 구독 기간 계산
      const now = new Date()
      const periodStart = new Date(now)
      const periodEnd = new Date(now)

      if (request.plan === SubscriptionPlan.FREE_TRIAL) {
        // 무료 체험: 14일
        periodEnd.setDate(periodEnd.getDate() + 14)
      } else if (request.billingCycle === 'yearly') {
        // 연간: 1년
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      } else {
        // 월간: 1개월
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }

      // 구독 생성
      const subscription = await prisma.subscription.create({
        data: {
          tenantId: request.tenantId,
          plan: request.plan,
          status:
            request.plan === SubscriptionPlan.FREE_TRIAL
              ? SubscriptionStatus.TRIAL
              : SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          customerKey: request.customerKey,
          billingKey: request.billingKey,
          priceAmount: amount,
          currency: 'KRW',
        },
      })

      // 테넌트 정보 업데이트
      await prisma.tenant.update({
        where: { id: request.tenantId },
        data: {
          subscriptionPlan: request.plan,
          subscriptionStatus: subscription.status,
          trialEndsAt: request.plan === SubscriptionPlan.FREE_TRIAL ? periodEnd : undefined,
          ...PLAN_LIMITS[request.plan],
        },
      })

      // 인보이스 생성 (유료 플랜인 경우)
      if (request.plan !== SubscriptionPlan.FREE_TRIAL && paymentInfo) {
        await this.createInvoice(subscription.id, paymentInfo)
      }

      logger.info('구독 생성 완료', {
        subscriptionId: subscription.id,
        tenantId: request.tenantId,
        plan: request.plan,
        status: subscription.status,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      })

      return subscription
    } catch (error) {
      logger.error('구독 생성 실패', {
        tenantId: request.tenantId,
        plan: request.plan,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 플랜 변경
   */
  static async changePlan(request: ChangePlanRequest): Promise<Subscription> {
    logger.info('플랜 변경 시작', {
      tenantId: request.tenantId,
      newPlan: request.newPlan,
      immediate: request.immediate,
    })

    try {
      // 현재 구독 정보 조회
      const currentSubscription = await prisma.subscription.findFirst({
        where: {
          tenantId: request.tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        },
        include: {
          tenant: true,
        },
      })

      if (!currentSubscription) {
        throw new Error('활성화된 구독이 없습니다.')
      }

      // 동일한 플랜인지 확인
      if (currentSubscription.plan === request.newPlan) {
        throw new Error('현재와 동일한 플랜입니다.')
      }

      // 다운그레이드 가능 여부 확인
      const currentLimits = PLAN_LIMITS[currentSubscription.plan as SubscriptionPlan]
      const newLimits = PLAN_LIMITS[request.newPlan]

      if (newLimits.priority < currentLimits.priority) {
        // 다운그레이드 시 현재 사용량 확인
        const usageCheck = await this.checkDowngradeEligibility(request.tenantId, request.newPlan)
        if (!usageCheck.eligible) {
          throw new Error(`다운그레이드할 수 없습니다: ${usageCheck.reason}`)
        }
      }

      // 새 플랜 가격 계산
      const billingCycle = request.billingCycle || 'monthly'
      const newPricing = PLAN_PRICING[request.newPlan]
      const newAmount = billingCycle === 'yearly' ? newPricing.yearly : newPricing.monthly

      // 즉시 적용인 경우 결제 처리
      if (request.immediate && request.newPlan !== SubscriptionPlan.FREE_TRIAL && newAmount > 0) {
        // 프레이션 계산 (남은 기간에 대한 비례 할인/추가 결제)
        const prorationAmount = this.calculateProration(
          currentSubscription,
          request.newPlan,
          billingCycle
        )

        if (prorationAmount > 0) {
          // 추가 결제 필요
          const orderId = TossPaymentService.generateOrderId(request.tenantId, 'subscription')
          const orderName = `Echo Mail 플랜 변경 (${request.newPlan})`

          const paymentInfo = await TossPaymentService.createAutoPayment({
            billingKey: currentSubscription.billingKey!,
            customerKey: currentSubscription.customerKey!,
            amount: prorationAmount,
            orderId,
            orderName,
          })

          if (paymentInfo.status !== 'DONE') {
            throw new Error('플랜 변경 결제에 실패했습니다.')
          }

          // 인보이스 생성
          await this.createInvoice(currentSubscription.id, paymentInfo)
        }
      }

      // 구독 업데이트
      const updatedSubscription = await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          plan: request.newPlan,
          priceAmount: newAmount,
          currentPeriodEnd: request.immediate
            ? this.calculateNextBillingDate(new Date(), billingCycle)
            : currentSubscription.currentPeriodEnd,
        },
      })

      // 테넌트 정보 업데이트
      await prisma.tenant.update({
        where: { id: request.tenantId },
        data: {
          subscriptionPlan: request.newPlan,
          ...PLAN_LIMITS[request.newPlan],
        },
      })

      logger.info('플랜 변경 완료', {
        subscriptionId: updatedSubscription.id,
        tenantId: request.tenantId,
        oldPlan: currentSubscription.plan,
        newPlan: request.newPlan,
        immediate: request.immediate,
      })

      return updatedSubscription
    } catch (error) {
      logger.error('플랜 변경 실패', {
        tenantId: request.tenantId,
        newPlan: request.newPlan,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 구독 취소
   */
  static async cancelSubscription(request: CancelSubscriptionRequest): Promise<Subscription> {
    logger.info('구독 취소 시작', {
      tenantId: request.tenantId,
      immediate: request.immediate,
      reason: request.reason,
    })

    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId: request.tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          },
        },
      })

      if (!subscription) {
        throw new Error('취소할 수 있는 구독이 없습니다.')
      }

      // 구독 상태 업데이트
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: !request.immediate,
          cancelledAt: new Date(),
        },
      })

      // 즉시 취소인 경우 테넌트 상태 변경
      if (request.immediate) {
        await prisma.tenant.update({
          where: { id: request.tenantId },
          data: {
            subscriptionStatus: SubscriptionStatus.CANCELED,
            // 무료 플랜으로 다운그레이드
            subscriptionPlan: SubscriptionPlan.FREE_TRIAL,
            ...PLAN_LIMITS[SubscriptionPlan.FREE_TRIAL],
          },
        })
      }

      logger.info('구독 취소 완료', {
        subscriptionId: updatedSubscription.id,
        tenantId: request.tenantId,
        immediate: request.immediate,
      })

      return updatedSubscription
    } catch (error) {
      logger.error('구독 취소 실패', {
        tenantId: request.tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 구독 갱신 처리
   */
  static async renewSubscription(subscriptionId: string): Promise<Subscription> {
    logger.info('구독 갱신 시작', { subscriptionId })

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { tenant: true },
      })

      if (!subscription) {
        throw new Error('구독 정보를 찾을 수 없습니다.')
      }

      // 갱신 결제 처리
      const orderId = TossPaymentService.generateOrderId(subscription.tenantId, 'subscription')
      const orderName = `Echo Mail ${subscription.plan} 플랜 갱신`

      const paymentInfo = await TossPaymentService.createAutoPayment({
        billingKey: subscription.billingKey!,
        customerKey: subscription.customerKey!,
        amount: subscription.priceAmount,
        orderId,
        orderName,
      })

      if (paymentInfo.status !== 'DONE') {
        // 결제 실패 처리
        return await this.handlePaymentFailure(subscription, '갱신 결제 실패')
      }

      // 구독 기간 연장
      const nextPeriodStart = subscription.currentPeriodEnd
      const nextPeriodEnd = new Date(nextPeriodStart)
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1) // 월간 갱신 기준

      const renewedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
          currentEmailCount: 0,
          currentNotificationCount: 0,
        },
      })

      // 인보이스 생성
      await this.createInvoice(subscriptionId, paymentInfo)

      logger.info('구독 갱신 완료', {
        subscriptionId,
        nextPeriodStart,
        nextPeriodEnd,
      })

      return renewedSubscription
    } catch (error) {
      logger.error('구독 갱신 실패', {
        subscriptionId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 결제 실패 처리
   */
  private static async handlePaymentFailure(
    subscription: Subscription,
    reason: string
  ): Promise<Subscription> {
    const retryCount = (subscription as any).retryCount || 0
    const maxRetries = 3

    if (retryCount >= maxRetries) {
      // 최대 재시도 횟수 초과 시 구독 정지
      return await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
        },
      })
    }

    // 다음 재시도 시간 계산 (1일, 3일, 7일 간격)
    const retryDelays = [1, 3, 7]
    const nextRetryAt = new Date()
    nextRetryAt.setDate(nextRetryAt.getDate() + retryDelays[retryCount])

    return await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        // TODO: retryCount 필드 추가 필요
      },
    })
  }

  /**
   * 인보이스 생성
   */
  private static async createInvoice(subscriptionId: string, paymentInfo: any): Promise<Invoice> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    })

    if (!subscription) {
      throw new Error('구독 정보를 찾을 수 없습니다.')
    }

    // 인보이스 번호 생성
    const invoiceNumber = this.generateInvoiceNumber()

    // 세금 계산 (부가세 10%)
    const subtotal = Math.floor(paymentInfo.totalAmount / 1.1)
    const tax = paymentInfo.totalAmount - subtotal

    return await prisma.invoice.create({
      data: {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        invoiceNumber,
        status: 'PAID',
        subtotal,
        tax,
        total: paymentInfo.totalAmount,
        currency: 'KRW',
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        paidAt: new Date(paymentInfo.approvedAt),
        paymentMethod: paymentInfo.method,
        paymentKey: paymentInfo.paymentKey,
        orderId: paymentInfo.orderId,
      },
    })
  }

  /**
   * 다운그레이드 가능 여부 확인
   */
  private static async checkDowngradeEligibility(
    tenantId: string,
    newPlan: SubscriptionPlan
  ): Promise<{ eligible: boolean; reason?: string }> {
    const newLimits = PLAN_LIMITS[newPlan]

    // 현재 사용량 조회
    const [companyCount, contactCount, memberCount] = await Promise.all([
      prisma.company.count({ where: { tenantId } }),
      prisma.contact.count({ where: { tenantId } }),
      prisma.tenantMember.count({ where: { tenantId, status: 'ACTIVE' } }),
    ])

    // 월간 사용량 조회
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    const [emailCount, notificationCount] = await Promise.all([
      prisma.emailLog.count({
        where: { tenantId, createdAt: { gte: thisMonth } },
      }),
      prisma.notificationLog.count({
        where: { tenantId, createdAt: { gte: thisMonth } },
      }),
    ])

    // 제한 초과 확인
    if (newLimits.maxCompanies !== -1 && companyCount > newLimits.maxCompanies) {
      return {
        eligible: false,
        reason: `업체 수가 제한(${newLimits.maxCompanies}개)을 초과합니다.`,
      }
    }

    if (newLimits.maxContacts !== -1 && contactCount > newLimits.maxContacts) {
      return {
        eligible: false,
        reason: `담당자 수가 제한(${newLimits.maxContacts}명)을 초과합니다.`,
      }
    }

    if (newLimits.maxUsers !== -1 && memberCount > newLimits.maxUsers) {
      return { eligible: false, reason: `사용자 수가 제한(${newLimits.maxUsers}명)을 초과합니다.` }
    }

    if (newLimits.maxEmailsPerMonth !== -1 && emailCount > newLimits.maxEmailsPerMonth) {
      return {
        eligible: false,
        reason: `월 이메일 처리량이 제한(${newLimits.maxEmailsPerMonth}건)을 초과합니다.`,
      }
    }

    if (
      newLimits.maxNotificationsPerMonth !== -1 &&
      notificationCount > newLimits.maxNotificationsPerMonth
    ) {
      return {
        eligible: false,
        reason: `월 알림 발송량이 제한(${newLimits.maxNotificationsPerMonth}건)을 초과합니다.`,
      }
    }

    return { eligible: true }
  }

  /**
   * 프레이션 계산 (비례 계산)
   */
  private static calculateProration(
    currentSubscription: Subscription,
    newPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly'
  ): number {
    const currentPricing = PLAN_PRICING[currentSubscription.plan as SubscriptionPlan]
    const newPricing = PLAN_PRICING[newPlan]

    const currentAmount = currentSubscription.priceAmount
    const newAmount = billingCycle === 'yearly' ? newPricing.yearly : newPricing.monthly

    // 남은 기간 계산
    const now = new Date()
    const totalPeriod =
      currentSubscription.currentPeriodEnd.getTime() -
      currentSubscription.currentPeriodStart.getTime()
    const remainingPeriod = currentSubscription.currentPeriodEnd.getTime() - now.getTime()
    const remainingRatio = remainingPeriod / totalPeriod

    // 현재 플랜의 남은 금액 계산
    const remainingCurrentAmount = Math.floor(currentAmount * remainingRatio)

    // 새 플랜의 비례 금액 계산
    const prorationNewAmount = Math.floor(newAmount * remainingRatio)

    // 차액 계산
    return Math.max(0, prorationNewAmount - remainingCurrentAmount)
  }

  /**
   * 다음 결제일 계산
   */
  private static calculateNextBillingDate(from: Date, billingCycle: 'monthly' | 'yearly'): Date {
    const nextDate = new Date(from)

    if (billingCycle === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1)
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1)
    }

    return nextDate
  }

  /**
   * 인보이스 번호 생성
   */
  private static generateInvoiceNumber(): string {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-6)
    return `ECHO-${year}${month}-${timestamp}`
  }

  /**
   * 구독 정보 조회
   */
  static async getSubscription(tenantId: string): Promise<Subscription | null> {
    return await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
        },
      },
      include: {
        tenant: true,
      },
    })
  }

  /**
   * 만료 예정 구독 조회
   */
  static async getExpiringSubscriptions(daysAhead: number = 3): Promise<Subscription[]> {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysAhead)

    return await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          lte: targetDate,
        },
      },
      include: {
        tenant: true,
      },
    })
  }
}

export default SubscriptionService
