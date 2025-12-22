import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext, prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// GET: 통계 데이터 조회
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
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      // 기본 날짜 범위: 최근 7일
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()

      // KST 기준 오늘
      const now = new Date()
      const kstOffset = 9 * 60 * 60 * 1000
      const kstNow = new Date(now.getTime() + kstOffset)
      const today = new Date(
        Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0, 0)
      )
      today.setTime(today.getTime() - kstOffset)

      // 1. 기간 내 일별 통계 계산
      const dailyStats = await prisma.$queryRaw<
        Array<{
          date: Date
          emailsProcessed: bigint
          smsSuccess: bigint
          smsFailed: bigint
          kakaoSuccess: bigint
          kakaoFailed: bigint
        }>
      >`
        SELECT
          DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
          COUNT(CASE WHEN type = 'EMAIL' THEN 1 END)::bigint as "emailsProcessed",
          COUNT(CASE WHEN type = 'SMS' AND status IN ('SENT', 'DELIVERED') THEN 1 END)::bigint as "smsSuccess",
          COUNT(CASE WHEN type = 'SMS' AND status = 'FAILED' THEN 1 END)::bigint as "smsFailed",
          COUNT(CASE WHEN type = 'KAKAO_ALIMTALK' AND status IN ('SENT', 'DELIVERED') THEN 1 END)::bigint as "kakaoSuccess",
          COUNT(CASE WHEN type = 'KAKAO_ALIMTALK' AND status = 'FAILED' THEN 1 END)::bigint as "kakaoFailed"
        FROM "NotificationLog"
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${start}
          AND "createdAt" <= ${end}
        GROUP BY DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
        ORDER BY date DESC
        LIMIT 30
      `

      // 2. 요약 통계
      const [totalEmails, totalNotifications, successNotifications, todayEmails, todayNotifications] =
        await Promise.all([
          // 총 이메일 수
          prisma.emailLog.count({
            where: {
              tenantId,
              createdAt: { gte: start, lte: end },
            },
          }),
          // 총 알림 수
          prisma.notificationLog.count({
            where: {
              tenantId,
              createdAt: { gte: start, lte: end },
            },
          }),
          // 성공 알림 수
          prisma.notificationLog.count({
            where: {
              tenantId,
              createdAt: { gte: start, lte: end },
              status: { in: ['SENT', 'DELIVERED'] },
            },
          }),
          // 오늘 이메일 수
          prisma.emailLog.count({
            where: {
              tenantId,
              createdAt: { gte: today },
            },
          }),
          // 오늘 알림 수
          prisma.notificationLog.count({
            where: {
              tenantId,
              createdAt: { gte: today },
            },
          }),
        ])

      // 3. 업체별 통계
      const byCompanyRaw = await prisma.notificationLog.groupBy({
        by: ['companyId'],
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          companyId: { not: null },
        },
        _count: true,
      })

      // 업체 정보 가져오기
      const companyIds = byCompanyRaw.map((c) => c.companyId).filter(Boolean) as string[]
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
      const companyMap = new Map(companies.map((c) => [c.id, c.name]))

      // 업체별 성공률 계산
      const byCompanyWithSuccess = await Promise.all(
        byCompanyRaw.slice(0, 10).map(async (item) => {
          const successCount = await prisma.notificationLog.count({
            where: {
              tenantId,
              companyId: item.companyId,
              createdAt: { gte: start, lte: end },
              status: { in: ['SENT', 'DELIVERED'] },
            },
          })

          const emailCount = await prisma.emailLog.count({
            where: {
              tenantId,
              companyId: item.companyId,
              createdAt: { gte: start, lte: end },
            },
          })

          return {
            companyName: companyMap.get(item.companyId!) || '알 수 없음',
            emailsReceived: emailCount,
            notificationsSent: item._count,
            successRate: item._count > 0 ? (successCount / item._count) * 100 : 0,
          }
        })
      )

      // 4. 오류 유형별 통계
      const errorStats = await prisma.notificationLog.groupBy({
        by: ['errorCode'],
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          status: 'FAILED',
          errorCode: { not: null },
        },
        _count: true,
      })

      const totalErrors = errorStats.reduce((sum, e) => sum + e._count, 0)
      const errorsByType = errorStats.map((e) => ({
        type: e.errorCode || 'UNKNOWN',
        count: e._count,
        percentage: totalErrors > 0 ? Math.round((e._count / totalErrors) * 100) : 0,
      }))

      // 결과 반환
      return NextResponse.json({
        success: true,
        data: {
          daily: dailyStats.map((d) => ({
            date: d.date.toISOString().split('T')[0],
            emailsProcessed: Number(d.emailsProcessed),
            smsSuccess: Number(d.smsSuccess),
            smsFailed: Number(d.smsFailed),
            kakaoSuccess: Number(d.kakaoSuccess),
            kakaoFailed: Number(d.kakaoFailed),
          })),
          summary: {
            totalEmails,
            totalNotifications,
            successRate: totalNotifications > 0 ? (successNotifications / totalNotifications) * 100 : 0,
            todayEmails,
            todayNotifications,
          },
          byCompany: byCompanyWithSuccess,
          errorsByType: errorsByType.length > 0 ? errorsByType : [{ type: '오류 없음', count: 0, percentage: 0 }],
        },
      })
    } catch (error) {
      logger.error('통계 조회 실패:', error)
      return NextResponse.json(
        {
          success: false,
          error: '통계를 불러오는데 실패했습니다.',
        },
        { status: 500 }
      )
    }
  })
}
