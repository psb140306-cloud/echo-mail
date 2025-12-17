import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { PLAN_PRICING } from '@/lib/subscription/plans'

export const dynamic = 'force-dynamic'

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
    const oldStatus = subscription.status

    // 같은 플랜으로 변경 시도하면 무시
    if (oldPlan === newPlan) {
      return NextResponse.json({
        success: true,
        data: subscription,
        message: '이미 해당 플랜을 사용 중입니다.',
      })
    }

    // 변경 유형 결정
    const planOrder = ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']
    const oldIndex = planOrder.indexOf(oldPlan)
    const newIndex = planOrder.indexOf(newPlan)
    let changeType = 'CHANGE'
    if (oldPlan === 'FREE_TRIAL' && newPlan !== 'FREE_TRIAL') {
      changeType = 'TRIAL_END'
    } else if (newIndex > oldIndex) {
      changeType = 'UPGRADE'
    } else if (newIndex < oldIndex) {
      changeType = 'DOWNGRADE'
    }

    const newStatus = newPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE'

    // 플랜 변경 (subscription + tenant + history 모두 업데이트)
    const [updated] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: newPlan,
          priceAmount: PLAN_PRICING[newPlan as keyof typeof PLAN_PRICING]?.monthly || 0,
          status: newStatus,
        }
      }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: newPlan,
          subscriptionStatus: newStatus,
        }
      }),
      // 변경 이력 저장
      prisma.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          previousPlan: oldPlan,
          newPlan: newPlan,
          previousStatus: oldStatus,
          newStatus: newStatus,
          changeType,
        }
      })
    ])

    logger.info('Subscription plan changed with history', { tenantId, oldPlan, newPlan, changeType })

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
