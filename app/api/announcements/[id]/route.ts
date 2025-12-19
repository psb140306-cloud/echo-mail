/**
 * 공지 상세 API (Phase 6)
 * GET - 공지 상세 조회
 * PUT - 공지 수정
 * DELETE - 공지 삭제
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { NotificationType, AnnouncementStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// 공지 수정 스키마
const updateAnnouncementSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100).optional(),
  content: z.string().min(1, '내용을 입력해주세요').max(1000).optional(),
  channel: z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  recipientFilter: z.object({
    all: z.boolean().optional(),
    regions: z.array(z.string()).optional(),
    companyIds: z.array(z.string()).optional(),
  }).nullable().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 공지 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()
      const { id } = await params

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const announcement = await prisma.announcement.findFirst({
        where: {
          id,
          tenantId,
        },
        include: {
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      })

      if (!announcement) {
        return createErrorResponse('공지를 찾을 수 없습니다.', 404)
      }

      return createSuccessResponse(announcement)
    } catch (error) {
      logger.error('공지 상세 조회 실패:', error)
      return createErrorResponse('공지를 불러오는데 실패했습니다.')
    }
  })
}

/**
 * PUT: 공지 수정
 * - DRAFT 또는 SCHEDULED 상태에서만 수정 가능
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

      // 기존 공지 조회
      const existingAnnouncement = await prisma.announcement.findFirst({
        where: {
          id,
          tenantId,
        },
      })

      if (!existingAnnouncement) {
        return createErrorResponse('공지를 찾을 수 없습니다.', 404)
      }

      // 수정 가능한 상태인지 확인
      if (!['DRAFT', 'SCHEDULED'].includes(existingAnnouncement.status)) {
        return createErrorResponse(
          '이미 발송 중이거나 완료된 공지는 수정할 수 없습니다.',
          400
        )
      }

      const { data, error } = await parseAndValidate(request, updateAnnouncementSchema)
      if (error) return error

      // 상태 결정: scheduledAt이 있으면 SCHEDULED, 없으면 DRAFT
      let newStatus = existingAnnouncement.status
      if (data.scheduledAt !== undefined) {
        newStatus = data.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT
      }

      const updateData: any = {
        status: newStatus,
      }
      if (data.title) updateData.title = data.title
      if (data.content) updateData.content = data.content
      if (data.channel) updateData.channel = data.channel as NotificationType
      if (data.scheduledAt !== undefined) {
        updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
      }
      if (data.recipientFilter !== undefined) {
        updateData.recipientFilter = data.recipientFilter
      }

      const updatedAnnouncement = await prisma.announcement.update({
        where: { id },
        data: updateData,
      })

      logger.info('공지 수정됨', {
        announcementId: id,
        tenantId,
        userId: user.id,
      })

      return createSuccessResponse(updatedAnnouncement, '공지가 수정되었습니다.')
    } catch (error) {
      logger.error('공지 수정 실패:', error)
      return createErrorResponse('공지 수정에 실패했습니다.')
    }
  })
}

/**
 * DELETE: 공지 삭제
 * - DRAFT 또는 SCHEDULED 상태에서만 삭제 가능
 * - SENDING 이상 상태는 CANCELLED로 변경
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

      // 기존 공지 조회
      const existingAnnouncement = await prisma.announcement.findFirst({
        where: {
          id,
          tenantId,
        },
      })

      if (!existingAnnouncement) {
        return createErrorResponse('공지를 찾을 수 없습니다.', 404)
      }

      // DRAFT나 SCHEDULED 상태면 실제 삭제
      if (['DRAFT', 'SCHEDULED'].includes(existingAnnouncement.status)) {
        // 관련 수신자 레코드도 함께 삭제
        await prisma.$transaction([
          prisma.announcementRecipient.deleteMany({
            where: { announcementId: id },
          }),
          prisma.announcement.delete({
            where: { id },
          }),
        ])

        logger.info('공지 삭제됨', {
          announcementId: id,
          tenantId,
          userId: user.id,
        })

        return createSuccessResponse(null, '공지가 삭제되었습니다.')
      }

      // SENDING 상태면 취소 처리
      if (existingAnnouncement.status === 'SENDING') {
        await prisma.announcement.update({
          where: { id },
          data: {
            status: AnnouncementStatus.CANCELLED,
          },
        })

        logger.info('공지 발송 취소됨', {
          announcementId: id,
          tenantId,
          userId: user.id,
        })

        return createSuccessResponse(null, '공지 발송이 취소되었습니다.')
      }

      // 이미 완료된 공지는 삭제 불가
      return createErrorResponse(
        '이미 완료된 공지는 삭제할 수 없습니다.',
        400
      )
    } catch (error) {
      logger.error('공지 삭제 실패:', error)
      return createErrorResponse('공지 삭제에 실패했습니다.')
    }
  })
}
