import { NextRequest, NextResponse } from 'next/server'
import { getTenantUsageReport } from '@/lib/subscription/limit-checker'
import { getTenantIdFromAuthUser } from '@/lib/auth/get-tenant-from-user'
import { logger } from '@/lib/utils/logger'

async function getUsage(request: NextRequest) {
  try {
    // 인증된 사용자의 테넌트 ID 조회
    const tenantId = await getTenantIdFromAuthUser()

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
  return getUsage(request)
}
