import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

/**
 * 활성화된 배송 규칙의 지역 목록 조회
 * 업체 추가 시 지역 드롭다운에 사용
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in delivery-rules/regions GET')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 활성화된 배송 규칙의 지역만 조회
      const deliveryRules = await prisma.deliveryRule.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        select: {
          region: true,
        },
        orderBy: {
          region: 'asc',
        },
      })

      // 지역명만 추출 (중복 제거)
      const regions = [...new Set(deliveryRules.map((rule) => rule.region))]

      logger.debug('Active delivery regions fetched', {
        tenantId,
        count: regions.length,
      })

      return createSuccessResponse(regions)
    } catch (error) {
      logger.error('Failed to fetch delivery regions:', error)
      return createErrorResponse('배송 가능 지역 조회에 실패했습니다.')
    }
  })
}
