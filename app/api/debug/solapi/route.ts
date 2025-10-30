import { NextResponse } from 'next/server'
import { createSolapiProviderFromEnv } from '@/lib/notifications/sms/solapi-provider'

export async function GET() {
  try {
    // SOLAPI Provider 생성
    const provider = createSolapiProviderFromEnv()

    // 1. 설정 검증
    const isValid = await provider.validateConfig()

    // 2. 잔액 조회
    const balance = await provider.getBalance()

    // 3. 발신번호 목록 조회
    const senderNumbers = await provider.getSenderNumbers()

    return NextResponse.json({
      success: true,
      config: {
        isValid,
        balance,
        senderNumbers,
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
        SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ? `${process.env.SOLAPI_API_KEY.substring(0, 8)}...` : '없음',
        SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ? '설정됨' : '없음',
        SOLAPI_SENDER_PHONE: process.env.SOLAPI_SENDER_PHONE || '없음',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
