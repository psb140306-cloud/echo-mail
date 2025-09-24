import { logger } from '@/lib/utils/logger'

export interface SMSConfig {
  provider: 'aligo' | 'ncp' | 'solapi'
  apiKey: string
  userId?: string
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
          message: message.message
        })

        return {
          success: true,
          messageId: `test_${Date.now()}`,
          cost: 0
        }
      }

      const formData = new URLSearchParams({
        key: this.config.apiKey,
        userid: this.config.userId!,
        sender: this.config.sender,
        receiver: message.to,
        msg: message.message,
        msg_type: 'SMS',
        title: message.subject || ''
      })

      const response = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      })

      const result = await response.json()

      if (result.result_code === '1') {
        logger.info('Aligo SMS 발송 성공', {
          to: message.to,
          messageId: result.msg_id,
          cost: result.success_cnt
        })

        return {
          success: true,
          messageId: result.msg_id,
          cost: parseInt(result.success_cnt)
        }
      } else {
        logger.error('Aligo SMS 발송 실패', {
          code: result.result_code,
          message: result.message,
          to: message.to
        })

        return {
          success: false,
          error: result.message
        }
      }

    } catch (error) {
      logger.error('Aligo SMS 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
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
        await new Promise(resolve => setTimeout(resolve, 100))
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
        userid: this.config.userId!
      })

      const response = await fetch('https://apis.aligo.in/remain/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
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

// NCP SMS Provider (Naver Cloud Platform)
export class NCPSMSProvider implements SMSProvider {
  private config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = config
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      if (this.config.testMode) {
        logger.info('SMS 테스트 모드 - 실제 발송되지 않음', {
          provider: 'ncp',
          to: message.to,
          message: message.message
        })

        return {
          success: true,
          messageId: `test_ncp_${Date.now()}`,
          cost: 0
        }
      }

      // NCP SMS API 구현 (실제 구현 시 NCP 문서 참조)
      logger.warn('NCP SMS Provider는 아직 구현되지 않았습니다')

      return {
        success: false,
        error: 'NCP SMS Provider가 구현되지 않았습니다'
      }

    } catch (error) {
      logger.error('NCP SMS 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResult[]> {
    return messages.map(() => ({
      success: false,
      error: 'NCP SMS Provider가 구현되지 않았습니다'
    }))
  }

  async getBalance(): Promise<number> {
    return 0
  }

  async validateConfig(): Promise<boolean> {
    return false
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
  const provider = (process.env.SMS_PROVIDER || 'aligo') as SMSConfig['provider']

  const config: SMSConfig = {
    provider,
    apiKey: process.env.ALIGO_API_KEY || '',
    userId: process.env.ALIGO_USER_ID || '',
    sender: process.env.ALIGO_SENDER || '',
    testMode: process.env.NODE_ENV !== 'production' || process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'
  }

  if (!config.apiKey || !config.sender) {
    throw new Error('SMS 설정이 완전하지 않습니다. 환경변수를 확인하세요.')
  }

  return createSMSProvider(config)
}