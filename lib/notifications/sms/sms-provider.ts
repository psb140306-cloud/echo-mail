import { logger } from '@/lib/utils/logger'
import crypto from 'crypto'

export interface SMSConfig {
  provider: 'aligo' | 'ncp' | 'solapi'
  apiKey: string
  apiSecret?: string // NCP용
  serviceId?: string // NCP용
  userId?: string // Aligo용
  sender: string
  testMode?: boolean
}

export interface SMSMessage {
  to: string
  message: string
  subject?: string
}

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  cost?: number
  remainingCount?: number
}

export interface SMSProvider {
  sendSMS(message: SMSMessage): Promise<SMSResult>
  sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]>
  getBalance(): Promise<number>
  validateConfig(): Promise<boolean>
}

// Aligo SMS Provider
export class AligoSMSProvider implements SMSProvider {
  private config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = config
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      if (this.config.testMode) {
        logger.info('SMS 테스트 모드 - 실제 발송되지 않음', {
          provider: 'aligo',
          to: message.to,
          message: message.message,
        })

        return {
          success: true,
          messageId: `test_${Date.now()}`,
          cost: 0,
        }
      }

      const formData = new URLSearchParams({
        key: this.config.apiKey,
        userid: this.config.userId!,
        sender: this.config.sender,
        receiver: message.to,
        msg: message.message,
        msg_type: 'SMS',
        title: message.subject || '',
      })

      const response = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      const result = await response.json()

      if (result.result_code === '1') {
        logger.info('Aligo SMS 발송 성공', {
          to: message.to,
          messageId: result.msg_id,
          cost: result.success_cnt,
        })

        return {
          success: true,
          messageId: result.msg_id,
          cost: parseInt(result.success_cnt),
        }
      } else {
        logger.error('Aligo SMS 발송 실패', {
          code: result.result_code,
          message: result.message,
          to: message.to,
        })

        return {
          success: false,
          error: result.message,
        }
      }
    } catch (error) {
      logger.error('Aligo SMS 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    const results: SMSResult[] = []

    for (const message of messages) {
      const result = await this.sendSMS(message)
      results.push(result)

      // API 호출 간격 (Rate Limiting)
      if (!this.config.testMode) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
  }

  async getBalance(): Promise<number> {
    try {
      if (this.config.testMode) {
        return 1000 // 테스트 모드에서는 가상의 잔액
      }

      const formData = new URLSearchParams({
        key: this.config.apiKey,
        userid: this.config.userId!,
      })

      const response = await fetch('https://apis.aligo.in/remain/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      const result = await response.json()

      if (result.result_code === '1') {
        return parseInt(result.sms_count)
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      logger.error('Aligo SMS 잔액 조회 실패:', error)
      return 0
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.config.apiKey || !this.config.userId || !this.config.sender) {
        return false
      }

      // 잔액 조회를 통한 설정 검증
      const balance = await this.getBalance()
      return balance >= 0
    } catch (error) {
      return false
    }
  }
}

// NCP SMS Provider (Naver Cloud Platform SENS)
export class NCPSMSProvider implements SMSProvider {
  private config: SMSConfig
  private baseUrl = 'https://sens.apigw.ntruss.com'

  constructor(config: SMSConfig) {
    this.config = config
  }

  // HMAC SHA256 서명 생성 (NCP 인증용)
  private makeSignature(method: string, url: string, timestamp: string): string {
    const space = ' '
    const newLine = '\n'
    const hmac = crypto.createHmac('sha256', this.config.apiSecret!)

    const message = [method, space, url, newLine, timestamp, newLine, this.config.apiKey].join('')

    return hmac.update(message).digest('base64')
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      if (this.config.testMode) {
        logger.info('SMS 테스트 모드 - 실제 발송되지 않음', {
          provider: 'ncp',
          to: message.to,
          message: message.message,
        })

        return {
          success: true,
          messageId: `test_ncp_${Date.now()}`,
          cost: 0,
        }
      }

      if (!this.config.apiSecret || !this.config.serviceId) {
        throw new Error('NCP API Secret 또는 Service ID가 설정되지 않았습니다')
      }

      const timestamp = Date.now().toString()
      const method = 'POST'
      const url = `/sms/v2/services/${this.config.serviceId}/messages`
      const signature = this.makeSignature(method, url, timestamp)

      // 메시지 타입 결정 (SMS: 80바이트, LMS: 2000바이트)
      const messageType = message.message.length > 80 ? 'LMS' : 'SMS'

      const requestBody = {
        type: messageType,
        contentType: 'COMM',
        countryCode: '82',
        from: this.config.sender.replace(/-/g, ''), // NCP는 발신번호도 하이픈 제거
        subject: message.subject || '알림',
        content: message.message,
        messages: [
          {
            to: message.to.replace(/-/g, ''), // NCP는 수신번호 하이픈 제거
          },
        ],
      }

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.apiKey,
          'x-ncp-apigw-signature-v2': signature,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (response.ok && result.statusCode === '202') {
        logger.info('NCP SMS 발송 성공', {
          to: message.to,
          requestId: result.requestId,
          messageType,
        })

        return {
          success: true,
          messageId: result.requestId,
          cost: messageType === 'SMS' ? 12 : 40, // 예상 비용
        }
      } else {
        logger.error('NCP SMS 발송 실패', {
          statusCode: result.statusCode,
          statusName: result.statusName,
          to: message.to,
          fullResponse: result, // 전체 응답 로깅
        })

        return {
          success: false,
          error: result.statusName || '발송 실패',
        }
      }
    } catch (error) {
      logger.error('NCP SMS 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    try {
      if (this.config.testMode) {
        return messages.map((msg) => ({
          success: true,
          messageId: `test_ncp_bulk_${Date.now()}`,
          cost: 0,
        }))
      }

      if (!this.config.apiSecret || !this.config.serviceId) {
        return messages.map(() => ({
          success: false,
          error: 'NCP API Secret 또는 Service ID가 설정되지 않았습니다',
        }))
      }

      const timestamp = Date.now().toString()
      const method = 'POST'
      const url = `/sms/v2/services/${this.config.serviceId}/messages`
      const signature = this.makeSignature(method, url, timestamp)

      // 첫 번째 메시지로 타입 결정
      const messageType = messages[0].message.length > 80 ? 'LMS' : 'SMS'

      const requestBody = {
        type: messageType,
        contentType: 'COMM',
        countryCode: '82',
        from: this.config.sender.replace(/-/g, ''), // NCP는 발신번호도 하이픈 제거
        subject: messages[0].subject || '알림',
        content: messages[0].message,
        messages: messages.map((msg) => ({
          to: msg.to.replace(/-/g, ''),
          content: msg.message, // 개별 메시지 내용
        })),
      }

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.apiKey,
          'x-ncp-apigw-signature-v2': signature,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (response.ok && result.statusCode === '202') {
        logger.info('NCP SMS 대량 발송 성공', {
          count: messages.length,
          requestId: result.requestId,
        })

        return messages.map(() => ({
          success: true,
          messageId: result.requestId,
          cost: messageType === 'SMS' ? 12 : 40,
        }))
      } else {
        logger.error('NCP SMS 대량 발송 실패', result)

        return messages.map(() => ({
          success: false,
          error: result.statusName || '발송 실패',
        }))
      }
    } catch (error) {
      logger.error('NCP SMS 대량 발송 오류:', error)
      return messages.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }))
    }
  }

  async getBalance(): Promise<number> {
    // NCP는 잔액 조회 API가 없음 (포인트 충전 방식)
    // 콘솔에서 확인해야 함
    logger.info('NCP는 잔액 조회 API를 제공하지 않습니다. 콘솔에서 확인하세요.')
    return -1 // -1은 조회 불가를 의미
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.config.apiKey || !this.config.apiSecret || !this.config.serviceId || !this.config.sender) {
        return false
      }

      // 테스트 모드에서는 설정만 확인
      if (this.config.testMode) {
        return true
      }

      // 실제 환경에서는 간단한 API 호출로 검증 가능
      // 여기서는 설정 값만 확인
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 해당 번호로 오늘 이미 메시지를 보냈는지 확인 (NCP SENS API)
   * GET /sms/v2/services/{serviceId}/messages?requestId={requestId}
   * @param phoneNumber 수신자 전화번호
   * @returns true면 이미 발송됨, false면 미발송
   */
  async checkMessageSentToday(phoneNumber: string): Promise<boolean> {
    try {
      if (this.config.testMode) {
        logger.info('[NCP] 메시지 발송 이력 조회 시뮬레이션', { phoneNumber })
        return false
      }

      if (!this.config.apiSecret || !this.config.serviceId) {
        logger.warn('[NCP] API Secret 또는 Service ID 미설정')
        return false
      }

      const timestamp = Date.now().toString()
      const method = 'GET'
      const url = `/sms/v2/services/${this.config.serviceId}/messages`
      const signature = this.makeSignature(method, url, timestamp)

      // 오늘 00:00:00 (KST) 계산
      const now = new Date()
      const kstOffset = 9 * 60 * 60 * 1000
      const kstNow = new Date(now.getTime() + kstOffset)
      const kstToday = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate())
      const startTime = new Date(kstToday.getTime() - kstOffset)

      // 전화번호 정리 (하이픈 제거)
      const cleanPhone = phoneNumber.replace(/-/g, '')

      // NCP SENS 메시지 조회 API
      // https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2#메시지-발송-요청-조회
      const params = new URLSearchParams({
        startTime: startTime.toISOString(),
        to: cleanPhone,
        pageSize: '1',
      })

      const response = await fetch(`${this.baseUrl}${url}?${params}`, {
        method: 'GET',
        headers: {
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.apiKey,
          'x-ncp-apigw-signature-v2': signature,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('[NCP] 메시지 조회 실패:', { status: response.status, error: errorText })
        return false
      }

      const data = await response.json()
      const hasSent = data.messages && data.messages.length > 0

      logger.info('[NCP] 오늘 메시지 발송 이력 조회', {
        phoneNumber: cleanPhone,
        hasSent,
        count: data.messages?.length || 0,
      })

      return hasSent
    } catch (error) {
      logger.error('[NCP] 메시지 조회 오류:', error)
      return false
    }
  }
}

// SMS Provider Factory
export function createSMSProvider(config: SMSConfig): SMSProvider {
  switch (config.provider) {
    case 'aligo':
      return new AligoSMSProvider(config)
    case 'ncp':
      return new NCPSMSProvider(config)
    case 'solapi':
      throw new Error('Solapi SMS Provider는 아직 구현되지 않았습니다')
    default:
      throw new Error(`지원하지 않는 SMS Provider: ${config.provider}`)
  }
}

// 환경변수에서 SMS 설정 로드
export function createSMSProviderFromEnv(): SMSProvider {
  const provider = (process.env.SMS_PROVIDER || 'solapi') as SMSConfig['provider']
  const testMode = process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

  let config: SMSConfig

  if (provider === 'solapi') {
    // SOLAPI 설정 (환경변수만 사용 - 레거시)
    const { createSolapiProviderFromEnv } = require('./solapi-provider')
    return createSolapiProviderFromEnv()
  } else if (provider === 'ncp') {
    // NCP 설정
    config = {
      provider: 'ncp',
      apiKey: process.env.NCP_ACCESS_KEY || '',
      apiSecret: process.env.NCP_SECRET_KEY || '',
      serviceId: process.env.NCP_SERVICE_ID || '',
      sender: process.env.NCP_SENDER || process.env.SMS_SENDER || '',
      testMode,
    }

    // 상세 로깅
    const missingVars = []
    if (!config.apiKey) missingVars.push('NCP_ACCESS_KEY')
    if (!config.apiSecret) missingVars.push('NCP_SECRET_KEY')
    if (!config.serviceId) missingVars.push('NCP_SERVICE_ID')
    if (!config.sender) missingVars.push('NCP_SENDER 또는 SMS_SENDER')

    if (missingVars.length > 0) {
      throw new Error(`NCP SMS 필수 환경변수 누락: ${missingVars.join(', ')}`)
    }
  } else if (provider === 'aligo') {
    // Aligo 설정
    config = {
      provider: 'aligo',
      apiKey: process.env.ALIGO_API_KEY || '',
      userId: process.env.ALIGO_USER_ID || '',
      sender: process.env.ALIGO_SENDER || process.env.SMS_SENDER || '',
      testMode,
    }

    if (!config.apiKey || !config.userId || !config.sender) {
      throw new Error('Aligo SMS 설정이 완전하지 않습니다. 환경변수를 확인하세요.')
    }
  } else {
    throw new Error(`지원하지 않는 SMS Provider: ${provider}`)
  }

  return createSMSProvider(config)
}
