/**
 * 주소록 검색 API
 * GET /api/mail/address-book?q=검색어&companyId=업체ID&limit=100
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

export const dynamic = 'force-dynamic'

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
      const companyId = searchParams.get('companyId')
      const limit = parseInt(searchParams.get('limit') || '100')

      // 전체 조회 (팝업용)
      const searchTerm = query.trim()

      // 업체 목록 조회 (담당자 수 포함)
      const companies = await prisma.company.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              contacts: {
                where: {
                  isActive: true,
                  email: { not: null },
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      // 담당자 조회 조건
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactWhere: any = {
        tenantId,
        isActive: true,
        email: { not: null },
      }

      // 검색어 조건
      if (searchTerm) {
        contactWhere.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { position: { contains: searchTerm, mode: 'insensitive' } },
          { company: { name: { contains: searchTerm, mode: 'insensitive' } } },
        ]
      }

      // 업체 필터
      if (companyId) {
        contactWhere.companyId = companyId
      }

      // 담당자 조회
      const contacts = await prisma.contact.findMany({
        where: contactWhere,
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: limit,
        orderBy: [
          { company: { name: 'asc' } },
          { name: 'asc' },
        ],
      })

      // 최근 사용한 연락처 (최근 발송한 메일의 수신자 기준)
      // NotificationLog에서 최근 발송 내역 기반으로 추출
      const recentNotifications = await prisma.notificationLog.findMany({
        where: {
          tenantId,
          status: 'SENT',
          type: 'SMS', // SMS로 발송한 내역 기준
        },
        select: {
          contactId: true,
        },
        distinct: ['contactId'],
        orderBy: { sentAt: 'desc' },
        take: 20,
      })

      const recentContactIds = recentNotifications
        .map(n => n.contactId)
        .filter(Boolean) as string[]

      const recentContacts = recentContactIds.length > 0
        ? await prisma.contact.findMany({
            where: {
              id: { in: recentContactIds },
              tenantId,
              isActive: true,
              email: { not: null },
            },
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : []

      logger.info('주소록 조회', {
        tenantId,
        query: searchTerm,
        companyId,
        contactCount: contacts.length,
        companyCount: companies.length,
      })

      return createSuccessResponse({
        contacts,
        companies,
        recentContacts,
      })
    } catch (error) {
      logger.error('주소록 API 오류:', error)
      return createErrorResponse('주소록 조회에 실패했습니다.')
    }
  })
}
