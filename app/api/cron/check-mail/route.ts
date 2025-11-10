import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { mailMonitorService } from '@/lib/mail/mail-monitor-service'

/**
 * Vercel Cron Job 엔드포인트
 * 주기적으로 모든 테넌트의 메일함을 확인하고 새 발주 메일 처리
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Secret 검증
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[Cron] 인증 실패', {
        hasAuthHeader: !!authHeader,
        hasCronSecret: !!cronSecret,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('[Cron] 메일 확인 작업 시작')
    const startTime = Date.now()

    // 모든 테넌트의 메일 확인
    const results = await mailMonitorService.checkAllTenants()

    const duration = Date.now() - startTime

    // 결과 집계
    const summary = {
      totalTenants: results.size,
      successCount: 0,
      failureCount: 0,
      totalNewMails: 0,
      totalProcessed: 0,
      totalFailed: 0,
      duration,
    }

    for (const [tenantId, result] of results.entries()) {
      if (result.success) {
        summary.successCount++
      } else {
        summary.failureCount++
      }
      summary.totalNewMails += result.newMailsCount
      summary.totalProcessed += result.processedCount
      summary.totalFailed += result.failedCount
    }

    logger.info('[Cron] 메일 확인 작업 완료', summary)

    return NextResponse.json({
      success: true,
      message: '메일 확인 완료',
      summary,
      results: Object.fromEntries(results),
    })
  } catch (error) {
    logger.error('[Cron] 메일 확인 작업 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

// POST 메서드도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request)
}
