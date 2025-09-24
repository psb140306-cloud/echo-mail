import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse, parseAndValidate } from '@/lib/utils/validation'

const prisma = new PrismaClient()

// 공휴일 수정 스키마
const updateHolidaySchema = z.object({
  name: z.string().min(1, '공휴일명은 필수입니다').max(50, '공휴일명은 50자 이하여야 합니다').optional(),
  isRecurring: z.boolean().optional()
})

interface RouteParams {
  params: {
    id: string
  }
}

// 공휴일 상세 조회
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    const holiday = await prisma.holiday.findUnique({
      where: { id }
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
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    const { data, error } = await parseAndValidate(request, updateHolidaySchema)
    if (error) return error

    // 공휴일 존재 확인
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!existingHoliday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    // 공휴일 수정
    const updatedHoliday = await prisma.holiday.update({
      where: { id },
      data
    })

    logger.info(`공휴일 수정 완료: ${updatedHoliday.name}`, {
      id,
      changes: data
    })

    return createSuccessResponse(
      updatedHoliday,
      '공휴일 정보가 성공적으로 수정되었습니다.'
    )

  } catch (error) {
    logger.error('공휴일 수정 실패:', error)
    return createErrorResponse('공휴일 수정에 실패했습니다.')
  }
}

// 공휴일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params

    if (!id) {
      return createErrorResponse('공휴일 ID가 필요합니다.', 400)
    }

    // 공휴일 존재 확인
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!existingHoliday) {
      return createErrorResponse('공휴일을 찾을 수 없습니다.', 404)
    }

    // 공휴일 삭제
    await prisma.holiday.delete({
      where: { id }
    })

    logger.info(`공휴일 삭제 완료: ${existingHoliday.name}`, { id })

    return createSuccessResponse(
      {
        deletedHoliday: existingHoliday.name,
        deletedDate: existingHoliday.date.toISOString().split('T')[0]
      },
      `공휴일 '${existingHoliday.name}'이(가) 성공적으로 삭제되었습니다.`
    )

  } catch (error) {
    logger.error('공휴일 삭제 실패:', error)
    return createErrorResponse('공휴일 삭제에 실패했습니다.')
  }
}