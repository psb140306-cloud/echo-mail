import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TenantContext } from '@/lib/db'
import { getTenantUsageReport } from '@/lib/subscription/limit-checker'
import { withTenantContext } from '@/lib/middleware/tenant-context'
import { logger } from '@/lib/utils/logger'

async function getUsage(request: NextRequest) {
  try {
    // Supabase 인증 확인
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 })
    }

    // 테넌트 컨텍스트 확인
    const tenantContext = TenantContext.getInstance()
    const tenantId = tenantContext.getTenantId()

    if (!tenantId) {
      return NextResponse.json({ error: '테넌트 정보가 필요합니다.' }, { status: 400 })
    }

    // 사용량 리포트 조회
    const usageReport = await getTenantUsageReport(tenantId)

    logger.info('Tenant usage report fetched', {
      tenantId,
      userId: user.id,
      plan: usageReport.plan,
    })

    return NextResponse.json({
      success: true,
      data: usageReport,
    })
  } catch (error) {
    logger.error('Failed to get usage report', { error })

    return NextResponse.json(
      {
        success: false,
        error: '사용량 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return withTenantContext(request, getUsage)
}
