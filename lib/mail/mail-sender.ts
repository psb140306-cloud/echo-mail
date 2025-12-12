/**
 * SMTP 메일 발송 서비스
 * - 테넌트별 SMTP 설정 사용
 * - 플랜별 발송 제한 적용
 * - 발송 기록 저장
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { prisma, TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { checkEmailSendingLimit } from '@/lib/subscription/plan-checker'
import { SubscriptionPlan } from '@/lib/subscription/plans'
import { trackEmailUsage } from '@/lib/usage/usage-tracker'
import { getKSTStartOfMonth } from '@/lib/utils/date'
import { createAdminClient } from '@/lib/supabase/server'

// 프론트엔드에서 전송하는 첨부파일 형식
export interface FrontendAttachment {
  key: string
  name: string
  size: number
  type: string
  url?: string
}

/**
 * 첨부파일에 대해 새로운 signed URL을 생성
 * 예약 발송 시 URL 만료 문제 해결
 */
async function refreshAttachmentUrls(
  attachments: FrontendAttachment[]
): Promise<FrontendAttachment[]> {
  if (attachments.length === 0) return attachments

  const supabase = createAdminClient()
  const refreshedAttachments: FrontendAttachment[] = []

  for (const attachment of attachments) {
    try {
      // key가 있으면 새 signed URL 생성 (1시간 유효)
      if (attachment.key) {
        const { data } = await supabase.storage
          .from('attachments')
          .createSignedUrl(attachment.key, 3600)

        if (data?.signedUrl) {
          refreshedAttachments.push({
            ...attachment,
            url: data.signedUrl,
          })
          continue
        }
      }
      // URL 갱신 실패 시 기존 URL 사용 (이미 만료되었을 수 있음)
      refreshedAttachments.push(attachment)
    } catch (error) {
      logger.warn('첨부파일 URL 갱신 실패:', { key: attachment.key, error })
      refreshedAttachments.push(attachment)
    }
  }

  return refreshedAttachments
}

/**
 * 프론트엔드 첨부파일 형식을 nodemailer 형식으로 변환
 * 발송 직전에 새 signed URL 생성하여 URL 만료 문제 해결
 */
export async function convertAttachmentsForNodemailer(
  attachments: FrontendAttachment[]
): Promise<Array<{
  filename: string
  path?: string
  contentType?: string
}>> {
  // 발송 직전에 새 signed URL 생성
  const refreshedAttachments = await refreshAttachmentUrls(attachments)

  return refreshedAttachments.map((attachment) => ({
    filename: attachment.name,
    path: attachment.url,
    contentType: attachment.type,
  }))
}

// 메일 발송 설정 인터페이스
export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

// 메일 발송 요청 인터페이스
export interface SendMailRequest {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content?: Buffer | string
    path?: string
    contentType?: string
  }>
  replyTo?: string
  inReplyTo?: string  // 답장시 원본 메시지 ID
  references?: string // 스레드 참조
}

// 메일 발송 결과 인터페이스
export interface SendMailResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: string
}

/**
 * 테넌트별 SMTP 설정 조회
 */
async function getSmtpConfig(tenantId: string): Promise<SmtpConfig | null> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        tenantId,
        key: {
          startsWith: 'smtp.',
        },
      },
    })

    if (configs.length === 0) {
      // 기존 mailServer 설정에서 SMTP 정보 가져오기 (호환성)
      const mailConfigs = await prisma.systemConfig.findMany({
        where: {
          tenantId,
          key: {
            startsWith: 'mailServer.',
          },
        },
      })

      const mailConfigMap: Record<string, any> = {}
      mailConfigs.forEach((c) => {
        const key = c.key.replace('mailServer.', '')
        try {
          mailConfigMap[key] = JSON.parse(c.value)
        } catch {
          mailConfigMap[key] = c.value
        }
      })

      // IMAP 설정을 SMTP로 변환 (호스트가 imap.로 시작하면 smtp.로 변경)
      if (mailConfigMap.host) {
        let smtpHost = mailConfigMap.host
        if (smtpHost.startsWith('imap.')) {
          smtpHost = smtpHost.replace('imap.', 'smtp.')
        }

        return {
          host: smtpHost,
          port: 465, // SMTP SSL 포트
          secure: true,
          user: mailConfigMap.username || '',
          password: mailConfigMap.password || '',
        }
      }

      return null
    }

    const configMap: Record<string, any> = {}
    configs.forEach((c) => {
      const key = c.key.replace('smtp.', '')
      try {
        configMap[key] = JSON.parse(c.value)
      } catch {
        configMap[key] = c.value
      }
    })

    return {
      host: configMap.host || '',
      port: configMap.port || 465,
      secure: configMap.secure ?? true,
      user: configMap.user || configMap.username || '',
      password: configMap.password || '',
    }
  } catch (error) {
    logger.error('SMTP 설정 조회 실패', { tenantId, error })
    return null
  }
}

/**
 * SMTP Transporter 생성
 */
function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    // 연결 타임아웃 설정
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 30000,
  })
}

/**
 * 메일 발송 함수
 */
export async function sendMail(
  tenantId: string,
  userId: string,
  request: SendMailRequest
): Promise<SendMailResult> {
  try {
    // 1. 테넌트 조회 및 플랜 확인
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionPlan: true,
        mailSendingEnabled: true,
      },
    })

    if (!tenant) {
      return {
        success: false,
        error: '테넌트를 찾을 수 없습니다.',
        errorCode: 'TENANT_NOT_FOUND',
      }
    }

    // 2. 메일 발신 기능 활성화 확인
    if (!tenant.mailSendingEnabled) {
      return {
        success: false,
        error: '메일 발신 기능이 비활성화되어 있습니다.',
        errorCode: 'MAIL_SENDING_DISABLED',
      }
    }

    // 3. 플랜별 발송 제한 확인
    const plan = tenant.subscriptionPlan as SubscriptionPlan

    // 이번 달 발송량 조회 (수신자 수 기준으로 집계)
    const startOfMonth = getKSTStartOfMonth()

    // metadata에 저장된 recipientCount 합산 또는 기본 1로 계산
    const sentEmails = await prisma.emailLog.findMany({
      where: {
        tenantId,
        direction: 'OUTBOUND',
        createdAt: { gte: startOfMonth },
        status: { not: 'FAILED' }, // 실패한 메일은 제외
      },
      select: {
        metadata: true,
      },
    })

    // 수신자 수 기반 사용량 계산
    const currentUsage = sentEmails.reduce((total, email) => {
      const metadata = email.metadata as Record<string, any> | null
      const recipientCount = metadata?.recipientCount || 1
      return total + recipientCount
    }, 0)

    const recipientCount = Array.isArray(request.to) ? request.to.length : 1
    const limitCheck = checkEmailSendingLimit(plan, currentUsage, recipientCount)

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `월간 메일 발송 한도를 초과했습니다. (현재: ${currentUsage}/${limitCheck.limit})`,
        errorCode: 'LIMIT_EXCEEDED',
      }
    }

    // 4. SMTP 설정 조회
    const smtpConfig = await getSmtpConfig(tenantId)
    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user) {
      return {
        success: false,
        error: 'SMTP 설정이 없습니다. 설정에서 메일 서버를 먼저 설정해주세요.',
        errorCode: 'SMTP_NOT_CONFIGURED',
      }
    }

    // 5. Transporter 생성 및 메일 발송
    const transporter = createTransporter(smtpConfig)

    const mailOptions = {
      from: smtpConfig.user,
      to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
      cc: request.cc
        ? Array.isArray(request.cc)
          ? request.cc.join(', ')
          : request.cc
        : undefined,
      bcc: request.bcc
        ? Array.isArray(request.bcc)
          ? request.bcc.join(', ')
          : request.bcc
        : undefined,
      subject: request.subject,
      text: request.text,
      html: request.html,
      attachments: request.attachments,
      replyTo: request.replyTo,
      inReplyTo: request.inReplyTo,
      references: request.references,
    }

    const info = await transporter.sendMail(mailOptions)

    // 6. 발송 기록 저장 (보낸 메일함에 표시되도록 folder: 'SENT' 설정)
    await prisma.emailLog.create({
      data: {
        tenantId,
        messageId: info.messageId,
        subject: request.subject,
        sender: smtpConfig.user, // sender 필드 사용 (목록에서 표시)
        from: smtpConfig.user,
        to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
        direction: 'OUTBOUND',
        folder: 'SENT', // 보낸 메일함에 표시
        status: 'SENT',
        isRead: true, // 발신 메일은 읽음 처리
        receivedAt: new Date(), // 발송 시간 기록
        metadata: {
          cc: request.cc,
          bcc: request.bcc,
          replyTo: request.replyTo,
          inReplyTo: request.inReplyTo,
          sentBy: userId,
          recipientCount: recipientCount, // 수신자 수 기록
        },
      },
    })

    // 7. 사용량 추적
    await trackEmailUsage(tenantId, recipientCount)

    logger.info('메일 발송 성공', {
      tenantId,
      userId,
      messageId: info.messageId,
      to: request.to,
      subject: request.subject,
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

    logger.error('메일 발송 실패', {
      tenantId,
      userId,
      error: errorMessage,
      to: request.to,
      subject: request.subject,
    })

    // 발송 실패 기록
    try {
      await prisma.emailLog.create({
        data: {
          tenantId,
          messageId: `failed-${Date.now()}`,
          subject: request.subject,
          sender: '', // 발송자 정보 없음
          from: '',
          to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
          direction: 'OUTBOUND',
          folder: 'SENT', // 보낸 메일함에 실패 기록도 표시
          status: 'FAILED',
          receivedAt: new Date(),
          metadata: {
            error: errorMessage,
            sentBy: userId,
          },
        },
      })
    } catch (logError) {
      logger.error('발송 실패 기록 저장 실패', { error: logError })
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: 'SEND_FAILED',
    }
  }
}

/**
 * SMTP 연결 테스트
 */
export async function testSmtpConnection(
  config: SmtpConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(config)
    await transporter.verify()
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '연결 실패'
    return { success: false, error: errorMessage }
  }
}

/**
 * 테넌트의 SMTP 설정 테스트
 */
export async function testTenantSmtpConnection(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const smtpConfig = await getSmtpConfig(tenantId)

  if (!smtpConfig) {
    return { success: false, error: 'SMTP 설정이 없습니다.' }
  }

  return testSmtpConnection(smtpConfig)
}

/**
 * sendMail의 별칭 (scheduled-email-processor와의 호환성을 위해)
 * tenantId만으로 호출 가능한 간소화된 인터페이스
 */
export interface SendEmailRequest {
  tenantId: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: FrontendAttachment[]
  replyTo?: string
  inReplyTo?: string
  references?: string
}

export async function sendEmail(
  request: SendEmailRequest
): Promise<SendMailResult> {
  // 첨부파일 변환 (새 signed URL 생성하여 만료 문제 해결)
  const convertedAttachments = request.attachments
    ? await convertAttachmentsForNodemailer(request.attachments)
    : undefined

  // sendMail 호출 (userId는 'system'으로 설정)
  return sendMail(request.tenantId, 'system', {
    to: request.to,
    cc: request.cc,
    bcc: request.bcc,
    subject: request.subject,
    text: request.text,
    html: request.html,
    attachments: convertedAttachments,
    replyTo: request.replyTo,
    inReplyTo: request.inReplyTo,
    references: request.references,
  })
}
