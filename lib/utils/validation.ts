import { z } from 'zod'
import { NextResponse } from 'next/server'
import { logger } from './logger'

// 공통 검증 스키마들
export const phoneSchema = z
  .string()
  .regex(/^010-\d{4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다 (010-0000-0000)')

export const emailSchema = z.string().email('올바른 이메일 형식이 아닙니다')

export const nameSchema = z
  .string()
  .min(1, '이름은 필수입니다')
  .max(50, '이름은 50자 이하여야 합니다')

export const companyNameSchema = z
  .string()
  .min(1, '업체명은 필수입니다')
  .max(100, '업체명은 100자 이하여야 합니다')

export const regionSchema = z
  .string()
  .min(1, '지역은 필수입니다')
  .max(50, '지역은 50자 이하여야 합니다')

// 페이지네이션 스키마
export const paginationSchema = z.object({
  page: z.number().int().min(1, '페이지는 1 이상이어야 합니다').default(1),
  limit: z.number().int().min(1).max(100, '한 페이지당 최대 100개까지 조회 가능합니다').default(10),
})

// 검색 스키마
export const searchSchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

// 에러 응답 생성기
export function createValidationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      success: false,
      error: '입력값이 올바르지 않습니다.',
      details: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    },
    { status: 400 }
  )
}

// 일반 에러 응답 생성기
export function createErrorResponse(message: string, statusCode: number = 500, details?: any) {
  const response = {
    success: false,
    error: message,
    ...(details && { details }),
  }

  logger.error('API Error:', { message, statusCode, details })

  return NextResponse.json(response, { status: statusCode })
}

// 성공 응답 생성기
export function createSuccessResponse(data?: any, message?: string, statusCode: number = 200) {
  const response = {
    success: true,
    ...(data && { data }),
    ...(message && { message }),
  }

  return NextResponse.json(response, { status: statusCode })
}

// 페이지네이션 응답 생성기
export function createPaginatedResponse(
  data: any[],
  pagination: {
    page: number
    limit: number
    total: number
  }
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      pages: Math.ceil(pagination.total / pagination.limit),
    },
  })
}

// 요청 데이터 파싱 및 검증 헬퍼
export async function parseAndValidate<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: createValidationErrorResponse(error) }
    }
    return { error: createErrorResponse('잘못된 요청 데이터입니다.', 400) }
  }
}

// URL 쿼리 파라미터 파싱 및 검증 헬퍼
export function parseQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  try {
    const queryObject: Record<string, any> = {}

    for (const [key, value] of searchParams.entries()) {
      // 숫자 형태인 경우 변환
      if (/^\d+$/.test(value)) {
        queryObject[key] = parseInt(value, 10)
      } else if (value === 'true' || value === 'false') {
        queryObject[key] = value === 'true'
      } else {
        queryObject[key] = value || undefined
      }
    }

    const data = schema.parse(queryObject)
    return { data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: createValidationErrorResponse(error) }
    }
    return { error: createErrorResponse('잘못된 쿼리 파라미터입니다.', 400) }
  }
}

// 중복 확인 헬퍼
export interface DuplicateCheckOptions {
  table: string
  field: string
  value: string
  excludeId?: string
  additionalWhere?: Record<string, any>
}

// 필드별 검증 함수들
export const validators = {
  // 한국 휴대폰 번호 검증
  isValidPhoneNumber: (phone: string): boolean => {
    return /^010-\d{4}-\d{4}$/.test(phone)
  },

  // 이메일 검증
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // 업체명 검증 (특수문자 제한)
  isValidCompanyName: (name: string): boolean => {
    return /^[가-힣a-zA-Z0-9\s\(\)\[\]\-_\.]{1,100}$/.test(name)
  },

  // 이름 검증 (특수문자 제한)
  isValidName: (name: string): boolean => {
    return /^[가-힣a-zA-Z\s]{1,50}$/.test(name)
  },
}

// 데이터 정제 함수들
export const sanitizers = {
  // 전화번호 정제 (하이픈 추가)
  formatPhoneNumber: (phone: string): string => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('010')) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    return phone
  },

  // 문자열 정제 (앞뒤 공백 제거, 빈 문자열은 null로)
  trimString: (str: string | null | undefined): string | null => {
    if (!str) return null
    const trimmed = str.trim()
    return trimmed === '' ? null : trimmed
  },

  // 업체명 정제
  formatCompanyName: (name: string): string => {
    return name.trim().replace(/\s+/g, ' ')
  },
}
