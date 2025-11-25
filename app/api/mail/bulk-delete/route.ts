import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 요청 스키마
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, '삭제할 메일 ID가 필요합니다.'),
})

// 메일 일괄 삭제 API
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const body = await request.json()

      // 요청 검증
      const validationResult = bulkDeleteSchema.safeParse(body)
      if (!validationResult.success) {
        return createErrorResponse(
          validationResult.error.errors[0]?.message || '잘못된 요청입니다.',
          400
        )
      }

      const { ids } = validationResult.data

      // 해당 테넌트의 메일인지 확인하고 일괄 업데이트 (Soft Delete)
      const result = await prisma.emailLog.updateMany({
        where: {
          id: { in: ids },
          tenantId, // 테넌트 격리
        },
        data: {
          status: 'IGNORED',
        },
      })

      logger.info('메일 일괄 삭제 완료', {
        tenantId,
        requestedCount: ids.length,
        deletedCount: result.count,
      })

      return createSuccessResponse(
        {
          deletedCount: result.count,
        },
        `${result.count}개의 메일이 삭제되었습니다.`
      )
    } catch (error) {
      logger.error('메일 일괄 삭제 실패:', error)
      return createErrorResponse('메일 삭제에 실패했습니다.')
    }
  })
}
