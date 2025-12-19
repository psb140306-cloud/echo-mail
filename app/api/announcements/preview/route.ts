/**
 * 공지 수신자 미리보기 API (Phase 6)
 * POST - 필터 조건에 따른 예상 수신자 수 조회
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

// 미리보기 요청 스키마
const previewSchema = z.object({
  recipientFilter: z.object({
    all: z.boolean().optional(),
    regions: z.array(z.string()).optional(),
    companyIds: z.array(z.string()).optional(),
  }).optional(),
})

/**
 * POST: 발송 대상 미리보기
 * - 필터 조건에 따른 예상 수신자 수와 샘플 목록 반환
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { data, error } = await parseAndValidate(request, previewSchema)
      if (error) return error

      const filter = data.recipientFilter

      // 기본 조건: 전화번호가 있는 연락처만
      const whereCondition: any = {
        tenantId,
        phone: { not: '' },
      }

      // 필터 적용
      if (filter && !filter.all) {
        if (filter.regions && filter.regions.length > 0) {
          whereCondition.company = {
            region: { in: filter.regions }
          }
        }
        if (filter.companyIds && filter.companyIds.length > 0) {
          whereCondition.companyId = { in: filter.companyIds }
        }
      }

      // 총 수신자 수 조회
      const totalCount = await prisma.contact.count({
        where: whereCondition,
      })

      // 샘플 수신자 목록 (최대 10명)
      const sampleContacts = await prisma.contact.findMany({
        where: whereCondition,
        take: 10,
        include: {
          company: {
            select: {
              name: true,
              region: true,
            },
          },
        },
      })

      // 지역별 분포 통계를 위한 연락처별 company 조회
      const contactsWithCompany = await prisma.contact.findMany({
        where: whereCondition,
        include: {
          company: {
            select: {
              region: true,
              name: true,
            },
          },
        },
      })

      // 지역별 집계
      const regionCounts: Record<string, number> = {}
      const companyCounts: Record<string, number> = {}

      for (const contact of contactsWithCompany) {
        const region = contact.company?.region || '미지정'
        const companyName = contact.company?.name || '미지정'

        regionCounts[region] = (regionCounts[region] || 0) + 1
        companyCounts[companyName] = (companyCounts[companyName] || 0) + 1
      }

      // 회사별 분포 통계 (상위 5개)
      const topCompanies = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

      return createSuccessResponse({
        totalCount,
        sampleContacts: sampleContacts.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          companyName: c.company?.name || '',
          region: c.company?.region || '',
        })),
        statistics: {
          byRegion: regionCounts,
          topCompanies,
        },
      })
    } catch (error) {
      logger.error('수신자 미리보기 실패:', error)
      return createErrorResponse('수신자 미리보기를 불러오는데 실패했습니다.')
    }
  })
}
