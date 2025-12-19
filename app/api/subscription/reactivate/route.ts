import { NextRequest } from 'next/server'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { prisma } from '@/lib/db'
import { SubscriptionStatus } from '@/lib/subscription/plans'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('billing')(request)
  if (rateLimitResponse.status === 429) return rateLimitResponse

  return withTenantContext(request, async () => {
    try {
      const tenantId = requireTenant()

      const subscription = await prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })

      if (!subscription) {
        return createErrorResponse('구독 정보를 찾을 수 없습니다.', 404)
      }

      if (!subscription.cancelAtPeriodEnd) {
        return createErrorResponse('취소 예약된 구독이 아닙니다.', 400)
      }

      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          status: SubscriptionStatus.ACTIVE,
        },
      })

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: SubscriptionStatus.ACTIVE },
      })

      return createSuccessResponse(updated, '구독이 다시 활성화되었습니다.')
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '구독 활성화에 실패했습니다.')
    }
  })
}

