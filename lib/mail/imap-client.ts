import { ImapFlow, FetchMessageObject } from 'imapflow'
import { ParsedMail, simpleParser } from 'mailparser'
import { logger } from '@/lib/utils/logger'

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  checkInterval?: number
  idleTimeout?: number
}

export interface ProcessedEmail {
  id: string
  from: string
  to: string[]
  subject: string
  body: {
    text?: string
    html?: string
  }
  attachments: Array<{
    filename?: string
    contentType: string
    size: number
    data: Buffer
  }>
  receivedAt: Date
  messageId: string
}

export class ImapClient {
  private client: ImapFlow | null = null
  private config: MailConfig
  private isConnected = false
  private isListening = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 5000

  constructor(config: MailConfig) {
    this.config = {
      checkInterval: 60000, // 1분
      idleTimeout: 300000, // 5분
      ...config,
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (this.isConnected && this.client) {
        return true
      }

      logger.info('IMAP 서버 연결 시도...', {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
      })

      this.client = new ImapFlow({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.password,
        },
        logger: {
          debug: (msg: string) => logger.debug(`IMAP: ${msg}`),
          info: (msg: string) => logger.info(`IMAP: ${msg}`),
          warn: (msg: string) => logger.warn(`IMAP: ${msg}`),
          error: (msg: string) => logger.error(`IMAP: ${msg}`),
        },
      })

      await this.client.connect()
      this.isConnected = true
      this.reconnectAttempts = 0

      logger.info('IMAP 연결 성공')
      return true
    } catch (error) {
      logger.error('IMAP 연결 실패:', error)
      this.isConnected = false
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.isListening = false

      if (this.client && this.isConnected) {
        await this.client.logout()
        this.client = null
        this.isConnected = false
        logger.info('IMAP 연결 해제')
      }
    } catch (error) {
      logger.error('IMAP 연결 해제 실패:', error)
    }
  }

  async selectMailbox(mailbox: string = 'INBOX'): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('IMAP 연결이 필요합니다')
      }

      await this.client.selectMailbox(mailbox)
      logger.info(`메일박스 선택: ${mailbox}`)
      return true
    } catch (error) {
      logger.error(`메일박스 선택 실패 (${mailbox}):`, error)
      return false
    }
  }

  async getUnseenEmails(): Promise<ProcessedEmail[]> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('IMAP 연결이 필요합니다')
      }

      // 읽지 않은 메일 검색
      const messages = []
      for await (const message of this.client.fetch('UNSEEN', {
        envelope: true,
        bodyStructure: true,
        source: true,
        markSeen: false, // 메일 가져올 때 자동 읽음 처리 방지
      })) {
        messages.push(message)
      }

      logger.info(`읽지 않은 메일 ${messages.length}개 발견`)

      // 메일 파싱 및 처리
      const processedEmails: ProcessedEmail[] = []
      for (const message of messages) {
        try {
          const processed = await this.parseMessage(message)
          if (processed) {
            processedEmails.push(processed)
          }
        } catch (error) {
          logger.error(`메일 파싱 실패 (UID: ${message.uid}):`, error)
        }
      }

      return processedEmails
    } catch (error) {
      logger.error('메일 조회 실패:', error)
      return []
    }
  }

  async getEmailsByDate(since: Date): Promise<ProcessedEmail[]> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('IMAP 연결이 필요합니다')
      }

      const sinceStr = since.toISOString().split('T')[0] // YYYY-MM-DD 형식

      const messages = []
      for await (const message of this.client.fetch(`SINCE ${sinceStr}`, {
        envelope: true,
        bodyStructure: true,
        source: true,
        markSeen: false, // 메일 가져올 때 자동 읽음 처리 방지
      })) {
        messages.push(message)
      }

      logger.info(`${sinceStr} 이후 메일 ${messages.length}개 발견`)

      const processedEmails: ProcessedEmail[] = []
      for (const message of messages) {
        try {
          const processed = await this.parseMessage(message)
          if (processed) {
            processedEmails.push(processed)
          }
        } catch (error) {
          logger.error(`메일 파싱 실패 (UID: ${message.uid}):`, error)
        }
      }

      return processedEmails
    } catch (error) {
      logger.error('메일 조회 실패:', error)
      return []
    }
  }

  private async parseMessage(message: FetchMessageObject): Promise<ProcessedEmail | null> {
    try {
      if (!message.source) {
        throw new Error('메시지 소스가 없습니다')
      }

      const parsed: ParsedMail = await simpleParser(message.source)

      const processedEmail: ProcessedEmail = {
        id: `${message.uid}`,
        from: parsed.from?.value?.[0]?.address || '',
        to: parsed.to?.value?.map((addr) => addr.address || '') || [],
        subject: parsed.subject || '',
        body: {
          text: parsed.text,
          html: parsed.html as string,
        },
        attachments: (parsed.attachments || []).map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          data: att.content,
        })),
        receivedAt: parsed.date || new Date(),
        messageId: parsed.messageId || `${message.uid}`,
      }

      return processedEmail
    } catch (error) {
      logger.error(`메시지 파싱 실패:`, error)
      return null
    }
  }

  async startMonitoring(onNewEmail: (email: ProcessedEmail) => Promise<void>): Promise<void> {
    if (this.isListening) {
      logger.warn('이미 메일 모니터링이 실행 중입니다')
      return
    }

    this.isListening = true
    logger.info('메일 실시간 모니터링 시작')

    while (this.isListening) {
      try {
        // 연결 확인 및 재연결
        if (!(await this.ensureConnection())) {
          await this.sleep(this.reconnectDelay)
          continue
        }

        // 새 메일 확인
        const newEmails = await this.getUnseenEmails()

        for (const email of newEmails) {
          try {
            await onNewEmail(email)
            logger.info(`새 메일 처리 완료: ${email.subject}`)
          } catch (error) {
            logger.error(`메일 처리 실패: ${email.subject}`, error)
          }
        }

        // 다음 체크까지 대기
        await this.sleep(this.config.checkInterval!)
      } catch (error) {
        logger.error('메일 모니터링 오류:', error)
        await this.sleep(this.reconnectDelay)
      }
    }

    logger.info('메일 모니터링 중지')
  }

  stopMonitoring(): void {
    this.isListening = false
    logger.info('메일 모니터링 중지 요청')
  }

  private async ensureConnection(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return await this.connect()
      }

      // 연결 상태 확인
      try {
        await this.client.noop()
        return true
      } catch {
        // 연결이 끊어진 경우 재연결 시도
        logger.warn('IMAP 연결이 끊어짐, 재연결 시도...')
        this.isConnected = false
        return await this.reconnect()
      }
    } catch (error) {
      logger.error('연결 확인 실패:', error)
      return false
    }
  }

  private async reconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`최대 재연결 시도 횟수 (${this.maxReconnectAttempts}) 초과`)
      return false
    }

    this.reconnectAttempts++
    logger.info(`IMAP 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    // 기존 연결 정리
    if (this.client) {
      try {
        await this.client.close()
      } catch {
        // 무시
      }
      this.client = null
      this.isConnected = false
    }

    return await this.connect()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 연결 상태 확인
  get connected(): boolean {
    return this.isConnected
  }

  // 모니터링 상태 확인
  get monitoring(): boolean {
    return this.isListening
  }
}
