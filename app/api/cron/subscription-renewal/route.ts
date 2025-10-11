/**
 * 구독 갱신 Cron Job
 * - 매일 오전 9시 실행 (Vercel Cron: 0 9 * * *)
 * - 만료 예정 구독 자동 갱신 (D-1)
 * - 갱신 예정 알림 발송 (D-7, D-3)
 */

import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionRenewal } from '@/lib/automation/subscription-renewal'
import { logger } from '@/lib/utils/logger'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: subscription-renewal', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: subscription-renewal')

    const startTime = Date.now()

    // 1. 내일 만료 예정 구독 갱신 (D-1)
    const renewalResults = await SubscriptionRenewal.processRenewals(1)

    // 2. 7일 후 갱신 예정 알림 (D-7)
    const notified7Days = await SubscriptionRenewal.sendUpcomingRenewalNotifications(7)

    // 3. 3일 후 갱신 예정 알림 (D-3)
    const notified3Days = await SubscriptionRenewal.sendUpcomingRenewalNotifications(3)

    // 4. 통계 조회
    const stats = await SubscriptionRenewal.getRenewalStats()

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: subscription-renewal', {
      duration: `${duration}ms`,
      renewalProcessed: renewalResults.length,
      success: renewalResults.filter((r) => r.status === 'success').length,
      failed: renewalResults.filter((r) => r.status === 'failed').length,
      skipped: renewalResults.filter((r) => r.status === 'skipped').length,
      notified7Days,
      notified3Days,
      stats,
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription renewal completed',
      data: {
        renewalResults,
        summary: {
          total: renewalResults.length,
          success: renewalResults.filter((r) => r.status === 'success').length,
          failed: renewalResults.filter((r) => r.status === 'failed').length,
          skipped: renewalResults.filter((r) => r.status === 'skipped').length,
        },
        notified7Days,
        notified3Days,
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: subscription-renewal', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Subscription renewal failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST 메서드로 수동 실행 지원
export async function POST(request: NextRequest) {
  return GET(request)
}
