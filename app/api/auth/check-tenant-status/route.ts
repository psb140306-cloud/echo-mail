import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

/**
 * 사용자의 Tenant 상태를 확인하는 API
 * - 로그인 후 tenant가 생성되었는지 확인
 * - 설정 대기 페이지에서 폴링으로 호출
 */
export async function GET(request: NextRequest) {
  try {
    // Supabase 세션 확인
    const { createServerClient } = await import('@supabase/ssr')
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Tenant 및 Membership 확인
    const membership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      include: {
        tenant: true,
      },
    })

    if (!membership || !membership.tenant) {
      // Tenant가 아직 없음
      logger.info('Tenant not ready for user', {
        userId: user.id,
        email: user.email,
      })

      return NextResponse.json({
        success: true,
        data: {
          hasTenant: false,
          isReady: false,
          status: 'pending',
          message: '작업 공간을 준비하고 있습니다...',
        },
      })
    }

    // Tenant 정상 존재
    logger.info('Tenant ready for user', {
      userId: user.id,
      email: user.email,
      tenantId: membership.tenant.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        hasTenant: true,
        isReady: true,
        status: 'ready',
        tenant: {
          id: membership.tenant.id,
          name: membership.tenant.name,
          subdomain: membership.tenant.subdomain,
          role: membership.role,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to check tenant status', { error })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check tenant status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
