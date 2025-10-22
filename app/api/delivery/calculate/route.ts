import { NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import {
  calculateDeliveryDate,
  getNextBusinessDay,
  getBusinessDaysBetween,
} from '@/lib/utils/delivery-calculator'
import { getTenantIdFromAuthUser } from '@/lib/auth/get-tenant-from-user'
// 납품일 계산 요청 스키마
const calculateDeliverySchema = z.object({
  region: z.string().min(1, '지역은 필수입니다'),
  orderDateTime: z.string().refine((dateStr) => {
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }, '올바른 날짜 시간 형식이 아닙니다'),
  excludeWeekends: z.boolean().optional(),
  customHolidays: z.array(z.string()).optional(),
})
// 영업일 간격 계산 요청 스키마
// 납품일 계산
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromAuthUser()

    const { data, error } = await parseAndValidate(request, calculateDeliverySchema)
    if (error) return error
    // 날짜 파싱
    const orderDateTime = new Date(data.orderDateTime)
    const customHolidays = data.customHolidays?.map((dateStr) => new Date(dateStr))
    // 납품일 계산
    const result = await calculateDeliveryDate({
      region: data.region,
      orderDateTime,
      tenantId,
      excludeWeekends: data.excludeWeekends,
      customHolidays,
    })
    logger.info('납품일 계산 API 호출 성공', {
      region: data.region,
      orderDateTime: data.orderDateTime,
      deliveryDate: result.deliveryDate.toISOString(),
    })
    // 응답 데이터 구성
    const response = {
      ...result,
      deliveryDate: result.deliveryDate.toISOString(),
      orderDateTime: orderDateTime.toISOString(),
      deliveryDateKR: result.deliveryDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
      deliveryTimeKR: result.deliveryTime === 'morning' ? '오전' : '오후',
    }
    return createSuccessResponse(response)
  } catch (error) {
    logger.error('납품일 계산 API 실패:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '납품일 계산에 실패했습니다.'
    )
  }
}
// 영업일 관련 유틸리티
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    switch (action) {
      case 'next-business-day':
        // 다음 영업일 조회
        const dateParam = searchParams.get('date')
        const baseDate = dateParam ? new Date(dateParam) : new Date()
        if (isNaN(baseDate.getTime())) {
          return createErrorResponse('올바른 날짜 형식이 아닙니다.', 400)
        }
        const nextBusinessDay = await getNextBusinessDay(baseDate)
        return createSuccessResponse({
          baseDate: baseDate.toISOString(),
          nextBusinessDay: nextBusinessDay.toISOString(),
          nextBusinessDayKR: nextBusinessDay.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }),
        })
      case 'business-days-between':
        // 두 날짜 간 영업일 수 계산
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')
        if (!startDateStr || !endDateStr) {
          return createErrorResponse('startDate와 endDate가 필요합니다.', 400)
        }
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return createErrorResponse('올바른 날짜 형식이 아닙니다.', 400)
        }
        if (startDate >= endDate) {
          return createErrorResponse('종료 날짜는 시작 날짜보다 늦어야 합니다.', 400)
        }
        const businessDays = await getBusinessDaysBetween(startDate, endDate)
        return createSuccessResponse({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          businessDays,
          totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        })
      default:
        return createErrorResponse(
          '지원하지 않는 액션입니다. (next-business-day, business-days-between)',
          400
        )
    }
  } catch (error) {
    logger.error('영업일 계산 API 실패:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '영업일 계산에 실패했습니다.'
    )
  }
}
