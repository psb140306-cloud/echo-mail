/**
 * 구독 갱신 자동화
 * - 만료 예정 구독 자동 갱신
 * - 결제 처리 및 인보이스 생성
 * - 갱신 실패 시 재시도 처리
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TossPaymentService } from '@/lib/payment/toss-payments'
import { SubscriptionStatus, SubscriptionPlan } from '@prisma/client'
import { getKSTNow } from '@/lib/utils/date'

export interface RenewalResult {
  subscriptionId: string
  tenantId: string
  tenantName: string
  plan: string
  status: 'success' | 'failed' | 'skipped'
  amount?: number
  newPeriodEnd?: Date
  errorMessage?: string
}

export class SubscriptionRenewal {
  /**
   * 만료 예정 구독 갱신 처리
   */
  static async processRenewals(daysAhead: number = 1): Promise<RenewalResult[]> {
    logger.info('구독 갱신 처리 시작', { daysAhead })

    try {
      const now = new Date()
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + daysAhead)
      targetDate.setHours(23, 59, 59, 999)

      // 갱신 대상 구독 조회 (만료 예정 + ACTIVE 상태)
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: {
            gte: now,
            lte: targetDate,
          },
          cancelAtPeriodEnd: false, // 취소 예정이 아닌 구독만
        },
        include: {
          tenant: {
            include: {
              users: {
                where: { isActive: true },
                take: 1,
              },
            },
          },
        },
        take: 100, // 한 번에 최대 100개 처리
      })

      logger.info(`갱신 대상 구독 ${subscriptions.length}개 발견`)

      const results: RenewalResult[] = []

      for (const subscription of subscriptions) {
        try {
          const result = await this.processSingleRenewal(subscription)
          results.push(result)

          // API 부하 방지를 위한 딜레이 (100ms)
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          logger.error('구독 갱신 실패', {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            error: error instanceof Error ? error.message : String(error),
          })

          results.push({
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            tenantName: subscription.tenant.name,
            plan: subscription.plan,
            status: 'skipped',
            errorMessage: error instanceof Error ? error.message : '처리 실패',
          })
        }
      }

      logger.info('구독 갱신 처리 완료', {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        failed: results.filter((r) => r.status === 'failed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      })

      return results
    } catch (error) {
      logger.error('구독 갱신 처리 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 단일 구독 갱신 처리
   */
  private static async processSingleRenewal(subscription: any): Promise<RenewalResult> {
    logger.info('구독 갱신 시작', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      tenantName: subscription.tenant.name,
      plan: subscription.plan,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })

    // 무료 체험은 자동 갱신 안 함
    if (subscription.plan === SubscriptionPlan.FREE_TRIAL) {
      logger.info('무료 체험 구독은 갱신하지 않음', {
        subscriptionId: subscription.id,
      })

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        plan: subscription.plan,
        status: 'skipped',
        errorMessage: '무료 체험은 자동 갱신 대상 아님',
      }
    }

    // 빌링 키 확인
    if (!subscription.billingKey || !subscription.customerKey) {
      logger.error('빌링 정보 없음', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
      })

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        plan: subscription.plan,
        status: 'failed',
        errorMessage: '빌링 정보가 없습니다',
      }
    }

    try {
      // 결제 처리
      const orderId = TossPaymentService.generateOrderId(subscription.tenantId, 'renewal')
      const orderName = `Echo Mail ${subscription.plan} 플랜 갱신`

      logger.info('갱신 결제 시작', {
        subscriptionId: subscription.id,
        orderId,
        amount: subscription.priceAmount,
      })

      const paymentResult = await TossPaymentService.createAutoPayment({
        billingKey: subscription.billingKey,
        customerKey: subscription.customerKey,
        amount: subscription.priceAmount,
        orderId,
        orderName,
      })

      if (paymentResult.status !== 'DONE') {
        throw new Error(`결제 실패: ${paymentResult.status}`)
      }

      logger.info('갱신 결제 성공', {
        subscriptionId: subscription.id,
        paymentKey: paymentResult.paymentKey,
      })

      // 구독 기간 연장
      const nextPeriodStart = subscription.currentPeriodEnd
      const nextPeriodEnd = this.calculateNextPeriodEnd(nextPeriodStart, subscription.plan)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
          currentEmailCount: 0,
          currentNotificationCount: 0,
        },
      })

      // 테넌트 상태 업데이트
      await prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
        },
      })

      // 인보이스 생성
      await this.createRenewalInvoice(subscription, paymentResult, nextPeriodStart, nextPeriodEnd)

      // 갱신 성공 알림
      await this.sendRenewalSuccessNotification(subscription.tenant, nextPeriodEnd)

      logger.info('구독 갱신 완료', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        nextPeriodStart,
        nextPeriodEnd,
      })

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        plan: subscription.plan,
        status: 'success',
        amount: subscription.priceAmount,
        newPeriodEnd: nextPeriodEnd,
      }
    } catch (error) {
      logger.error('구독 갱신 결제 실패', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        error: error instanceof Error ? error.message : String(error),
      })

      // 구독 상태를 PAST_DUE로 변경
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
        },
      })

      await prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          subscriptionStatus: SubscriptionStatus.PAST_DUE,
        },
      })

      // 갱신 실패 알림
      await this.sendRenewalFailureNotification(subscription.tenant)

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        plan: subscription.plan,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '결제 실패',
      }
    }
  }

  /**
   * 다음 구독 기간 종료일 계산
   */
  private static calculateNextPeriodEnd(currentEnd: Date, plan: string): Date {
    const nextEnd = new Date(currentEnd)

    // 대부분 월간 구독이지만, 필요 시 연간 로직 추가
    nextEnd.setMonth(nextEnd.getMonth() + 1)

    return nextEnd
  }

  /**
   * 갱신 인보이스 생성
   */
  private static async createRenewalInvoice(
    subscription: any,
    paymentResult: any,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const invoiceNumber = this.generateInvoiceNumber()
    const subtotal = Math.floor(paymentResult.totalAmount / 1.1)
    const tax = paymentResult.totalAmount - subtotal

    await prisma.invoice.create({
      data: {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        invoiceNumber,
        status: 'PAID',
        subtotal,
        tax,
        total: paymentResult.totalAmount,
        currency: 'KRW',
        periodStart,
        periodEnd,
        paidAt: new Date(paymentResult.approvedAt),
        paymentMethod: paymentResult.method,
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
      },
    })

    logger.info('갱신 인보이스 생성 완료', {
      subscriptionId: subscription.id,
      invoiceNumber,
    })
  }

  /**
   * 갱신 성공 알림
   */
  private static async sendRenewalSuccessNotification(
    tenant: any,
    nextPeriodEnd: Date
  ): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 구독 갱신 성공', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      nextPeriodEnd,
      message: `
안녕하세요 ${tenant.name} 관리자님,

Echo Mail 구독이 정상적으로 갱신되었습니다.

다음 갱신일: ${nextPeriodEnd.toLocaleDateString('ko-KR')}

계속해서 Echo Mail 서비스를 이용하실 수 있습니다.

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 갱신 실패 알림
   */
  private static async sendRenewalFailureNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 구독 갱신 실패', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      message: `
안녕하세요 ${tenant.name} 관리자님,

Echo Mail 구독 갱신 중 결제 문제가 발생했습니다.

결제 수단을 확인하시고, 문제를 해결해주세요.
자동으로 재시도를 진행하며, 계속 실패할 경우 서비스가 정지될 수 있습니다.

결제 정보 수정: https://echomail.example.com/settings/billing

문의사항이 있으시면 고객센터로 연락해주세요.

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 갱신 예정 알림 발송
   */
  static async sendUpcomingRenewalNotifications(daysAhead: number = 7): Promise<number> {
    logger.info(`${daysAhead}일 후 갱신 예정 알림 발송 시작`)

    try {
      // KST 기준으로 날짜 계산
      const kstNow = getKSTNow()
      const targetDate = new Date(Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + daysAhead,
        23, 59, 59, 999
      ))
      targetDate.setTime(targetDate.getTime() - 9 * 60 * 60 * 1000) // UTC로 변환

      const startOfDay = new Date(Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + daysAhead,
        0, 0, 0, 0
      ))
      startOfDay.setTime(startOfDay.getTime() - 9 * 60 * 60 * 1000) // UTC로 변환

      // 갱신 예정 구독 조회
      const upcomingRenewals = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: {
            gte: startOfDay,
            lte: targetDate,
          },
          cancelAtPeriodEnd: false,
          plan: {
            not: SubscriptionPlan.FREE_TRIAL,
          },
        },
        include: {
          tenant: {
            include: {
              users: {
                where: { isActive: true },
                take: 1,
              },
            },
          },
        },
      })

      logger.info(`${daysAhead}일 후 갱신 예정 구독 ${upcomingRenewals.length}개 발견`)

      for (const subscription of upcomingRenewals) {
        try {
          await this.sendUpcomingRenewalNotification(subscription, daysAhead)
        } catch (error) {
          logger.error('갱신 예정 알림 발송 실패', {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return upcomingRenewals.length
    } catch (error) {
      logger.error('갱신 예정 알림 발송 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 갱신 예정 알림
   */
  private static async sendUpcomingRenewalNotification(
    subscription: any,
    daysRemaining: number
  ): Promise<void> {
    if (!subscription.tenant.users || subscription.tenant.users.length === 0) {
      return
    }

    const user = subscription.tenant.users[0]

    logger.info('[알림] 구독 갱신 예정', {
      tenantId: subscription.tenantId,
      tenantName: subscription.tenant.name,
      userEmail: user.email,
      daysRemaining,
      currentPeriodEnd: subscription.currentPeriodEnd,
      message: `
안녕하세요 ${subscription.tenant.name} 관리자님,

Echo Mail 구독이 ${daysRemaining}일 후 자동 갱신됩니다.

갱신일: ${subscription.currentPeriodEnd.toLocaleDateString('ko-KR')}
플랜: ${subscription.plan}
금액: ${subscription.priceAmount.toLocaleString('ko-KR')}원

등록된 결제 수단으로 자동 결제됩니다.
결제 정보를 변경하시려면 아래 링크를 이용해주세요.

결제 정보 수정: https://echomail.example.com/settings/billing

감사합니다.
Echo Mail 팀
      `.trim(),
    })
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
   * 갱신 통계 조회
   */
  static async getRenewalStats(): Promise<{
    renewingToday: number
    renewingThisWeek: number
    renewingThisMonth: number
  }> {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const monthEnd = new Date(today)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const [renewingToday, renewingThisWeek, renewingThisMonth] = await Promise.all([
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: {
            gte: now,
            lte: weekEnd,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: {
            gte: now,
            lte: monthEnd,
          },
        },
      }),
    ])

    return {
      renewingToday,
      renewingThisWeek,
      renewingThisMonth,
    }
  }
}

export default SubscriptionRenewal
