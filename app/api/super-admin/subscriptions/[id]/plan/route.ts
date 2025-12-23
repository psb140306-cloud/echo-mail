import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { SubscriptionPlan } from '@prisma/client'

export const dynamic = 'force-dynamic'

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  FREE_TRIAL: 0,
  STARTER: 29000,
  PROFESSIONAL: 79000,
  BUSINESS: 149000,
  ENTERPRISE: 199000,
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const { id } = await params
    const { plan_id } = await request.json()

    // 플랜 유효성 검증
    const planEnum = plan_id.toUpperCase() as SubscriptionPlan
    if (!PLAN_PRICES.hasOwnProperty(planEnum)) {
      return NextResponse.json(
        {
          error: 'Invalid plan',
          validPlans: Object.keys(PLAN_PRICES),
          received: plan_id
        },
        { status: 400 }
      )
    }

    // 현재 구독 정보 조회
    const currentSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: { tenant: true },
    })

    if (!currentSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // 플랜에 따른 상태 결정: 유료 플랜이면 ACTIVE, 무료 체험이면 TRIAL
    const newStatus = planEnum === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE'

    // 트랜잭션으로 모든 업데이트 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. Subscription 테이블 업데이트 (플랜 + 가격 + 상태)
      const updatedSubscription = await tx.subscription.update({
        where: { id },
        data: {
          plan: planEnum,
          priceAmount: PLAN_PRICES[planEnum],
          status: newStatus,
          updatedAt: new Date(),
        },
      })

      // 2. Tenant 테이블 업데이트 (플랜 + 상태)
      await tx.tenant.update({
        where: { id: currentSubscription.tenantId },
        data: {
          subscriptionPlan: planEnum,
          subscriptionStatus: newStatus,
          updatedAt: new Date(),
        },
      })

      // 3. SubscriptionHistory 레코드 생성 (플랜 + 상태 변경 기록)
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          previousPlan: currentSubscription.plan,
          newPlan: planEnum,
          previousStatus: currentSubscription.status,
          newStatus: newStatus,
          changeType: 'ADMIN_CHANGE',
          reason: 'Super admin manual plan change',
          changedAt: new Date(),
        },
      })

      return updatedSubscription
    })

    console.log('[Super Admin Plan Change] Success:', {
      subscriptionId: id,
      previousPlan: currentSubscription.plan,
      newPlan: planEnum,
      previousStatus: currentSubscription.status,
      newStatus: newStatus,
      tenantId: currentSubscription.tenantId,
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: result.id,
        plan: result.plan,
        priceAmount: result.priceAmount,
        tenantId: result.tenantId,
      },
    })
  } catch (error) {
    console.error('[Super Admin Plan Change API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update subscription plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
