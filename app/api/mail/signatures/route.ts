import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { SubscriptionPlan } from '@prisma/client'

export const dynamic = 'force-dynamic'

// 플랜별 서명 개수 제한
const SIGNATURE_LIMITS: Record<SubscriptionPlan, number> = {
  FREE_TRIAL: 1,
  STARTER: 3,
  PROFESSIONAL: 10,
  BUSINESS: 100,
  ENTERPRISE: 1000,
}

// GET: 서명 목록 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const signatures = await prisma.emailSignature.findMany({
        where: { tenantId },
        orderBy: [
          { isDefault: 'desc' },
          { updatedAt: 'desc' },
        ],
      })

      // 플랜별 제한 정보도 함께 반환
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionPlan: true },
      })

      const maxSignatures = SIGNATURE_LIMITS[tenant?.subscriptionPlan || 'FREE_TRIAL']

      return createSuccessResponse({
        signatures,
        maxSignatures,
        currentCount: signatures.length,
      })
    } catch (error) {
      logger.error('서명 목록 조회 실패:', error)
      return createErrorResponse('서명 목록 조회에 실패했습니다.')
    }
  })
}

// POST: 서명 생성
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

      const maxSignatures = SIGNATURE_LIMITS[tenant?.subscriptionPlan || 'FREE_TRIAL']

      // 현재 서명 개수 확인
      const currentCount = await prisma.emailSignature.count({
        where: { tenantId },
      })

      if (currentCount >= maxSignatures) {
        return createErrorResponse(
          `서명은 최대 ${maxSignatures}개까지 생성할 수 있습니다. 플랜을 업그레이드해주세요.`,
          403
        )
      }

      const body = await request.json()
      const { name, content, isDefault } = body

      if (!name?.trim()) {
        return createErrorResponse('서명 이름은 필수입니다.', 400)
      }

      if (!content?.trim()) {
        return createErrorResponse('서명 내용은 필수입니다.', 400)
      }

      // 기본 서명으로 설정하면 기존 기본 서명 해제
      if (isDefault) {
        await prisma.emailSignature.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const signature = await prisma.emailSignature.create({
        data: {
          name: name.trim(),
          content,
          isDefault: isDefault || false,
          tenantId,
          createdBy: userId,
        },
      })

      logger.info('[Signatures POST] 서명 생성 완료', {
        tenantId,
        signatureId: signature.id,
        name: signature.name,
      })

      return createSuccessResponse(signature, '서명이 생성되었습니다.')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return createErrorResponse('이미 같은 이름의 서명이 존재합니다.', 409)
      }
      logger.error('서명 생성 실패:', error)
      return createErrorResponse('서명 생성에 실패했습니다.')
    }
  })
}

// PUT: 서명 수정
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const body = await request.json()
      const { id, name, content, isDefault } = body

      if (!id) {
        return createErrorResponse('서명 ID는 필수입니다.', 400)
      }

      // 서명 존재 확인
      const existingSignature = await prisma.emailSignature.findUnique({
        where: { id },
      })

      if (!existingSignature || existingSignature.tenantId !== tenantId) {
        return createErrorResponse('서명을 찾을 수 없습니다.', 404)
      }

      // 기본 서명으로 설정하면 기존 기본 서명 해제
      if (isDefault && !existingSignature.isDefault) {
        await prisma.emailSignature.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        })
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name.trim()
      if (content !== undefined) updateData.content = content
      if (isDefault !== undefined) updateData.isDefault = isDefault

      const signature = await prisma.emailSignature.update({
        where: { id },
        data: updateData,
      })

      logger.info('[Signatures PUT] 서명 수정 완료', {
        tenantId,
        signatureId: signature.id,
      })

      return createSuccessResponse(signature, '서명이 수정되었습니다.')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return createErrorResponse('이미 같은 이름의 서명이 존재합니다.', 409)
      }
      logger.error('서명 수정 실패:', error)
      return createErrorResponse('서명 수정에 실패했습니다.')
    }
  })
}

// DELETE: 서명 삭제
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
        return createErrorResponse('서명 ID는 필수입니다.', 400)
      }

      // 서명 존재 확인
      const existingSignature = await prisma.emailSignature.findUnique({
        where: { id },
      })

      if (!existingSignature || existingSignature.tenantId !== tenantId) {
        return createErrorResponse('서명을 찾을 수 없습니다.', 404)
      }

      await prisma.emailSignature.delete({
        where: { id },
      })

      logger.info('[Signatures DELETE] 서명 삭제 완료', {
        tenantId,
        signatureId: id,
      })

      return createSuccessResponse(null, '서명이 삭제되었습니다.')
    } catch (error) {
      logger.error('서명 삭제 실패:', error)
      return createErrorResponse('서명 삭제에 실패했습니다.')
    }
  })
}
