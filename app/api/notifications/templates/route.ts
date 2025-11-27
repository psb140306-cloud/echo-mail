import { NextRequest, NextResponse } from 'next/server'
import { NotificationType } from '@prisma/client'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { TenantContext, prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

// GET: 템플릿 목록 조회 (내부 핸들러)
async function getTemplates(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    const templates = await prisma.messageTemplate.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    logger.error('템플릿 목록 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '템플릿 목록을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: 템플릿 생성 (내부 핸들러)
async function createTemplate(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, subject, content, variables } = body

    // 유효성 검사
    if (!name || !type || !content || !variables) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 중복 확인
    const existing = await prisma.messageTemplate.findFirst({
      where: {
        tenantId,
        name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 같은 이름의 템플릿이 존재합니다.' },
        { status: 400 }
      )
    }

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        type: type as NotificationType,
        subject,
        content,
        variables,
        tenantId,
        isActive: true,
        isDefault: false,
      },
    })

    logger.info('템플릿 생성 완료', { templateId: template.id, name: template.name })

    return NextResponse.json({
      success: true,
      data: template,
      message: '템플릿이 생성되었습니다.',
    })
  } catch (error) {
    logger.error('템플릿 생성 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '템플릿 생성에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// PUT: 템플릿 수정 (내부 핸들러)
async function updateTemplate(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    const body = await request.json()
    const { id, subject, content, variables, isActive } = body

    if (!id) {
      return NextResponse.json({ success: false, error: '템플릿 ID가 필요합니다.' }, { status: 400 })
    }

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!template) {
      return NextResponse.json({ success: false, error: '템플릿을 찾을 수 없습니다.' }, { status: 404 })
    }

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: {
        subject,
        content,
        variables,
        isActive,
      },
    })

    logger.info('템플릿 수정 완료', { templateId: updated.id, name: updated.name })

    return NextResponse.json({
      success: true,
      data: updated,
      message: '템플릿이 수정되었습니다.',
    })
  } catch (error) {
    logger.error('템플릿 수정 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '템플릿 수정에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// DELETE: 템플릿 삭제 (내부 핸들러)
async function deleteTemplate(request: NextRequest) {
  try {
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context not found' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: '템플릿 ID가 필요합니다.' }, { status: 400 })
    }

    const template = await prisma.messageTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!template) {
      return NextResponse.json({ success: false, error: '템플릿을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 기본 템플릿은 삭제 불가
    if (template.isDefault) {
      return NextResponse.json(
        { success: false, error: '기본 템플릿은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    await prisma.messageTemplate.delete({
      where: { id },
    })

    logger.info('템플릿 삭제 완료', { templateId: id, name: template.name })

    return NextResponse.json({
      success: true,
      message: '템플릿이 삭제되었습니다.',
    })
  } catch (error) {
    logger.error('템플릿 삭제 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '템플릿 삭제에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// withTenantContext 미들웨어 적용된 export 함수들
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => getTemplates(request))
}

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => createTemplate(request))
}

export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => updateTemplate(request))
}

export async function DELETE(request: NextRequest) {
  return withTenantContext(request, async () => deleteTemplate(request))
}
