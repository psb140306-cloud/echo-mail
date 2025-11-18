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

// 납품 규칙 수정 스키마
const updateDeliveryRuleSchema = z.object({
  region: z.string().min(1).max(50).optional(),
  cutoffTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다 (HH:MM)')
    .optional(),
  beforeCutoffDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다')
    .optional(),
  afterCutoffDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다')
    .optional(),
  beforeCutoffDeliveryTime: z.enum(['오전', '오후']).optional(),
  afterCutoffDeliveryTime: z.enum(['오전', '오후']).optional(),
  workingDays: z.array(z.string()).min(1, '최소 1개 이상의 영업일을 선택해야 합니다').optional(),
  customClosedDates: z.array(z.string()).optional(),
  excludeHolidays: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// 납품 규칙 상세 조회
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
        return createErrorResponse('납품 규칙 ID가 필요합니다.', 400)
      }

      const deliveryRule = await prisma.deliveryRule.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
      })

      if (!deliveryRule) {
        return createErrorResponse('납품 규칙을 찾을 수 없습니다.', 404)
      }

      logger.info(`납품 규칙 상세 조회: ${deliveryRule.region}`, { id, tenantId })

      return createSuccessResponse(deliveryRule)
    } catch (error) {
      logger.error('납품 규칙 상세 조회 실패:', error)
      return createErrorResponse('납품 규칙 조회에 실패했습니다.')
    }
  })
}

// 납품 규칙 수정
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
        return createErrorResponse('납품 규칙 ID가 필요합니다.', 400)
      }

      const { data, error } = await parseAndValidate(request, updateDeliveryRuleSchema)
      if (error) return error

      // 납품 규칙 존재 확인
      const existingRule = await prisma.deliveryRule.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
      })

      if (!existingRule) {
        return createErrorResponse('납품 규칙을 찾을 수 없습니다.', 404)
      }

      // 납품 규칙 수정
      const updatedRule = await prisma.deliveryRule.update({
        where: { id },
        data,
      })

      logger.info(`납품 규칙 수정 완료: ${updatedRule.region}`, {
        id,
        changes: data,
        tenantId,
      })

      return createSuccessResponse(updatedRule, '납품 규칙이 성공적으로 수정되었습니다.')
    } catch (error) {
      logger.error('납품 규칙 수정 실패:', error)
      return createErrorResponse('납품 규칙 수정에 실패했습니다.')
    }
  })
}

// 납품 규칙 삭제
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
        return createErrorResponse('납품 규칙 ID가 필요합니다.', 400)
      }

      // 납품 규칙 존재 확인
      const existingRule = await prisma.deliveryRule.findFirst({
        where: {
          id,
          tenantId, // 테넌트 격리
        },
      })

      if (!existingRule) {
        return createErrorResponse('납품 규칙을 찾을 수 없습니다.', 404)
      }

      // 해당 지역을 사용하는 업체가 있는지 확인
      const companiesUsingRegion = await prisma.company.count({
        where: {
          region: existingRule.region,
          isActive: true,
          tenantId, // 같은 테넌트 내에서만 확인
        },
      })

      if (companiesUsingRegion > 0) {
        return createErrorResponse(
          `'${existingRule.region}' 지역을 사용하는 활성 업체가 ${companiesUsingRegion}개 있어 삭제할 수 없습니다.`,
          400
        )
      }

      // 납품 규칙 삭제
      await prisma.deliveryRule.delete({
        where: { id },
      })

      logger.info(`납품 규칙 삭제 완료: ${existingRule.region}`, { id, tenantId })

      return createSuccessResponse(
        {
          deletedRegion: existingRule.region,
        },
        `'${existingRule.region}' 지역의 납품 규칙이 성공적으로 삭제되었습니다.`
      )
    } catch (error) {
      logger.error('납품 규칙 삭제 실패:', error)
      return createErrorResponse('납품 규칙 삭제에 실패했습니다.')
    }
  })
}

// 시간 문자열을 분으로 변환하는 헬퍼 함수
function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}
