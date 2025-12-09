import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { sendEmail, FrontendAttachment } from '@/lib/mail/mail-sender'

/**
 * 예약된 메일을 발송하는 프로세서
 * 스케줄러에서 1분마다 호출됨
 */
export async function processScheduledEmails(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const now = new Date()
  let processed = 0
  let sent = 0
  let failed = 0

  try {
    // 발송 시간이 된 PENDING 메일 조회
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            subscriptionPlan: true,
            mailSendingEnabled: true,
          },
        },
      },
      take: 50, // 한 번에 최대 50개 처리
    })

    if (pendingEmails.length === 0) {
      return { processed: 0, sent: 0, failed: 0 }
    }

    logger.info(`[ScheduledEmailProcessor] ${pendingEmails.length}개의 예약 메일 처리 시작`)

    for (const scheduledEmail of pendingEmails) {
      processed++

      try {
        // 상태를 SENDING으로 변경
        await prisma.scheduledEmail.update({
          where: { id: scheduledEmail.id },
          data: { status: 'SENDING' },
        })

        // 메일 발신 기능이 비활성화된 경우
        if (!scheduledEmail.tenant.mailSendingEnabled) {
          await prisma.scheduledEmail.update({
            where: { id: scheduledEmail.id },
            data: {
              status: 'FAILED',
              errorMessage: '메일 발신 기능이 비활성화되어 있습니다.',
            },
          })
          failed++
          continue
        }

        // 메일 발송
        const result = await sendEmail({
          tenantId: scheduledEmail.tenantId,
          to: scheduledEmail.to,
          cc: scheduledEmail.cc.length > 0 ? scheduledEmail.cc : undefined,
          bcc: scheduledEmail.bcc.length > 0 ? scheduledEmail.bcc : undefined,
          subject: scheduledEmail.subject,
          text: scheduledEmail.text || undefined,
          html: scheduledEmail.html,
          attachments: scheduledEmail.attachments as FrontendAttachment[] | undefined,
        })

        if (result.success) {
          await prisma.scheduledEmail.update({
            where: { id: scheduledEmail.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              messageId: result.messageId,
            },
          })
          sent++
          logger.info(`[ScheduledEmailProcessor] 예약 메일 발송 성공: ${scheduledEmail.id}`)
        } else {
          await prisma.scheduledEmail.update({
            where: { id: scheduledEmail.id },
            data: {
              status: 'FAILED',
              errorMessage: result.error || '알 수 없는 오류',
            },
          })
          failed++
          logger.error(`[ScheduledEmailProcessor] 예약 메일 발송 실패: ${scheduledEmail.id}`, {
            error: result.error,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
        await prisma.scheduledEmail.update({
          where: { id: scheduledEmail.id },
          data: {
            status: 'FAILED',
            errorMessage,
          },
        })
        failed++
        logger.error(`[ScheduledEmailProcessor] 예약 메일 처리 중 오류: ${scheduledEmail.id}`, {
          error: errorMessage,
        })
      }
    }

    logger.info(`[ScheduledEmailProcessor] 처리 완료 - 전체: ${processed}, 성공: ${sent}, 실패: ${failed}`)
  } catch (error) {
    logger.error('[ScheduledEmailProcessor] 예약 메일 처리 중 오류:', error)
  }

  return { processed, sent, failed }
}

/**
 * 만료된 예약 메일 정리 (30일 이상 지난 발송/실패/취소 건)
 */
export async function cleanupOldScheduledEmails(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = await prisma.scheduledEmail.deleteMany({
      where: {
        status: {
          in: ['SENT', 'FAILED', 'CANCELLED'],
        },
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    })

    if (result.count > 0) {
      logger.info(`[ScheduledEmailProcessor] ${result.count}개의 오래된 예약 메일 삭제`)
    }

    return result.count
  } catch (error) {
    logger.error('[ScheduledEmailProcessor] 오래된 예약 메일 정리 중 오류:', error)
    return 0
  }
}
