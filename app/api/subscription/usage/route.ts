import { NextRequest, NextResponse } from 'next/server'
import { getTenantUsageReport } from '@/lib/subscription/limit-checker'
import { TenantContext } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { withTenantContext } from '@/lib/middleware/tenant-context'

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

    return NextResponse.json({
      success: true,
      data: usageReport,
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
