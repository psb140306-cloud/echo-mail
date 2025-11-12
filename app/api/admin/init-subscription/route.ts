import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { PLAN_PRICING } from '@/lib/subscription/plans'

export async function POST(request: NextRequest) {
  try {
    const { tenantId, plan = 'FREE_TRIAL' } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
    }

    // Check if subscription already exists
    const existing = await prisma.subscription.findFirst({
      where: { tenantId }
    })

    if (existing) {
      // Update existing subscription plan
      const updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan,
          priceAmount: PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.monthly || 0,
        }
      })

      logger.info('Subscription plan updated', { tenantId, plan, subscriptionId: updated.id })

      return NextResponse.json({
        success: true,
        message: `Subscription updated to ${plan}`,
        subscription: updated,
      })
    }

    // Create new subscription
    const now = new Date()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        plan,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        priceAmount: PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.monthly || 0,
        cancelAtPeriodEnd: false,
      }
    })

    logger.info('Subscription created', { tenantId, plan, subscriptionId: subscription.id })

    return NextResponse.json({
      success: true,
      message: `${plan} subscription created`,
      subscription,
    })
  } catch (error) {
    logger.error('Failed to create subscription', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
