import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { generateHolidays } from '@/lib/utils/holiday-calculator'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    year: string
  }
}

/**
 * 특정 연도의 공휴일 자동 생성 및 DB 저장
 * GET /api/holidays/generate/2025
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const year = parseInt(params.year)

      if (isNaN(year) || year < 2000 || year > 2100) {
        return createErrorResponse('올바른 연도를 입력해주세요 (2000-2100)', 400)
      }

      // 공휴일 자동 계산
      const holidays = generateHolidays(year)

      if (holidays.length === 0) {
        return createErrorResponse('공휴일 생성에 실패했습니다.', 500)
      }

      // 기존 공휴일 확인
      const existingCount = await prisma.holiday.count({
        where: {
          tenantId,
          date: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      })

      if (existingCount > 0) {
        return createErrorResponse(
          `${year}년 공휴일이 이미 ${existingCount}개 등록되어 있습니다. 기존 데이터를 먼저 삭제해주세요.`,
          400
        )
      }

      // DB에 저장
      const created = await prisma.holiday.createMany({
        data: holidays.map((h) => ({
          name: h.name,
          date: new Date(h.date),
          isLunar: h.isLunar,
          tenantId,
        })),
        skipDuplicates: true,
      })

      logger.info(`${year}년 공휴일 자동 생성 완료`, {
        year,
        count: created.count,
        tenantId,
      })

      return createSuccessResponse(
        {
          year,
          count: created.count,
          holidays: holidays.map((h) => ({
            name: h.name,
            date: h.date,
            isLunar: h.isLunar,
          })),
        },
        `${year}년 공휴일 ${created.count}개가 성공적으로 생성되었습니다.`
      )
    } catch (error) {
      logger.error('공휴일 생성 실패:', error)
      return createErrorResponse('공휴일 생성에 실패했습니다.')
    }
  })
}

/**
 * 특정 연도의 공휴일 삭제 후 재생성
 * POST /api/holidays/generate/2025
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const year = parseInt(params.year)

      if (isNaN(year) || year < 2000 || year > 2100) {
        return createErrorResponse('올바른 연도를 입력해주세요 (2000-2100)', 400)
      }

      // 기존 공휴일 삭제
      const deleted = await prisma.holiday.deleteMany({
        where: {
          tenantId,
          date: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      })

      // 공휴일 자동 계산
      const holidays = generateHolidays(year)

      if (holidays.length === 0) {
        return createErrorResponse('공휴일 생성에 실패했습니다.', 500)
      }

      // DB에 저장
      const created = await prisma.holiday.createMany({
        data: holidays.map((h) => ({
          name: h.name,
          date: new Date(h.date),
          isLunar: h.isLunar,
          tenantId,
        })),
        skipDuplicates: true,
      })

      logger.info(`${year}년 공휴일 재생성 완료`, {
        year,
        deletedCount: deleted.count,
        createdCount: created.count,
        tenantId,
      })

      return createSuccessResponse(
        {
          year,
          deletedCount: deleted.count,
          createdCount: created.count,
          holidays: holidays.map((h) => ({
            name: h.name,
            date: h.date,
            isLunar: h.isLunar,
          })),
        },
        `${year}년 공휴일 ${deleted.count}개 삭제 후 ${created.count}개가 새로 생성되었습니다.`
      )
    } catch (error) {
      logger.error('공휴일 재생성 실패:', error)
      return createErrorResponse('공휴일 재생성에 실패했습니다.')
    }
  })
}
