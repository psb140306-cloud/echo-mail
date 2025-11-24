import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

interface RouteParams {
  params: {
    id: string
  }
}

// 메일 상세 조회 API
export async function GET(request: NextRequest, { params }: RouteParams) {
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

      // 메일 조회 (관련 데이터 포함)
      const email = await prisma.emailLog.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              region: true,
            },
          },
          notifications: {
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              type: true,
              recipient: true,
              status: true,
              sentAt: true,
              deliveredAt: true,
              errorMessage: true,
              createdAt: true,
            },
          },
        },
      })

      if (!email) {
        return createErrorResponse('메일을 찾을 수 없습니다.', 404)
      }

      // 메일이 읽지 않은 상태면 읽음 처리
      if (!email.isRead) {
        await prisma.emailLog.update({
          where: { id },
          data: { isRead: true },
        })

        logger.info('메일 읽음 처리 완료', { id, tenantId })
      }

      logger.info('메일 상세 조회 완료', {
        id,
        tenantId,
        subject: email.subject,
        hasNotifications: email.notifications.length > 0,
      })

      return createSuccessResponse({
        ...email,
        isRead: true, // 조회하면서 읽음 처리했으므로 true로 반환
      })
    } catch (error) {
      logger.error('메일 상세 조회 실패:', error)
      return createErrorResponse('메일 조회에 실패했습니다.')
    }
  })
}

// 메일 삭제 API
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

      // 메일 삭제 (Soft delete - status를 IGNORED로 변경)
      await prisma.emailLog.update({
        where: { id },
        data: {
          status: 'IGNORED',
        },
      })

      logger.info('메일 삭제 완료', {
        id,
        tenantId,
        subject: existingEmail.subject,
      })

      return createSuccessResponse(
        {
          deletedId: id,
        },
        '메일이 성공적으로 삭제되었습니다.'
      )
    } catch (error) {
      logger.error('메일 삭제 실패:', error)
      return createErrorResponse('메일 삭제에 실패했습니다.')
    }
  })
}
