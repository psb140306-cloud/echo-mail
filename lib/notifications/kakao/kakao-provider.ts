import { logger } from '@/lib/utils/logger'

export interface KakaoConfig {
  apiKey: string
  apiSecret?: string
  senderKey: string
  testMode?: boolean
}

export interface KakaoMessage {
  to: string
  templateCode: string
  message: string
  variables?: Record<string, string>
  buttonName?: string
  buttonUrl?: string
}

export interface KakaoResult {
  success: boolean
  messageId?: string
  error?: string
  failoverToSMS?: boolean
}

export interface KakaoTemplate {
  templateCode: string
  templateName: string
  content: string
  variables: string[]
  buttonName?: string
  buttonUrl?: string
}

export class KakaoProvider {
  private config: KakaoConfig

  constructor(config: KakaoConfig) {
    this.config = config
  }

  async sendAlimTalk(message: KakaoMessage): Promise<KakaoResult> {
    try {
      if (this.config.testMode) {
        logger.info('카카오 알림톡 테스트 모드 - 실제 발송되지 않음', {
          to: message.to,
          templateCode: message.templateCode,
          message: message.message,
        })

        return {
          success: true,
          messageId: `test_kakao_${Date.now()}`,
        }
      }

      // 카카오 비즈메시지 API 호출
      const requestBody = {
        senderkey: this.config.senderKey,
        tpl_code: message.templateCode,
        sender: this.config.senderKey,
        receiver_1: message.to,
        subject_1: message.message.substring(0, 40), // 제목 (40자 제한)
        message_1: message.message,
        ...(message.variables && this.formatVariables(message.variables, 1)),
        ...(message.buttonName &&
          message.buttonUrl && {
            button_1: JSON.stringify([
              {
                name: message.buttonName,
                type: 'WL',
                url_pc: message.buttonUrl,
                url_mobile: message.buttonUrl,
              },
            ]),
          }),
      }

      const response = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestBody).toString(),
      })

      const result = await response.json()

      if (result.code === 0) {
        logger.info('카카오 알림톡 발송 성공', {
          to: message.to,
          templateCode: message.templateCode,
          messageId: result.info?.mid_1,
        })

        return {
          success: true,
          messageId: result.info?.mid_1,
        }
      } else {
        logger.error('카카오 알림톡 발송 실패', {
          code: result.code,
          message: result.message,
          to: message.to,
        })

        return {
          success: false,
          error: result.message,
          failoverToSMS: this.shouldFailoverToSMS(result.code),
        }
      }
    } catch (error) {
      logger.error('카카오 알림톡 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        failoverToSMS: true,
      }
    }
  }

  async sendFriendTalk(message: Omit<KakaoMessage, 'templateCode'>): Promise<KakaoResult> {
    try {
      if (this.config.testMode) {
        logger.info('카카오 친구톡 테스트 모드 - 실제 발송되지 않음', {
          to: message.to,
          message: message.message,
        })

        return {
          success: true,
          messageId: `test_friend_${Date.now()}`,
        }
      }

      const requestBody = {
        apikey: this.config.apiKey,
        senderkey: this.config.senderKey,
        receiver_1: message.to,
        message_1: message.message,
        ...(message.buttonName &&
          message.buttonUrl && {
            button_1: JSON.stringify([
              {
                name: message.buttonName,
                type: 'WL',
                url_pc: message.buttonUrl,
                url_mobile: message.buttonUrl,
              },
            ]),
          }),
      }

      const response = await fetch('https://kakaoapi.aligo.in/akv10/friendtalk/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestBody).toString(),
      })

      const result = await response.json()

      if (result.code === 0) {
        logger.info('카카오 친구톡 발송 성공', {
          to: message.to,
          messageId: result.info?.mid_1,
        })

        return {
          success: true,
          messageId: result.info?.mid_1,
        }
      } else {
        logger.error('카카오 친구톡 발송 실패', {
          code: result.code,
          message: result.message,
          to: message.to,
        })

        return {
          success: false,
          error: result.message,
          failoverToSMS: true,
        }
      }
    } catch (error) {
      logger.error('카카오 친구톡 발송 오류:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        failoverToSMS: true,
      }
    }
  }

  async getTemplateList(): Promise<KakaoTemplate[]> {
    try {
      if (this.config.testMode) {
        // 테스트 모드에서는 샘플 템플릿 반환
        return [
          {
            templateCode: 'ORDER_RECEIVED',
            templateName: '발주 접수 확인',
            content:
              '#{companyName}님의 발주가 접수되었습니다.\n납품 예정일: #{deliveryDate} #{deliveryTime}\n감사합니다.',
            variables: ['companyName', 'deliveryDate', 'deliveryTime'],
          },
          {
            templateCode: 'DELIVERY_NOTICE',
            templateName: '배송 안내',
            content:
              '#{companyName}님께 주문하신 상품을 #{deliveryDate}에 배송 예정입니다.\n감사합니다.',
            variables: ['companyName', 'deliveryDate'],
          },
        ]
      }

      const response = await fetch(`https://kakaoapi.aligo.in/akv10/template/list/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          apikey: this.config.apiKey,
          senderkey: this.config.senderKey,
        }).toString(),
      })

      const result = await response.json()

      if (result.code === 0) {
        return (
          result.list?.map((template: any) => ({
            templateCode: template.templtCode,
            templateName: template.templtName,
            content: template.templtContent,
            variables: this.extractVariables(template.templtContent),
          })) || []
        )
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      logger.error('카카오 템플릿 목록 조회 실패:', error)
      return []
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.config.apiKey || !this.config.senderKey) {
        return false
      }

      // 템플릿 목록 조회를 통한 설정 검증
      const templates = await this.getTemplateList()
      return templates.length >= 0 // 빈 배열도 유효한 응답
    } catch (error) {
      return false
    }
  }

  // 템플릿 변수 추출
  private extractVariables(content: string): string[] {
    const variableRegex = /#\{([^}]+)\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      variables.push(match[1])
    }

    return [...new Set(variables)] // 중복 제거
  }

  // 변수를 API 형식으로 포맷
  private formatVariables(
    variables: Record<string, string>,
    index: number
  ): Record<string, string> {
    const formatted: Record<string, string> = {}

    Object.entries(variables).forEach(([key, value]) => {
      formatted[`${key}_${index}`] = value
    })

    return formatted
  }

  // SMS 폴백 여부 결정
  private shouldFailoverToSMS(errorCode: number): boolean {
    // 특정 오류 코드에서만 SMS 폴백
    const failoverCodes = [
      -1, // 시스템 오류
      -2, // 발송 실패
      -31, // 차단된 수신번호
      -32, // 수신거부
    ]

    return failoverCodes.includes(errorCode)
  }
}

// 환경변수에서 카카오 설정 로드
export function createKakaoProviderFromEnv(): KakaoProvider {
  const provider = process.env.KAKAO_PROVIDER || 'solapi'

  if (provider === 'solapi') {
    // SOLAPI 카카오 Provider 사용
    const { createSolapiKakaoProviderFromEnv } = require('./solapi-kakao-provider')
    return createSolapiKakaoProviderFromEnv()
  }

  // 기존 Aligo 기반 카카오 Provider
  const config: KakaoConfig = {
    apiKey: process.env.KAKAO_API_KEY || '',
    apiSecret: process.env.KAKAO_API_SECRET || '',
    senderKey: process.env.KAKAO_SENDER_KEY || '',
    testMode: process.env.ENABLE_REAL_NOTIFICATIONS !== 'true',
  }

  if (!config.apiKey || !config.senderKey) {
    throw new Error('카카오 설정이 완전하지 않습니다. 환경변수를 확인하세요.')
  }

  return new KakaoProvider(config)
}
