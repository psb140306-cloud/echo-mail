import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/utils/validation'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { mailMonitorService } from '@/lib/mail/mail-monitor-service'
import { TenantContext } from '@/lib/db'

/**
 * 메일 모니터링 상태 조회
 */
export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      const status = mailMonitorService.getStatus()

      logger.info('[MailMonitor] 상태 조회', { tenantId, status })

      return createSuccessResponse({
        isRunning: status.isRunning,
        lastCheckTime: status.lastCheckTimes[tenantId] || null,
      })
    } catch (error) {
      logger.error('[MailMonitor] 상태 조회 실패:', error)
      return createErrorResponse('상태 조회에 실패했습니다.')
    }
  })
}

/**
 * 수동 메일 확인 트리거
 */
export async function POST(request: NextRequest) {
  return withTenantContext(request, async () => {
    try {
      const tenantContext = TenantContext.getInstance()
      const tenantId = tenantContext.getTenantId()

      if (!tenantId) {
        return createErrorResponse('테넌트 정보를 찾을 수 없습니다.', 401)
      }

      logger.info('[MailMonitor] 수동 메일 확인 시작', { tenantId })

      // 현재 테넌트의 메일만 확인
      const results = await mailMonitorService.checkAllTenants()
      const result = results.get(tenantId)

      if (!result) {
        return createErrorResponse(
          '메일 서버 설정이 활성화되지 않았거나 설정이 올바르지 않습니다.',
          400
        )
      }

      logger.info('[MailMonitor] 수동 메일 확인 완료', {
        tenantId,
        result,
      })

      return createSuccessResponse(
        result,
        `메일 확인 완료: 새 메일 ${result.newMailsCount}개, 처리 ${result.processedCount}개`
      )
    } catch (error) {
      logger.error('[MailMonitor] 수동 메일 확인 실패:', error)
      return createErrorResponse(
        error instanceof Error ? error.message : '메일 확인에 실패했습니다.'
      )
    }
  })
}
