import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { SubscriptionService } from '@/lib/subscription/subscription-service'
import { SubscriptionPlan } from '@/lib/subscription/plans'

// 구독 생성 스키마
const createSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  billingKey: z.string().min(1, '빌링키는 필수입니다'),
  paymentMethod: z.string().optional(),
})

// 플랜 변경 스키마
const changePlanSchema = z.object({
  newPlan: z.nativeEnum(SubscriptionPlan),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  immediate: z.boolean().default(false),
})

// 구독 취소 스키마
const cancelSubscriptionSchema = z.object({
  reason: z.string().min(1, '취소 사유는 필수입니다'),
  immediate: z.boolean().default(false),
})

// 구독 정보 조회
async function getSubscription(request: NextRequest) {
  try {
    const tenantId = requireTenant()

    const subscription = await SubscriptionService.getSubscription(tenantId)

    if (!subscription) {
      return createErrorResponse('활성화된 구독이 없습니다.', 404)
    }

    logger.info('구독 정보 조회 완료', {
      tenantId,
      subscriptionId: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
    })

    // 페이지에서 기대하는 형식으로 변환
    const subscriptionInfo = {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      trialEndsAt: subscription.trialEndsAt?.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    }

    return createSuccessResponse(
      subscriptionInfo,
      '구독 정보를 성공적으로 조회했습니다.'
    )
  } catch (error) {
    logger.error('구독 정보 조회 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '구독 정보 조회에 실패했습니다.'
    )
  }
}

// 구독 생성
async function createSubscription(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, createSubscriptionSchema)
  if (error) return error

  try {
    const tenantId = requireTenant()

    // 고객 키 생성
    const customerKey = `tenant_${tenantId}`

    const subscription = await SubscriptionService.createSubscription({
      tenantId,
      plan: data.plan,
      billingCycle: data.billingCycle,
      billingKey: data.billingKey,
      customerKey,
      paymentMethod: data.paymentMethod,
    })

    logger.info('구독 생성 완료', {
      tenantId,
      subscriptionId: subscription.id,
      plan: data.plan,
      billingCycle: data.billingCycle,
    })

    return createSuccessResponse(subscription, '구독이 성공적으로 생성되었습니다.', 201)
  } catch (error) {
    logger.error('구독 생성 실패', error)
    return createErrorResponse(error instanceof Error ? error.message : '구독 생성에 실패했습니다.')
  }
}

// 플랜 변경
async function changePlan(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, changePlanSchema)
  if (error) return error

  try {
    const tenantId = requireTenant()

    const subscription = await SubscriptionService.changePlan({
      tenantId,
      newPlan: data.newPlan,
      billingCycle: data.billingCycle,
      immediate: data.immediate,
    })

    logger.info('플랜 변경 완료', {
      tenantId,
      subscriptionId: subscription.id,
      newPlan: data.newPlan,
      immediate: data.immediate,
    })

    return createSuccessResponse(subscription, '플랜이 성공적으로 변경되었습니다.')
  } catch (error) {
    logger.error('플랜 변경 실패', error)
    return createErrorResponse(error instanceof Error ? error.message : '플랜 변경에 실패했습니다.')
  }
}

// 구독 취소
async function cancelSubscription(request: NextRequest) {
  const { data, error } = await parseAndValidate(request, cancelSubscriptionSchema)
  if (error) return error

  try {
    const tenantId = requireTenant()

    const subscription = await SubscriptionService.cancelSubscription({
      tenantId,
      reason: data.reason,
      immediate: data.immediate,
    })

    logger.info('구독 취소 완료', {
      tenantId,
      subscriptionId: subscription.id,
      immediate: data.immediate,
      reason: data.reason,
    })

    return createSuccessResponse(subscription, '구독이 성공적으로 취소되었습니다.')
  } catch (error) {
    logger.error('구독 취소 실패', error)
    return createErrorResponse(error instanceof Error ? error.message : '구독 취소에 실패했습니다.')
  }
}

// 구독 갱신 (내부 API)
async function renewSubscription(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json()

    if (!subscriptionId) {
      return createErrorResponse('구독 ID는 필수입니다.')
    }

    const subscription = await SubscriptionService.renewSubscription(subscriptionId)

    logger.info('구독 갱신 완료', {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
    })

    return createSuccessResponse(subscription, '구독이 성공적으로 갱신되었습니다.')
  } catch (error) {
    logger.error('구독 갱신 실패', error)
    return createErrorResponse(error instanceof Error ? error.message : '구독 갱신에 실패했습니다.')
  }
}

// 라우트 핸들러
export async function GET(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('billing')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, getSubscription)
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('billing')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, async (req) => {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'change-plan':
        return changePlan(req)
      case 'cancel':
        return cancelSubscription(req)
      case 'renew':
        return renewSubscription(req)
      default:
        return createSubscription(req)
    }
  })
}
