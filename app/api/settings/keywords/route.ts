import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

// GET: 키워드 설정 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          orderKeywords: true,
          keywordsDisabled: true,
        },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      return createSuccessResponse({
        keywords: tenant.orderKeywords || ['발주', '주문', '구매', '납품', 'order', 'purchase', 'po'],
        keywordsDisabled: tenant.keywordsDisabled || false,
      })
    } catch (error) {
      logger.error('키워드 설정 조회 실패:', error)
      return createErrorResponse('키워드 설정 조회에 실패했습니다.')
    }
  })
}

// PUT: 키워드 설정 저장
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      logger.info('[Keywords PUT] 요청 시작', { tenantId })

      if (!tenantId) {
        logger.warn('[Keywords PUT] 테넌트 ID 없음')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const body = await request.json()
      const { keywords, keywordsDisabled } = body

      logger.info('[Keywords PUT] 요청 데이터', {
        tenantId,
        keywords,
        keywordsDisabled,
        keywordsType: typeof keywords,
        keywordsLength: Array.isArray(keywords) ? keywords.length : 'N/A',
      })

      // 유효성 검사
      if (keywords !== undefined && !Array.isArray(keywords)) {
        return createErrorResponse('키워드는 배열이어야 합니다.', 400)
      }

      if (keywordsDisabled !== undefined && typeof keywordsDisabled !== 'boolean') {
        return createErrorResponse('keywordsDisabled는 boolean이어야 합니다.', 400)
      }

      // 키워드 정제 (빈 문자열 제거, 트림)
      const cleanedKeywords = keywords
        ? keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0)
        : undefined

      const updateData: Record<string, unknown> = {}
      if (cleanedKeywords !== undefined) {
        updateData.orderKeywords = cleanedKeywords
      }
      if (keywordsDisabled !== undefined) {
        updateData.keywordsDisabled = keywordsDisabled
      }

      logger.info('[Keywords PUT] 업데이트 데이터', {
        tenantId,
        updateData,
        cleanedKeywords,
      })

      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: updateData,
        select: {
          orderKeywords: true,
          keywordsDisabled: true,
        },
      })

      logger.info('[Keywords PUT] 저장 완료', {
        tenantId,
        keywords: updatedTenant.orderKeywords,
        keywordsDisabled: updatedTenant.keywordsDisabled,
      })

      return createSuccessResponse(
        {
          keywords: updatedTenant.orderKeywords,
          keywordsDisabled: updatedTenant.keywordsDisabled,
        },
        '키워드 설정이 저장되었습니다.'
      )
    } catch (error) {
      logger.error('[Keywords PUT] 저장 실패:', error)
      return createErrorResponse('키워드 설정 저장에 실패했습니다.')
    }
  })
}
