import { SMSProvider, SMSMessage, SMSResult } from './sms-provider'
import { logger } from '@/lib/utils/logger'
import { SolapiMessageService } from 'solapi'

/**
 * SOLAPI SMS Provider
 * https://solapi.com
 */

interface SolapiConfig {
  apiKey: string
  apiSecret: string
  sender: string
  testMode?: boolean
}

interface SolapiSendResponse {
  groupId: string
  to: string
  from: string
  type: string
  statusMessage: string
  country: string
  messageId: string
  statusCode: string
  accountId: string
}

interface SolapiErrorResponse {
  errorCode: string
  errorMessage: string
}

export class SolapiSMSProvider implements SMSProvider {
  private config: SolapiConfig
  private messageService: SolapiMessageService

  constructor(config: SolapiConfig) {
    this.config = config
    this.messageService = new SolapiMessageService(config.apiKey, config.apiSecret)
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // 환경 변수 디버깅
      logger.info('[SOLAPI] 환경 변수 확인', {
        NODE_ENV: process.env.NODE_ENV,
        ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
        testMode: this.config.testMode,
        hasApiKey: !!this.config.apiKey,
        hasApiSecret: !!this.config.apiSecret,
        sender: this.config.sender,
      })

      // 테스트 모드
      if (this.config.testMode) {
        logger.warn('[SOLAPI Test Mode] SMS 전송 시뮬레이션 (실제 발송 안됨!)', {
          to: message.to,
          from: this.config.sender,
          messageLength: message.message.length,
          reason: process.env.NODE_ENV !== 'production' ? 'NODE_ENV가 production이 아님' : 'ENABLE_REAL_NOTIFICATIONS가 true가 아님',
        })

        return {
          success: true,
          messageId: `test_solapi_${Date.now()}`,
        }
      }

      // 메시지 타입 결정 (SMS: 90바이트 이하, LMS: 90바이트 초과)
      const messageBytes = Buffer.from(message.message, 'utf8').length
      const messageType = messageBytes <= 90 ? 'SMS' : 'LMS'

      logger.info('[SOLAPI] 메시지 타입 결정', {
        messageLength: message.message.length,
        messageBytes,
        type: messageType,
      })

      // SOLAPI SDK를 사용한 메시지 발송
      const result = await this.messageService.send({
        to: message.to.replace(/-/g, ''),
        from: this.config.sender.replace(/-/g, ''),
        text: message.message,
        type: messageType,
        ...(message.subject && messageType === 'LMS' && { subject: message.subject }),
      })

      logger.info('[SOLAPI] SMS 전송 성공', {
        messageId: result.messageId,
        to: message.to,
        type: messageType,
      })

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error: any) {
      logger.error('[SOLAPI] SMS 전송 오류:', {
        error: error.message || error.toString(),
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        fullError: JSON.stringify(error),
        stack: error.stack,
      })

      return {
        success: false,
        error: error.message || error.toString() || '알 수 없는 오류',
      }
    }
  }

  async getBalance(): Promise<number> {
    try {
      if (this.config.testMode) {
        return 999999
      }

      const date = new Date().toISOString()
      const signature = this.generateSignature(date)

      const response = await fetch(`${this.baseUrl}/cash/v1/balance`, {
        method: 'GET',
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
      })

      if (!response.ok) {
        throw new Error('잔액 조회 실패')
      }

      const data = await response.json()
      return data.balance || 0
    } catch (error) {
      logger.error('[SOLAPI] 잔액 조회 오류:', error)
      return 0
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // API 키와 발신번호가 설정되어 있는지 확인
      if (!this.config.apiKey || !this.config.apiSecret || !this.config.sender) {
        return false
      }

      // 테스트 모드면 검증 통과
      if (this.config.testMode) {
        return true
      }

      // 실제 API 호출로 검증
      const balance = await this.getBalance()
      return balance >= 0
    } catch (error) {
      logger.error('[SOLAPI] 설정 검증 실패:', error)
      return false
    }
  }


  /**
   * 발신번호 등록 (SOLAPI API 사용)
   */
  async registerSenderNumber(phoneNumber: string, comment?: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      if (this.config.testMode) {
        logger.info('[SOLAPI Test Mode] 발신번호 등록 시뮬레이션', { phoneNumber })
        return { success: true }
      }

      const date = new Date().toISOString()
      const requestBody = {
        phoneNumber: phoneNumber.replace(/-/g, ''),
        ...(comment && { comment }),
      }
      const signature = this.generateSignature(date, requestBody)

      const response = await fetch(`${this.baseUrl}/senderid/v1/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.errorMessage || '발신번호 등록 실패',
        }
      }

      logger.info('[SOLAPI] 발신번호 등록 요청 성공', { phoneNumber })
      return { success: true }
    } catch (error) {
      logger.error('[SOLAPI] 발신번호 등록 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  /**
   * 등록된 발신번호 목록 조회
   */
  async getSenderNumbers(): Promise<string[]> {
    try {
      if (this.config.testMode) {
        return [this.config.sender]
      }

      const date = new Date().toISOString()
      const signature = this.generateSignature(date)

      const response = await fetch(`${this.baseUrl}/senderid/v1/list`, {
        method: 'GET',
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
      })

      if (!response.ok) {
        throw new Error('발신번호 조회 실패')
      }

      const data = await response.json()
      return data.list?.map((item: any) => item.phoneNumber) || []
    } catch (error) {
      logger.error('[SOLAPI] 발신번호 조회 오류:', error)
      return []
    }
  }
}

/**
 * 환경변수에서 SOLAPI Provider 생성
 */
export function createSolapiProviderFromEnv(): SolapiSMSProvider {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const sender = process.env.SOLAPI_SENDER || process.env.SOLAPI_SENDER_PHONE || process.env.DEFAULT_SENDER_PHONE

  // 디버깅: 환경 변수 타입 확인
  logger.info('[SOLAPI] 환경 변수 로드', {
    apiKeyType: typeof apiKey,
    apiKeyLength: apiKey?.length,
    apiSecretType: typeof apiSecret,
    apiSecretLength: apiSecret?.length,
    senderType: typeof sender,
    sender: sender,
  })

  if (!apiKey || !apiSecret || !sender) {
    throw new Error('SOLAPI 환경변수가 설정되지 않았습니다 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER)')
  }

  // ENABLE_REAL_NOTIFICATIONS가 명시적으로 true면 실제 발송
  const testMode = process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

  logger.info('[SOLAPI] Provider 생성', {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
    testMode,
  })

  return new SolapiSMSProvider({
    apiKey,
    apiSecret,
    sender,
    testMode,
  })
}
