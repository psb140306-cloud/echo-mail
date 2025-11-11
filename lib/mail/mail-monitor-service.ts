import { PrismaClient } from '@prisma/client'
import { ImapFlow } from 'imapflow'
import { logger } from '@/lib/utils/logger'
import { createImapClient } from '@/lib/imap/connection'
import { parseOrderEmail } from './email-parser'
import { sendOrderReceivedNotification } from '@/lib/notifications/notification-service'

const prisma = new PrismaClient()

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
        // 마지막 확인 시간 이후의 읽지 않은 메일 검색
        const lastCheckTime = this.lastCheckTimes.get(config.tenantId)
        const searchCriteria = lastCheckTime
          ? { unseen: true, since: lastCheckTime }
          : { unseen: true }

        // 새 메일 검색
        const messages = []
        for await (const message of client.fetch(searchCriteria, {
          envelope: true,
          source: true,
          uid: true,
        })) {
          messages.push(message)
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

    logger.info('[MailMonitor] 메일 처리 시작', {
      tenantId,
      uid: message.uid,
      from: from?.address,
      subject,
      date,
    })

    try {
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
        // 읽음 처리
        await this.safeMarkAsRead(client, message.uid)
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
        // 읽음 처리
        await this.safeMarkAsRead(client, message.uid)
        return
      }

      logger.info('[MailMonitor] 업체 매칭 성공', {
        companyId: company.id,
        companyName: company.name,
      })

      // 알림 발송 (재시도 로직)
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const results = await sendOrderReceivedNotification(company.id)
          const successCount = results.filter((r) => r.success).length

          logger.info('[MailMonitor] 알림 발송 완료', {
            companyId: company.id,
            totalContacts: results.length,
            successCount,
            attempt,
          })

          // 알림 발송 성공 시 읽음 처리
          await this.safeMarkAsRead(client, message.uid)
          return
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('알림 발송 실패')
          logger.warn(`[MailMonitor] 알림 발송 실패 (시도 ${attempt}/${maxRetries}):`, error)

          if (attempt < maxRetries) {
            // 재시도 전 대기 (exponential backoff)
            const delay = Math.pow(2, attempt) * 1000
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }

      // 모든 재시도 실패
      throw lastError || new Error('알림 발송 실패')
    } catch (error) {
      logger.error('[MailMonitor] 메일 처리 최종 실패:', error)
      // 에러 발생 시에도 읽음 처리하여 무한 루프 방지
      await this.safeMarkAsRead(client, message.uid)
      throw error
    }
  }

  /**
   * 안전한 읽음 처리 (에러 무시)
   */
  private async safeMarkAsRead(client: ImapFlow, uid: number): Promise<void> {
    try {
      await client.messageFlagsAdd(uid, ['\\Seen'])
    } catch (error) {
      logger.debug('[MailMonitor] 읽음 처리 실패 (무시됨)', { uid, error })
    }
  }

  /**
   * 테넌트의 등록된 업체 이메일 목록 조회 (캐싱)
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

    // DB에서 조회
    const companies = await prisma.company.findMany({
      where: {
        tenantId,
        isActive: true,
        email: {
          not: null,
        },
      },
      select: {
        email: true,
      },
    })

    const emails = companies.map((c) => c.email).filter((email): email is string => !!email)

    // 캐시 업데이트
    this.companyEmailsCache.set(tenantId, {
      emails,
      updatedAt: new Date(),
    })

    logger.info('[MailMonitor] 등록된 업체 이메일 로드 완료', {
      tenantId,
      count: emails.length,
    })

    return emails
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
}

// 싱글톤 인스턴스
export const mailMonitorService = new MailMonitorService()
