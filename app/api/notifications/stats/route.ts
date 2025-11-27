import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'
import { startOfDay, endOfDay, subDays, startOfMonth, format } from 'date-fns'

export const dynamic = 'force-dynamic'

interface DailyStats {
  date: string
  sms: number
  kakao: number
  total: number
  success: number
  failed: number
}

async function getNotificationStats(request: NextRequest) {
  try {
    const tenantId = requireTenant()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7days' // 7days, 30days, thisMonth

    // 기간 설정
    let startDate: Date
    const endDate = endOfDay(new Date())

    switch (period) {
      case '30days':
        startDate = startOfDay(subDays(new Date(), 29))
        break
      case 'thisMonth':
        startDate = startOfMonth(new Date())
        break
      case '7days':
      default:
        startDate = startOfDay(subDays(new Date(), 6))
        break
    }

    // 전체 통계
    const [totalStats, statusStats, typeStats, dailyData, companyStats] = await Promise.all([
      // 전체 발송 건수
      prisma.notificationLog.count({
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // 상태별 통계
      prisma.notificationLog.groupBy({
        by: ['status'],
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
      }),

      // 타입별 통계 (SMS/카카오)
      prisma.notificationLog.groupBy({
        by: ['type'],
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
      }),

      // 일별 통계 - Prisma 쿼리로 대체
      prisma.notificationLog.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          createdAt: true,
          type: true,
          status: true,
        },
      }),

      // 업체별 발송 통계 (상위 10개)
      prisma.notificationLog.groupBy({
        by: ['companyId'],
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
          companyId: { not: null },
        },
        _count: true,
        orderBy: {
          _count: {
            companyId: 'desc',
          },
        },
        take: 10,
      }),
    ])

    // 상태별 집계
    const statusMap: Record<string, number> = {}
    statusStats.forEach((s) => {
      statusMap[s.status] = s._count
    })

    // 타입별 집계
    const typeMap: Record<string, number> = {}
    typeStats.forEach((t) => {
      typeMap[t.type] = t._count
    })

    // 일별 데이터 가공
    const dailyMap = new Map<string, DailyStats>()

    // 기간 내 모든 날짜 초기화
    const days = period === '30days' ? 30 : period === 'thisMonth' ? new Date().getDate() : 7
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
      dailyMap.set(date, {
        date,
        sms: 0,
        kakao: 0,
        total: 0,
        success: 0,
        failed: 0,
      })
    }

    // 실제 데이터 채우기
    dailyData.forEach((row) => {
      const dateStr = format(new Date(row.createdAt), 'yyyy-MM-dd')
      const existing = dailyMap.get(dateStr)
      if (existing) {
        existing.total += 1

        if (row.type === 'SMS') {
          existing.sms += 1
        } else if (row.type === 'KAKAO_ALIMTALK' || row.type === 'KAKAO_FRIENDTALK') {
          existing.kakao += 1
        }

        if (row.status === 'SENT' || row.status === 'DELIVERED') {
          existing.success += 1
        } else if (row.status === 'FAILED') {
          existing.failed += 1
        }
      }
    })

    // 업체 정보 조회
    const companyIds = companyStats.map((c) => c.companyId).filter(Boolean) as string[]
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    })
    const companyNameMap = new Map(companies.map((c) => [c.id, c.name]))

    const companyStatsWithNames = companyStats.map((c) => ({
      companyId: c.companyId,
      companyName: c.companyId ? companyNameMap.get(c.companyId) || '알 수 없음' : '알 수 없음',
      count: c._count,
    }))

    // 성공률 계산
    const successCount = (statusMap['SENT'] || 0) + (statusMap['DELIVERED'] || 0)
    const failedCount = statusMap['FAILED'] || 0
    const successRate = totalStats > 0 ? Math.round((successCount / totalStats) * 100) : 0

    const result = {
      period,
      summary: {
        total: totalStats,
        success: successCount,
        failed: failedCount,
        pending: statusMap['PENDING'] || 0,
        successRate,
      },
      byType: {
        sms: typeMap['SMS'] || 0,
        kakaoAlimtalk: typeMap['KAKAO_ALIMTALK'] || 0,
        kakaoFriendtalk: typeMap['KAKAO_FRIENDTALK'] || 0,
      },
      daily: Array.from(dailyMap.values()),
      topCompanies: companyStatsWithNames,
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('발송 통계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '통계 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => getNotificationStats(request))
}
