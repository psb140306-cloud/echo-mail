import { NextResponse } from 'next/server'
import { createSMSProviderFromEnv } from '@/lib/notifications/sms/sms-provider'
import { logger } from '@/lib/utils/logger'

/**
 * SMS 발송 테스트 엔드포인트
 * - usage limiter 우회 (디버그 목적)
 * - SMS Provider를 직접 호출
 */
export async function GET(request: Request) {
  try {
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
