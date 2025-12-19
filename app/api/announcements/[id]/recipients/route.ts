/**
 * 공지 수신자 목록 API (Phase 6)
 * GET - 수신자 목록 조회 (발송 상태 포함)
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { NotificationStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 공지 수신자 목록 조회
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

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '50')
      const status = searchParams.get('status') as NotificationStatus | null

      // 공지 존재 확인
      const announcement = await prisma.announcement.findFirst({
        where: {
          id,
          tenantId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          totalRecipients: true,
          sentCount: true,
          failedCount: true,
        },
      })

      if (!announcement) {
        return createErrorResponse('공지를 찾을 수 없습니다.', 404)
      }

      const skip = (page - 1) * limit

      const where = {
        announcementId: id,
        ...(status && { status }),
      }

      const [recipients, total] = await Promise.all([
        prisma.announcementRecipient.findMany({
          where,
          orderBy: { id: 'asc' },
          skip,
          take: limit,
          select: {
            id: true,
            contactId: true,
            contactName: true,
            phone: true,
            companyName: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            errorMessage: true,
            retryCount: true,
          },
        }),
        prisma.announcementRecipient.count({ where }),
      ])

      // 상태별 통계
      const stats = await prisma.announcementRecipient.groupBy({
        by: ['status'],
        where: { announcementId: id },
        _count: true,
      })

      const statusCounts = stats.reduce(
        (acc, item) => {
          acc[item.status] = item._count
          return acc
        },
        {} as Record<string, number>
      )

      return createSuccessResponse({
        announcement: {
          id: announcement.id,
          title: announcement.title,
          status: announcement.status,
        },
        recipients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: announcement.totalRecipients,
          pending: statusCounts['PENDING'] || 0,
          sent: statusCounts['SENT'] || 0,
          delivered: statusCounts['DELIVERED'] || 0,
          failed: statusCounts['FAILED'] || 0,
        },
      })
    } catch (error) {
      logger.error('공지 수신자 목록 조회 실패:', error)
      return createErrorResponse('수신자 목록을 불러오는데 실패했습니다.')
    }
  })
}
