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
import { canAccessFullMailbox } from '@/lib/subscription/plan-checker'
import { SubscriptionPlan } from '@/lib/subscription/plans'

export const dynamic = 'force-dynamic'

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

      // 테넌트 플랜 및 메일 모드 조회
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          subscriptionPlan: true,
          mailMode: true,
        },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan
      const mailMode = tenant.mailMode || 'ORDER_ONLY'

      // 플랜 권한과 설정된 모드 모두 확인
      // 플랜이 전체 메일함을 지원하지 않으면 강제로 ORDER_ONLY
      const effectiveMailMode = canAccessFullMailbox(plan) ? mailMode : 'ORDER_ONLY'

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
      // ORDER_ONLY 모드인 경우 발주 메일만 강제 필터링 (플랜 제한 적용)
      if (effectiveMailMode === 'ORDER_ONLY') {
        // ORDER_ONLY 모드: 발주 메일만 조회 가능 (사용자 필터 무시)
        where.isOrder = true
      } else if (isOrder !== undefined) {
        // FULL_INBOX 모드: 사용자 필터 적용
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
            senderName: true, // 발신자 이름
            recipient: true, // 수신자 (보낸 메일용)
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
                region: true, // 업체 지역 정보 추가
              },
            },
            // 알림 발송 상태 정보 추가
            notifications: {
              select: {
                id: true,
                type: true,
                status: true,
                recipient: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1, // 최신 알림만
            },
          },
        }),
        prisma.emailLog.count({ where }),
      ])

      logger.info('메일 목록 조회 완료', {
        tenantId,
        folder,
        effectiveMailMode,
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
