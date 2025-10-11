import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { withTenantContext, requireTenant } from '@/lib/middleware/tenant-context'
import { withTenantRateLimit } from '@/lib/middleware/rate-limiter'
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/validation'
import { UsageTracker, UsageType } from '@/lib/usage/usage-tracker'

// 사용량 조회
async function getUsage(request: NextRequest) {
  try {
    const tenantId = requireTenant()
    const { searchParams } = new URL(request.url)

    const period = (searchParams.get('period') as 'day' | 'month' | 'total') || 'month'
    const usageType = (searchParams.get('type') as UsageType) || undefined
    const startMonth = searchParams.get('startMonth') || undefined
    const endMonth = searchParams.get('endMonth') || undefined

    // 현재 사용량 조회
    const currentUsage = await UsageTracker.getCurrentUsage(tenantId, usageType, period)

    // 기간별 통계 (통계 요청시)
    let stats = null
    if (searchParams.get('includeStats') === 'true') {
      stats = await UsageTracker.getUsageStats(tenantId, startMonth, endMonth)
    }

    // 모든 타입의 제한 체크
    const limits = await UsageTracker.checkAllUsageLimits(tenantId)

    logger.info('사용량 조회 완료', {
      tenantId,
      period,
      usageType,
      includeStats: !!stats,
    })

    return createSuccessResponse(
      {
        current: currentUsage,
        limits,
        stats,
        period,
      },
      '사용량 정보를 성공적으로 조회했습니다.'
    )
  } catch (error) {
    logger.error('사용량 조회 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '사용량 조회에 실패했습니다.'
    )
  }
}

// 사용량 통계 조회 (상세)
async function getUsageStats(request: NextRequest) {
  try {
    const tenantId = requireTenant()
    const { searchParams } = new URL(request.url)

    const startMonth = searchParams.get('startMonth')
    const endMonth = searchParams.get('endMonth')

    const stats = await UsageTracker.getUsageStats(tenantId, startMonth, endMonth)

    logger.info('사용량 통계 조회 완료', {
      tenantId,
      startMonth,
      endMonth,
      recordCount: stats.length,
    })

    return createSuccessResponse(
      {
        stats,
        totalPeriods: stats.length,
      },
      '사용량 통계를 성공적으로 조회했습니다.'
    )
  } catch (error) {
    logger.error('사용량 통계 조회 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '사용량 통계 조회에 실패했습니다.'
    )
  }
}

// 사용량 제한 체크
async function checkUsageLimits(request: NextRequest) {
  try {
    const tenantId = requireTenant()
    const { searchParams } = new URL(request.url)
    const usageType = searchParams.get('type') as UsageType

    let limits
    if (usageType) {
      // 특정 타입만 체크
      const singleLimit = await UsageTracker.checkUsageLimits(tenantId, usageType)
      limits = { [usageType]: singleLimit }
    } else {
      // 모든 타입 체크
      limits = await UsageTracker.checkAllUsageLimits(tenantId)
    }

    logger.info('사용량 제한 체크 완료', {
      tenantId,
      usageType,
      limitChecks: Object.keys(limits).length,
    })

    return createSuccessResponse(
      {
        limits,
        summary: {
          hasExceeded: Object.values(limits).some((limit) => !limit.allowed),
          hasWarning: Object.values(limits).some(
            (limit) => limit.warningLevel === 'warning' || limit.warningLevel === 'critical'
          ),
          totalChecks: Object.keys(limits).length,
        },
      },
      '사용량 제한 체크가 완료되었습니다.'
    )
  } catch (error) {
    logger.error('사용량 제한 체크 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '사용량 제한 체크에 실패했습니다.'
    )
  }
}

// 사용량 초기화 (관리자용)
async function resetUsage(request: NextRequest) {
  try {
    const tenantId = requireTenant()

    // 월별 사용량 초기화
    await UsageTracker.resetMonthlyUsage(tenantId)

    logger.info('사용량 초기화 완료', { tenantId })

    return createSuccessResponse(
      { tenantId, resetAt: new Date().toISOString() },
      '사용량이 성공적으로 초기화되었습니다.'
    )
  } catch (error) {
    logger.error('사용량 초기화 실패', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '사용량 초기화에 실패했습니다.'
    )
  }
}

// 라우트 핸들러
export async function GET(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('dashboard')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, async (req) => {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'stats':
        return getUsageStats(req)
      case 'limits':
        return checkUsageLimits(req)
      default:
        return getUsage(req)
    }
  })
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await withTenantRateLimit('dashboard')(request)
  if (rateLimitResponse.status === 429) {
    return rateLimitResponse
  }

  return withTenantContext(request, resetUsage)
}
