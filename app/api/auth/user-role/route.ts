import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TenantContext } from '@/lib/db'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { TenantUserRole } from '@/lib/auth/rbac'

export async function GET(request: NextRequest) {
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
      // Super Admin 모드
      logger.debug('Super Admin mode detected for user role check', {
        userId: user.id,
      })

      return NextResponse.json({
        role: TenantUserRole.OWNER,
        isSuperAdmin: true,
        userId: user.id,
      })
    }

    // 사용자의 테넌트별 역할 조회
    // 현재는 user 메타데이터에서 역할을 가져오거나, 기본값 사용
    // TODO: 실제 데이터베이스에서 TenantUser 테이블 조회
    const userRole = user.user_metadata?.role || TenantUserRole.VIEWER

    // 테넌트 소유자인지 확인
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerId: true },
    })

    let finalRole = userRole

    // 테넌트 소유자는 자동으로 OWNER 역할
    if (tenant?.ownerId === user.id) {
      finalRole = TenantUserRole.OWNER
    }

    logger.info('User role fetched', {
      userId: user.id,
      tenantId,
      role: finalRole,
      isOwner: tenant?.ownerId === user.id,
    })

    return NextResponse.json({
      role: finalRole,
      tenantId,
      userId: user.id,
      isOwner: tenant?.ownerId === user.id,
    })
  } catch (error) {
    logger.error('Failed to fetch user role', { error })

    return NextResponse.json(
      {
        error: '사용자 역할 조회에 실패했습니다.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
