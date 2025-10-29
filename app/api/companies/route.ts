import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { checkCompanyLimit } from '@/lib/subscription/limit-checker'
import { TenantContext } from '@/lib/db'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'

const createCompanySchema = z.object({
  // 업체 정보
  name: z.string().min(1, '업체명은 필수입니다').max(100, '업체명은 100자 이하여야 합니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  region: z.string().min(1, '지역은 필수입니다').max(50, '지역은 50자 이하여야 합니다'),
  isActive: z.boolean().optional(),
  // 담당자 정보 (선택적)
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('올바른 이메일 형식이 아닙니다').optional().or(z.literal('')),
  contactPosition: z.string().optional(),
  smsEnabled: z.boolean().optional(),
  kakaoEnabled: z.boolean().optional(),
})

async function getCompanies(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') ?? '10', 10)
    const search = searchParams.get('search') ?? ''
    const region = searchParams.get('region') ?? ''
    const isActiveParam = searchParams.get('isActive')

    const skip = (page - 1) * limit

    const where: Prisma.CompanyWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (region) {
      where.region = region
    }

    if (isActiveParam !== null) {
      where.isActive = isActiveParam === 'true'
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              contacts: { where: { isActive: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.company.count({ where }),
    ])

    logger.info('업체 목록 조회', {
      companyCount: companies.length,
      page,
      limit,
      total,
      search,
      region,
      isActive: isActiveParam,
    })

    return NextResponse.json({
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('업체 목록 조회 실패', error)

    return NextResponse.json(
      {
        success: false,
        error: '업체 목록 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function createCompany(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createCompanySchema.parse(body)

    // 플랜별 업체 수 제한 체크
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (tenantId) {
      const limitCheck = await checkCompanyLimit(tenantId)
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: '업체 수 한도 초과',
            message: limitCheck.message,
            upgradeRequired: limitCheck.upgradeRequired,
            suggestedPlan: limitCheck.suggestedPlan,
            currentUsage: limitCheck.currentUsage,
            limit: limitCheck.limit,
          },
          { status: 402 } // Payment Required
        )
      }
    }

    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [{ name: validatedData.name }, { email: validatedData.email }],
      },
    })

    if (existingCompany) {
      const duplicateField = existingCompany.name === validatedData.name ? 'name' : 'email'

      return NextResponse.json(
        {
          success: false,
          error: `이미 존재하는 ${duplicateField === 'name' ? '업체명' : '이메일'}입니다.`,
          field: duplicateField,
        },
        { status: 400 }
      )
    }

    // 트랜잭션으로 업체와 담당자를 함께 생성
    const company = await prisma.company.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        region: validatedData.region,
        isActive: validatedData.isActive ?? true,
        tenantId, // tenant context에서 가져온 tenantId 추가
        // 담당자 정보가 있으면 함께 생성
        ...(validatedData.contactName &&
          validatedData.contactPhone && {
            contacts: {
              create: {
                name: validatedData.contactName,
                phone: validatedData.contactPhone,
                email: validatedData.contactEmail || null,
                position: validatedData.contactPosition || null,
                smsEnabled: validatedData.smsEnabled ?? true,
                kakaoEnabled: validatedData.kakaoEnabled ?? false,
                isActive: true,
                tenantId, // contact에도 tenantId 추가
              },
            },
          }),
      },
      include: {
        contacts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            contacts: { where: { isActive: true } },
          },
        },
      },
    })

    logger.info('업체 생성 완료', {
      id: company.id,
      name: company.name,
      email: company.email,
      region: company.region,
      contactsCount: company._count.contacts,
    })

    return NextResponse.json(
      {
        success: true,
        data: company,
        message: '업체가 성공적으로 생성되었습니다.',
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('업체 생성 실패', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '입력값이 올바르지 않습니다.',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: '업체 생성에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 테넌트 컨텍스트 및 Rate Limiting 미들웨어가 적용된 export 함수들
export async function GET(request: NextRequest) {
  // Rate Limiting 적용
  const rateLimitResponse = await withTenantRateLimit('companies')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, getCompanies)
}

export async function POST(request: NextRequest) {
  // Rate Limiting 적용
  const rateLimitResponse = await withTenantRateLimit('companies')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, createCompany)
}
