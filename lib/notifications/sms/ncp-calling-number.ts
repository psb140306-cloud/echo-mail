import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'

export interface NCPCallingNumberConfig {
  accessKey: string
  secretKey: string
  serviceId: string
}

export interface CallingNumberRequest {
  number: string // 발신번호 (010-1234-5678 또는 01012345678)
  comment?: string // 설명 (테넌트명 등)
}

export interface CallingNumberResponse {
  success: boolean
  callingNumberId?: string
  message?: string
  error?: string
}

export interface CallingNumberStatus {
  id: string
  number: string
  comment: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED'
  createdAt: string
}

/**
 * NCP 발신번호 관리 클래스
 */
export class NCPCallingNumberService {
  private config: NCPCallingNumberConfig
  private baseUrl = 'https://sens.apigw.ntruss.com'

  constructor(config: NCPCallingNumberConfig) {
    this.config = config
  }

  /**
   * HMAC SHA256 서명 생성
   */
  private makeSignature(method: string, url: string, timestamp: string): string {
    const space = ' '
    const newLine = '\n'
    const hmac = crypto.createHmac('sha256', this.config.secretKey)

    const message = [method, space, url, newLine, timestamp, newLine, this.config.accessKey].join('')

    return hmac.update(message).digest('base64')
  }

  /**
   * 발신번호 등록
   */
  async registerCallingNumber(request: CallingNumberRequest): Promise<CallingNumberResponse> {
    try {
      // 전화번호 형식 정규화 (하이픈 제거)
      const phoneNumber = request.number.replace(/-/g, '')

      // 전화번호 유효성 검사
      if (!/^01[0-9]{8,9}$/.test(phoneNumber)) {
        return {
          success: false,
          error: '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)',
        }
      }

      const timestamp = Date.now().toString()
      const method = 'POST'
      const url = `/sms/v2/services/${this.config.serviceId}/calling-numbers`
      const signature = this.makeSignature(method, url, timestamp)

      const requestBody = {
        number: phoneNumber,
        comment: request.comment || '',
      }

      logger.info('NCP 발신번호 등록 요청', {
        phoneNumber,
        comment: request.comment,
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

      const result = await response.json()

      if (response.ok && (result.statusCode === '200' || result.statusCode === '201')) {
        logger.info('NCP 발신번호 등록 성공', {
          phoneNumber,
          callingNumberId: result.callingNumber?.id,
        })

        return {
          success: true,
          callingNumberId: result.callingNumber?.id,
          message: '발신번호가 등록되었습니다. 승인 대기 중입니다.',
        }
      } else {
        logger.error('NCP 발신번호 등록 실패', {
          statusCode: result.statusCode,
          statusName: result.statusName,
          message: result.message,
        })

        return {
          success: false,
          error: result.message || result.statusName || '발신번호 등록에 실패했습니다.',
        }
      }
    } catch (error) {
      logger.error('NCP 발신번호 등록 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  /**
   * 발신번호 목록 조회
   */
  async getCallingNumbers(): Promise<CallingNumberStatus[]> {
    try {
      const timestamp = Date.now().toString()
      const method = 'GET'
      const url = `/sms/v2/services/${this.config.serviceId}/calling-numbers`
      const signature = this.makeSignature(method, url, timestamp)

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'GET',
        headers: {
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.accessKey,
          'x-ncp-apigw-signature-v2': signature,
        },
      })

      const result = await response.json()

      if (response.ok && result.callingNumbers) {
        return result.callingNumbers.map((cn: any) => ({
          id: cn.id,
          number: cn.number,
          comment: cn.comment || '',
          status: cn.status,
          createdAt: cn.createdAt,
        }))
      }

      return []
    } catch (error) {
      logger.error('NCP 발신번호 목록 조회 오류:', error)
      return []
    }
  }

  /**
   * 발신번호 삭제
   */
  async deleteCallingNumber(callingNumberId: string): Promise<CallingNumberResponse> {
    try {
      const timestamp = Date.now().toString()
      const method = 'DELETE'
      const url = `/sms/v2/services/${this.config.serviceId}/calling-numbers/${callingNumberId}`
      const signature = this.makeSignature(method, url, timestamp)

      const response = await fetch(`${this.baseUrl}${url}`, {
        method: 'DELETE',
        headers: {
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.config.accessKey,
          'x-ncp-apigw-signature-v2': signature,
        },
      })

      const result = await response.json()

      if (response.ok && result.statusCode === '204') {
        logger.info('NCP 발신번호 삭제 성공', { callingNumberId })

        return {
          success: true,
          message: '발신번호가 삭제되었습니다.',
        }
      } else {
        logger.error('NCP 발신번호 삭제 실패', result)

        return {
          success: false,
          error: result.message || '발신번호 삭제에 실패했습니다.',
        }
      }
    } catch (error) {
      logger.error('NCP 발신번호 삭제 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  /**
   * 발신번호 상태 확인
   */
  async checkCallingNumberStatus(phoneNumber: string): Promise<CallingNumberStatus | null> {
    try {
      const numbers = await this.getCallingNumbers()
      const normalizedPhone = phoneNumber.replace(/-/g, '')

      return numbers.find((n) => n.number === normalizedPhone) || null
    } catch (error) {
      logger.error('발신번호 상태 확인 오류:', error)
      return null
    }
  }
}

/**
 * 환경변수에서 NCP Calling Number Service 생성
 */
export function createNCPCallingNumberServiceFromEnv(): NCPCallingNumberService {
  const config: NCPCallingNumberConfig = {
    accessKey: process.env.NCP_ACCESS_KEY || '',
    secretKey: process.env.NCP_SECRET_KEY || '',
    serviceId: process.env.NCP_SERVICE_ID || '',
  }

  if (!config.accessKey || !config.secretKey || !config.serviceId) {
    throw new Error('NCP 설정이 완전하지 않습니다. 환경변수를 확인하세요.')
  }

  return new NCPCallingNumberService(config)
}
