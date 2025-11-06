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

// 공휴일 수정 스키마
const updateHolidaySchema = z.object({
  name: z
    .string()
    .min(1, '공휴일명은 필수입니다')
    .max(50, '공휴일명은 50자 이하여야 합니다')
    .optional(),
  isRecurring: z.boolean().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// 공휴일 상세 조회
async function getHoliday(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    const holiday = await prisma.holiday.findFirst({
      where: {
        id,
        tenantId
      },
    })

    if (!holiday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    logger.info(`공휴일 상세 조회: ${holiday.name}`, { id })

    return createSuccessResponse(holiday)
  } catch (error) {
    logger.error('공휴일 상세 조회 실패:', error)
    return createErrorResponse('공휴일 조회에 실패했습니다.')
  }
}

// 공휴일 수정 (날짜는 수정할 수 없음, 이름과 반복 여부만 수정 가능)
async function updateHoliday(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    const { data, error } = await parseAndValidate(request, updateHolidaySchema)
    if (error) return error

    // 공휴일 존재 확인 - tenantId 필터링
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        id,
        tenantId
      },
    })

    if (!existingHoliday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    // 공휴일 수정 - tenantId로 검증된 후 업데이트
    const updatedHoliday = await prisma.holiday.update({
      where: {
        id,
        tenantId
      },
      data,
    })

    logger.info(`공휴일 수정 완료: ${updatedHoliday.name}`, {
      id,
      changes: data,
    })

    return createSuccessResponse(updatedHoliday, '공휴일 정보가 성공적으로 수정되었습니다.')
  } catch (error) {
    logger.error('공휴일 수정 실패:', error)
    return createErrorResponse('공휴일 수정에 실패했습니다.')
  }
}

// 공휴일 삭제
async function deleteHoliday(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return createErrorResponse('Tenant context not found', 401)
    }

    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    // 공휴일 존재 확인 - tenantId 필터링
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        id,
        tenantId
      },
    })

    if (!existingHoliday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    // 공휴일 삭제 - tenantId로 검증된 후 삭제
    await prisma.holiday.delete({
      where: {
        id,
        tenantId
      },
    })

    logger.info(`공휴일 삭제 완료: ${existingHoliday.name}`, { id })

    return createSuccessResponse(
      {
        deletedHoliday: existingHoliday.name,
        deletedDate: existingHoliday.date.toISOString().split('T')[0],
      },
      `공휴일 '${existingHoliday.name}'이(가) 성공적으로 삭제되었습니다.`
    )
  } catch (error) {
    logger.error('공휴일 삭제 실패:', error)
    return createErrorResponse('공휴일 삭제에 실패했습니다.')
  }
}

// Export GET/PUT/DELETE with tenant context middleware
export async function GET(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => getHoliday(req, context))
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => updateHoliday(req, context))
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => deleteHoliday(req, context))
}
