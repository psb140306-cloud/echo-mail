import cron from 'node-cron'
import { AnnouncementStatus, NotificationStatus } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db'

/**
 * 예약 공지 발송 스케줄러
 * SCHEDULED 상태의 공지 중 scheduledAt이 지난 것을 자동 발송
 */
export class AnnouncementScheduler {
  private task: cron.ScheduledTask | null = null
  private isInitialized = false
  private isProcessing = false

  /**
   * 스케줄러 초기화 및 시작
   * 1분 간격으로 예약된 공지 확인
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('[AnnouncementScheduler] 이미 초기화됨')
      return
    }

    logger.info('[AnnouncementScheduler] 초기화 시작')

    // 1분마다 SCHEDULED 상태 확인
    this.task = cron.schedule(
      '* * * * *', // 매 분마다
      async () => {
        await this.processScheduledAnnouncements()
      },
      {
        scheduled: true,
        timezone: 'Asia/Seoul',
      }
    )

    this.isInitialized = true
    logger.info('[AnnouncementScheduler] 초기화 완료 - 1분 간격으로 예약 공지 확인')
  }

  /**
   * SCHEDULED 상태의 공지 중 발송 시간이 지난 것 처리
   */
  private async processScheduledAnnouncements() {
    if (this.isProcessing) {
      logger.debug('[AnnouncementScheduler] 이전 작업 처리 중, 스킵')
      return
    }

    this.isProcessing = true

    try {
      const now = new Date()

      // scheduledAt이 현재 시간보다 이전인 SCHEDULED 공지 조회
      const scheduledAnnouncements = await prisma.announcement.findMany({
        where: {
          status: AnnouncementStatus.SCHEDULED,
          scheduledAt: {
            lte: now,
          },
        },
        take: 10, // 한 번에 최대 10개 처리
        orderBy: {
          scheduledAt: 'asc',
        },
      })

      if (scheduledAnnouncements.length === 0) {
        logger.debug('[AnnouncementScheduler] 발송 대기 중인 예약 공지 없음')
        this.isProcessing = false
        return
      }

      logger.info('[AnnouncementScheduler] 예약 공지 발송 시작', {
        count: scheduledAnnouncements.length,
      })

      for (const announcement of scheduledAnnouncements) {
        try {
          await this.sendAnnouncement(announcement.id, announcement.tenantId)
        } catch (error) {
          logger.error('[AnnouncementScheduler] 공지 발송 실패', {
            announcementId: announcement.id,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          })
        }
      }

      logger.info('[AnnouncementScheduler] 예약 공지 처리 완료', {
        count: scheduledAnnouncements.length,
      })
    } catch (error) {
      logger.error('[AnnouncementScheduler] 처리 중 오류:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 개별 공지 발송 처리
   */
  private async sendAnnouncement(announcementId: string, tenantId: string) {
    const BATCH_SIZE = 100
    const BATCH_DELAY_MS = 1000

    try {
      // 공지 정보 조회
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
      })

      if (!announcement || announcement.status !== 'SCHEDULED') {
        logger.warn('[AnnouncementScheduler] 공지를 찾을 수 없거나 상태가 변경됨', {
          announcementId,
        })
        return
      }

      // 수신자 필터에 따라 연락처 조회
      const filter = announcement.recipientFilter as {
        all?: boolean
        regions?: string[]
        companyIds?: string[]
      } | null

      const whereCondition: any = {
        tenantId,
        phone: { not: '' },
      }

      if (filter && !filter.all) {
        if (filter.regions && filter.regions.length > 0) {
          whereCondition.company = {
            region: { in: filter.regions }
          }
        }
        if (filter.companyIds && filter.companyIds.length > 0) {
          whereCondition.companyId = { in: filter.companyIds }
        }
      }

      const contacts = await prisma.contact.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          phone: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      })

      if (contacts.length === 0) {
        logger.warn('[AnnouncementScheduler] 발송 대상 없음, 취소 처리', {
          announcementId,
        })
        await prisma.announcement.update({
          where: { id: announcementId },
          data: { status: AnnouncementStatus.CANCELLED },
        })
        return
      }

      // 트랜잭션으로 상태 업데이트 및 수신자 생성
      await prisma.$transaction(async (tx) => {
        await tx.announcementRecipient.deleteMany({
          where: { announcementId },
        })

        await tx.announcementRecipient.createMany({
          data: contacts.map((contact) => ({
            announcementId,
            contactId: contact.id,
            contactName: contact.name,
            phone: contact.phone!,
            companyName: contact.company?.name || '',
            status: NotificationStatus.PENDING,
          })),
        })

        await tx.announcement.update({
          where: { id: announcementId },
          data: {
            status: AnnouncementStatus.SENDING,
            sentAt: new Date(),
            totalRecipients: contacts.length,
            sentCount: 0,
            failedCount: 0,
          },
        })
      })

      logger.info('[AnnouncementScheduler] 공지 발송 시작', {
        announcementId,
        totalRecipients: contacts.length,
      })

      // 배치 발송 처리
      await this.processBatchSending(announcementId, announcement)
    } catch (error) {
      logger.error('[AnnouncementScheduler] 공지 발송 처리 중 오류', {
        announcementId,
        error,
      })

      await prisma.announcement.update({
        where: { id: announcementId },
        data: { status: AnnouncementStatus.FAILED },
      })
    }
  }

  /**
   * 배치 단위 발송 처리
   */
  private async processBatchSending(
    announcementId: string,
    announcement: { title: string; content: string; channel: string }
  ) {
    const BATCH_SIZE = 100
    const BATCH_DELAY_MS = 1000

    let hasMore = true

    while (hasMore) {
      const recipients = await prisma.announcementRecipient.findMany({
        where: {
          announcementId,
          status: NotificationStatus.PENDING,
        },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      })

      if (recipients.length === 0) {
        hasMore = false
        continue
      }

      // 발송 취소 확인
      const currentAnnouncement = await prisma.announcement.findUnique({
        where: { id: announcementId },
        select: { status: true },
      })

      if (!currentAnnouncement || currentAnnouncement.status === 'CANCELLED') {
        logger.info('[AnnouncementScheduler] 공지 발송 취소됨', { announcementId })
        return
      }

      // 배치 처리
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          this.sendNotificationToRecipient(announcement, recipient)
        )
      )

      let successCount = 0
      let failCount = 0

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const recipient = recipients[i]

        if (result.status === 'fulfilled' && result.value.success) {
          successCount++
          await prisma.announcementRecipient.update({
            where: { id: recipient.id },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
            },
          })
        } else {
          failCount++
          const errorMessage =
            result.status === 'rejected'
              ? result.reason?.message
              : result.value?.error

          await prisma.announcementRecipient.update({
            where: { id: recipient.id },
            data: {
              status: NotificationStatus.FAILED,
              errorMessage: errorMessage || '발송 실패',
            },
          })
        }
      }

      await prisma.announcement.update({
        where: { id: announcementId },
        data: {
          sentCount: { increment: successCount },
          failedCount: { increment: failCount },
        },
      })

      logger.info('[AnnouncementScheduler] 배치 발송 완료', {
        announcementId,
        batchSize: recipients.length,
        successCount,
        failCount,
      })

      if (recipients.length === BATCH_SIZE) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      } else {
        hasMore = false
      }
    }

    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.COMPLETED,
        completedAt: new Date(),
      },
    })

    logger.info('[AnnouncementScheduler] 공지 발송 완료', { announcementId })
  }

  /**
   * 개별 수신자에게 알림 발송
   */
  private async sendNotificationToRecipient(
    announcement: { title: string; content: string; channel: string },
    recipient: { id: string; phone: string; contactName: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: 실제 발송 로직 구현 (SMS, 카카오 알림톡 등)
      logger.debug('[AnnouncementScheduler] 알림 발송', {
        channel: announcement.channel,
        recipient: recipient.phone,
      })

      // 시뮬레이션: 95% 성공률
      const isSuccess = Math.random() > 0.05

      if (!isSuccess) {
        return { success: false, error: '발송 실패 (시뮬레이션)' }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('[AnnouncementScheduler] 스케줄러 중지됨')
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
}

// 싱글톤 인스턴스
export const announcementScheduler = new AnnouncementScheduler()
