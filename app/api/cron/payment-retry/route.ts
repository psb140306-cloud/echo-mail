/**
 * 결제 실패 재시도 Cron Job
 * - 매일 오전 10시 실행 (Vercel Cron: 0 10 * * *)
 * - PAST_DUE 상태 구독 결제 재시도
 * - 최대 재시도 초과 시 구독 정지
 */

import { NextRequest, NextResponse } from 'next/server'
import { PaymentFailureHandler } from '@/lib/automation/payment-failure-handler'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: payment-retry', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: payment-retry')

    const startTime = Date.now()

    // 결제 실패 구독 재시도 처리
    const retryResults = await PaymentFailureHandler.processFailedPayments()

    // 통계 조회
    const stats = await PaymentFailureHandler.getFailureStats()

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: payment-retry', {
      duration: `${duration}ms`,
      totalProcessed: retryResults.length,
      success: retryResults.filter((r) => r.status === 'success').length,
      failed: retryResults.filter((r) => r.status === 'failed').length,
      suspended: retryResults.filter((r) => r.status === 'suspended').length,
      skipped: retryResults.filter((r) => r.status === 'skipped').length,
      stats,
    })

    return NextResponse.json({
      success: true,
      message: 'Payment retry completed',
      data: {
        results: retryResults,
        summary: {
          total: retryResults.length,
          success: retryResults.filter((r) => r.status === 'success').length,
          failed: retryResults.filter((r) => r.status === 'failed').length,
          suspended: retryResults.filter((r) => r.status === 'suspended').length,
          skipped: retryResults.filter((r) => r.status === 'skipped').length,
        },
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: payment-retry', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Payment retry failed',
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
