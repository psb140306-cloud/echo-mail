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

// 쿼리 파라미터 스키마
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  folder: z.string().optional().default('INBOX'),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isRead: z.enum(['true', 'false']).optional(),
  isOrder: z.enum(['true', 'false']).optional(),
})

// 메일 목록 조회 API
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        logger.error('Tenant context not available in mail list GET')
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // URL에서 쿼리 파라미터 추출
      const { searchParams } = new URL(request.url)
      const queryParams = Object.fromEntries(searchParams.entries())

      // 쿼리 파라미터 검증
      const validationResult = listQuerySchema.safeParse(queryParams)
      if (!validationResult.success) {
        return createErrorResponse('잘못된 쿼리 파라미터입니다.', 400)
      }

      const { page, limit, folder, search, dateFrom, dateTo, isRead, isOrder } =
        validationResult.data

      // WHERE 조건 구성
      const where: any = {
        tenantId,
        folder,
        status: { not: 'IGNORED' }, // 삭제된 메일 제외
      }

      // 검색어 조건 (subject, sender, body에서 검색)
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: 'insensitive' } },
          { sender: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ]
      }

      // 날짜 필터
      if (dateFrom || dateTo) {
        where.receivedAt = {}
        if (dateFrom) {
          where.receivedAt.gte = new Date(dateFrom)
        }
        if (dateTo) {
          where.receivedAt.lte = new Date(dateTo)
        }
      }

      // 읽음/안읽음 필터
      if (isRead !== undefined) {
        where.isRead = isRead === 'true'
      }

      // 발주 메일 필터
      if (isOrder !== undefined) {
        where.isOrder = isOrder === 'true'
      }

      // 메일 목록 조회 (페이지네이션)
      const [emails, totalCount] = await Promise.all([
        prisma.emailLog.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            messageId: true,
            subject: true,
            sender: true,
            receivedAt: true,
            isRead: true,
            isOrder: true,
            size: true,
            hasAttachment: true,
            status: true,
            companyId: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.emailLog.count({ where }),
      ])

      logger.info('메일 목록 조회 완료', {
        tenantId,
        folder,
        page,
        limit,
        totalCount,
        emailCount: emails.length,
      })

      return createSuccessResponse({
        emails,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      })
    } catch (error) {
      logger.error('메일 목록 조회 실패:', error)
      return createErrorResponse('메일 목록을 불러오는데 실패했습니다.')
    }
  })
}
