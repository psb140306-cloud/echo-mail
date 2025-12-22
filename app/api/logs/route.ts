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
      const search = searchParams.get('search')
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      const skip = (page - 1) * limit

      // where 조건 구성
      const whereConditions: any = {
        tenantId,
      }

      if (startDate) {
        whereConditions.createdAt = {
          ...whereConditions.createdAt,
          gte: new Date(startDate),
        }
      }

      if (endDate) {
        whereConditions.createdAt = {
          ...whereConditions.createdAt,
          lte: new Date(endDate + 'T23:59:59.999Z'),
        }
      }

      if (search) {
        whereConditions.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      // ActivityLog에서 시스템 로그 조회
      let logs: any[] = []
      let total = 0

      try {
        const [activityLogs, count] = await Promise.all([
          prisma.activityLog.findMany({
            where: whereConditions,
            orderBy: {
              createdAt: 'desc',
            },
            skip,
            take: limit,
          }),
          prisma.activityLog.count({
            where: whereConditions,
          }),
        ])

        total = count

        // ActivityLog를 LogEntry 형식으로 변환
        logs = activityLogs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          level: 'info' as const,
          category: 'system' as const,
          message: `${log.action}: ${log.description || ''}`,
          details: log.metadata,
          companyName: undefined,
          contactName: undefined,
        }))
      } catch (dbError) {
        // ActivityLog 테이블에 tenantId 컬럼이 없는 경우 빈 배열 반환
        logger.warn('ActivityLog 조회 실패 (마이그레이션 필요):', dbError)
        logs = []
        total = 0
      }

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
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('시스템 로그 조회 실패:', { error: errorMessage, stack: errorStack })
      return NextResponse.json(
        {
          success: false,
          error: `시스템 로그를 불러오는데 실패했습니다: ${errorMessage}`,
        },
        { status: 500 }
      )
    }
  })
}
