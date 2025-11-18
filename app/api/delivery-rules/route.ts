import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 납품 규칙 생성 스키마
const createDeliveryRuleSchema = z.object({
  region: z.string().min(1, '지역은 필수입니다').max(50, '지역은 50자 이하여야 합니다'),
  cutoffTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다 (HH:MM)'),
  beforeCutoffDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다'),
  afterCutoffDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다'),
  beforeCutoffDeliveryTime: z.enum(['오전', '오후', '미정']).optional(),
  afterCutoffDeliveryTime: z.enum(['오전', '오후', '미정']).optional(),
  workingDays: z.array(z.string()).min(1, '최소 1개 이상의 영업일을 선택해야 합니다').optional(),
  customClosedDates: z.array(z.string()).optional(),
  excludeHolidays: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// 납품 규칙 목록 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      // TenantContext에서 tenantId 가져오기 (AsyncLocalStorage 사용)
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in delivery-rules GET')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '10')
      const region = searchParams.get('region') || ''
      const isActive = searchParams.get('isActive')

      const skip = (page - 1) * limit

      // 검색 조건 구성
      const where: Prisma.DeliveryRuleWhereInput = {
        tenantId, // 테넌트 격리
      }

      if (region) {
        where.region = {
          contains: region,
          mode: 'insensitive',
        }
      }

      if (isActive !== null) {
        where.isActive = isActive === 'true'
      }

      // 납품 규칙 목록 조회
      const [deliveryRules, total] = await Promise.all([
        prisma.deliveryRule.findMany({
          where,
          orderBy: { region: 'asc' },
          skip,
          take: limit,
        }),
        prisma.deliveryRule.count({ where }),
      ])

      logger.info(`납품 규칙 목록 조회: ${deliveryRules.length}개`, {
        page,
        limit,
        total,
        region,
        tenantId,
      })

      return createPaginatedResponse(deliveryRules, { page, limit, total })
    } catch (error) {
      logger.error('납품 규칙 목록 조회 실패:', error)
      // DEBUG: 실제 에러 메시지 노출 (production에서는 제거)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return createErrorResponse(`납품 규칙 목록 조회에 실패했습니다. [DEBUG: ${errorMessage}]`)
    }
  })
}

// 납품 규칙 생성
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      // TenantContext에서 tenantId 가져오기 (AsyncLocalStorage 사용)
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in delivery-rules POST')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { data, error } = await parseAndValidate(request, createDeliveryRuleSchema)
      if (error) return error

      // 중복 지역 확인 (같은 테넌트 내에서)
      const existingRule = await prisma.deliveryRule.findFirst({
        where: {
          region: data.region,
          tenantId,
        },
      })

      if (existingRule) {
        return createErrorResponse(`'${data.region}' 지역의 납품 규칙이 이미 존재합니다.`, 400)
      }

      // 납품 규칙 생성
      const deliveryRule = await prisma.deliveryRule.create({
        data: {
          region: data.region,
          cutoffTime: data.cutoffTime,
          beforeCutoffDays: data.beforeCutoffDays,
          afterCutoffDays: data.afterCutoffDays,
          beforeCutoffDeliveryTime: data.beforeCutoffDeliveryTime || '오전',
          afterCutoffDeliveryTime: data.afterCutoffDeliveryTime || '오후',
          workingDays: data.workingDays || ['1', '2', '3', '4', '5'],
          customClosedDates: data.customClosedDates || [],
          excludeHolidays: data.excludeHolidays ?? true,
          isActive: data.isActive ?? true,
          tenantId, // 테넌트 ID 추가
        },
      })

      logger.info(`납품 규칙 생성 완료: ${deliveryRule.region}`, {
        id: deliveryRule.id,
        cutoffTime: deliveryRule.cutoffTime,
        workingDays: deliveryRule.workingDays,
        tenantId,
      })

      return createSuccessResponse(deliveryRule, '납품 규칙이 성공적으로 생성되었습니다.', 201)
    } catch (error) {
      logger.error('납품 규칙 생성 실패:', error)
      return createErrorResponse('납품 규칙 생성에 실패했습니다.')
    }
  })
}

// 시간 문자열을 분으로 변환하는 헬퍼 함수
function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}
