import { NextRequest, NextResponse } from 'next/server'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

export interface ApiError extends Error {
  statusCode?: number
  field?: string
}

// 에러 타입별 처리
export function handleApiError(error: unknown, request?: NextRequest): NextResponse {
  // 요청 정보 로깅
  const requestInfo = request ? {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent')
  } : {}

  // Zod 검증 에러
  if (error instanceof z.ZodError) {
    logger.warn('Validation error:', { error: error.errors, ...requestInfo })

    return NextResponse.json(
      {
        success: false,
        error: '입력값이 올바르지 않습니다.',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      },
      { status: 400 }
    )
  }

  // Prisma 에러
  if (error instanceof PrismaClientKnownRequestError) {
    return handlePrismaError(error, requestInfo)
  }

  // 커스텀 API 에러
  if (error instanceof Error && 'statusCode' in error) {
    const apiError = error as ApiError

    logger.error('API error:', {
      message: apiError.message,
      statusCode: apiError.statusCode,
      field: apiError.field,
      stack: apiError.stack,
      ...requestInfo
    })

    return NextResponse.json(
      {
        success: false,
        error: apiError.message,
        ...(apiError.field && { field: apiError.field })
      },
      { status: apiError.statusCode || 500 }
    )
  }

  // 일반 JavaScript 에러
  if (error instanceof Error) {
    logger.error('Unexpected error:', {
      message: error.message,
      stack: error.stack,
      ...requestInfo
    })

    // 프로덕션에서는 자세한 에러 정보 숨기기
    const message = process.env.NODE_ENV === 'production'
      ? '서버 내부 오류가 발생했습니다.'
      : error.message

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }

  // 알 수 없는 에러
  logger.error('Unknown error:', { error, ...requestInfo })

  return NextResponse.json(
    {
      success: false,
      error: '알 수 없는 오류가 발생했습니다.'
    },
    { status: 500 }
  )
}

// Prisma 에러 처리
function handlePrismaError(error: PrismaClientKnownRequestError, requestInfo: any): NextResponse {
  logger.error('Prisma error:', {
    code: error.code,
    message: error.message,
    meta: error.meta,
    ...requestInfo
  })

  switch (error.code) {
    // 고유 제약조건 위반
    case 'P2002':
      const target = error.meta?.target as string[] || []
      const field = target[0] || 'field'

      const duplicateMessages: Record<string, string> = {
        name: '이미 존재하는 업체명입니다.',
        email: '이미 존재하는 이메일입니다.',
        phone: '이미 등록된 전화번호입니다.',
        default: '이미 존재하는 데이터입니다.'
      }

      return NextResponse.json(
        {
          success: false,
          error: duplicateMessages[field] || duplicateMessages.default,
          field,
          code: 'DUPLICATE_ENTRY'
        },
        { status: 400 }
      )

    // 레코드를 찾을 수 없음
    case 'P2025':
      return NextResponse.json(
        {
          success: false,
          error: '요청한 데이터를 찾을 수 없습니다.',
          code: 'RECORD_NOT_FOUND'
        },
        { status: 404 }
      )

    // 외래키 제약조건 위반
    case 'P2003':
      return NextResponse.json(
        {
          success: false,
          error: '연결된 데이터로 인해 작업을 수행할 수 없습니다.',
          code: 'FOREIGN_KEY_CONSTRAINT'
        },
        { status: 400 }
      )

    // 데이터베이스 연결 오류
    case 'P1001':
      return NextResponse.json(
        {
          success: false,
          error: '데이터베이스에 연결할 수 없습니다.',
          code: 'DATABASE_CONNECTION_ERROR'
        },
        { status: 503 }
      )

    // 기타 Prisma 에러
    default:
      return NextResponse.json(
        {
          success: false,
          error: '데이터베이스 작업 중 오류가 발생했습니다.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      )
  }
}

// API 라우트 래퍼 함수
export function withErrorHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      return handleApiError(error, request)
    }
  }
}

// 커스텀 에러 클래스들
export class ValidationError extends Error implements ApiError {
  statusCode = 400
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404

  constructor(message: string = '요청한 리소스를 찾을 수 없습니다.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ConflictError'
    this.field = field
  }
}

export class BadRequestError extends Error implements ApiError {
  statusCode = 400
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'BadRequestError'
    this.field = field
  }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401

  constructor(message: string = '인증이 필요합니다.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error implements ApiError {
  statusCode = 403

  constructor(message: string = '접근 권한이 없습니다.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}