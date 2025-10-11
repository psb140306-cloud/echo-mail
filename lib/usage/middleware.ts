/**
 * 사용량 추적 미들웨어
 * - API 호출 추적
 * - 이메일 처리 추적
 * - 자동 제한 체크
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { trackAPIUsage, checkEmailLimit, UsageTracker, UsageType } from './usage-tracker'
import { getTenantFromRequest } from '@/lib/middleware/tenant-context'

/**
 * API 사용량 추적 미들웨어
 */
export function withUsageTracking(endpoint?: string) {
  return async (request: NextRequest) => {
    try {
      // 테넌트 정보 추출
      const tenantInfo = await getTenantFromRequest(request)
      if (!tenantInfo) {
        // 테넌트 정보 없으면 추적하지 않음
        return NextResponse.next()
      }

      const { tenantId } = tenantInfo
      const actualEndpoint = endpoint || new URL(request.url).pathname

      // API 사용량 추적
      await trackAPIUsage(tenantId, actualEndpoint)

      // 응답에 사용량 헤더 추가
      const response = NextResponse.next()

      // 현재 API 사용량 조회
      const usage = await UsageTracker.getCurrentUsage(tenantId, UsageType.API_CALL, 'month')
      const apiUsage = usage[UsageType.API_CALL] || 0

      response.headers.set('X-Usage-API-Calls', apiUsage.toString())
      response.headers.set('X-Usage-Period', 'monthly')

      return response
    } catch (error) {
      logger.error('API 사용량 추적 실패', {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      })

      // 추적 실패해도 요청은 계속 진행
      return NextResponse.next()
    }
  }
}

/**
 * 이메일 사용량 체크 미들웨어
 */
export async function checkEmailUsageLimit(tenantId: string): Promise<{
  allowed: boolean
  message?: string
  currentUsage: number
  limit: number
}> {
  try {
    const limitCheck = await checkEmailLimit(tenantId)

    if (!limitCheck.allowed) {
      logger.warn('이메일 처리 제한 초과', {
        tenantId,
        currentUsage: limitCheck.currentUsage,
        limit: limitCheck.limit,
        message: limitCheck.message,
      })
    }

    return {
      allowed: limitCheck.allowed,
      message: limitCheck.message,
      currentUsage: limitCheck.currentUsage,
      limit: limitCheck.limit,
    }
  } catch (error) {
    logger.error('이메일 사용량 체크 실패', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      allowed: false,
      message: '사용량 체크 중 오류가 발생했습니다.',
      currentUsage: 0,
      limit: 0,
    }
  }
}

/**
 * 사용량 알림 체크 (배치 작업용)
 */
export async function checkUsageAlerts(tenantId: string): Promise<void> {
  try {
    const limits = await UsageTracker.checkAllUsageLimits(tenantId)

    // 경고 레벨별 처리
    for (const [usageType, limitCheck] of Object.entries(limits)) {
      if (limitCheck.warningLevel !== 'none') {
        logger.info('사용량 경고 감지', {
          tenantId,
          usageType,
          warningLevel: limitCheck.warningLevel,
          usagePercentage: limitCheck.usagePercentage,
          currentUsage: limitCheck.currentUsage,
          limit: limitCheck.limit,
        })

        // 여기서 알림 발송 로직 호출 가능
        // await sendUsageWarningNotification(tenantId, usageType, limitCheck)
      }
    }
  } catch (error) {
    logger.error('사용량 알림 체크 실패', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 사용량 요약 정보 조회
 */
export async function getUsageSummary(tenantId: string): Promise<{
  email: { current: number; limit: number; percentage: number }
  sms: { current: number; limit: number; percentage: number }
  kakao: { current: number; limit: number; percentage: number }
  api: { current: number; limit: number; percentage: number }
  hasWarning: boolean
  hasExceeded: boolean
}> {
  try {
    const [usage, limits] = await Promise.all([
      UsageTracker.getCurrentUsage(tenantId, undefined, 'month'),
      UsageTracker.checkAllUsageLimits(tenantId),
    ])

    const summary = {
      email: {
        current: usage[UsageType.EMAIL] || 0,
        limit: limits[UsageType.EMAIL]?.limit || 0,
        percentage: limits[UsageType.EMAIL]?.usagePercentage || 0,
      },
      sms: {
        current: usage[UsageType.SMS] || 0,
        limit: limits[UsageType.SMS]?.limit || 0,
        percentage: limits[UsageType.SMS]?.usagePercentage || 0,
      },
      kakao: {
        current: usage[UsageType.KAKAO] || 0,
        limit: limits[UsageType.KAKAO]?.limit || 0,
        percentage: limits[UsageType.KAKAO]?.usagePercentage || 0,
      },
      api: {
        current: usage[UsageType.API_CALL] || 0,
        limit: limits[UsageType.API_CALL]?.limit || 0,
        percentage: limits[UsageType.API_CALL]?.usagePercentage || 0,
      },
      hasWarning: Object.values(limits).some(
        (limit) => limit.warningLevel === 'warning' || limit.warningLevel === 'critical'
      ),
      hasExceeded: Object.values(limits).some((limit) => !limit.allowed),
    }

    return summary
  } catch (error) {
    logger.error('사용량 요약 조회 실패', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      email: { current: 0, limit: 0, percentage: 0 },
      sms: { current: 0, limit: 0, percentage: 0 },
      kakao: { current: 0, limit: 0, percentage: 0 },
      api: { current: 0, limit: 0, percentage: 0 },
      hasWarning: false,
      hasExceeded: false,
    }
  }
}

export default {
  withUsageTracking,
  checkEmailUsageLimit,
  checkUsageAlerts,
  getUsageSummary,
}
