/**
 * 무료 체험 만료 처리 Cron Job
 * - 매일 자정 실행 (Vercel Cron: 0 0 * * *)
 * - 만료된 체험 테넌트 정지
 * - 만료 예정 테넌트에 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server'
import { TrialManager } from '@/lib/automation/trial-manager'
import { logger } from '@/lib/utils/logger'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: trial-expiry', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: trial-expiry')

    const startTime = Date.now()

    // 1. 만료된 체험 테넌트 처리
    const expiredResults = await TrialManager.processExpiredTrials()

    // 2. 3일 후 만료 예정 알림 발송
    const notified3Days = await TrialManager.sendUpcomingExpiryNotifications(3)

    // 3. 7일 후 만료 예정 알림 발송
    const notified7Days = await TrialManager.sendUpcomingExpiryNotifications(7)

    // 4. 통계 조회
    const stats = await TrialManager.getExpiryStats()

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: trial-expiry', {
      duration: `${duration}ms`,
      expiredProcessed: expiredResults.length,
      suspended: expiredResults.filter((r) => r.action === 'suspended').length,
      notified3Days,
      notified7Days,
      stats,
    })

    return NextResponse.json({
      success: true,
      message: 'Trial expiry check completed',
      data: {
        expiredResults,
        notified3Days,
        notified7Days,
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: trial-expiry', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Trial expiry check failed',
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
