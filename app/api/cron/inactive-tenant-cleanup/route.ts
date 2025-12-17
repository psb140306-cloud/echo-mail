/**
 * 비활성 테넌트 정리 Cron Job
 * - 매월 1일 새벽 4시 실행 (Vercel Cron: 0 4 1 * *)
 * - 장기 미사용 테넌트 정리
 * - 경고 → 아카이브 → 삭제 단계적 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import { InactiveTenantCleanup } from '@/lib/automation/inactive-tenant-cleanup'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: inactive-tenant-cleanup', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: inactive-tenant-cleanup')

    const startTime = Date.now()

    // 비활성 테넌트 정리 처리
    const cleanupResults = await InactiveTenantCleanup.processInactiveTenants()

    // 통계 조회
    const stats = await InactiveTenantCleanup.getInactiveStats()

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: inactive-tenant-cleanup', {
      duration: `${duration}ms`,
      totalProcessed: cleanupResults.length,
      deleted: cleanupResults.filter((r) => r.status === 'deleted').length,
      archived: cleanupResults.filter((r) => r.status === 'archived').length,
      notified: cleanupResults.filter((r) => r.status === 'notified').length,
      skipped: cleanupResults.filter((r) => r.status === 'skipped').length,
      stats,
    })

    return NextResponse.json({
      success: true,
      message: 'Inactive tenant cleanup completed',
      data: {
        results: cleanupResults,
        summary: {
          total: cleanupResults.length,
          deleted: cleanupResults.filter((r) => r.status === 'deleted').length,
          archived: cleanupResults.filter((r) => r.status === 'archived').length,
          notified: cleanupResults.filter((r) => r.status === 'notified').length,
          skipped: cleanupResults.filter((r) => r.status === 'skipped').length,
        },
        stats,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: inactive-tenant-cleanup', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Inactive tenant cleanup failed',
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
