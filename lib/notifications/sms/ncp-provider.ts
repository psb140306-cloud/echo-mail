import { SMSProvider, SMSMessage, SMSResult } from './sms-provider'
import { logger } from '@/lib/utils/logger'

/**
 * NCP (Naver Cloud Platform) SMS Provider
 * https://api.ncloud-docs.com/docs/ai-application-service-sens-smsv2
 */

interface NCPConfig {
  serviceId: string
  accessKey: string
  secretKey: string
  sender: string
  testMode?: boolean
}

export class NCPSMSProvider implements SMSProvider {
  private config: NCPConfig
  private readonly baseUrl = 'https://sens.apigw.ntruss.com'

  constructor(config: NCPConfig) {
    this.config = config
  }

  /**
   * HMAC-SHA256 서명 생성 (NCP 방식)
   */
  private generateSignature(method: string, url: string, timestamp: string): string {
    const crypto = require('crypto')
    const space = ' '
    const newLine = '\n'

    const message = [
      method,
      space,
      url,
      newLine,
      timestamp,
      newLine,
      this.config.accessKey,
    ].join('')

    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(message)
      .digest('base64')
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // 테스트 모드
      if (this.config.testMode) {
        logger.warn('[NCP Test Mode] SMS 전송 시뮬레이션 (실제 발송 안됨!)', {
          to: message.to,
          from: this.config.sender,
          messageLength: message.message.length,
        })

        return {
          success: true,
          messageId: `test_ncp_${Date.now()}`,
        }
      }

      const timestamp = Date.now().toString()
      const url = `/sms/v2/services/${this.config.serviceId}/messages`
      const signature = this.generateSignature('POST', url, timestamp)

      const requestBody = {
        type: 'SMS',
        contentType: 'COMM',
        countryCode: '82',
        from: this.config.sender.replace(/-/g, ''),
        content: message.message,
        messages: [
          {
            to: message.to.replace(/-/g, ''),
            ...(message.subject && { subject: message.subject }),
          },
        ],
      }

      logger.info('[NCP] SMS 전송 요청', {
        to: message.to,
        from: this.config.sender,
        messageLength: message.message.length,
      })

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.accessKey,
          'x-ncp-apigw-signature-v2': signature,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('[NCP] SMS 전송 실패:', {
          status: response.status,
          error,
        })
        return {
          success: false,
          error: error.message || '전송 실패',
        }
      }

      const result = await response.json()
      logger.info('[NCP] SMS 전송 성공', {
        requestId: result.requestId,
        to: message.to,
      })

      return {
        success: true,
        messageId: result.requestId,
      }
    } catch (error: any) {
      logger.error('[NCP] SMS 전송 오류:', {
        error: error.message || error.toString(),
        stack: error.stack,
      })

      return {
        success: false,
        error: error.message || error.toString() || '알 수 없는 오류',
      }
    }
  }

  async getBalance(): Promise<number> {
    // NCP는 잔액 API가 없으므로 -1 반환 (사용 불가 표시)
    logger.warn('[NCP] 잔액 조회 API 미지원')
    return -1
  }

  async validateConfig(): Promise<boolean> {
    try {
      // API 키와 발신번호가 설정되어 있는지 확인
      if (!this.config.serviceId || !this.config.accessKey || !this.config.secretKey || !this.config.sender) {
        return false
      }

      // 테스트 모드면 검증 통과
      if (this.config.testMode) {
        return true
      }

      // NCP는 별도 검증 API가 없으므로 설정만 확인
      return true
    } catch (error) {
      logger.error('[NCP] 설정 검증 실패:', error)
      return false
    }
  }

  async getSenderNumbers(): Promise<string[]> {
    // NCP는 발신번호 목록 조회 API가 없으므로 설정된 번호만 반환
    return [this.config.sender]
  }
}

/**
 * 환경변수에서 NCP Provider 생성
 */
export function createNCPProviderFromEnv(): NCPSMSProvider {
  const serviceId = process.env.NCP_SERVICE_ID
  const accessKey = process.env.NCP_ACCESS_KEY
  const secretKey = process.env.NCP_SECRET_KEY
  const sender = process.env.NCP_SENDER_PHONE || process.env.NCP_SENDER

  logger.info('[NCP] 환경 변수 로드', {
    hasServiceId: !!serviceId,
    hasAccessKey: !!accessKey,
    hasSecretKey: !!secretKey,
    hasSender: !!sender,
  })

  if (!serviceId || !accessKey || !secretKey || !sender) {
    throw new Error('NCP 환경변수가 설정되지 않았습니다 (NCP_SERVICE_ID, NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_SENDER_PHONE)')
  }

  const testMode = process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

  logger.info('[NCP] Provider 생성 (환경변수)', {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
    testMode,
  })

  return new NCPSMSProvider({
    serviceId,
    accessKey,
    secretKey,
    sender,
    testMode,
  })
}
