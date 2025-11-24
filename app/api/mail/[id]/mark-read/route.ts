import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

interface RouteParams {
  params: {
    id: string
  }
}

// 읽음 상태 변경 스키마
const markReadSchema = z.object({
  isRead: z.boolean(),
})

// 메일 읽음/안읽음 토글 API
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { id } = params

      if (!id) {
        return createErrorResponse('메일 ID가 필요합니다.', 400)
      }

      // Request body 검증
      const { data, error } = await parseAndValidate(request, markReadSchema)
      if (error) return error

      // 메일 존재 확인
      const existingEmail = await prisma.emailLog.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
      })

      if (!existingEmail) {
        return createErrorResponse('메일을 찾을 수 없습니다.', 404)
      }

      // 읽음 상태 업데이트
      const updatedEmail = await prisma.emailLog.update({
        where: { id },
        data: { isRead: data.isRead },
        select: {
          id: true,
          messageId: true,
          subject: true,
          isRead: true,
        },
      })

      logger.info('메일 읽음 상태 변경 완료', {
        id,
        tenantId,
        isRead: data.isRead,
      })

      return createSuccessResponse(
        updatedEmail,
        `메일을 ${data.isRead ? '읽음' : '안읽음'}으로 표시했습니다.`
      )
    } catch (error) {
      logger.error('메일 읽음 상태 변경 실패:', error)
      return createErrorResponse('메일 상태 변경에 실패했습니다.')
    }
  })
}
