import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { mailScheduler } from '@/lib/scheduler/mail-scheduler'
import { TenantContext } from '@/lib/db'

/**
 * 스케줄러 상태 조회
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const status = mailScheduler.getStatus()

      logger.info('[Scheduler] 상태 조회', { status })

      return createSuccessResponse(status)
    } catch (error) {
      logger.error('[Scheduler] 상태 조회 실패:', error)
      return createErrorResponse('스케줄러 상태 조회에 실패했습니다.')
    }
  })
}

/**
 * 스케줄 재로드 (설정 변경 시 호출)
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      logger.info('[Scheduler] 스케줄 재로드 요청', { tenantId })

      // 모든 테넌트의 스케줄 재로드
      await mailScheduler.reloadAllSchedules()

      const status = mailScheduler.getStatus()

      logger.info('[Scheduler] 스케줄 재로드 완료', {
        tenantId,
        isRunning: status.isRunning,
        intervalMinutes: status.intervalMinutes,
      })

      return createSuccessResponse(
        status,
        '스케줄이 재로드되었습니다.'
      )
    } catch (error) {
      logger.error('[Scheduler] 스케줄 재로드 실패:', error)
      return createErrorResponse(
        error instanceof Error ? error.message : '스케줄 재로드에 실패했습니다.'
      )
    }
  })
}
