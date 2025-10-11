import { ImapClient, MailConfig, ProcessedEmail } from './imap-client'
import { MailProcessor, ProcessingResult } from './mail-processor'
import { logger } from '@/lib/utils/logger'
import { trackEmailUsage, checkEmailLimit } from '@/lib/usage/usage-tracker'
import { checkEmailUsageLimit } from '@/lib/usage/middleware'

export class MailService {
  private imapClient: ImapClient
  private mailProcessor: MailProcessor
  private isRunning = false

  constructor(config: MailConfig) {
    this.imapClient = new ImapClient(config)
    this.mailProcessor = new MailProcessor()
  }

  async start(): Promise<boolean> {
    try {
      if (this.isRunning) {
        logger.warn('메일 서비스가 이미 실행 중입니다')
        return true
      }

      logger.info('메일 서비스 시작...')

      // IMAP 연결
      const connected = await this.imapClient.connect()
      if (!connected) {
        throw new Error('IMAP 연결 실패')
      }

      // INBOX 선택
      const selected = await this.imapClient.selectMailbox('INBOX')
      if (!selected) {
        throw new Error('INBOX 선택 실패')
      }

      this.isRunning = true

      // 기존 읽지 않은 메일 처리
      logger.info('기존 읽지 않은 메일 확인 중...')
      const unreadEmails = await this.imapClient.getUnseenEmails()
      for (const email of unreadEmails) {
        await this.processEmail(email)
      }

      // 실시간 모니터링 시작
      logger.info('실시간 메일 모니터링 시작')
      this.imapClient.startMonitoring(async (email) => {
        await this.processEmail(email)
      })

      logger.info('메일 서비스 시작 완료')
      return true
    } catch (error) {
      logger.error('메일 서비스 시작 실패:', error)
      this.isRunning = false
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.info('메일 서비스가 실행 중이 아닙니다')
        return
      }

      logger.info('메일 서비스 중지 중...')

      // 모니터링 중지
      this.imapClient.stopMonitoring()

      // IMAP 연결 해제
      await this.imapClient.disconnect()

      this.isRunning = false
      logger.info('메일 서비스 중지 완료')
    } catch (error) {
      logger.error('메일 서비스 중지 실패:', error)
    }
  }

  private async processEmail(email: ProcessedEmail): Promise<void> {
    try {
      logger.info(`새 메일 수신: ${email.subject}`, {
        from: email.from,
        messageId: email.messageId,
      })

      // 메일 처리 전 사용량 체크 (테넌트별로 체크해야 하지만, 현재는 전역으로 처리)
      // TODO: 이메일에서 테넌트 정보를 추출하여 체크하도록 개선 필요

      const result: ProcessingResult = await this.mailProcessor.processEmail(email)

      if (result.success) {
        // 메일 처리 성공시 사용량 추적
        if (result.tenantId) {
          const usageMetadata = {
            messageId: email.messageId,
            from: email.from,
            subject: email.subject,
            companyId: result.company?.id,
            action: result.action,
          }

          await trackEmailUsage(result.tenantId, 1)
          logger.debug('이메일 사용량 추적 완료', {
            tenantId: result.tenantId,
            messageId: email.messageId,
          })
        }

        switch (result.action) {
          case 'processed':
            logger.info(`메일 처리 완료: ${result.company?.name}`)
            // 알림 발송 로직 추가 예정
            break

          case 'ignored':
            logger.info(`메일 무시됨: ${result.reason}`)
            break
        }
      } else {
        logger.error(`메일 처리 실패: ${result.reason}`)
      }
    } catch (error) {
      logger.error('메일 처리 중 예상치 못한 오류:', error)
    }
  }

  // 연결 상태 확인
  get connected(): boolean {
    return this.imapClient.connected
  }

  // 실행 상태 확인
  get running(): boolean {
    return this.isRunning
  }

  // 수동으로 메일 확인
  async checkNow(): Promise<ProcessedEmail[]> {
    try {
      if (!this.imapClient.connected) {
        throw new Error('IMAP 연결이 필요합니다')
      }

      logger.info('수동 메일 확인 시작')
      const emails = await this.imapClient.getUnseenEmails()

      for (const email of emails) {
        await this.processEmail(email)
      }

      logger.info(`수동 메일 확인 완료: ${emails.length}개 처리`)
      return emails
    } catch (error) {
      logger.error('수동 메일 확인 실패:', error)
      return []
    }
  }

  // 특정 날짜 이후의 메일 확인
  async checkEmailsSince(since: Date): Promise<ProcessedEmail[]> {
    try {
      if (!this.imapClient.connected) {
        throw new Error('IMAP 연결이 필요합니다')
      }

      logger.info(`${since.toISOString()} 이후 메일 확인 시작`)
      const emails = await this.imapClient.getEmailsByDate(since)

      for (const email of emails) {
        await this.processEmail(email)
      }

      logger.info(`날짜별 메일 확인 완료: ${emails.length}개 처리`)
      return emails
    } catch (error) {
      logger.error('날짜별 메일 확인 실패:', error)
      return []
    }
  }

  // 서비스 상태 정보
  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.imapClient.connected,
      isMonitoring: this.imapClient.monitoring,
    }
  }
}

// 환경변수에서 메일 설정 로드
export function createMailServiceFromEnv(): MailService {
  const config: MailConfig = {
    host: process.env.MAIL_HOST!,
    port: parseInt(process.env.MAIL_PORT || '993'),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER!,
    password: process.env.MAIL_PASSWORD!,
    checkInterval: parseInt(process.env.MAIL_CHECK_INTERVAL || '60000'),
    idleTimeout: parseInt(process.env.MAIL_IDLE_TIMEOUT || '300000'),
  }

  if (!config.host || !config.user || !config.password) {
    throw new Error(
      '메일 설정이 완전하지 않습니다. MAIL_HOST, MAIL_USER, MAIL_PASSWORD를 확인하세요.'
    )
  }

  return new MailService(config)
}
