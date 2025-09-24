import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

const prisma = new PrismaClient()

// 업체 생성 스키마
const createCompanySchema = z.object({
  name: z.string().min(1, '업체명은 필수입니다').max(100, '업체명은 100자 이하여야 합니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  region: z.string().min(1, '지역은 필수입니다').max(50, '지역은 50자 이하여야 합니다'),
  isActive: z.boolean().optional()
})

// 업체 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const region = searchParams.get('region') || ''
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    // 검색 조건 구성
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (region) {
      where.region = region
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // 업체 목록 조회 (담당자 정보 포함)
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              contacts: { where: { isActive: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.company.count({ where })
    ])

    // 응답 데이터 구성
    const response = {
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }

    logger.info(`업체 목록 조회: ${companies.length}개`, {
      page,
      limit,
      total,
      search,
      region
    })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('업체 목록 조회 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '업체 목록 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 업체 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 입력값 검증
    const validatedData = createCompanySchema.parse(body)

    // 중복 확인 (이름 또는 이메일)
    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { email: validatedData.email }
        ]
      }
    })

    if (existingCompany) {
      const duplicateField = existingCompany.name === validatedData.name ? '업체명' : '이메일'

      return NextResponse.json(
        {
          success: false,
          error: `이미 존재하는 ${duplicateField}입니다.`,
          field: existingCompany.name === validatedData.name ? 'name' : 'email'
        },
        { status: 400 }
      )
    }

    // 업체 생성
    const company = await prisma.company.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        region: validatedData.region,
        isActive: validatedData.isActive ?? true
      },
      include: {
        contacts: true,
        _count: {
          select: {
            contacts: { where: { isActive: true } }
          }
        }
      }
    })

    logger.info(`업체 생성 완료: ${company.name}`, {
      id: company.id,
      email: company.email,
      region: company.region
    })

    return NextResponse.json(
      {
        success: true,
        data: company,
        message: '업체가 성공적으로 생성되었습니다.'
      },
      { status: 201 }
    )

  } catch (error) {
    logger.error('업체 생성 실패:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '입력값이 올바르지 않습니다.',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: '업체 생성에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}