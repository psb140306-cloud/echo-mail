import { NextResponse } from 'next/server'
import { createSMSProviderFromEnv } from '@/lib/notifications/sms/sms-provider'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * SMS 발송 테스트 엔드포인트
 * ⚠️ 보안 주의:
 * - DEBUG_API_KEY 환경 변수로 보호됨
 * - usage limiter 우회 (디버그 목적만)
 * - 프로덕션에서는 반드시 인증 필요
 */
export async function GET(request: Request) {
  try {
    // 인증 확인 - DEBUG_API_KEY 필수
    const authHeader = request.headers.get('authorization')
    const debugApiKey = process.env.DEBUG_API_KEY

    // DEBUG_API_KEY가 설정되지 않은 경우
    if (!debugApiKey) {
      logger.error('[DEBUG] DEBUG_API_KEY 환경 변수가 설정되지 않았습니다')
      return NextResponse.json({
        success: false,
        error: 'Debug API가 비활성화되어 있습니다. 관리자에게 문의하세요.',
      }, {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        },
      })
    }

    // Authorization 헤더 확인
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[DEBUG] 인증 헤더 누락 또는 형식 오류', {
        hasHeader: !!authHeader,
        format: authHeader?.substring(0, 20),
      })
      return NextResponse.json({
        success: false,
        error: 'Authorization 헤더가 필요합니다. (Bearer <DEBUG_API_KEY>)',
      }, {
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'WWW-Authenticate': 'Bearer',
        },
      })
    }

    const providedKey = authHeader.substring(7) // 'Bearer ' 제거

    // API 키 검증
    if (providedKey !== debugApiKey) {
      logger.warn('[DEBUG] 잘못된 API 키로 접근 시도', {
        providedKeyPrefix: providedKey.substring(0, 8),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      })
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 API 키입니다.',
      }, {
        status: 403,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        },
      })
    }

    // URL에서 파라미터 가져오기
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') || '01093704931'
    const message = searchParams.get('message') || '[Echo Mail 테스트] SMS 발송 테스트입니다.'

    logger.info('[DEBUG] SMS 테스트 시작', {
      recipient,
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    })

    // SMS Provider 직접 생성
    const smsProvider = createSMSProviderFromEnv()

    // SMS 발송
    const result = await smsProvider.sendSMS({
      to: recipient,
      message: message,
      subject: 'Echo Mail 테스트',
    })

    logger.info('[DEBUG] SMS 발송 결과', {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    })

    return NextResponse.json({
      success: true,
      smsResult: result,
      requestInfo: {
        recipient,
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
        SMS_PROVIDER: process.env.SMS_PROVIDER || 'aligo',
        testMode: process.env.NODE_ENV !== 'production' || process.env.ENABLE_REAL_NOTIFICATIONS !== 'true',
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    logger.error('[DEBUG] SMS 테스트 오류:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  }
}
