import { KakaoProvider, KakaoMessage, KakaoResult } from './kakao-provider'
import { logger } from '@/lib/utils/logger'

/**
 * SOLAPI 카카오톡 Provider
 * https://solapi.com
 */

interface SolapiKakaoConfig {
  apiKey: string
  apiSecret: string
  pfId: string // 카카오톡 채널 ID (발신 프로필 ID)
  testMode?: boolean
}

interface SolapiKakaoSendResponse {
  groupId: string
  to: string
  from: string
  type: string
  statusMessage: string
  messageId: string
  statusCode: string
}

interface SolapiErrorResponse {
  errorCode: string
  errorMessage: string
}

export class SolapiKakaoProvider implements KakaoProvider {
  private config: SolapiKakaoConfig
  private baseUrl = 'https://api.solapi.com'

  constructor(config: SolapiKakaoConfig) {
    this.config = config
  }

  async sendAlimTalk(message: KakaoMessage): Promise<KakaoResult> {
    try {
      // 테스트 모드
      if (this.config.testMode) {
        logger.info('[SOLAPI Kakao Test Mode] 알림톡 전송 시뮬레이션', {
          to: message.to,
          templateCode: message.templateCode,
        })

        return {
          success: true,
          messageId: `test_kakao_${Date.now()}`,
        }
      }

      // 요청 본문
      const requestBody = {
        message: {
          to: message.to.replace(/-/g, ''),
          from: this.config.pfId,
          type: 'ATA', // 알림톡
          text: message.message,
          kakaoOptions: {
            pfId: this.config.pfId,
            templateId: message.templateCode,
            ...(message.variables && {
              variables: message.variables,
            }),
          },
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
        logger.error('[SOLAPI Kakao] 알림톡 전송 실패', {
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          to: message.to,
        })

        return {
          success: false,
          error: error.errorMessage || '전송 실패',
        }
      }

      const result = data as SolapiKakaoSendResponse

      logger.info('[SOLAPI Kakao] 알림톡 전송 성공', {
        messageId: result.messageId,
        to: result.to,
        templateCode: message.templateCode,
      })

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      logger.error('[SOLAPI Kakao] 알림톡 전송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async sendFriendTalk(message: Omit<KakaoMessage, 'templateCode'>): Promise<KakaoResult> {
    try {
      // 테스트 모드
      if (this.config.testMode) {
        logger.info('[SOLAPI Kakao Test Mode] 친구톡 전송 시뮬레이션', {
          to: message.to,
        })

        return {
          success: true,
          messageId: `test_kakao_friend_${Date.now()}`,
        }
      }

      // 요청 본문
      const requestBody = {
        message: {
          to: message.to.replace(/-/g, ''),
          from: this.config.pfId,
          type: 'CTA', // 친구톡
          text: message.message,
          kakaoOptions: {
            pfId: this.config.pfId,
          },
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
        logger.error('[SOLAPI Kakao] 친구톡 전송 실패', {
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          to: message.to,
        })

        return {
          success: false,
          error: error.errorMessage || '전송 실패',
        }
      }

      const result = data as SolapiKakaoSendResponse

      logger.info('[SOLAPI Kakao] 친구톡 전송 성공', {
        messageId: result.messageId,
        to: result.to,
      })

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      logger.error('[SOLAPI Kakao] 친구톡 전송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      }
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // 설정 검증
      if (!this.config.apiKey || !this.config.apiSecret || !this.config.pfId) {
        return false
      }

      // 테스트 모드면 검증 통과
      if (this.config.testMode) {
        return true
      }

      // 실제 API 호출로 검증 (발신 프로필 조회)
      const date = new Date().toISOString()
      const signature = this.generateSignature(date)

      const response = await fetch(`${this.baseUrl}/kakao/v1/plus-friends`, {
        method: 'GET',
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
      })

      return response.ok
    } catch (error) {
      logger.error('[SOLAPI Kakao] 설정 검증 실패:', error)
      return false
    }
  }

  /**
   * HMAC-SHA256 서명 생성
   */
  private generateSignature(date: string, body?: any): string {
    const crypto = require('crypto')

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
   * 카카오 채널 목록 조회
   */
  async getChannels(): Promise<any[]> {
    try {
      if (this.config.testMode) {
        return [
          {
            pfId: this.config.pfId,
            name: '테스트 채널',
          },
        ]
      }

      const date = new Date().toISOString()
      const signature = this.generateSignature(date)

      const response = await fetch(`${this.baseUrl}/kakao/v1/plus-friends`, {
        method: 'GET',
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
        },
      })

      if (!response.ok) {
        throw new Error('채널 조회 실패')
      }

      const data = await response.json()
      return data.plusFriends || []
    } catch (error) {
      logger.error('[SOLAPI Kakao] 채널 조회 오류:', error)
      return []
    }
  }

  /**
   * 알림톡 템플릿 목록 조회
   */
  async getTemplates(): Promise<any[]> {
    try {
      if (this.config.testMode) {
        return [
          {
            templateId: 'TEST_TEMPLATE',
            name: '테스트 템플릿',
            content: '안녕하세요, #{고객명}님',
          },
        ]
      }

      const date = new Date().toISOString()
      const signature = this.generateSignature(date)

      const response = await fetch(
        `${this.baseUrl}/kakao/v1/plus-friends/${this.config.pfId}/templates`,
        {
          method: 'GET',
          headers: {
            Authorization: `HMAC-SHA256 apiKey=${this.config.apiKey}, date=${date}, signature=${signature}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('템플릿 조회 실패')
      }

      const data = await response.json()
      return data.templates || []
    } catch (error) {
      logger.error('[SOLAPI Kakao] 템플릿 조회 오류:', error)
      return []
    }
  }
}

/**
 * 환경변수에서 SOLAPI 카카오 Provider 생성
 */
export function createSolapiKakaoProviderFromEnv(): SolapiKakaoProvider {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const pfId = process.env.SOLAPI_KAKAO_PFID

  if (!apiKey || !apiSecret || !pfId) {
    throw new Error('SOLAPI 카카오 환경변수가 설정되지 않았습니다 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_KAKAO_PFID)')
  }

  const testMode = process.env.NODE_ENV !== 'production' || process.env.ENABLE_REAL_NOTIFICATIONS !== 'true'

  return new SolapiKakaoProvider({
    apiKey,
    apiSecret,
    pfId,
    testMode,
  })
}
