import { NextResponse } from 'next/server'

export async function GET() {
  const smsProvider = process.env.SMS_PROVIDER || 'solapi'

  return NextResponse.json({
    SMS_PROVIDER: smsProvider,
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_REAL_NOTIFICATIONS: process.env.ENABLE_REAL_NOTIFICATIONS,
    testMode: process.env.ENABLE_REAL_NOTIFICATIONS !== 'true',
    timestamp: new Date().toISOString(),
  })
}
