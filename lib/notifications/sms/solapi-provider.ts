import { SMSProvider, SMSMessage, SMSResult } from './sms-provider'
import { logger } from '@/lib/utils/logger'

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
  private baseUrl = 'https://api.solapi.com'

  constructor(config: SolapiConfig) {
    this.config = config
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

      // 메시지 타입 결정 (SMS: 90자 이하, LMS: 90자 초과)
      const messageType = message.message.length <= 90 ? 'SMS' : 'LMS'

      // 요청 본문
      const requestBody = {
        message: {
          to: message.to.replace(/-/g, ''), // 하이픈 제거
          from: this.config.sender.replace(/-/g, ''),
          text: message.message,
          type: messageType,
          ...(message.subject && { subject: message.subject }), // LMS일 경우 제목 추가
        },
      }

      // HMAC 인증 헤더 생성
      const date = new Date().toISOString()
      const signature = this.generateSignature(date, requestBody)

      // API 호출
      const response = await fetch(`${this.baseUrl}/messages/v4/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      // 응답 처리
      if (!response.ok) {
        const error = data as SolapiErrorResponse
        logger.error('[SOLAPI] SMS 전송 실패', {
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          to: message.to,
        })

        return {
          success: false,
          error: error.errorMessage || '전송 실패',
        }
      }

      const result = data as SolapiSendResponse

      logger.info('[SOLAPI] SMS 전송 성공', {
        messageId: result.messageId,
        to: result.to,
        type: result.type,
      })

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      logger.error('[SOLAPI] SMS 전송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
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
   * HMAC-SHA256 서명 생성
   */
  private generateSignature(date: string, body?: any): string {
    const crypto = require('crypto')

    // API Secret 검증
    if (!this.config.apiSecret || typeof this.config.apiSecret !== 'string') {
      logger.error('[SOLAPI] Invalid API Secret', {
        hasSecret: !!this.config.apiSecret,
        secretType: typeof this.config.apiSecret,
        secretLength: this.config.apiSecret?.length,
      })
      throw new Error('SOLAPI API Secret must be a string')
    }

    let message = date
    if (body) {
      message = date + JSON.stringify(body)
    }

    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('hex')

    return signature
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
  const sender = process.env.SOLAPI_SENDER_PHONE || process.env.DEFAULT_SENDER_PHONE

  if (!apiKey || !apiSecret || !sender) {
    throw new Error('SOLAPI 환경변수가 설정되지 않았습니다 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_PHONE)')
  }

  const testMode = process.env.NODE_ENV !== 'production' || process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

  return new SolapiSMSProvider({
    apiKey,
    apiSecret,
    sender,
    testMode,
  })
}
