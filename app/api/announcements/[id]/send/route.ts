/**
 * 공지 발송 API (Phase 6)
 * POST - 즉시 발송 시작
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { AnnouncementStatus, NotificationStatus } from '@prisma/client'
import { createSMSProviderFromEnv } from '@/lib/notifications/sms/sms-provider'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: 공지 즉시 발송
 * - DRAFT 또는 SCHEDULED 상태에서만 발송 가능
 * - 수신자 필터에 따라 연락처를 조회하여 발송 대상 생성
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()
      const { id } = await params

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      // 공지 조회
      const announcement = await prisma.announcement.findFirst({
        where: {
          id,
          tenantId,
        },
      })

      if (!announcement) {
        return createErrorResponse('공지를 찾을 수 없습니다.', 404)
      }

      // 발송 가능한 상태인지 확인
      if (!['DRAFT', 'SCHEDULED'].includes(announcement.status)) {
        return createErrorResponse(
          '이미 발송 중이거나 완료된 공지입니다.',
          400
        )
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

      // 필터 적용
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
        return createErrorResponse(
          '발송 대상 연락처가 없습니다. 필터 조건을 확인해주세요.',
          400
        )
      }

      // 트랜잭션으로 상태 업데이트 및 수신자 생성
      await prisma.$transaction(async (tx) => {
        // 기존 수신자 레코드 삭제 (재발송 시)
        await tx.announcementRecipient.deleteMany({
          where: { announcementId: id },
        })

        // 수신자 레코드 생성
        await tx.announcementRecipient.createMany({
          data: contacts.map((contact) => ({
            announcementId: id,
            contactId: contact.id,
            contactName: contact.name,
            phone: contact.phone!,
            companyName: contact.company?.name || '',
            status: NotificationStatus.PENDING,
          })),
        })

        // 공지 상태 업데이트
        await tx.announcement.update({
          where: { id },
          data: {
            status: AnnouncementStatus.SENDING,
            sentAt: new Date(),
            totalRecipients: contacts.length,
            sentCount: 0,
            failedCount: 0,
          },
        })
      })

      logger.info('공지 발송 시작', {
        announcementId: id,
        tenantId,
        userId: user.id,
        totalRecipients: contacts.length,
      })

      // 실제 발송은 백그라운드 작업으로 처리 (별도 프로세서)
      // 여기서는 발송 대기열에 추가하는 것까지만 처리
      triggerAnnouncementProcessing(id, tenantId)

      return createSuccessResponse(
        {
          announcementId: id,
          totalRecipients: contacts.length,
          status: 'SENDING',
        },
        `${contacts.length}명에게 공지 발송이 시작되었습니다.`
      )
    } catch (error) {
      logger.error('공지 발송 시작 실패:', error)
      return createErrorResponse('공지 발송을 시작하는데 실패했습니다.')
    }
  })
}

/**
 * 공지 발송 백그라운드 처리 트리거
 * 실제 구현은 별도의 발송 프로세서에서 처리
 */
async function triggerAnnouncementProcessing(announcementId: string, tenantId: string) {
  // TODO: 실제 발송 프로세서 호출
  // 옵션 1: 내부 API 호출
  // 옵션 2: 메시지 큐 (Redis, SQS 등)
  // 옵션 3: 즉시 처리 (소규모)

  // 현재는 즉시 처리 방식으로 구현
  processAnnouncementInBackground(announcementId, tenantId).catch((error) => {
    logger.error('백그라운드 발송 처리 실패', { announcementId, error })
  })
}

/**
 * 백그라운드에서 실제 발송 처리
 * 배치 단위로 처리하여 API 부하 분산
 */
async function processAnnouncementInBackground(announcementId: string, tenantId: string) {
  const BATCH_SIZE = 100
  const BATCH_DELAY_MS = 1000 // 배치 간 대기 시간

  try {
    let offset = 0
    let hasMore = true

    while (hasMore) {
      // 대기 중인 수신자 배치 조회
      const recipients = await prisma.announcementRecipient.findMany({
        where: {
          announcementId,
          status: NotificationStatus.PENDING,
        },
        take: BATCH_SIZE,
        skip: offset,
        orderBy: { id: 'asc' },
      })

      if (recipients.length === 0) {
        hasMore = false
        continue
      }

      // 공지 정보 조회 (발송에 필요한 정보)
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
        select: {
          title: true,
          content: true,
          channel: true,
          status: true,
        },
      })

      // 발송 취소된 경우 중단
      if (!announcement || announcement.status === 'CANCELLED') {
        logger.info('공지 발송 취소됨', { announcementId })
        return
      }

      // 배치 처리
      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          sendNotificationToRecipient(announcement, recipient, tenantId)
        )
      )

      // 결과 집계 및 업데이트
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
          const errorMessage = result.status === 'rejected'
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

      // 공지 통계 업데이트
      await prisma.announcement.update({
        where: { id: announcementId },
        data: {
          sentCount: { increment: successCount },
          failedCount: { increment: failCount },
        },
      })

      logger.info('배치 발송 완료', {
        announcementId,
        batchSize: recipients.length,
        successCount,
        failCount,
      })

      // 다음 배치 전 대기
      if (recipients.length === BATCH_SIZE) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      } else {
        hasMore = false
      }
    }

    // 발송 완료 처리
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.COMPLETED,
        completedAt: new Date(),
      },
    })

    logger.info('공지 발송 완료', { announcementId })
  } catch (error) {
    logger.error('공지 발송 처리 중 오류', { announcementId, error })

    // 실패 상태로 업데이트
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status: AnnouncementStatus.FAILED,
      },
    })
  }
}

/**
 * 개별 수신자에게 알림 발송
 */
async function sendNotificationToRecipient(
  announcement: { title: string; content: string; channel: string },
  recipient: { id: string; phone: string; contactName: string },
  tenantId: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    logger.debug('알림 발송 시작', {
      channel: announcement.channel,
      recipient: recipient.phone,
      title: announcement.title,
    })

    // SMS 채널로 발송
    if (announcement.channel === 'SMS') {
      const smsProvider = createSMSProviderFromEnv()

      const result = await smsProvider.sendSMS({
        to: recipient.phone,
        message: announcement.content,
        subject: announcement.title,
      })

      if (result.success) {
        logger.info('공지 SMS 발송 성공', {
          recipient: recipient.phone,
          messageId: result.messageId,
        })
        return { success: true, messageId: result.messageId }
      } else {
        logger.warn('공지 SMS 발송 실패', {
          recipient: recipient.phone,
          error: result.error,
        })
        return { success: false, error: result.error }
      }
    }

    // 카카오 알림톡/친구톡은 추후 구현
    if (announcement.channel === 'KAKAO_ALIMTALK' || announcement.channel === 'KAKAO_FRIENDTALK') {
      logger.warn('카카오 채널은 아직 구현되지 않았습니다', {
        channel: announcement.channel,
      })
      return { success: false, error: '카카오 채널은 아직 지원되지 않습니다.' }
    }

    return { success: false, error: '지원하지 않는 채널입니다.' }
  } catch (error) {
    logger.error('알림 발송 중 오류', {
      recipient: recipient.phone,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }
  }
}
