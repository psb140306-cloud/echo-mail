import { NextRequest } from 'next/server'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { SubscriptionService } from '@/lib/subscription/subscription-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('billing')(request)
  if (rateLimitResponse.status === 429) return rateLimitResponse

  return withTenantContext(request, async (req) => {
    try {
      const tenantId = requireTenant()

      let body: any = {}
      try {
        body = await req.json()
      } catch {
        body = {}
      }

      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : '사용자 요청'
      const immediate = typeof body.immediate === 'boolean' ? body.immediate : false

      const subscription = await SubscriptionService.cancelSubscription({
        tenantId,
        reason,
        immediate,
      })

      return createSuccessResponse(subscription, '구독이 취소되었습니다.')
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '구독 취소에 실패했습니다.')
    }
  })
}

