import { NextRequest } from 'next/server'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { SubscriptionPlan } from '@prisma/client'

// 프로페셔널 이상만 예약 발송 가능
const PLANS_WITH_SCHEDULE: SubscriptionPlan[] = ['PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']

// GET: 예약 메일 목록 조회
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')

      const whereClause: Record<string, unknown> = { tenantId }
      if (status) {
        whereClause.status = status
      }

      const [scheduledEmails, total] = await Promise.all([
        prisma.scheduledEmail.findMany({
          where: whereClause,
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.scheduledEmail.count({ where: whereClause }),
      ])

      return createSuccessResponse({
        scheduledEmails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('예약 메일 목록 조회 실패:', error)
      return createErrorResponse('예약 메일 목록 조회에 실패했습니다.')
    }
  })
}

// POST: 예약 메일 생성
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

      if (!tenant || !PLANS_WITH_SCHEDULE.includes(tenant.subscriptionPlan)) {
        return createErrorResponse(
          '예약 발송은 프로페셔널 플랜 이상에서 사용할 수 있습니다.',
          403
        )
      }

      const body = await request.json()
      const { to, cc, bcc, subject, text, html, attachments, scheduledAt } = body

      // 유효성 검사
      if (!to || (Array.isArray(to) && to.length === 0)) {
        return createErrorResponse('받는 사람은 필수입니다.', 400)
      }

      if (!subject?.trim()) {
        return createErrorResponse('제목은 필수입니다.', 400)
      }

      if (!html?.trim()) {
        return createErrorResponse('본문은 필수입니다.', 400)
      }

      if (!scheduledAt) {
        return createErrorResponse('예약 시간은 필수입니다.', 400)
      }

      const scheduledDate = new Date(scheduledAt)
      if (isNaN(scheduledDate.getTime())) {
        return createErrorResponse('유효하지 않은 예약 시간입니다.', 400)
      }

      // 최소 5분 후부터 예약 가능
      const minTime = new Date(Date.now() + 5 * 60 * 1000)
      if (scheduledDate < minTime) {
        return createErrorResponse('예약 시간은 최소 5분 후부터 설정할 수 있습니다.', 400)
      }

      // 최대 30일 후까지 예약 가능
      const maxTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      if (scheduledDate > maxTime) {
        return createErrorResponse('예약 시간은 최대 30일 후까지 설정할 수 있습니다.', 400)
      }

      const toEmails = Array.isArray(to) ? to : [to]
      const ccEmails = cc ? (Array.isArray(cc) ? cc : [cc]) : []
      const bccEmails = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []

      const scheduledEmail = await prisma.scheduledEmail.create({
        data: {
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject: subject.trim(),
          text: text || null,
          html,
          attachments: attachments || null,
          scheduledAt: scheduledDate,
          tenantId,
          createdBy: userId,
        },
      })

      logger.info('[Schedule POST] 예약 메일 생성 완료', {
        tenantId,
        scheduledEmailId: scheduledEmail.id,
        scheduledAt: scheduledDate,
      })

      return createSuccessResponse(scheduledEmail, '메일이 예약되었습니다.')
    } catch (error) {
      logger.error('예약 메일 생성 실패:', error)
      return createErrorResponse('예약 메일 생성에 실패했습니다.')
    }
  })
}

// PUT: 예약 메일 수정
export async function PUT(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const body = await request.json()
      const { id, to, cc, bcc, subject, text, html, attachments, scheduledAt } = body

      if (!id) {
        return createErrorResponse('예약 메일 ID는 필수입니다.', 400)
      }

      // 예약 메일 존재 확인
      const existingEmail = await prisma.scheduledEmail.findUnique({
        where: { id },
      })

      if (!existingEmail || existingEmail.tenantId !== tenantId) {
        return createErrorResponse('예약 메일을 찾을 수 없습니다.', 404)
      }

      // 대기 중인 메일만 수정 가능
      if (existingEmail.status !== 'PENDING') {
        return createErrorResponse('대기 중인 메일만 수정할 수 있습니다.', 400)
      }

      const updateData: Record<string, unknown> = {}

      if (to !== undefined) {
        updateData.to = Array.isArray(to) ? to : [to]
      }
      if (cc !== undefined) {
        updateData.cc = cc ? (Array.isArray(cc) ? cc : [cc]) : []
      }
      if (bcc !== undefined) {
        updateData.bcc = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []
      }
      if (subject !== undefined) {
        updateData.subject = subject.trim()
      }
      if (text !== undefined) {
        updateData.text = text
      }
      if (html !== undefined) {
        updateData.html = html
      }
      if (attachments !== undefined) {
        updateData.attachments = attachments
      }
      if (scheduledAt !== undefined) {
        const scheduledDate = new Date(scheduledAt)
        if (isNaN(scheduledDate.getTime())) {
          return createErrorResponse('유효하지 않은 예약 시간입니다.', 400)
        }

        const minTime = new Date(Date.now() + 5 * 60 * 1000)
        if (scheduledDate < minTime) {
          return createErrorResponse('예약 시간은 최소 5분 후부터 설정할 수 있습니다.', 400)
        }

        const maxTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        if (scheduledDate > maxTime) {
          return createErrorResponse('예약 시간은 최대 30일 후까지 설정할 수 있습니다.', 400)
        }

        updateData.scheduledAt = scheduledDate
      }

      const scheduledEmail = await prisma.scheduledEmail.update({
        where: { id },
        data: updateData,
      })

      logger.info('[Schedule PUT] 예약 메일 수정 완료', {
        tenantId,
        scheduledEmailId: id,
      })

      return createSuccessResponse(scheduledEmail, '예약 메일이 수정되었습니다.')
    } catch (error) {
      logger.error('예약 메일 수정 실패:', error)
      return createErrorResponse('예약 메일 수정에 실패했습니다.')
    }
  })
}

// DELETE: 예약 취소
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
        return createErrorResponse('예약 메일 ID는 필수입니다.', 400)
      }

      // 예약 메일 존재 확인
      const existingEmail = await prisma.scheduledEmail.findUnique({
        where: { id },
      })

      if (!existingEmail || existingEmail.tenantId !== tenantId) {
        return createErrorResponse('예약 메일을 찾을 수 없습니다.', 404)
      }

      // 대기 중인 메일만 취소 가능
      if (existingEmail.status !== 'PENDING') {
        return createErrorResponse('대기 중인 메일만 취소할 수 있습니다.', 400)
      }

      await prisma.scheduledEmail.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      logger.info('[Schedule DELETE] 예약 메일 취소 완료', {
        tenantId,
        scheduledEmailId: id,
      })

      return createSuccessResponse(null, '예약이 취소되었습니다.')
    } catch (error) {
      logger.error('예약 메일 취소 실패:', error)
      return createErrorResponse('예약 메일 취소에 실패했습니다.')
    }
  })
}
