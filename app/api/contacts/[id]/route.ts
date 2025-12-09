import { NextRequest, NextResponse } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

// 담당자 수정 스키마
const updateContactSchema = z.object({
  name: z
    .string()
    .min(1, '담당자명은 필수입니다')
    .max(50, '담당자명은 50자 이하여야 합니다')
    .optional(),
  phone: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/, '올바른 전화번호 형식이 아닙니다 (010-0000-0000)')
    .optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다').optional(),
  position: z.string().max(50, '직책은 50자 이하여야 합니다').optional(),
  companyId: z.string().min(1, '업체 ID는 필수입니다').optional(), // 업체 변경 지원
  isActive: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  kakaoEnabled: z.boolean().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// 담당자 상세 조회
async function getContact(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: '담당자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 담당자 조회 (업체 정보 포함) - tenantId 필터링
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        tenantId
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

    if (!contact) {
      return NextResponse.json(
        { success: false, error: '담당자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    logger.info(`담당자 상세 조회: ${contact.name}`, {
      id,
      company: contact.company.name,
    })

    return NextResponse.json({
      success: true,
      data: contact,
    })
  } catch (error) {
    logger.error('담당자 상세 조회 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '담당자 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 담당자 수정
async function updateContact(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: '담당자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 입력값 검증
    const validatedData = updateContactSchema.parse(body)

    // 담당자 존재 확인 - tenantId 필터링
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        company: true,
      },
    })

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: '담당자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업체 변경 시 새 업체 존재 여부 확인
    const targetCompanyId = validatedData.companyId || existingContact.companyId
    if (validatedData.companyId && validatedData.companyId !== existingContact.companyId) {
      const newCompany = await prisma.company.findFirst({
        where: { id: validatedData.companyId, tenantId },
      })
      if (!newCompany) {
        return NextResponse.json(
          {
            success: false,
            error: '존재하지 않는 업체입니다.',
            field: 'companyId',
          },
          { status: 400 }
        )
      }
    }

    // 전화번호 중복 확인 (전화번호 또는 업체가 변경된 경우)
    const phoneToCheck = validatedData.phone || existingContact.phone
    const phoneChanged = validatedData.phone && validatedData.phone !== existingContact.phone
    const companyChanged = validatedData.companyId && validatedData.companyId !== existingContact.companyId

    if (phoneChanged || companyChanged) {
      const duplicateContact = await prisma.contact.findFirst({
        where: {
          AND: [
            { id: { not: id } }, // 현재 담당자 제외
            { companyId: targetCompanyId }, // 변경될 업체 또는 현재 업체 내에서
            { phone: phoneToCheck },
            { tenantId }, // 같은 테넌트 내에서
          ],
        },
      })

      if (duplicateContact) {
        return NextResponse.json(
          {
            success: false,
            error: '해당 업체에 이미 등록된 전화번호입니다.',
            field: 'phone',
          },
          { status: 400 }
        )
      }
    }

    // 담당자 수정 - findFirst로 tenantId 검증 완료 후 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id },
      data: validatedData,
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

    logger.info(`담당자 수정 완료: ${updatedContact.name}`, {
      id,
      company: updatedContact.company.name,
      changes: validatedData,
    })

    return NextResponse.json({
      success: true,
      data: updatedContact,
      message: '담당자 정보가 성공적으로 수정되었습니다.',
    })
  } catch (error) {
    logger.error('담당자 수정 실패:', error)

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
        error: '담당자 수정에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// 담당자 삭제
async function deleteContact(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: '담당자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 담당자 존재 확인 - tenantId 필터링
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: '담당자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 담당자 삭제 - findFirst로 tenantId 검증 완료 후 삭제
    await prisma.contact.delete({
      where: { id },
    })

    logger.info(`담당자 삭제 완료: ${existingContact.name}`, {
      id,
      company: existingContact.company.name,
    })

    return NextResponse.json({
      success: true,
      message: `담당자 '${existingContact.name}'이(가) 성공적으로 삭제되었습니다.`,
      data: {
        deletedContact: existingContact.name,
        company: existingContact.company.name,
      },
    })
  } catch (error) {
    logger.error('담당자 삭제 실패:', error)

    return NextResponse.json(
      {
        success: false,
        error: '담당자 삭제에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Export GET/PUT/DELETE with tenant context middleware
export async function GET(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => getContact(req, context))
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => updateContact(req, context))
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return withTenantContext(request, (req) => deleteContact(req, context))
}
