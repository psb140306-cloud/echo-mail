import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { PLAN_PRICING } from '@/lib/subscription/plans'

async function changePlan(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: '인증되지 않은 요청입니다.' }, { status: 401 })
    }

    const { newPlan } = await request.json()

    if (!newPlan) {
      return NextResponse.json({ success: false, error: 'newPlan is required' }, { status: 400 })
    }

    // 현재 구독 조회
    let subscription = await prisma.subscription.findFirst({
      where: { tenantId }
    })

    // 기존 테넌트를 위한 fallback: 구독이 없으면 자동 생성
    if (!subscription) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) {
        return NextResponse.json({ success: false, error: '테넌트 정보를 찾을 수 없습니다.' }, { status: 404 })
      }

      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          plan: tenant.subscriptionPlan,
          status: tenant.subscriptionStatus === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: tenant.trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          priceAmount: PLAN_PRICING[tenant.subscriptionPlan as keyof typeof PLAN_PRICING]?.monthly || 0,
          currency: 'KRW',
        }
      })
      logger.info('Created subscription for existing tenant', { tenantId, plan: tenant.subscriptionPlan })
    }

    const oldPlan = subscription.plan

    // 플랜 변경 (subscription + tenant 모두 업데이트)
    const [updated] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: newPlan,
          priceAmount: PLAN_PRICING[newPlan as keyof typeof PLAN_PRICING]?.monthly || 0,
          status: newPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
        }
      }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: newPlan,
          subscriptionStatus: newPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
        }
      })
    ])

    logger.info('Subscription plan changed', { tenantId, oldPlan, newPlan })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    logger.error('Failed to change plan', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '플랜 변경에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => changePlan(request))
}
