import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

// 담당자 생성 스키마
const createContactSchema = z.object({
  name: z.string().min(1, '담당자명은 필수입니다').max(50, '담당자명은 50자 이하여야 합니다'),
  phone: z.string().regex(/^010-\d{4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다 (010-0000-0000)'),
  email: z.string().email('올바른 이메일 형식이 아닙니다').optional(),
  position: z.string().max(50, '직책은 50자 이하여야 합니다').optional(),
  companyId: z.string().min(1, '업체 ID는 필수입니다'),
  isActive: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  kakaoEnabled: z.boolean().optional(),
})

// 담당자 목록 조회
async function getContacts(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const companyId = searchParams.get('companyId') || ''
    const isActive = searchParams.get('isActive')

    const skip = (page - 1) * limit

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant context not found',
        },
        { status: 401 }
      )
    }

    // 검색 조건 구성
    const where: Prisma.ContactWhereInput = {
      tenantId, // CRITICAL: Filter by tenantId for security
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (companyId) {
      where.companyId = companyId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // 담당자 목록 조회 (업체 정보 포함)
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              region: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ])

    // 응답 데이터 구성
    const response = {
      success: true,
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    logger.info(`담당자 목록 조회: ${contacts.length}개`, {
      page,
      limit,
      total,
      search,
      companyId,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('담당자 목록 조회 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '담당자 목록 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 담당자 생성
async function createContact(request: NextRequest) {
  try {
    const body = await request.json()

    // 입력값 검증
    const validatedData = createContactSchema.parse(body)

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant context not found',
        },
        { status: 401 }
      )
    }

    // 업체 존재 확인
    const company = await prisma.company.findUnique({
      where: { id: validatedData.companyId },
    })

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: '존재하지 않는 업체입니다.',
          field: 'companyId',
        },
        { status: 400 }
      )
    }

    // 중복 확인 (같은 업체 내 전화번호 중복)
    const existingContact = await prisma.contact.findFirst({
      where: {
        companyId: validatedData.companyId,
        phone: validatedData.phone,
      },
    })

    if (existingContact) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 업체에 이미 등록된 전화번호입니다.',
          field: 'phone',
        },
        { status: 400 }
      )
    }

    // 담당자 생성
    const contact = await prisma.contact.create({
      data: {
        name: validatedData.name,
        phone: validatedData.phone,
        email: validatedData.email,
        position: validatedData.position,
        companyId: validatedData.companyId,
        tenantId, // CRITICAL: Add tenantId for security
        isActive: validatedData.isActive ?? true,
        smsEnabled: validatedData.smsEnabled ?? true,
        kakaoEnabled: validatedData.kakaoEnabled ?? false,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            region: true,
            isActive: true,
          },
        },
      },
    })

    logger.info(`담당자 생성 완료: ${contact.name}`, {
      id: contact.id,
      company: company.name,
      phone: contact.phone,
    })

    return NextResponse.json(
      {
        success: true,
        data: contact,
        message: '담당자가 성공적으로 생성되었습니다.',
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('담당자 생성 실패:', error)

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
        error: '담당자 생성에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Export GET/POST with tenant context middleware
export async function GET(request: NextRequest) {
  return withTenantContext(request, getContacts)
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, createContact)
}
