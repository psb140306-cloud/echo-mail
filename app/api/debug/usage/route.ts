import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

async function debugUsage(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID' }, { status: 401 })
    }

    const now = new Date()
    const koreaOffset = 9 * 60 // UTC+9
    const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000)

    const startOfMonth = new Date(Date.UTC(
      koreaTime.getUTCFullYear(),
      koreaTime.getUTCMonth(),
      1,
      0, 0, 0, 0
    ))
    startOfMonth.setHours(startOfMonth.getHours() - 9)

    // 모든 이메일 로그 조회 (최근 10개)
    const allEmails = await prisma.emailLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        from: true,
        subject: true,
      },
    })

    // 모든 알림 로그 조회 (최근 10개)
    const allNotifications = await prisma.notificationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
      },
    })

    // 이번 달 이메일 (계산된 startOfMonth 사용)
    const emailsThisMonth = await prisma.emailLog.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    })

    // 이번 달 알림 (계산된 startOfMonth 사용)
    const notificationsThisMonth = await prisma.notificationLog.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    })

    // 전체 개수
    const totalEmails = await prisma.emailLog.count({ where: { tenantId } })
    const totalNotifications = await prisma.notificationLog.count({ where: { tenantId } })

    return NextResponse.json({
      success: true,
      debug: {
        now_UTC: now.toISOString(),
        koreaTime_UTC: koreaTime.toISOString(),
        startOfMonth_UTC: startOfMonth.toISOString(),
        year: koreaTime.getUTCFullYear(),
        month: koreaTime.getUTCMonth() + 1,
      },
      counts: {
        totalEmails,
        totalNotifications,
        emailsThisMonth,
        notificationsThisMonth,
      },
      recentEmails: allEmails.map(e => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        from: e.from,
        subject: e.subject,
      })),
      recentNotifications: allNotifications.map(n => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        type: n.type,
        status: n.status,
      })),
    })
  } catch (error) {
    logger.error('Debug usage failed', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => debugUsage(request))
}
