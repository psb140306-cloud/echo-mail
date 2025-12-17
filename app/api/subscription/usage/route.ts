import { NextRequest, NextResponse } from 'next/server'
import { getTenantUsageReport } from '@/lib/subscription/limit-checker'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

export const dynamic = 'force-dynamic'

async function getUsage(request: NextRequest) {
  try {
    // TenantContext에서 tenantId 가져오기
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      logger.error('Tenant context not available in usage GET')
      return NextResponse.json(
        {
          success: false,
          error: '테넌트 정보를 찾을 수 없습니다.',
        },
        { status: 401 }
      )
    }

    // 사용량 리포트 조회
    const usageReport = await getTenantUsageReport(tenantId)

    logger.info('Tenant usage report fetched', {
      tenantId,
      plan: usageReport.plan,
    })

    // 페이지에서 기대하는 형식으로 변환
    const formattedUsage = {
      // 구독 페이지용 간단한 형식
      companies: {
        current: usageReport.limits.companies.current,
        limit: usageReport.limits.companies.limit,
      },
      contacts: {
        current: usageReport.limits.contacts.current,
        limit: usageReport.limits.contacts.limit,
      },
      emails: {
        current: usageReport.limits.emailsThisMonth.current,
        limit: usageReport.limits.emailsThisMonth.limit,
      },
      notifications: {
        current: usageReport.limits.notificationsThisMonth.current,
        limit: usageReport.limits.notificationsThisMonth.limit,
      },
      // 대시보드에서 사용하는 summary 필드
      summary: usageReport.summary,
      // UsageDisplay 컴포넌트용 전체 정보
      plan: usageReport.plan,
      status: usageReport.status,
      limits: usageReport.limits,
      features: usageReport.features,
    }

    return NextResponse.json({
      success: true,
      data: formattedUsage,
    })
  } catch (error) {
    logger.error('Failed to get usage report', { error })

    const errorMessage = error instanceof Error ? error.message : '사용량 조회에 실패했습니다.'
    const statusCode = errorMessage.includes('인증되지 않은') ? 401 : errorMessage.includes('테넌트 정보가 없습니다') ? 400 : 500

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, async () => getUsage(request))
}
