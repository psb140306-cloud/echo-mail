import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext, prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// GET: 시스템 로그 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async (req) => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: '테넌트 정보를 찾을 수 없습니다.' },
          { status: 401 }
        )
      }

      const { searchParams } = new URL(req.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '50')
      const level = searchParams.get('level') // error, warn, info, debug
      const category = searchParams.get('category') // email, sms, kakao, system
      const search = searchParams.get('search')
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      const skip = (page - 1) * limit

      // 시스템 로그는 ActivityLog를 사용하거나, 별도 로그 테이블이 없으면 NotificationLog 기반으로 생성
      // 여기서는 NotificationLog와 EmailLog를 조합하여 시스템 로그로 표시

      const where: any = {
        tenantId,
      }

      if (startDate) {
        where.createdAt = {
          ...where.createdAt,
          gte: new Date(startDate),
        }
      }

      if (endDate) {
        where.createdAt = {
          ...where.createdAt,
          lte: new Date(endDate + 'T23:59:59.999Z'),
        }
      }

      // ActivityLog에서 시스템 로그 조회
      const [activityLogs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: {
            tenantId,
            ...(startDate && {
              createdAt: {
                gte: new Date(startDate),
              },
            }),
            ...(endDate && {
              createdAt: {
                lte: new Date(endDate + 'T23:59:59.999Z'),
              },
            }),
            ...(search && {
              OR: [
                { action: { contains: search, mode: 'insensitive' } },
                { details: { contains: search, mode: 'insensitive' } },
              ],
            }),
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({
          where: {
            tenantId,
            ...(startDate && {
              createdAt: {
                gte: new Date(startDate),
              },
            }),
            ...(endDate && {
              createdAt: {
                lte: new Date(endDate + 'T23:59:59.999Z'),
              },
            }),
          },
        }),
      ])

      // ActivityLog를 LogEntry 형식으로 변환
      const logs = activityLogs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        level: 'info' as const,
        category: 'system' as const,
        message: `${log.action}: ${log.details || ''}`,
        details: log.metadata,
        companyName: undefined,
        contactName: undefined,
      }))

      return NextResponse.json({
        success: true,
        data: logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('시스템 로그 조회 실패:', error)
      return NextResponse.json(
        {
          success: false,
          error: '시스템 로그를 불러오는데 실패했습니다.',
        },
        { status: 500 }
      )
    }
  })
}
