import { NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/notification-service'

export async function GET() {
  try {
    const result = await notificationService.sendNotification({
      type: 'SMS',
      recipient: '01093704931',
      templateName: 'TEST',
      variables: {},
    })

    return NextResponse.json({
      success: true,
      result,
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
