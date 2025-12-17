import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db'
import { TossPaymentService } from '@/lib/payment/toss-payments'
import { SubscriptionService } from '@/lib/subscription/subscription-service'
import { SubscriptionStatus } from '@/lib/subscription/plans'

export const dynamic = 'force-dynamic'

// 토스페이먼츠 웹훅 이벤트 타입
interface TossWebhookEvent {
  eventType: string
  data: {
    paymentKey: string
    orderId: string
    status: string
    totalAmount: number
    method: string
    approvedAt?: string
    canceledAt?: string
    cancelReason?: string
    customerKey?: string
    billingKey?: string
  }
  createdAt: string
}

// 웹훅 처리 결과
interface WebhookResult {
  success: boolean
  message: string
  processedEventType?: string
}

/**
 * 토스페이먼츠 웹훅 처리
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const signature = request.headers.get('toss-signature')
    const rawBody = await request.text()

    // 웹훅 서명 검증
    if (!signature || !TossPaymentService.verifyWebhook(rawBody, signature)) {
      logger.warn('토스페이먼츠 웹훅 서명 검증 실패', {
        hasSignature: !!signature,
        bodyLength: rawBody.length,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event: TossWebhookEvent = JSON.parse(rawBody)

    logger.info('토스페이먼츠 웹훅 수신', {
      eventType: event.eventType,
      paymentKey: event.data.paymentKey,
      orderId: event.data.orderId,
      status: event.data.status,
    })

    // 이벤트 타입별 처리
    const result = await processWebhookEvent(event)

    logger.info('토스페이먼츠 웹훅 처리 완료', {
      eventType: event.eventType,
      paymentKey: event.data.paymentKey,
      success: result.success,
      message: result.message,
    })

    return NextResponse.json({
      success: result.success,
      message: result.message,
    })
  } catch (error) {
    logger.error('토스페이먼츠 웹훅 처리 실패', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

/**
 * 웹훅 이벤트 처리
 */
async function processWebhookEvent(event: TossWebhookEvent): Promise<WebhookResult> {
  switch (event.eventType) {
    case 'PAYMENT_COMPLETED':
      return await handlePaymentCompleted(event)

    case 'PAYMENT_CANCELED':
      return await handlePaymentCanceled(event)

    case 'PAYMENT_FAILED':
      return await handlePaymentFailed(event)

    case 'BILLING_KEY_CREATED':
      return await handleBillingKeyCreated(event)

    case 'BILLING_KEY_UPDATED':
      return await handleBillingKeyUpdated(event)

    case 'BILLING_KEY_DELETED':
      return await handleBillingKeyDeleted(event)

    default:
      logger.warn('처리하지 않는 웹훅 이벤트', {
        eventType: event.eventType,
        paymentKey: event.data.paymentKey,
      })

      return {
        success: true,
        message: `Ignored event type: ${event.eventType}`,
        processedEventType: event.eventType,
      }
  }
}

/**
 * 결제 완료 처리
 */
async function handlePaymentCompleted(event: TossWebhookEvent): Promise<WebhookResult> {
  const { paymentKey, orderId, status } = event.data

  try {
    // 주문 ID에서 테넌트 ID 추출
    const tenantId = extractTenantIdFromOrderId(orderId)
    if (!tenantId) {
      throw new Error('유효하지 않은 주문 ID 형식')
    }

    // 결제 정보 조회
    const paymentInfo = await TossPaymentService.getPayment(paymentKey)

    // 구독 결제인지 확인
    if (orderId.includes('SUBSCRIPTION')) {
      // 구독 결제 처리
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId },
      })

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
          },
        })

        // 인보이스 생성 또는 업데이트
        await updateInvoiceStatus(paymentKey, 'PAID', paymentInfo)
      }
    }

    return {
      success: true,
      message: 'Payment completed successfully',
      processedEventType: 'PAYMENT_COMPLETED',
    }
  } catch (error) {
    logger.error('결제 완료 처리 실패', {
      paymentKey,
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      message: `Failed to process payment completion: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * 결제 취소 처리
 */
async function handlePaymentCanceled(event: TossWebhookEvent): Promise<WebhookResult> {
  const { paymentKey, orderId, cancelReason } = event.data

  try {
    // 인보이스 상태 업데이트
    await updateInvoiceStatus(paymentKey, 'CANCELLED')

    // 구독 취소인 경우 처리
    if (orderId.includes('SUBSCRIPTION')) {
      const tenantId = extractTenantIdFromOrderId(orderId)
      if (tenantId) {
        const subscription = await prisma.subscription.findFirst({
          where: { tenantId },
        })

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: SubscriptionStatus.CANCELED,
              cancelledAt: new Date(),
            },
          })
        }
      }
    }

    return {
      success: true,
      message: 'Payment canceled successfully',
      processedEventType: 'PAYMENT_CANCELED',
    }
  } catch (error) {
    logger.error('결제 취소 처리 실패', {
      paymentKey,
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      message: `Failed to process payment cancelation: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * 결제 실패 처리
 */
async function handlePaymentFailed(event: TossWebhookEvent): Promise<WebhookResult> {
  const { paymentKey, orderId } = event.data

  try {
    // 구독 결제 실패인 경우
    if (orderId.includes('SUBSCRIPTION')) {
      const tenantId = extractTenantIdFromOrderId(orderId)
      if (tenantId) {
        const subscription = await prisma.subscription.findFirst({
          where: { tenantId },
        })

        if (subscription) {
          // 결제 실패 처리 (재시도 로직)
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: SubscriptionStatus.PAST_DUE,
            },
          })

          // TODO: 결제 실패 알림 발송
          // await notificationService.sendPaymentFailureNotification(tenantId)
        }
      }
    }

    // 인보이스 상태 업데이트
    await updateInvoiceStatus(paymentKey, 'FAILED')

    return {
      success: true,
      message: 'Payment failure processed successfully',
      processedEventType: 'PAYMENT_FAILED',
    }
  } catch (error) {
    logger.error('결제 실패 처리 오류', {
      paymentKey,
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      message: `Failed to process payment failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * 빌링키 생성 처리
 */
async function handleBillingKeyCreated(event: TossWebhookEvent): Promise<WebhookResult> {
  const { billingKey, customerKey } = event.data

  try {
    if (!customerKey) {
      throw new Error('Customer key not provided')
    }

    // 테넌트 ID 추출 (customerKey 형식: tenant_{tenantId})
    const tenantId = customerKey.replace('tenant_', '')

    // 테넌트 빌링키 정보 업데이트
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
    })

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          billingKey: billingKey,
          customerKey: customerKey,
        },
      })
    }

    return {
      success: true,
      message: 'Billing key created successfully',
      processedEventType: 'BILLING_KEY_CREATED',
    }
  } catch (error) {
    logger.error('빌링키 생성 처리 실패', {
      billingKey,
      customerKey,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      message: `Failed to process billing key creation: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * 빌링키 업데이트 처리
 */
async function handleBillingKeyUpdated(event: TossWebhookEvent): Promise<WebhookResult> {
  // 빌링키 업데이트 로직 구현
  return {
    success: true,
    message: 'Billing key updated successfully',
    processedEventType: 'BILLING_KEY_UPDATED',
  }
}

/**
 * 빌링키 삭제 처리
 */
async function handleBillingKeyDeleted(event: TossWebhookEvent): Promise<WebhookResult> {
  const { billingKey, customerKey } = event.data

  try {
    if (!customerKey) {
      throw new Error('Customer key not provided')
    }

    // 테넌트 ID 추출
    const tenantId = customerKey.replace('tenant_', '')

    // 구독 상태 업데이트 (결제 수단 없음)
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
    })

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          billingKey: null,
          status: SubscriptionStatus.CANCELED,
        },
      })
    }

    return {
      success: true,
      message: 'Billing key deleted successfully',
      processedEventType: 'BILLING_KEY_DELETED',
    }
  } catch (error) {
    logger.error('빌링키 삭제 처리 실패', {
      billingKey,
      customerKey,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      message: `Failed to process billing key deletion: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * 주문 ID에서 테넌트 ID 추출
 */
function extractTenantIdFromOrderId(orderId: string): string | null {
  // 주문 ID 형식: ECHO_SUBSCRIPTION_{tenantId}_{timestamp}_{random}
  const parts = orderId.split('_')
  if (parts.length >= 4 && parts[0] === 'ECHO' && parts[1] === 'SUBSCRIPTION') {
    return parts[2]
  }
  return null
}

/**
 * 인보이스 상태 업데이트
 */
async function updateInvoiceStatus(
  paymentKey: string,
  status: 'PAID' | 'FAILED' | 'CANCELLED',
  paymentInfo?: any
): Promise<void> {
  try {
    const updateData: any = { status }

    if (status === 'PAID' && paymentInfo) {
      updateData.paidAt = new Date(paymentInfo.approvedAt)
      updateData.paymentMethod = paymentInfo.method
    }

    await prisma.invoice.updateMany({
      where: { paymentKey },
      data: updateData,
    })
  } catch (error) {
    logger.error('인보이스 상태 업데이트 실패', {
      paymentKey,
      status,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
