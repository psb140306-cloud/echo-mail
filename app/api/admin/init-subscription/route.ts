import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
    }

    // Check if subscription already exists
    const existing = await prisma.subscription.findFirst({
      where: { tenantId }
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Subscription already exists',
        subscription: existing,
      })
    }

    // Create FREE_TRIAL subscription
    const now = new Date()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        plan: 'FREE_TRIAL',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        priceAmount: 0,
        cancelAtPeriodEnd: false,
      }
    })

    logger.info('FREE_TRIAL subscription created', { tenantId, subscriptionId: subscription.id })

    return NextResponse.json({
      success: true,
      message: 'FREE_TRIAL subscription created',
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
