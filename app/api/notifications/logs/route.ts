import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

// GET 통계: /api/notifications/logs?stats=true
async function getStats(tenantId: string) {
  try {
    // KST (UTC+9) 기준으로 오늘 시작 시간 계산
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // 9시간을 밀리초로
    const kstNow = new Date(now.getTime() + kstOffset)

    // KST 기준 오늘 00:00:00을 UTC로 변환
    const today = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0, 0)
    )
    today.setTime(today.getTime() - kstOffset) // UTC 기준으로 변환

    // KST 기준 이번 달 1일 00:00:00을 UTC로 변환
    const thisMonth = new Date(
      Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1, 0, 0, 0, 0)
    )
    thisMonth.setTime(thisMonth.getTime() - kstOffset) // UTC 기준으로 변환

    const [todayStats, monthStats, typeStats, statusStats] = await Promise.all([
      // 오늘 통계 (성공한 것만: SENT 또는 DELIVERED)
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: {
            gte: today,
          },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),

      // 이번 달 통계 (성공한 것만: SENT 또는 DELIVERED)
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: {
            gte: thisMonth,
          },
          status: { in: ['SENT', 'DELIVERED'] },
        },
      }),

      // 타입별 통계
      prisma.notificationLog.groupBy({
        by: ['type'],
        where: {
          tenantId,
        },
        _count: true,
      }),

      // 상태별 통계
      prisma.notificationLog.groupBy({
        by: ['status'],
        where: {
          tenantId,
        },
        _count: true,
      }),
    ])

    return {
      today: todayStats,
      thisMonth: monthStats,
      byType: typeStats.reduce(
        (acc, item) => {
          acc[item.type] = item._count
          return acc
        },
        {} as Record<string, number>
      ),
      byStatus: statusStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count
          return acc
        },
        {} as Record<string, number>
      ),
    }
  } catch (error) {
    logger.error('통계 조회 실패:', error)
    throw error
  }
}

// GET: 발송 내역 조회 또는 통계
export async function GET(request: NextRequest) {
  return withTenantContext(request, async (req) => {
    try {
      // TenantContext에서 tenantId 가져오기
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: '테넌트 정보를 찾을 수 없습니다.' },
          { status: 401 }
        )
      }

      const { searchParams } = new URL(req.url)

      // 통계 조회
      if (searchParams.get('stats') === 'true') {
        const stats = await getStats(tenantId)
        return NextResponse.json({
          success: true,
          data: stats,
        })
      }

      // 발송 내역 조회
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '50')
      const type = searchParams.get('type') // SMS, KAKAO_ALIMTALK, EMAIL
      const status = searchParams.get('status') // SUCCESS, FAILED, PENDING

      const skip = (page - 1) * limit

      const where: any = {
        tenantId,
      }

      if (type) {
        where.type = type
      }

      if (status) {
        where.status = status
      }

      const [logs, total] = await Promise.all([
        prisma.notificationLog.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
          include: {
            company: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.notificationLog.count({ where }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      })
    } catch (error) {
      logger.error('발송 내역 조회 실패:', error)
      return NextResponse.json(
        {
          success: false,
          error: '발송 내역을 불러오는데 실패했습니다.',
        },
        { status: 500 }
      )
    }
  })
}
