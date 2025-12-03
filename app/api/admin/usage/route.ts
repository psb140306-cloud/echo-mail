import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

// 슈퍼어드민용 전체 사용량 통계 조회
export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 모든 테넌트의 사용량 조회
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            companies: true,
            members: true,
          },
        },
      },
    })

    // 전체 알림 로그 통계
    const totalNotifications = await prisma.notificationLog.count()
    const smsCount = await prisma.notificationLog.count({
      where: { type: 'SMS' },
    })
    const kakaoCount = await prisma.notificationLog.count({
      where: { type: { in: ['KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK'] } },
    })

    // 최근 30일 알림 통계
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentNotifications = await prisma.notificationLog.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    const recentSMS = await prisma.notificationLog.count({
      where: {
        type: 'SMS',
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    const recentKakao = await prisma.notificationLog.count({
      where: {
        type: { in: ['KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    // 일별 알림 발송 통계 (최근 7일)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyStats = await prisma.notificationLog.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    })

    // 날짜별로 집계
    const dailyStatsMap = new Map<string, number>()
    dailyStats.forEach((stat) => {
      const dateKey = stat.createdAt.toISOString().split('T')[0]
      dailyStatsMap.set(dateKey, (dailyStatsMap.get(dateKey) || 0) + stat._count)
    })

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      const dateKey = date.toISOString().split('T')[0]
      return {
        date: dateKey,
        count: dailyStatsMap.get(dateKey) || 0,
      }
    })

    // 테넌트별 사용량 통계
    const tenantUsage = await Promise.all(
      tenants.map(async (tenant) => {
        const notificationCount = await prisma.notificationLog.count({
          where: { tenantId: tenant.id },
        })

        const sms = await prisma.notificationLog.count({
          where: { tenantId: tenant.id, type: 'SMS' },
        })

        const kakao = await prisma.notificationLog.count({
          where: {
            tenantId: tenant.id,
            type: { in: ['KAKAO_ALIMTALK', 'KAKAO_FRIENDTALK'] },
          },
        })

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          subdomain: tenant.subdomain,
          memberCount: tenant._count.members,
          companyCount: tenant._count.companies,
          notifications: {
            total: notificationCount,
            sms,
            kakao,
          },
        }
      })
    )

    return NextResponse.json({
      success: true,
      summary: {
        totalTenants: tenants.length,
        totalMembers: tenants.reduce((sum, t) => sum + t._count.members, 0),
        totalCompanies: tenants.reduce((sum, t) => sum + t._count.companies, 0),
        totalNotifications,
        smsCount,
        kakaoCount,
      },
      recent30Days: {
        total: recentNotifications,
        sms: recentSMS,
        kakao: recentKakao,
      },
      dailyStats: last7Days,
      tenantUsage,
    })
  } catch (error) {
    console.error('[Admin Usage API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
