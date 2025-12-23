import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * DB에 실제 데이터가 있는지 확인하는 API
 */
export async function GET() {
  try {
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // 1. NotificationLog 데이터 확인
    const notificationCount = await prisma.notificationLog.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    })

    const notificationSample = await prisma.notificationLog.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 2. Announcement 데이터 확인
    const announcementCount = await prisma.announcement.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    })

    const announcementSample = await prisma.announcement.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 3. Subscription 데이터 확인
    const subscriptionCount = await prisma.subscription.count()
    const activeSubscriptionCount = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    })

    const subscriptionSample = await prisma.subscription.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 4. Tenant 데이터 확인
    const tenantCount = await prisma.tenant.count()

    return NextResponse.json({
      success: true,
      period: {
        start: startOfMonth.toISOString(),
        end: now.toISOString(),
      },
      data: {
        notificationLog: {
          totalCount: notificationCount,
          thisMonthCount: notificationCount,
          sample: notificationSample ? {
            id: notificationSample.id,
            type: notificationSample.type,
            status: notificationSample.status,
            createdAt: notificationSample.createdAt,
          } : null,
        },
        announcement: {
          totalCount: announcementCount,
          thisMonthCount: announcementCount,
          sample: announcementSample ? {
            id: announcementSample.id,
            channel: announcementSample.channel,
            createdAt: announcementSample.createdAt,
          } : null,
        },
        subscription: {
          totalCount: subscriptionCount,
          activeCount: activeSubscriptionCount,
          sample: subscriptionSample ? {
            id: subscriptionSample.id,
            plan: subscriptionSample.plan,
            status: subscriptionSample.status,
            priceAmount: subscriptionSample.priceAmount,
          } : null,
        },
        tenant: {
          totalCount: tenantCount,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Data Check] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
