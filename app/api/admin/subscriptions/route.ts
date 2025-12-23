import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const dbSubscriptions = await prisma.subscription.findMany({
      include: {
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const subscriptions = dbSubscriptions.map((sub) => ({
      id: sub.id,
      plan_id: sub.plan,
      status: sub.status.toLowerCase(),
      current_period_end: sub.currentPeriodEnd,
      price_per_month: sub.priceAmount,
      tenants: {
        name: sub.tenant.name,
        slug: sub.tenant.subdomain,
      },
    }))

    return NextResponse.json({
      success: true,
      subscriptions,
    })
  } catch (error) {
    console.error('[Admin Subscriptions API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
