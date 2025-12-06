/**
 * 주소록 검색 API
 * GET /api/mail/address-book?q=검색어
 *
 * 등록된 담당자(Contact)와 업체(Company) 이메일에서 검색
 */

import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export interface AddressBookEntry {
  type: 'contact' | 'company'
  id: string
  name: string
  email: string
  companyName?: string
  position?: string
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const query = searchParams.get('q') || ''
      const limit = parseInt(searchParams.get('limit') || '10')

      // 검색어가 없으면 빈 배열 반환
      if (!query.trim()) {
        return createSuccessResponse([])
      }

      const searchTerm = query.trim()

      // 담당자에서 검색 (이메일이 있는 담당자만)
      const contacts = await prisma.contact.findMany({
        where: {
          tenantId,
          isActive: true,
          email: { not: null },
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { position: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          company: {
            select: {
              name: true,
            },
          },
        },
        take: limit,
        orderBy: { name: 'asc' },
      })

      // 업체 이메일에서 검색
      const companies = await prisma.company.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { name: 'asc' },
      })

      // 결과 통합
      const results: AddressBookEntry[] = []

      // 담당자 추가
      for (const contact of contacts) {
        if (contact.email) {
          results.push({
            type: 'contact',
            id: contact.id,
            name: contact.name,
            email: contact.email,
            companyName: contact.company.name,
            position: contact.position || undefined,
          })
        }
      }

      // 업체 추가 (담당자 이메일과 중복되지 않는 경우만)
      const contactEmails = new Set(results.map((r) => r.email.toLowerCase()))
      for (const company of companies) {
        if (!contactEmails.has(company.email.toLowerCase())) {
          results.push({
            type: 'company',
            id: company.id,
            name: company.name,
            email: company.email,
            companyName: company.name,
          })
        }
      }

      // 이름순 정렬 후 limit 적용
      results.sort((a, b) => a.name.localeCompare(b.name))
      const limitedResults = results.slice(0, limit)

      logger.info('주소록 검색', {
        tenantId,
        query: searchTerm,
        resultCount: limitedResults.length,
      })

      return createSuccessResponse(limitedResults)
    } catch (error) {
      logger.error('주소록 검색 API 오류:', error)
      return createErrorResponse('주소록 검색에 실패했습니다.')
    }
  })
}
