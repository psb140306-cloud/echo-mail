/**
 * 대량 공지 발송 API (Phase 6)
 * POST - 공지 생성
 * GET - 공지 목록 조회
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

// 공지 생성 스키마
const createAnnouncementSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100),
  content: z.string().min(1, '내용을 입력해주세요').max(1000),
  channel: z.enum(['SMS', 'KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK']),
  scheduledAt: z.string().datetime().optional(), // ISO 8601 형식
  recipientFilter: z.object({
    all: z.boolean().optional(),
    regions: z.array(z.string()).optional(),
    companyIds: z.array(z.string()).optional(),
  }).optional(),
})

// 목록 조회 쿼리 스키마
const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => parseInt(v || '20')),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
})

/**
 * POST: 공지 생성
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      const { data, error } = await parseAndValidate(request, createAnnouncementSchema)
      if (error) return error

      // 공지 생성
      const announcement = await prisma.announcement.create({
        data: {
          tenantId,
          title: data.title,
          content: data.content,
          channel: data.channel as NotificationType,
          status: data.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          recipientFilter: data.recipientFilter as any || undefined,
          createdBy: user.id,
        },
      })

      logger.info('공지 생성됨', {
        announcementId: announcement.id,
        tenantId,
        userId: user.id,
        title: data.title,
      })

      return createSuccessResponse(announcement, '공지가 생성되었습니다.')
    } catch (error) {
      logger.error('공지 생성 실패:', error)
      return createErrorResponse('공지 생성에 실패했습니다.')
    }
  })
}

/**
 * GET: 공지 목록 조회
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const status = searchParams.get('status') as AnnouncementStatus | null

      const skip = (page - 1) * limit

      const where = {
        tenantId,
        ...(status && { status }),
      }

      const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            channel: true,
            status: true,
            scheduledAt: true,
            sentAt: true,
            completedAt: true,
            totalRecipients: true,
            sentCount: true,
            failedCount: true,
            createdAt: true,
          },
        }),
        prisma.announcement.count({ where }),
      ])

      return createSuccessResponse({
        announcements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('공지 목록 조회 실패:', error)
      return createErrorResponse('공지 목록을 불러오는데 실패했습니다.')
    }
  })
}
