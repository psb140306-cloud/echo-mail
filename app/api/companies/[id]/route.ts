import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 업체 수정 스키마
const updateCompanySchema = z.object({
  name: z
    .string()
    .min(1, '업체명은 필수입니다')
    .max(100, '업체명은 100자 이하여야 합니다')
    .optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다').optional(),
  region: z.string().min(1, '지역은 필수입니다').max(50, '지역은 50자 이하여야 합니다').optional(),
  isActive: z.boolean().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// 업체 상세 조회
async function getCompanyById(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ success: false, error: '업체 ID가 필요합니다.' }, { status: 400 })
    }

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    // 업체 조회 (담당자 정보 포함) - CRITICAL: Filter by tenantId
    const company = await prisma.company.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Ensure company belongs to current tenant
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

    if (!company) {
      return NextResponse.json(
        { success: false, error: '업체를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    logger.info(`업체 상세 조회: ${company.name}`, { id })

    return NextResponse.json({
      success: true,
      data: company,
    })
  } catch (error) {
    logger.error('업체 상세 조회 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '업체 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 업체 수정
async function updateCompanyById(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ success: false, error: '업체 ID가 필요합니다.' }, { status: 400 })
    }

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    // 입력값 검증
    const validatedData = updateCompanySchema.parse(body)

    // 업체 존재 확인 - CRITICAL: Check tenant ownership
    const existingCompany = await prisma.company.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Ensure company belongs to current tenant
      },
    })

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, error: '업체를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 중복 확인 (이름 또는 이메일이 변경된 경우)
    if (validatedData.name || validatedData.email) {
      const orConditions: Prisma.CompanyWhereInput[] = []

      if (validatedData.name && validatedData.name !== existingCompany.name) {
        orConditions.push({ name: validatedData.name })
      }

      if (validatedData.email && validatedData.email !== existingCompany.email) {
        orConditions.push({ email: validatedData.email })
      }

      if (orConditions.length > 0) {
        const duplicateWhere: Prisma.CompanyWhereInput = {
          AND: [
            { id: { not: id } }, // 현재 업체 제외
            { tenantId }, // CRITICAL: Check within tenant only
            { OR: orConditions },
          ],
        }
        const duplicateCompany = await prisma.company.findFirst({
          where: duplicateWhere,
        })

        if (duplicateCompany) {
          const duplicateField = duplicateCompany.name === validatedData.name ? '업체명' : '이메일'

          return NextResponse.json(
            {
              success: false,
              error: `이미 존재하는 ${duplicateField}입니다.`,
              field: duplicateCompany.name === validatedData.name ? 'name' : 'email',
            },
            { status: 400 }
          )
        }
      }
    }

    // 업체 수정
    const updatedCompany = await prisma.company.update({
      where: { id },
      data: validatedData,
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

    logger.info(`업체 수정 완료: ${updatedCompany.name}`, {
      id,
      changes: validatedData,
    })

    return NextResponse.json({
      success: true,
      data: updatedCompany,
      message: '업체 정보가 성공적으로 수정되었습니다.',
    })
  } catch (error) {
    logger.error('업체 수정 실패:', error)

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
        error: '업체 수정에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 업체 삭제
async function deleteCompanyById(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ success: false, error: '업체 ID가 필요합니다.' }, { status: 400 })
    }

    // CRITICAL: Get tenantId for multi-tenancy isolation
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    // 업체 존재 확인 - CRITICAL: Check tenant ownership
    const existingCompany = await prisma.company.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Ensure company belongs to current tenant
      },
      include: {
        _count: {
          select: {
            contacts: true,
          },
        },
      },
    })

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, error: '업체를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 관련 담당자들도 함께 삭제 (CASCADE 설정으로 자동 삭제됨)
    await prisma.company.delete({
      where: { id },
    })

    logger.info(`업체 삭제 완료: ${existingCompany.name}`, {
      id,
      contactsCount: existingCompany._count.contacts,
    })

    return NextResponse.json({
      success: true,
      message: `업체 '${existingCompany.name}'이(가) 성공적으로 삭제되었습니다.`,
      data: {
        deletedCompany: existingCompany.name,
        deletedContactsCount: existingCompany._count.contacts,
      },
    })
  } catch (error) {
    logger.error('업체 삭제 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '업체 삭제에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Export GET/PUT/DELETE with tenant context middleware
export async function GET(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => getCompanyById(req, context))
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => updateCompanyById(req, context))
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => deleteCompanyById(req, context))
}
