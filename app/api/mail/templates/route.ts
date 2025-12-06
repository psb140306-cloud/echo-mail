import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { SubscriptionPlan } from '@prisma/client'

// 플랜별 템플릿 개수 제한
const TEMPLATE_LIMITS: Record<SubscriptionPlan, number> = {
  FREE_TRIAL: 3,
  STARTER: 10,
  PROFESSIONAL: 50,
  BUSINESS: 200,
  ENTERPRISE: 1000,
}

// GET: 템플릿 목록 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const category = searchParams.get('category')

      const whereClause: Record<string, unknown> = { tenantId }
      if (category) {
        whereClause.category = category
      }

      const templates = await prisma.emailTemplate.findMany({
        where: whereClause,
        orderBy: [
          { isDefault: 'desc' },
          { updatedAt: 'desc' },
        ],
      })

      // 카테고리 목록도 함께 반환
      const categories = await prisma.emailTemplate.findMany({
        where: { tenantId, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      })

      // 플랜별 제한 정보도 함께 반환
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionPlan: true },
      })

      const maxTemplates = TEMPLATE_LIMITS[tenant?.subscriptionPlan || 'FREE_TRIAL']

      return createSuccessResponse({
        templates,
        categories: categories.map(c => c.category).filter(Boolean),
        maxTemplates,
        currentCount: templates.length,
      })
    } catch (error) {
      logger.error('템플릿 목록 조회 실패:', error)
      return createErrorResponse('템플릿 목록 조회에 실패했습니다.')
    }
  })
}

// POST: 템플릿 생성
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()
      const userId = tenantContext.getUserId()

      if (!tenantId || !userId) {
        return createErrorResponse('인증 정보가 필요합니다.', 401)
      }

      // 플랜 체크
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionPlan: true },
      })

      const maxTemplates = TEMPLATE_LIMITS[tenant?.subscriptionPlan || 'FREE_TRIAL']

      // 현재 템플릿 개수 확인
      const currentCount = await prisma.emailTemplate.count({
        where: { tenantId },
      })

      if (currentCount >= maxTemplates) {
        return createErrorResponse(
          `템플릿은 최대 ${maxTemplates}개까지 생성할 수 있습니다. 플랜을 업그레이드해주세요.`,
          403
        )
      }

      const body = await request.json()
      const { name, subject, content, category, isDefault } = body

      if (!name?.trim()) {
        return createErrorResponse('템플릿 이름은 필수입니다.', 400)
      }

      if (!subject?.trim()) {
        return createErrorResponse('제목은 필수입니다.', 400)
      }

      if (!content?.trim()) {
        return createErrorResponse('내용은 필수입니다.', 400)
      }

      // 기본 템플릿으로 설정하면 기존 기본 템플릿 해제
      if (isDefault) {
        await prisma.emailTemplate.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const template = await prisma.emailTemplate.create({
        data: {
          name: name.trim(),
          subject: subject.trim(),
          content,
          category: category?.trim() || null,
          isDefault: isDefault || false,
          tenantId,
          createdBy: userId,
        },
      })

      logger.info('[Templates POST] 템플릿 생성 완료', {
        tenantId,
        templateId: template.id,
        name: template.name,
      })

      return createSuccessResponse(template, '템플릿이 생성되었습니다.')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return createErrorResponse('이미 같은 이름의 템플릿이 존재합니다.', 409)
      }
      logger.error('템플릿 생성 실패:', error)
      return createErrorResponse('템플릿 생성에 실패했습니다.')
    }
  })
}

// PUT: 템플릿 수정
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const body = await request.json()
      const { id, name, subject, content, category, isDefault } = body

      if (!id) {
        return createErrorResponse('템플릿 ID는 필수입니다.', 400)
      }

      // 템플릿 존재 확인
      const existingTemplate = await prisma.emailTemplate.findUnique({
        where: { id },
      })

      if (!existingTemplate || existingTemplate.tenantId !== tenantId) {
        return createErrorResponse('템플릿을 찾을 수 없습니다.', 404)
      }

      // 기본 템플릿으로 설정하면 기존 기본 템플릿 해제
      if (isDefault && !existingTemplate.isDefault) {
        await prisma.emailTemplate.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name.trim()
      if (subject !== undefined) updateData.subject = subject.trim()
      if (content !== undefined) updateData.content = content
      if (category !== undefined) updateData.category = category?.trim() || null
      if (isDefault !== undefined) updateData.isDefault = isDefault

      const template = await prisma.emailTemplate.update({
        where: { id },
        data: updateData,
      })

      logger.info('[Templates PUT] 템플릿 수정 완료', {
        tenantId,
        templateId: template.id,
      })

      return createSuccessResponse(template, '템플릿이 수정되었습니다.')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return createErrorResponse('이미 같은 이름의 템플릿이 존재합니다.', 409)
      }
      logger.error('템플릿 수정 실패:', error)
      return createErrorResponse('템플릿 수정에 실패했습니다.')
    }
  })
}

// DELETE: 템플릿 삭제
export async function DELETE(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        return createErrorResponse('템플릿 ID는 필수입니다.', 400)
      }

      // 템플릿 존재 확인
      const existingTemplate = await prisma.emailTemplate.findUnique({
        where: { id },
      })

      if (!existingTemplate || existingTemplate.tenantId !== tenantId) {
        return createErrorResponse('템플릿을 찾을 수 없습니다.', 404)
      }

      await prisma.emailTemplate.delete({
        where: { id },
      })

      logger.info('[Templates DELETE] 템플릿 삭제 완료', {
        tenantId,
        templateId: id,
      })

      return createSuccessResponse(null, '템플릿이 삭제되었습니다.')
    } catch (error) {
      logger.error('템플릿 삭제 실패:', error)
      return createErrorResponse('템플릿 삭제에 실패했습니다.')
    }
  })
}
