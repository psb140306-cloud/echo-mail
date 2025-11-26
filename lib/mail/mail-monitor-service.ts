import { PrismaClient } from '@prisma/client'
import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail, Attachment } from 'mailparser'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'
import { parseOrderEmail } from './email-parser'
import { sendOrderReceivedNotification } from '@/lib/notifications/notification-service'
import { getKSTStartOfDay } from '@/lib/utils/date'

const prisma = new PrismaClient()

// 파싱된 이메일 정보 인터페이스
interface ParsedEmailContent {
  textBody: string | null
  htmlBody: string | null
  attachments: {
    filename: string
    contentType: string
    size: number
    content: Buffer
  }[]
}

export interface MailCheckResult {
  success: boolean
  newMailsCount: number
  processedCount: number
  failedCount: number
  errors: string[]
}

export interface TenantMailConfig {
  tenantId: string
  host: string
  port: number
  username: string
  password: string
  useSSL: boolean
  enabled: boolean
}

/**
 * 메일 모니터링 서비스
 * 각 테넌트의 메일함을 주기적으로 확인하고 새 발주 메일을 감지
 */
export class MailMonitorService {
  private isRunning = false
  private lastCheckTimes = new Map<string, Date>()
  private companyEmailsCache = new Map<string, { emails: string[]; updatedAt: Date }>()

  /**
   * 모든 활성 테넌트의 메일 확인
   */
  async checkAllTenants(): Promise<Map<string, MailCheckResult>> {
    if (this.isRunning) {
      logger.warn('[MailMonitor] 이미 실행 중입니다')
      return new Map()
    }

    this.isRunning = true
    const results = new Map<string, MailCheckResult>()

    try {
      logger.info('[MailMonitor] 전체 테넌트 메일 확인 시작')

      // 활성화된 메일 서버 설정이 있는 테넌트 조회
      const configs = await this.getActiveTenantConfigs()

      logger.info(`[MailMonitor] 활성 테넌트 ${configs.length}개 발견`)

      // 각 테넌트 순차 처리
      for (const config of configs) {
        try {
          const result = await this.checkTenantMails(config)
          results.set(config.tenantId, result)

          logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 처리 완료`, {
            newMails: result.newMailsCount,
            processed: result.processedCount,
            failed: result.failedCount,
          })
        } catch (error) {
          logger.error(`[MailMonitor] 테넌트 ${config.tenantId} 처리 실패:`, error)
          results.set(config.tenantId, {
            success: false,
            newMailsCount: 0,
            processedCount: 0,
            failedCount: 0,
            errors: [error instanceof Error ? error.message : '알 수 없는 오류'],
          })
        }
      }

      logger.info('[MailMonitor] 전체 테넌트 메일 확인 완료', {
        totalTenants: configs.length,
        successCount: Array.from(results.values()).filter((r) => r.success).length,
      })

      return results
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 특정 테넌트의 메일 확인
   */
  async checkTenantMails(config: TenantMailConfig): Promise<MailCheckResult> {
    const errors: string[] = []
    let newMailsCount = 0
    let processedCount = 0
    let failedCount = 0

    let client: ImapFlow | null = null

    try {
      // IMAP 클라이언트 생성 및 연결
      client = createImapClient({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        useSSL: config.useSSL,
      })

      await client.connect()
      logger.info(`[MailMonitor] 테넌트 ${config.tenantId} IMAP 연결 성공`)

      // INBOX 열기
      const lock = await client.getMailboxLock('INBOX')

      try {
        // 등록된 업체 이메일 목록 가져오기
        const registeredEmails = await this.getRegisteredCompanyEmails(config.tenantId)

        if (registeredEmails.length === 0) {
          logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 등록된 업체 없음`)
          return {
            success: true,
            newMailsCount: 0,
            processedCount: 0,
            failedCount: 0,
            errors: [],
          }
        }

        logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 등록된 업체 ${registeredEmails.length}개`)

        // 등록된 업체 이메일에서 온 오늘 도착한 메일 검색 (읽음/읽지않음 무관)
        logger.info(`[MailMonitor] 검색할 이메일 목록:`, { emails: registeredEmails })

        // 오늘 도착한 읽지 않은 메일만 검색 (KST 기준, DB 기반 중복 체크 병행)
        const messages = []
        const today = getKSTStartOfDay()

        for (const email of registeredEmails) {
          try {
            const searchCriteria = {
              from: email,
              since: today, // 오늘 도착한 메일만
              unseen: true, // 읽지 않은 메일만 (1차 필터)
              // DB 기반 중복 체크도 병행 (2차 필터)
            }

            logger.info(`[MailMonitor] IMAP 검색 시작:`, { email, searchCriteria })

            for await (const message of client.fetch(searchCriteria, {
              envelope: true,
              source: true,
              uid: true,
              headers: ['message-id'], // 실제 Message-ID 헤더 가져오기
            })) {
              logger.info(`[MailMonitor] 메일 발견:`, {
                uid: message.uid,
                from: message.envelope?.from?.[0]?.address,
                subject: message.envelope?.subject,
              })
              messages.push(message)
            }
          } catch (error) {
            logger.warn(`[MailMonitor] ${email} 검색 실패:`, error)
          }
        }

        newMailsCount = messages.length
        logger.info(`[MailMonitor] 테넌트 ${config.tenantId} 새 메일 ${newMailsCount}개 발견`)

        // 각 메일 처리
        for (const message of messages) {
          try {
            await this.processEmail(config.tenantId, message, client)
            processedCount++
          } catch (error) {
            failedCount++
            const errorMsg = error instanceof Error ? error.message : '메일 처리 실패'
            errors.push(`UID ${message.uid}: ${errorMsg}`)
            logger.error(`[MailMonitor] 메일 처리 실패 (UID: ${message.uid}):`, error)
          }
        }

        // 마지막 확인 시간 업데이트
        this.lastCheckTimes.set(config.tenantId, new Date())
      } finally {
        lock.release()
      }

      return {
        success: true,
        newMailsCount,
        processedCount,
        failedCount,
        errors,
      }
    } catch (error) {
      logger.error(`[MailMonitor] 테넌트 ${config.tenantId} 메일 확인 실패:`, error)
      return {
        success: false,
        newMailsCount,
        processedCount,
        failedCount,
        errors: [...errors, error instanceof Error ? error.message : '알 수 없는 오류'],
      }
    } finally {
      // IMAP 연결 종료
      if (client) {
        try {
          await client.logout()
        } catch (error) {
          logger.debug('[MailMonitor] IMAP 로그아웃 실패 (무시됨)', error)
        }
      }
    }
  }

  /**
   * 개별 이메일 처리 (재시도 로직 포함)
   */
  private async processEmail(
    tenantId: string,
    message: any,
    client: ImapFlow
  ): Promise<void> {
    const from = message.envelope.from?.[0]
    const subject = message.envelope.subject
    const date = message.envelope.date
    const maxRetries = 3
    let lastError: Error | null = null

    // autoMarkAsRead 설정 조회
    const mailConfig = await this.getMailConfig(tenantId)

    // 실제 Message-ID 헤더 추출
    let messageIdHeader = message.headers?.['message-id']?.[0]

    // Message-ID가 없으면 안정적인 fallback ID 생성 (sender + subject + date + 본문해시)
    if (!messageIdHeader) {
      const emailContent = message.source?.toString() || ''
      const bodyHash = this.generateBodyHash(emailContent)
      const dateStr = date ? date.toISOString().split('T')[0] : 'unknown'
      const sender = from?.address || 'unknown'
      const subjectStr = subject || 'no-subject'

      messageIdHeader = `fallback-${tenantId}-${sender}-${subjectStr}-${dateStr}-${bodyHash}`
      logger.warn('[MailMonitor] Message-ID 헤더 없음 - fallback ID 사용', {
        uid: message.uid,
        fallbackId: messageIdHeader,
      })
    }

    logger.info('[MailMonitor] 메일 처리 시작', {
      tenantId,
      uid: message.uid,
      messageId: messageIdHeader,
      from: from?.address,
      subject,
      date,
    })

    let emailLogId: string | undefined

    try {
      // 중복 이메일 체크 (Message-ID 기반 + 알림 발송 여부 확인)
      const existingEmail = await prisma.emailLog.findFirst({
        where: {
          messageId: messageIdHeader,
          tenantId,
        },
        include: {
          notifications: true, // 알림 기록 포함
        },
      })

      if (existingEmail) {
        // 발송 성공한 알림이 있는지 확인
        const hasSuccessfulNotification = existingEmail.notifications.some(
          (n) => n.status === 'SENT' || n.status === 'DELIVERED'
        )

        if (hasSuccessfulNotification) {
          // 알림 발송 완료 → 스킵
          logger.info('[중복 방지] 알림 발송 완료된 메일 - DB 기반 스킵', {
            messageId: messageIdHeader,
            existingLogId: existingEmail.id,
            sentAt: existingEmail.notifications[0].createdAt,
          })

          // 설정에 따라 읽음 처리
          if (mailConfig.autoMarkAsRead) {
            await this.safeMarkAsRead(client, message.uid)
          }
          return
        } else {
          // 알림 미발송 → 재처리
          logger.info('[재시도] 알림 미발송 메일 재처리', {
            messageId: messageIdHeader,
            existingLogId: existingEmail.id,
            previousAttempts: existingEmail.notifications.length,
          })
          emailLogId = existingEmail.id // 기존 EmailLog 재사용
        }
      }
      // 메일 파싱하여 업체 정보 추출
      const emailContent = message.source?.toString() || ''
      const parsedData = await parseOrderEmail({
        from: from?.address || '',
        fromName: from?.name || '',
        subject: subject || '',
        body: emailContent,
        receivedDate: date,
      })

      if (!parsedData.isOrderEmail) {
        logger.info('[MailMonitor] 발주 메일이 아님 - 스킵', {
          uid: message.uid,
          subject,
        })
        // 설정에 따라 읽음 처리
        if (mailConfig.autoMarkAsRead) {
          await this.safeMarkAsRead(client, message.uid)
        }
        return
      }

      // 발주 메일인 경우 업체 찾기
      const company = await this.findCompanyByEmail(tenantId, parsedData)

      if (!company) {
        logger.warn('[MailMonitor] 업체를 찾을 수 없음', {
          tenantId,
          from: from?.address,
          companyName: parsedData.companyName,
        })
        // 설정에 따라 읽음 처리
        if (mailConfig.autoMarkAsRead) {
          await this.safeMarkAsRead(client, message.uid)
        }
        return
      }

      logger.info('[MailMonitor] 업체 매칭 성공', {
        companyId: company.id,
        companyName: company.name,
        emailReceivedAt: date,
      })

      // EmailLog 생성 (재처리가 아닌 경우만)
      let emailLog
      if (emailLogId) {
        // 재처리: 기존 EmailLog 사용
        emailLog = await prisma.emailLog.findUnique({
          where: { id: emailLogId },
        })
        logger.info('[MailMonitor] 기존 EmailLog 재사용', {
          emailLogId,
        })
      } else {
        // 신규: EmailLog 생성
        // mailparser를 사용하여 본문 및 첨부파일 파싱
        const emailSource = message.source
        const parsedEmail = await this.parseEmailWithMailparser(emailSource)
        const emailSize = message.size || (emailSource ? emailSource.length : 0)

        emailLog = await prisma.emailLog.create({
          data: {
            messageId: messageIdHeader, // 실제 Message-ID 사용
            sender: from?.address || '',
            recipient: '', // IMAP에서는 수신자 정보 없음
            subject: subject || '',
            receivedAt: date,
            body: parsedEmail.textBody, // Plain text 본문
            bodyHtml: parsedEmail.htmlBody, // HTML 본문
            isRead: false, // 새 메일은 읽지 않음
            folder: 'INBOX', // 기본 메일함
            size: emailSize, // 메일 크기
            isOrder: parsedData.isOrderEmail, // 발주 메일 여부
            hasAttachment: parsedEmail.attachments.length > 0,
            attachments: parsedEmail.attachments.length > 0
              ? parsedEmail.attachments.map((att) => ({
                  id: `att-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  // Base64로 인코딩된 파일 내용 저장 (10MB 제한)
                  content: att.size <= 10 * 1024 * 1024 ? att.content.toString('base64') : null,
                }))
              : [],
            status: 'MATCHED',
            companyId: company.id,
            tenantId,
          },
        })

        logger.info('[MailMonitor] EmailLog 생성 완료', {
          emailLogId: emailLog.id,
          hasBody: !!parsedEmail.textBody || !!parsedEmail.htmlBody,
          attachmentCount: parsedEmail.attachments.length,
        })
      }

      if (!emailLog) {
        throw new Error('EmailLog를 찾을 수 없습니다')
      }

      // 알림 발송 (notification-service에서 upsert 및 재시도 로직 담당)
      // - 유니크 키 기반으로 중복 생성 방지
      // - SENT/DELIVERED 상태면 스킵
      // - FAILED 상태면 재시도 가능 여부 판단 (에러 코드 + retryCount)
      try {
        logger.info('[MailMonitor] 알림 발송 시작', {
          companyId: company.id,
          companyName: company.name,
          emailLogId: emailLog.id,
        })

        const results = await sendOrderReceivedNotification(company.id, date, emailLog.id)
        const successCount = results.filter((r) => r.success).length
        const failedCount = results.filter((r) => !r.success).length

        logger.info('[MailMonitor] 알림 발송 완료', {
          companyId: company.id,
          companyName: company.name,
          totalContacts: results.length,
          successCount,
          failedCount,
          results: results.map((r) => ({
            success: r.success,
            error: r.error,
            errorCode: r.errorCode,
            provider: r.provider,
          })),
        })

        // 빈 배열: 담당자 없거나 모두 이미 발송 완료 상태
        if (results.length === 0) {
          logger.info('[MailMonitor] 알림 발송 스킵 - 담당자 없음 또는 이미 성공 상태', {
            companyId: company.id,
            emailLogId: emailLog.id,
          })
        }

        // 설정에 따라 읽음 처리
        if (mailConfig.autoMarkAsRead) {
          await this.safeMarkAsRead(client, message.uid)
          logger.info('[MailMonitor] 메일 읽음 처리 완료', { uid: message.uid })
        } else {
          logger.info('[MailMonitor] 읽음 처리 스킵 (설정 OFF)', { uid: message.uid })
        }
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('알림 발송 실패')
        logger.error('[MailMonitor] 알림 발송 중 예외 발생:', {
          companyId: company.id,
          emailLogId: emailLog.id,
          error: lastError.message,
        })
      }

      // 알림 발송 실패해도 메일은 처리된 것으로 간주
      // (다음 스케줄에서 다시 시도하면 upsert로 재시도됨)
      if (lastError) {
        logger.warn('[MailMonitor] 알림 발송 실패, 다음 스케줄에서 재시도 예정', {
          companyId: company.id,
          emailLogId: emailLog.id,
          error: lastError.message,
        })
      }
    } catch (error) {
      logger.error('[MailMonitor] 메일 처리 최종 실패:', error)
      // 에러 발생 시에도 설정에 따라 읽음 처리
      if (mailConfig.autoMarkAsRead) {
        await this.safeMarkAsRead(client, message.uid)
      }
      throw error
    }
  }

  /**
   * 안전한 읽음 처리 (에러 무시)
   */
  private async safeMarkAsRead(client: ImapFlow, uid: number): Promise<void> {
    try {
      // uid를 배열로 전달
      await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true })
      logger.info('[MailMonitor] 읽음 처리 성공', { uid })
    } catch (error) {
      logger.error('[MailMonitor] 읽음 처리 실패 - 재시도', { uid, error })

      // 다른 방법으로 재시도
      try {
        await client.store(`${uid}`, '+FLAGS', ['\\Seen'], { uid: true })
        logger.info('[MailMonitor] 읽음 처리 성공 (재시도)', { uid })
      } catch (retryError) {
        logger.error('[MailMonitor] 읽음 처리 완전 실패', { uid, error: retryError })
      }
    }
  }

  /**
   * 테넌트의 등록된 업체 및 담당자 이메일 목록 조회 (캐싱)
   */
  private async getRegisteredCompanyEmails(tenantId: string): Promise<string[]> {
    const CACHE_TTL = 5 * 60 * 1000 // 5분

    // 캐시 확인
    const cached = this.companyEmailsCache.get(tenantId)
    if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
      logger.debug('[MailMonitor] 캐시된 업체 이메일 사용', {
        tenantId,
        count: cached.emails.length,
      })
      return cached.emails
    }

    // 1. 업체 이메일 가져오기
    const companies = await prisma.company.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        email: true,
      },
    })

    const companyEmails = companies.map((c) => c.email).filter((email): email is string => !!email)

    // 2. 담당자 이메일 가져오기
    const contacts = await prisma.contact.findMany({
      where: {
        company: {
          tenantId,
          isActive: true,
        },
        isActive: true,
      },
      select: {
        email: true,
      },
    })

    const contactEmails = contacts.map((c) => c.email).filter((email): email is string => !!email)

    // 3. 중복 제거하여 합치기
    const allEmails = Array.from(new Set([...companyEmails, ...contactEmails]))

    // 캐시 업데이트
    this.companyEmailsCache.set(tenantId, {
      emails: allEmails,
      updatedAt: new Date(),
    })

    logger.info('[MailMonitor] 등록된 업체 및 담당자 이메일 로드 완료', {
      tenantId,
      companyEmails: companyEmails.length,
      contactEmails: contactEmails.length,
      totalUnique: allEmails.length,
    })

    return allEmails
  }

  /**
   * 이메일 정보로 업체 찾기
   */
  private async findCompanyByEmail(
    tenantId: string,
    parsedData: {
      companyName?: string
      senderEmail?: string
      senderDomain?: string
    }
  ) {
    // 1순위: 이메일 주소로 찾기
    if (parsedData.senderEmail) {
      const company = await prisma.company.findFirst({
        where: {
          tenantId,
          email: parsedData.senderEmail,
          isActive: true,
        },
      })
      if (company) return company
    }

    // 2순위: 도메인으로 찾기
    if (parsedData.senderDomain) {
      const company = await prisma.company.findFirst({
        where: {
          tenantId,
          email: {
            endsWith: `@${parsedData.senderDomain}`,
          },
          isActive: true,
        },
      })
      if (company) return company
    }

    // 3순위: 업체명으로 찾기 (정확히 일치)
    if (parsedData.companyName) {
      const company = await prisma.company.findFirst({
        where: {
          tenantId,
          name: parsedData.companyName,
          isActive: true,
        },
      })
      if (company) return company
    }

    // 4순위: 업체명 부분 일치
    if (parsedData.companyName) {
      const company = await prisma.company.findFirst({
        where: {
          tenantId,
          name: {
            contains: parsedData.companyName,
          },
          isActive: true,
        },
      })
      if (company) return company
    }

    return null
  }

  /**
   * 테넌트의 메일 설정 조회 (autoMarkAsRead 포함)
   */
  private async getMailConfig(tenantId: string): Promise<{
    autoMarkAsRead: boolean
  }> {
    const config = await prisma.systemConfig.findFirst({
      where: {
        tenantId,
        key: 'mailServer.autoMarkAsRead',
      },
    })

    return {
      autoMarkAsRead: config ? JSON.parse(config.value) : false, // 기본값 false (사용자 메일함 상태 유지)
    }
  }

  /**
   * 활성화된 테넌트의 메일 설정 조회
   */
  private async getActiveTenantConfigs(): Promise<TenantMailConfig[]> {
    // SystemConfig에서 메일 설정 조회
    const mailConfigs = await prisma.systemConfig.findMany({
      where: {
        key: {
          startsWith: 'mailServer.',
        },
      },
    })

    // 테넌트별로 그룹화
    const tenantConfigMap = new Map<string, Record<string, any>>()

    for (const config of mailConfigs) {
      if (!tenantConfigMap.has(config.tenantId)) {
        tenantConfigMap.set(config.tenantId, {})
      }

      const [, field] = config.key.split('.')
      const tenantConfig = tenantConfigMap.get(config.tenantId)!

      try {
        tenantConfig[field] = JSON.parse(config.value)
      } catch {
        tenantConfig[field] = config.value
      }
    }

    // 활성화되고 필수 설정이 모두 있는 테넌트만 반환
    const activeConfigs: TenantMailConfig[] = []

    for (const [tenantId, config] of tenantConfigMap.entries()) {
      if (
        config.enabled === true &&
        config.host &&
        config.port &&
        config.username &&
        config.password
      ) {
        activeConfigs.push({
          tenantId,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          useSSL: config.useSSL ?? true,
          enabled: config.enabled,
        })
      }
    }

    return activeConfigs
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTimes: Object.fromEntries(this.lastCheckTimes),
    }
  }

  /**
   * mailparser를 사용하여 이메일 파싱 (본문 + 첨부파일)
   */
  private async parseEmailWithMailparser(emailSource: Buffer | undefined): Promise<ParsedEmailContent> {
    const result: ParsedEmailContent = {
      textBody: null,
      htmlBody: null,
      attachments: [],
    }

    if (!emailSource) {
      logger.warn('[MailMonitor] 이메일 소스가 없습니다')
      return result
    }

    try {
      const parsed: ParsedMail = await simpleParser(emailSource)

      // Plain text 본문
      if (parsed.text) {
        result.textBody = parsed.text
      }

      // HTML 본문
      if (parsed.html) {
        result.htmlBody = parsed.html as string
      }

      // 첨부파일 추출
      if (parsed.attachments && parsed.attachments.length > 0) {
        result.attachments = parsed.attachments.map((att: Attachment) => ({
          filename: att.filename || 'unknown',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          content: att.content,
        }))

        logger.info('[MailMonitor] 첨부파일 감지', {
          count: result.attachments.length,
          files: result.attachments.map((a) => ({ name: a.filename, size: a.size })),
        })
      }

      logger.info('[MailMonitor] 이메일 파싱 완료', {
        hasTextBody: !!result.textBody,
        textBodyLength: result.textBody?.length || 0,
        hasHtmlBody: !!result.htmlBody,
        htmlBodyLength: result.htmlBody?.length || 0,
        attachmentCount: result.attachments.length,
      })

      return result
    } catch (error) {
      logger.error('[MailMonitor] mailparser 파싱 실패:', error)
      return result
    }
  }

  /**
   * 메일 본문의 해시 생성 (앞 500자 기준)
   * Message-ID가 없을 때 fallback ID 생성에 사용
   */
  private generateBodyHash(emailBody: string): string {
    const crypto = require('crypto')
    // 본문 앞 500자만 사용 (성능 및 일관성)
    const contentToHash = emailBody.substring(0, 500)
    return crypto.createHash('md5').update(contentToHash).digest('hex').substring(0, 12)
  }
}

// 싱글톤 인스턴스
export const mailMonitorService = new MailMonitorService()
