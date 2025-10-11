/**
 * 테넌트 백업 Cron Job
 * - 매주 일요일 새벽 3시 실행 (Vercel Cron: 0 3 * * 0)
 * - 모든 활성 테넌트 데이터 백업
 * - JSON 형식으로 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { TenantBackup } from '@/lib/automation/tenant-backup'
import { logger } from '@/lib/utils/logger'

export const maxDuration = 300 // 5분 타임아웃

export async function GET(request: NextRequest) {
  try {
    // Cron job 인증 확인
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Cron job 인증 실패: tenant-backup', {
        ip: request.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Cron job 시작: tenant-backup')

    const startTime = Date.now()

    // 모든 활성 테넌트 백업
    const backupResults = await TenantBackup.backupAllActiveTenants()

    // 통계 계산
    const totalSize = backupResults
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + (r.backupSize || 0), 0)

    const totalRecords = backupResults
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => {
        const counts = r.recordCount || {}
        return (
          sum +
          (counts.companies || 0) +
          (counts.contacts || 0) +
          (counts.emailLogs || 0) +
          (counts.notificationLogs || 0) +
          (counts.deliveryRules || 0) +
          (counts.holidays || 0) +
          (counts.messageTemplates || 0)
        )
      }, 0)

    const duration = Date.now() - startTime

    logger.info('Cron job 완료: tenant-backup', {
      duration: `${duration}ms`,
      totalTenants: backupResults.length,
      success: backupResults.filter((r) => r.status === 'success').length,
      failed: backupResults.filter((r) => r.status === 'failed').length,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      totalRecords,
    })

    return NextResponse.json({
      success: true,
      message: 'Tenant backup completed',
      data: {
        results: backupResults,
        summary: {
          total: backupResults.length,
          success: backupResults.filter((r) => r.status === 'success').length,
          failed: backupResults.filter((r) => r.status === 'failed').length,
          skipped: backupResults.filter((r) => r.status === 'skipped').length,
          totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
          totalRecords,
        },
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Cron job 실패: tenant-backup', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Tenant backup failed',
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
