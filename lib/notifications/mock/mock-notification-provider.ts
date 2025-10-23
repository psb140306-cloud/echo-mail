import { NotificationType } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { SMSProvider, SMSMessage, SMSResult } from '../sms/sms-provider'
import { KakaoProvider, KakaoMessage, KakaoResult } from '../kakao/kakao-provider'

/**
 * 모의 알림 저장소
 * 실제 전송 없이 메모리에 메시지를 저장합니다
 */
interface MockNotification {
  id: string
  type: 'SMS' | 'KAKAO_ALIMTALK' | 'KAKAO_FRIENDTALK'
  recipient: string
  message: string
  subject?: string
  templateCode?: string
  variables?: Record<string, string>
  sender?: string
  sentAt: Date
  status: 'success' | 'failed'
  errorMessage?: string
}

class MockNotificationStore {
  private static instance: MockNotificationStore
  private notifications: MockNotification[] = []
  private maxSize = 1000 // 최대 저장 개수

  private constructor() {}

  static getInstance(): MockNotificationStore {
    if (!MockNotificationStore.instance) {
      MockNotificationStore.instance = new MockNotificationStore()
    }
    return MockNotificationStore.instance
  }

  add(notification: MockNotification): void {
    this.notifications.unshift(notification)

    // 최대 개수 초과시 오래된 항목 제거
    if (this.notifications.length > this.maxSize) {
      this.notifications = this.notifications.slice(0, this.maxSize)
    }
  }

  getAll(): MockNotification[] {
    return [...this.notifications]
  }

  getRecent(count: number = 50): MockNotification[] {
    return this.notifications.slice(0, count)
  }

  getByRecipient(recipient: string): MockNotification[] {
    return this.notifications.filter((n) => n.recipient === recipient)
  }

  clear(): void {
    this.notifications = []
  }

  getCount(): number {
    return this.notifications.length
  }
}

/**
 * 모의 SMS Provider
 * 실제 SMS 전송 없이 로컬에 저장만 합니다
 */
export class MockSMSProvider implements SMSProvider {
  private store = MockNotificationStore.getInstance()
  private config: {
    provider: string
    sender: string
    testMode: boolean
    failureRate?: number // 의도적인 실패율 (0-1)
  }

  constructor(config: {
    provider?: string
    sender?: string
    testMode?: boolean
    failureRate?: number
  } = {}) {
    this.config = {
      provider: config.provider || 'mock',
      sender: config.sender || '01012345678',
      testMode: config.testMode ?? true,
      failureRate: config.failureRate || 0,
    }
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // 의도적인 실패 시뮬레이션
      if (Math.random() < this.config.failureRate) {
        const errorNotification: MockNotification = {
          id: this.generateMessageId(),
          type: 'SMS',
          recipient: message.to,
          message: message.message,
          subject: message.subject,
          sender: this.config.sender,
          sentAt: new Date(),
          status: 'failed',
          errorMessage: '모의 실패 (의도적)',
        }
        this.store.add(errorNotification)

        logger.warn('[Mock SMS] 의도적 실패 시뮬레이션', {
          recipient: message.to,
        })

        return {
          success: false,
          error: '모의 실패 (테스트용)',
        }
      }

      const messageId = this.generateMessageId()

      const notification: MockNotification = {
        id: messageId,
        type: 'SMS',
        recipient: message.to,
        message: message.message,
        subject: message.subject,
        sender: this.config.sender,
        sentAt: new Date(),
        status: 'success',
      }

      this.store.add(notification)

      logger.info('[Mock SMS] 메시지 저장 완료', {
        messageId,
        recipient: message.to,
        messageLength: message.message.length,
      })

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      logger.error('[Mock SMS] 메시지 저장 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async getBalance(): Promise<number> {
    // 무제한 잔액 시뮬레이션
    return 999999
  }

  async validateConfig(): Promise<boolean> {
    return true
  }

  private generateMessageId(): string {
    return `mock_sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 모의 카카오 Provider
 * 실제 카카오톡 전송 없이 로컬에 저장만 합니다
 */
export class MockKakaoProvider implements KakaoProvider {
  private store = MockNotificationStore.getInstance()
  private config: {
    testMode: boolean
    failureRate?: number
  }

  constructor(config: { testMode?: boolean; failureRate?: number } = {}) {
    this.config = {
      testMode: config.testMode ?? true,
      failureRate: config.failureRate || 0,
    }
  }

  async sendAlimTalk(message: KakaoMessage): Promise<KakaoResult> {
    try {
      // 의도적인 실패 시뮬레이션
      if (Math.random() < this.config.failureRate) {
        const errorNotification: MockNotification = {
          id: this.generateMessageId(),
          type: 'KAKAO_ALIMTALK',
          recipient: message.to,
          message: message.message,
          templateCode: message.templateCode,
          variables: message.variables,
          sentAt: new Date(),
          status: 'failed',
          errorMessage: '모의 실패 (의도적)',
        }
        this.store.add(errorNotification)

        return {
          success: false,
          error: '모의 실패 (테스트용)',
        }
      }

      const messageId = this.generateMessageId()

      const notification: MockNotification = {
        id: messageId,
        type: 'KAKAO_ALIMTALK',
        recipient: message.to,
        message: message.message,
        templateCode: message.templateCode,
        variables: message.variables,
        sentAt: new Date(),
        status: 'success',
      }

      this.store.add(notification)

      logger.info('[Mock Kakao] 알림톡 저장 완료', {
        messageId,
        recipient: message.to,
        templateCode: message.templateCode,
      })

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      logger.error('[Mock Kakao] 알림톡 저장 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async sendFriendTalk(message: Omit<KakaoMessage, 'templateCode'>): Promise<KakaoResult> {
    try {
      const messageId = this.generateMessageId()

      const notification: MockNotification = {
        id: messageId,
        type: 'KAKAO_FRIENDTALK',
        recipient: message.to,
        message: message.message,
        variables: message.variables,
        sentAt: new Date(),
        status: 'success',
      }

      this.store.add(notification)

      logger.info('[Mock Kakao] 친구톡 저장 완료', {
        messageId,
        recipient: message.to,
      })

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      logger.error('[Mock Kakao] 친구톡 저장 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async validateConfig(): Promise<boolean> {
    return true
  }

  private generateMessageId(): string {
    return `mock_kakao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 모의 알림 저장소 접근 함수
 */
export const mockNotificationStore = MockNotificationStore.getInstance()

/**
 * Mock Provider 생성 팩토리 함수
 */
export function createMockSMSProvider(config?: {
  sender?: string
  failureRate?: number
}): SMSProvider {
  return new MockSMSProvider({
    provider: 'mock',
    testMode: true,
    ...config,
  })
}

export function createMockKakaoProvider(config?: {
  failureRate?: number
}): KakaoProvider {
  return new MockKakaoProvider({
    testMode: true,
    ...config,
  })
}
