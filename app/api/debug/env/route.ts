import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
    SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ? '설정됨' : '없음',
    SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ? '설정됨' : '없음',
    SOLAPI_SENDER_PHONE: process.env.SOLAPI_SENDER_PHONE || '없음',
    testMode: process.env.NODE_ENV !== 'production' || process.env.ENABLE_REAL_NOTIFICATIONS !== 'true',
    timestamp: new Date().toISOString(),
  })
}
