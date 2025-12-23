import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const { id } = await params

    const dbSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
          },
        },
      },
    })

    if (!dbSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    const subscription = {
      id: dbSubscription.id,
      plan_id: dbSubscription.plan,
      status: dbSubscription.status.toLowerCase(),
      current_period_start: dbSubscription.currentPeriodStart,
      current_period_end: dbSubscription.currentPeriodEnd,
      cancel_at_period_end: dbSubscription.cancelAtPeriodEnd,
      price_per_month: dbSubscription.priceAmount,
      tenant_id: dbSubscription.tenantId,
      tenants: {
        id: dbSubscription.tenant.id,
        name: dbSubscription.tenant.name,
        slug: dbSubscription.tenant.subdomain,
        status: dbSubscription.tenant.status,
      },
    }

    // Get payment history - using empty array for now as Payment model may not exist
    const payments: any[] = []

    // Get invoices - using empty array for now as Invoice model may not exist
    const invoices: any[] = []

    return NextResponse.json({
      success: true,
      subscription,
      payments,
      invoices,
    })
  } catch (error) {
    console.error('[Admin Subscription Detail API] Error:', error)
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
