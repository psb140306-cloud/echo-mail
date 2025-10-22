import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { getTenantIdFromAuthUser } from '@/lib/auth/get-tenant-from-user'

// 납품 규칙 생성 스키마
const createDeliveryRuleSchema = z.object({
  region: z.string().min(1, '지역은 필수입니다').max(50, '지역은 50자 이하여야 합니다'),
  morningCutoff: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다 (HH:MM)'),
  afternoonCutoff: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다 (HH:MM)'),
  morningDeliveryDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다'),
  afternoonDeliveryDays: z
    .number()
    .int()
    .min(0, '배송일은 0 이상이어야 합니다')
    .max(14, '배송일은 14일 이하여야 합니다'),
  isActive: z.boolean().optional(),
})

// 납품 규칙 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 테넌트 ID 가져오기
    const tenantId = await getTenantIdFromAuthUser()

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
    })

    return createPaginatedResponse(deliveryRules, { page, limit, total })
  } catch (error) {
    logger.error('납품 규칙 목록 조회 실패:', error)
    return createErrorResponse('납품 규칙 목록 조회에 실패했습니다.')
  }
}

// 납품 규칙 생성
export async function POST(request: NextRequest) {
  try {
    // 테넌트 ID 가져오기
    const tenantId = await getTenantIdFromAuthUser()

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

    // 시간 검증 (오전 마감시간 < 오후 마감시간)
    const morningTime = parseTime(data.morningCutoff)
    const afternoonTime = parseTime(data.afternoonCutoff)

    if (morningTime >= afternoonTime) {
      return createErrorResponse('오전 마감시간은 오후 마감시간보다 빨라야 합니다.', 400)
    }

    // 납품 규칙 생성
    const deliveryRule = await prisma.deliveryRule.create({
      data: {
        region: data.region,
        morningCutoff: data.morningCutoff,
        afternoonCutoff: data.afternoonCutoff,
        morningDeliveryDays: data.morningDeliveryDays,
        afternoonDeliveryDays: data.afternoonDeliveryDays,
        isActive: data.isActive ?? true,
        tenantId, // 테넌트 ID 추가
      },
    })

    logger.info(`납품 규칙 생성 완료: ${deliveryRule.region}`, {
      id: deliveryRule.id,
      morningCutoff: deliveryRule.morningCutoff,
      afternoonCutoff: deliveryRule.afternoonCutoff,
    })

    return createSuccessResponse(deliveryRule, '납품 규칙이 성공적으로 생성되었습니다.', 201)
  } catch (error) {
    logger.error('납품 규칙 생성 실패:', error)
    return createErrorResponse('납품 규칙 생성에 실패했습니다.')
  }
}

// 시간 문자열을 분으로 변환하는 헬퍼 함수
function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}
