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
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId }
    })

    if (!subscription) {
      return NextResponse.json({ success: false, error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 플랜 변경
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: newPlan,
        priceAmount: PLAN_PRICING[newPlan as keyof typeof PLAN_PRICING]?.monthly || 0,
      }
    })

    logger.info('Subscription plan changed', { tenantId, oldPlan: subscription.plan, newPlan })

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
