import { NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/notification-service'

export async function GET(request: Request) {
  try {
    // URL에서 tenantId 파라미터 가져오기
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId') || 'test-tenant-id'

    const result = await notificationService.sendNotification({
      type: 'SMS',
      recipient: '01093704931',
      templateName: 'TEST',
      variables: {},
      tenantId, // tenantId 추가
    })

    return NextResponse.json({
      success: true,
      result,
      tenantId,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    })
  }
}
