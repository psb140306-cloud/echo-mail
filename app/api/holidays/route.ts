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

export const dynamic = 'force-dynamic'

// 공휴일 생성 스키마
const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)'),
  name: z.string().min(1, '공휴일명은 필수입니다').max(50, '공휴일명은 50자 이하여야 합니다'),
  isRecurring: z.boolean().optional(),
})

// 공휴일 목록 조회
async function getHolidays(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const isRecurring = searchParams.get('isRecurring')

    const skip = (page - 1) * limit

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    // 검색 조건 구성
    const where: Prisma.HolidayWhereInput = {
      tenantId, // CRITICAL: Filter by tenantId for security
    }

    if (year) {
      const yearNum = parseInt(year)
      if (!isNaN(yearNum)) {
        where.date = {
          gte: new Date(`${yearNum}-01-01`),
          lt: new Date(`${yearNum + 1}-01-01`),
        }
      }
    }

    if (month && year) {
      const yearNum = parseInt(year)
      const monthNum = parseInt(month)
      if (!isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        const startDate = new Date(yearNum, monthNum - 1, 1)
        const endDate = new Date(yearNum, monthNum, 0)
        where.date = {
          gte: startDate,
          lte: endDate,
        }
      }
    }

    if (isRecurring !== null) {
      where.isRecurring = isRecurring === 'true'
    }

    // 공휴일 목록 조회
    const [holidays, total] = await Promise.all([
      prisma.holiday.findMany({
        where,
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      }),
      prisma.holiday.count({ where }),
    ])

    logger.info(`공휴일 목록 조회: ${holidays.length}개`, {
      page,
      limit,
      total,
      year,
      month,
    })

    return createPaginatedResponse(holidays, { page, limit, total })
  } catch (error) {
    logger.error('공휴일 목록 조회 실패:', error)
    return createErrorResponse('공휴일 목록 조회에 실패했습니다.')
  }
}

// 공휴일 생성
async function createHoliday(request: NextRequest) {
  try {
    const { data, error } = await parseAndValidate(request, createHolidaySchema)
    if (error) return error

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    // 날짜 파싱 및 검증
    const holidayDate = new Date(data.date + 'T00:00:00.000Z')
    if (isNaN(holidayDate.getTime())) {
      return createErrorResponse('올바른 날짜가 아닙니다.', 400)
    }

    // 중복 날짜 확인 (같은 tenant 내에서)
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        date: holidayDate,
        tenantId, // CRITICAL: Check within tenant only
      },
    })

    if (existingHoliday) {
      return createErrorResponse(`${data.date} 날짜의 공휴일이 이미 존재합니다.`, 400)
    }

    // 공휴일 생성
    const holiday = await prisma.holiday.create({
      data: {
        date: holidayDate,
        name: data.name,
        isRecurring: data.isRecurring ?? false,
        tenantId, // CRITICAL: Add tenantId for security
      },
    })

    logger.info(`공휴일 생성 완료: ${holiday.name}`, {
      id: holiday.id,
      date: holiday.date,
      isRecurring: holiday.isRecurring,
    })

    return createSuccessResponse(holiday, '공휴일이 성공적으로 생성되었습니다.', 201)
  } catch (error) {
    logger.error('공휴일 생성 실패:', error)
    return createErrorResponse('공휴일 생성에 실패했습니다.')
  }
}

// 여러 공휴일 일괄 생성
async function bulkCreateHolidays(request: NextRequest) {
  try {
    const body = await request.json()

    if (!Array.isArray(body.holidays)) {
      return createErrorResponse('holidays 배열이 필요합니다.', 400)
    }

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    const holidaysSchema = z.array(createHolidaySchema).min(1, '최소 1개의 공휴일이 필요합니다')
    const holidays = holidaysSchema.parse(body.holidays)

    // 날짜 중복 확인
    const dates = holidays.map((h) => h.date)
    const uniqueDates = new Set(dates)
    if (dates.length !== uniqueDates.size) {
      return createErrorResponse('중복된 날짜가 있습니다.', 400)
    }

    // 기존 공휴일과의 중복 확인 (같은 tenant 내에서)
    const holidayDates = holidays.map((h) => new Date(h.date + 'T00:00:00.000Z'))
    const existingHolidays = await prisma.holiday.findMany({
      where: {
        date: {
          in: holidayDates,
        },
        tenantId, // CRITICAL: Check within tenant only
      },
    })

    if (existingHolidays.length > 0) {
      const duplicateDates = existingHolidays.map((h) => h.date.toISOString().split('T')[0])
      return createErrorResponse(
        `다음 날짜의 공휴일이 이미 존재합니다: ${duplicateDates.join(', ')}`,
        400
      )
    }

    // 일괄 생성
    const createdHolidays = await prisma.holiday.createMany({
      data: holidays.map((h) => ({
        date: new Date(h.date + 'T00:00:00.000Z'),
        name: h.name,
        isRecurring: h.isRecurring ?? false,
        tenantId, // CRITICAL: Add tenantId for security
      })),
    })

    logger.info(`공휴일 일괄 생성 완료: ${createdHolidays.count}개`)

    return createSuccessResponse(
      {
        count: createdHolidays.count,
        holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
      },
      `${createdHolidays.count}개의 공휴일이 성공적으로 생성되었습니다.`,
      201
    )
  } catch (error) {
    logger.error('공휴일 일괄 생성 실패:', error)

    if (error instanceof z.ZodError) {
      return createErrorResponse('입력값이 올바르지 않습니다.', 400, error.errors)
    }

    return createErrorResponse('공휴일 일괄 생성에 실패했습니다.')
  }
}

// Export GET/POST/PUT with tenant context middleware
export async function GET(request: NextRequest) {
  return withTenantContext(request, getHolidays)
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, createHoliday)
}

export async function PUT(request: NextRequest) {
  return withTenantContext(request, bulkCreateHolidays)
}

// 공휴일 삭제
async function deleteHoliday(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    // 존재 확인 (같은 tenant 내에서만)
    const holiday = await prisma.holiday.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Check within tenant only
      },
    })

    if (!holiday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    // 삭제
    await prisma.holiday.delete({
      where: { id },
    })

    logger.info(`공휴일 삭제 완료: ${holiday.name}`, { id, date: holiday.date })

    return createSuccessResponse(
      {
        name: holiday.name,
        date: holiday.date.toISOString().split('T')[0],
      },
      '공휴일이 성공적으로 삭제되었습니다.'
    )
  } catch (error) {
    logger.error('공휴일 삭제 실패:', error)
    return createErrorResponse('공휴일 삭제에 실패했습니다.')
  }
}

export async function DELETE(request: NextRequest) {
  return withTenantContext(request, deleteHoliday)
}
