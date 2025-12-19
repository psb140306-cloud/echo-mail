import cron from 'node-cron'
import { NotificationType } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { notificationService } from '@/lib/notifications/notification-service'
import { calculateDeliveryDate } from '@/lib/utils/delivery-calculator'
import { prisma } from '@/lib/db'

/**
 * 알림 재발송 스케줄러
 * PENDING_RETRY 상태의 알림을 주기적으로 확인하고 재발송 시도
 */
export class NotificationRetryScheduler {
  private task: cron.ScheduledTask | null = null
  private isInitialized = false
  private isProcessing = false

  /**
   * 스케줄러 초기화 및 시작
   * 1분 간격으로 PENDING_RETRY 알림 확인
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('[NotificationRetryScheduler] 이미 초기화됨')
      return
    }

    logger.info('[NotificationRetryScheduler] 초기화 시작')

    // 1분마다 PENDING_RETRY 상태 확인
    this.task = cron.schedule(
      '* * * * *', // 매 분마다
      async () => {
        await this.processPendingRetries()
      },
      {
        scheduled: true,
        timezone: 'Asia/Seoul',
      }
    )

    this.isInitialized = true
    logger.info('[NotificationRetryScheduler] 초기화 완료 - 1분 간격으로 재시도 확인')
  }

  /**
   * PENDING_RETRY 상태의 알림 처리
   */
  private async processPendingRetries() {
    // 이미 처리 중이면 스킵 (프로세스 내 중복 실행 방지)
    if (this.isProcessing) {
      logger.debug('[NotificationRetryScheduler] 이전 작업 처리 중, 스킵')
      return
    }

    this.isProcessing = true

    try {
      const now = new Date()

      // nextRetryAt이 현재 시간보다 이전인 PENDING_RETRY 알림 조회
      const pendingRetries = await prisma.notificationLog.findMany({
        where: {
          status: 'PENDING_RETRY',
          nextRetryAt: {
            lte: now,
          },
        },
        include: {
          company: true,
          emailLog: true,
        },
        take: 50, // 한 번에 최대 50개 처리
        orderBy: {
          nextRetryAt: 'asc', // 가장 오래된 것부터 처리
        },
      })

      if (pendingRetries.length === 0) {
        logger.debug('[NotificationRetryScheduler] 재시도 대기 중인 알림 없음')
        this.isProcessing = false
        return
      }

      logger.info('[NotificationRetryScheduler] 재시도 대기 알림 발견', {
        count: pendingRetries.length,
      })

      let successCount = 0
      let failedCount = 0
      let skipCount = 0

      for (const notification of pendingRetries) {
        try {
          // 중복 처리 방지: 처리 중으로 표시
          await prisma.notificationLog.update({
            where: { id: notification.id },
            data: {
              status: 'SENDING',
              nextRetryAt: null,
            },
          })

          // 재시도 횟수 체크
          if (notification.retryCount >= notification.maxRetries) {
            // 최대 재시도 초과 - FAILED로 변경
            await prisma.notificationLog.update({
              where: { id: notification.id },
              data: {
                status: 'FAILED',
                errorMessage: `최대 재시도 횟수(${notification.maxRetries}) 초과`,
                nextRetryAt: null,
              },
            })

            logger.warn('[NotificationRetryScheduler] 최대 재시도 초과', {
              notificationId: notification.id,
              retryCount: notification.retryCount,
              maxRetries: notification.maxRetries,
            })

            skipCount++
            continue
          }

          logger.info('[NotificationRetryScheduler] 재발송 시도', {
            notificationId: notification.id,
            type: notification.type,
            recipient: notification.recipient,
            retryCount: notification.retryCount,
            maxRetries: notification.maxRetries,
          })

          const templateName =
            notification.type === 'SMS' ? 'ORDER_RECEIVED_SMS' : 'ORDER_RECEIVED_KAKAO'

          // 원본 변수 복원이 필요하므로 (template variables가 로그에 저장되지 않음)
          // 회사/메일로그 기반으로 ORDER_RECEIVED 변수 재구성
          let variables: Record<string, string> = {}
          if (notification.company && notification.emailLog) {
            const orderDateTime = notification.emailLog.receivedAt || notification.createdAt
            const deliveryResult = await calculateDeliveryDate({
              region: notification.company.region,
              orderDateTime,
              tenantId: notification.tenantId,
            })

            const deliveryDate = deliveryResult.deliveryDate
            const deliveryTime = deliveryResult.deliveryTime || '미정'

            const kstDateString = deliveryDate.toLocaleString('en-US', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              hour12: false,
            })
            const parts = kstDateString.split(', ')
            const datePart = parts[0].split('/')
            const kstMonth = parseInt(datePart[0])
            const kstDay = parseInt(datePart[1])

            const kstWeekdayShort = new Intl.DateTimeFormat('ko-KR', {
              timeZone: 'Asia/Seoul',
              weekday: 'short',
            }).format(deliveryDate)

            variables = {
              companyName: notification.company.name,
              deliveryDate: deliveryDate.toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              }),
              shortDate: `${kstMonth}/${kstDay}(${kstWeekdayShort})`,
              deliveryTime: deliveryTime === '미정' ? '' : ` ${deliveryTime}`,
            }
          }

          // 재발송 시도 - notificationService의 sendNotification 호출
          const result = await notificationService.sendNotification({
            type: notification.type as NotificationType,
            recipient: notification.recipient,
            templateName,
            variables,
            companyId: notification.companyId || undefined,
            contactId: notification.contactId || undefined,
            tenantId: notification.tenantId,
            emailLogId: notification.emailLogId || undefined,
          })

          if (result.success) {
            successCount++
            logger.info('[NotificationRetryScheduler] 재발송 성공', {
              notificationId: notification.id,
              messageId: result.messageId,
            })
          } else {
            failedCount++
            logger.warn('[NotificationRetryScheduler] 재발송 실패', {
              notificationId: notification.id,
              error: result.error,
            })
          }
        } catch (error) {
          failedCount++
          logger.error('[NotificationRetryScheduler] 재발송 중 오류:', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          })
        }

        // Rate limiting: 각 발송 사이에 500ms 대기
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      logger.info('[NotificationRetryScheduler] 재시도 처리 완료', {
        total: pendingRetries.length,
        success: successCount,
        failed: failedCount,
        skipped: skipCount,
      })
    } catch (error) {
      logger.error('[NotificationRetryScheduler] 처리 중 오류:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('[NotificationRetryScheduler] 스케줄러 중지됨')
    }
    this.isInitialized = false
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
    }
  }

  /**
   * 수동으로 재시도 처리 트리거
   */
  async triggerManually() {
    logger.info('[NotificationRetryScheduler] 수동 트리거')
    await this.processPendingRetries()
  }
}

// 싱글톤 인스턴스
export const notificationRetryScheduler = new NotificationRetryScheduler()
