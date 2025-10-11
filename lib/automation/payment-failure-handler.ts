/**
 * 결제 실패 후속 조치 관리
 * - 결제 실패 재시도
 * - 재시도 실패 시 계정 정지
 * - 관리자 알림 발송
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TossPaymentService } from '@/lib/payment/toss-payments'
import { SubscriptionStatus } from '@prisma/client'

export interface PaymentRetryResult {
  subscriptionId: string
  tenantId: string
  tenantName: string
  status: 'success' | 'failed' | 'suspended' | 'skipped'
  retryCount: number
  nextRetryAt?: Date
  errorMessage?: string
}

export class PaymentFailureHandler {
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAYS = [1, 3, 7] // 1일, 3일, 7일 간격

  /**
   * 결제 실패한 구독 재시도 처리
   */
  static async processFailedPayments(): Promise<PaymentRetryResult[]> {
    logger.info('결제 실패 재시도 처리 시작')

    try {
      const now = new Date()

      // PAST_DUE 상태의 구독 조회 (재시도 대상)
      const failedSubscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: {
            lt: now, // 이미 만료된 구독
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
        take: 50, // 한 번에 최대 50개 처리
      })

      logger.info(`결제 실패 구독 ${failedSubscriptions.length}개 발견`)

      const results: PaymentRetryResult[] = []

      for (const subscription of failedSubscriptions) {
        try {
          const result = await this.processSingleFailedPayment(subscription)
          results.push(result)

          // API 부하 방지를 위한 딜레이 (100ms)
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          logger.error('결제 재시도 실패', {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            error: error instanceof Error ? error.message : String(error),
          })

          results.push({
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            tenantName: subscription.tenant.name,
            status: 'skipped',
            retryCount: 0,
            errorMessage: error instanceof Error ? error.message : '처리 실패',
          })
        }
      }

      logger.info('결제 실패 재시도 처리 완료', {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        failed: results.filter((r) => r.status === 'failed').length,
        suspended: results.filter((r) => r.status === 'suspended').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      })

      return results
    } catch (error) {
      logger.error('결제 실패 재시도 처리 중 오류 발생', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * 단일 구독의 결제 재시도
   */
  private static async processSingleFailedPayment(subscription: any): Promise<PaymentRetryResult> {
    const retryCount = (subscription as any).paymentRetryCount || 0

    logger.info('결제 재시도 처리', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      tenantName: subscription.tenant.name,
      retryCount,
      maxRetries: this.MAX_RETRIES,
    })

    // 최대 재시도 횟수 초과 확인
    if (retryCount >= this.MAX_RETRIES) {
      logger.warn('최대 재시도 횟수 초과, 구독 정지', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        retryCount,
      })

      // 구독 정지
      await this.suspendSubscription(subscription)

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        status: 'suspended',
        retryCount,
        errorMessage: '최대 재시도 횟수 초과',
      }
    }

    // 결제 재시도
    try {
      const orderId = TossPaymentService.generateOrderId(subscription.tenantId, 'retry')
      const orderName = `Echo Mail ${subscription.plan} 플랜 재결제 (${retryCount + 1}차)`

      logger.info('결제 API 호출', {
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

      if (paymentResult.status === 'DONE') {
        // 결제 성공
        logger.info('결제 재시도 성공', {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          paymentKey: paymentResult.paymentKey,
        })

        // 구독 상태 업데이트
        await this.activateSubscription(subscription, paymentResult)

        // 성공 알림 발송
        await this.sendPaymentSuccessNotification(subscription.tenant)

        return {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          tenantName: subscription.tenant.name,
          status: 'success',
          retryCount: retryCount + 1,
        }
      } else {
        throw new Error(`결제 실패: ${paymentResult.status}`)
      }
    } catch (error) {
      // 결제 실패
      logger.error('결제 재시도 실패', {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        retryCount: retryCount + 1,
        error: error instanceof Error ? error.message : String(error),
      })

      const nextRetryCount = retryCount + 1

      // 다음 재시도 시간 계산
      const nextRetryAt = new Date()
      if (nextRetryCount < this.MAX_RETRIES) {
        nextRetryAt.setDate(nextRetryAt.getDate() + this.RETRY_DELAYS[nextRetryCount])
      }

      // TODO: 재시도 정보 저장 (Prisma 스키마에 필드 추가 필요)
      // 현재는 로그만 기록

      // 실패 알림 발송
      await this.sendPaymentFailureNotification(subscription.tenant, nextRetryCount, nextRetryAt)

      return {
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        tenantName: subscription.tenant.name,
        status: 'failed',
        retryCount: nextRetryCount,
        nextRetryAt: nextRetryCount < this.MAX_RETRIES ? nextRetryAt : undefined,
        errorMessage: error instanceof Error ? error.message : '결제 실패',
      }
    }
  }

  /**
   * 구독 정지
   */
  private static async suspendSubscription(subscription: any): Promise<void> {
    logger.info('구독 정지 처리', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
    })

    // 구독 상태를 UNPAID로 변경
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.UNPAID,
        cancelledAt: new Date(),
      },
    })

    // 테넌트 상태 업데이트
    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: {
        subscriptionStatus: SubscriptionStatus.UNPAID,
      },
    })

    // 정지 알림 발송
    await this.sendSubscriptionSuspendedNotification(subscription.tenant)

    logger.info('구독 정지 완료', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
    })
  }

  /**
   * 구독 활성화 (결제 성공 시)
   */
  private static async activateSubscription(subscription: any, paymentResult: any): Promise<void> {
    logger.info('구독 활성화 처리', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
    })

    // 새로운 구독 기간 계산
    const nextPeriodStart = new Date()
    const nextPeriodEnd = new Date(nextPeriodStart)
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)

    // 구독 상태 업데이트
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
    await this.createRetryInvoice(subscription, paymentResult)

    logger.info('구독 활성화 완료', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      nextPeriodStart,
      nextPeriodEnd,
    })
  }

  /**
   * 재시도 결제 인보이스 생성
   */
  private static async createRetryInvoice(subscription: any, paymentResult: any): Promise<void> {
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
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        paidAt: new Date(paymentResult.approvedAt),
        paymentMethod: paymentResult.method,
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
      },
    })

    logger.info('재시도 인보이스 생성 완료', {
      subscriptionId: subscription.id,
      invoiceNumber,
    })
  }

  /**
   * 결제 성공 알림
   */
  private static async sendPaymentSuccessNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 결제 성공', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      message: `
안녕하세요 ${tenant.name} 관리자님,

결제가 정상적으로 완료되었습니다.

Echo Mail 서비스를 계속 이용하실 수 있습니다.

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 결제 실패 알림
   */
  private static async sendPaymentFailureNotification(
    tenant: any,
    retryCount: number,
    nextRetryAt: Date
  ): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 결제 실패', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      retryCount,
      nextRetryAt,
      message: `
안녕하세요 ${tenant.name} 관리자님,

결제 처리 중 문제가 발생했습니다.

재시도 횟수: ${retryCount}/${PaymentFailureHandler.MAX_RETRIES}
다음 재시도: ${nextRetryAt.toLocaleDateString('ko-KR')}

결제 수단을 확인하시고, 문제가 지속되면 고객센터로 문의해주세요.

결제 정보 수정: https://echomail.example.com/settings/billing

감사합니다.
Echo Mail 팀
      `.trim(),
    })
  }

  /**
   * 구독 정지 알림
   */
  private static async sendSubscriptionSuspendedNotification(tenant: any): Promise<void> {
    if (!tenant.users || tenant.users.length === 0) {
      return
    }

    const user = tenant.users[0]

    logger.info('[알림] 구독 정지', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userEmail: user.email,
      message: `
안녕하세요 ${tenant.name} 관리자님,

결제 실패로 인해 Echo Mail 서비스가 정지되었습니다.

최대 재시도 횟수(3회)를 초과하여 자동으로 구독이 정지되었습니다.

서비스를 계속 이용하시려면 결제 정보를 업데이트하고 구독을 재개해주세요.

결제 정보 수정: https://echomail.example.com/settings/billing

문의사항이 있으시면 고객센터로 연락해주세요.

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
   * 결제 실패 통계
   */
  static async getFailureStats(): Promise<{
    pastDue: number
    unpaid: number
    retryPending: number
  }> {
    const [pastDue, unpaid] = await Promise.all([
      prisma.subscription.count({
        where: { status: SubscriptionStatus.PAST_DUE },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.UNPAID },
      }),
    ])

    return {
      pastDue,
      unpaid,
      retryPending: pastDue, // PAST_DUE = 재시도 대기 중
    }
  }
}

export default PaymentFailureHandler
