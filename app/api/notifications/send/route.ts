import { NextRequest } from 'next/server'
import { z } from 'zod'
import { NotificationType } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import {
  notificationService,
  sendOrderReceivedNotification,
} from '@/lib/notifications/notification-service'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 개별 알림 발송 스키마
const sendNotificationSchema = z.object({
  type: z.nativeEnum(NotificationType, {
    errorMap: () => ({ message: '올바른 알림 타입이 아닙니다' }),
  }),
  recipient: z.string().min(1, '수신자는 필수입니다'),
  templateName: z.string().min(1, '템플릿명은 필수입니다'),
  variables: z.record(z.string()).default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  scheduledAt: z
    .string()
    .optional()
    .refine(
      (dateStr) => !dateStr || !isNaN(new Date(dateStr).getTime()),
      '올바른 날짜 형식이 아닙니다'
    ),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  enableFailover: z.boolean().optional(),
  useQueue: z.boolean().optional(),
})

// 대량 알림 발송 스키마
const sendBulkNotificationSchema = z.object({
  notifications: z.array(sendNotificationSchema).min(1, '최소 1개의 알림이 필요합니다'),
  batchSize: z.number().int().min(1).max(100).optional(),
})

// 발주 접수 알림 스키마
const orderNotificationSchema = z.object({
  companyId: z.string().min(1, '업체 ID는 필수입니다'),
})

// 개별 알림 발송
export async function POST(request: NextRequest) {
  return withTenantContext(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url)
      const action = searchParams.get('action')

      switch (action) {
        case 'order-received':
          return handleOrderReceivedNotification(req)
        case 'bulk':
          return handleBulkNotification(req)
        default:
          return handleSingleNotification(req)
      }
    } catch (error) {
      logger.error('알림 발송 API 오류:', error)
      return createErrorResponse('알림 발송에 실패했습니다.')
    }
  })
}

// 단일 알림 발송 처리
async function handleSingleNotification(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, sendNotificationSchema)
  if (error) return error

  try {
    // 세션에서 tenantId 가져오기
    const { prisma } = await import('@/lib/db')
    const sessionCookie = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token')

    let tenantId: string | null = null

    if (sessionCookie) {
      const user = await prisma.user.findFirst({
        where: {
          sessions: {
            some: {
              sessionToken: sessionCookie.value,
              expires: { gt: new Date() },
            },
          },
        },
        select: {
          tenantId: true,
          email: true,
        },
      })
      tenantId = user?.tenantId || null

      logger.info('세션에서 tenantId 조회', {
        hasSessionCookie: !!sessionCookie,
        userFound: !!user,
        userEmail: user?.email,
        tenantId,
      })
    }

    if (!tenantId) {
      logger.error('tenantId를 찾을 수 없습니다', {
        hasSessionCookie: !!sessionCookie,
      })
    }

    const notificationRequest = {
      type: data.type,
      recipient: data.recipient,
      templateName: data.templateName,
      variables: data.variables,
      priority: data.priority,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      companyId: data.companyId,
      contactId: data.contactId,
      enableFailover: data.enableFailover ?? true,
      tenantId: tenantId || undefined,
    }

    let result

    if (data.useQueue) {
      // 큐를 통한 비동기 발송
      const jobId = await notificationService.queueNotification(notificationRequest)

      result = {
        queued: true,
        jobId,
        message: '알림이 큐에 등록되었습니다.',
      }
    } else {
      // 즉시 발송
      result = await notificationService.sendNotification(notificationRequest)
    }

    logger.info('알림 발송 API 성공', {
      type: data.type,
      recipient: data.recipient,
      template: data.templateName,
      useQueue: data.useQueue,
    })

    return createSuccessResponse(result, '알림이 성공적으로 처리되었습니다.')
  } catch (error) {
    logger.error('단일 알림 발송 실패:', error)
    return createErrorResponse(error instanceof Error ? error.message : '알림 발송에 실패했습니다.')
  }
}

// 대량 알림 발송 처리
async function handleBulkNotification(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, sendBulkNotificationSchema)
  if (error) return error

  try {
    const bulkRequest = {
      notifications: data.notifications.map((notification) => ({
        type: notification.type,
        recipient: notification.recipient,
        templateName: notification.templateName,
        variables: notification.variables,
        priority: notification.priority,
        scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt) : undefined,
        companyId: notification.companyId,
        contactId: notification.contactId,
        enableFailover: notification.enableFailover ?? true,
      })),
      batchSize: data.batchSize,
    }

    const result = await notificationService.sendBulkNotifications(bulkRequest)

    logger.info('대량 알림 발송 API 성공', {
      total: result.totalCount,
      success: result.successCount,
      failure: result.failureCount,
    })

    return createSuccessResponse(
      result,
      `${result.totalCount}개 중 ${result.successCount}개 알림이 성공적으로 발송되었습니다.`
    )
  } catch (error) {
    logger.error('대량 알림 발송 실패:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '대량 알림 발송에 실패했습니다.'
    )
  }
}

// 발주 접수 알림 처리
async function handleOrderReceivedNotification(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, orderNotificationSchema)
  if (error) return error

  try {
    const results = await sendOrderReceivedNotification(data.companyId)

    const successCount = results.filter((r) => r.success).length
    const totalCount = results.length

    logger.info('발주 접수 알림 API 성공', {
      companyId: data.companyId,
      total: totalCount,
      success: successCount,
    })

    return createSuccessResponse(
      {
        companyId: data.companyId,
        totalCount,
        successCount,
        failureCount: totalCount - successCount,
        results,
      },
      `발주 접수 알림이 ${successCount}/${totalCount}개 담당자에게 성공적으로 발송되었습니다.`
    )
  } catch (error) {
    logger.error('발주 접수 알림 실패:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '발주 접수 알림 발송에 실패했습니다.'
    )
  }
}
