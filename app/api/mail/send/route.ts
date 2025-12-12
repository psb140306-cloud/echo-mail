/**
 * 메일 발신 API
 * POST /api/mail/send
 *
 * - 프로페셔널 플랜 이상에서만 사용 가능
 * - 테넌트별 SMTP 설정 사용
 * - 발송 제한 적용
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
  parseAndValidate,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { sendMail, convertAttachmentsForNodemailer } from '@/lib/mail/mail-sender'
import { canSendMail } from '@/lib/subscription/plan-checker'
import { SubscriptionPlan } from '@/lib/subscription/plans'

// 첨부파일 스키마 (프론트엔드에서 전송하는 형식)
const attachmentSchema = z.object({
  key: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
})

// 메일 발송 요청 스키마
const sendMailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject: z.string().min(1, '제목을 입력해주세요.').max(500),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
  replyTo: z.string().email().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
}).refine(
  (data) => data.text || data.html,
  { message: '본문(text 또는 html)을 입력해주세요.' }
)

export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      // 사용자 인증 확인
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return createErrorResponse('인증이 필요합니다.', 401)
      }

      // 테넌트 플랜 확인
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          subscriptionPlan: true,
          mailSendingEnabled: true,
        },
      })

      if (!tenant) {
        return createErrorResponse('테넌트를 찾을 수 없습니다.', 404)
      }

      const plan = tenant.subscriptionPlan as SubscriptionPlan

      // 1. 플랜 권한 체크
      if (!canSendMail(plan)) {
        return createErrorResponse(
          '메일 발신 기능은 프로페셔널 플랜 이상에서 사용할 수 있습니다.',
          403
        )
      }

      // 2. 기능 활성화 체크
      if (!tenant.mailSendingEnabled) {
        return createErrorResponse(
          '메일 발신 기능이 비활성화되어 있습니다. 설정에서 활성화해주세요.',
          403
        )
      }

      // 요청 데이터 파싱 및 검증
      const { data, error } = await parseAndValidate(request, sendMailSchema)
      if (error) return error

      // 첨부파일 변환 (프론트엔드 형식 → nodemailer 형식, 새 signed URL 생성)
      const convertedAttachments = data.attachments
        ? await convertAttachmentsForNodemailer(data.attachments)
        : undefined

      // 메일 발송
      const result = await sendMail(tenantId, user.id, {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        text: data.text,
        html: data.html,
        attachments: convertedAttachments,
        replyTo: data.replyTo,
        inReplyTo: data.inReplyTo,
        references: data.references,
      })

      if (!result.success) {
        // 에러 코드별 상태 코드 결정
        let statusCode = 500
        switch (result.errorCode) {
          case 'SMTP_NOT_CONFIGURED':
            statusCode = 400
            break
          case 'LIMIT_EXCEEDED':
            statusCode = 429
            break
          case 'MAIL_SENDING_DISABLED':
            statusCode = 403
            break
        }

        return createErrorResponse(result.error || '메일 발송에 실패했습니다.', statusCode)
      }

      logger.info('메일 발송 완료', {
        tenantId,
        userId: user.id,
        messageId: result.messageId,
        to: data.to,
      })

      return createSuccessResponse(
        {
          messageId: result.messageId,
        },
        '메일이 발송되었습니다.'
      )
    } catch (error) {
      logger.error('메일 발송 API 오류:', error)

      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      const isDev = process.env.NODE_ENV === 'development'

      return createErrorResponse(
        isDev ? `메일 발송 실패: ${errorMessage}` : '메일 발송에 실패했습니다.'
      )
    }
  })
}
