import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

/**
 * 관리자 전용: 특정 사용자에게 Tenant 강제 생성
 * 사용 케이스:
 * - Trigger 실패로 tenant가 생성되지 않은 사용자
 * - 수동으로 tenant를 재생성해야 하는 경우
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId is required',
        },
        { status: 400 }
      )
    }

    // 1. 관리자 권한 확인
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
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // TODO: 실제 관리자 권한 체크 로직 추가
    // 현재는 인증된 사용자면 모두 허용

    // 2. 대상 사용자 확인
    const targetUser = await supabase.auth.admin.getUserById(userId)

    if (targetUser.error || !targetUser.data.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target user not found',
        },
        { status: 404 }
      )
    }

    const targetUserData = targetUser.data.user

    // 3. 이미 Tenant가 있는지 확인
    const existingTenant = await prisma.tenant.findFirst({
      where: { ownerId: userId },
    })

    if (existingTenant) {
      logger.warn('[Admin] User already has tenant', {
        userId,
        tenantId: existingTenant.id,
        adminId: adminUser.id,
      })

      return NextResponse.json({
        success: true,
        data: {
          tenantId: existingTenant.id,
          message: 'User already has a tenant',
          alreadyExists: true,
        },
      })
    }

    // 4. Request body 파싱 (선택적 설정)
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body 없으면 기본값 사용
    }

    const companyName = body.companyName || targetUserData.email?.split('@')[0] + '의 회사'
    const subdomain =
      body.subdomain ||
      targetUserData.email?.split('@')[0]?.replace(/[^a-zA-Z0-9-]/g, '') ||
      'company-' + userId.substring(0, 8)

    // 5. Tenant + TenantMember 트랜잭션 생성
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: companyName,
          subdomain,
          ownerId: userId,
          ownerEmail: targetUserData.email!,
          ownerName: targetUserData.user_metadata?.full_name || targetUserData.email!.split('@')[0],
          subscriptionPlan: body.subscriptionPlan || 'FREE_TRIAL',
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일
          maxCompanies: 10,
          maxContacts: 50,
          maxEmails: 100,
          maxNotifications: 100,
        },
      })

      await tx.tenantMember.create({
        data: {
          userId,
          tenantId: newTenant.id,
          userEmail: targetUserData.email!,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      return newTenant
    })

    logger.info('[Admin] Tenant created successfully', {
      tenantId: tenant.id,
      userId,
      adminId: adminUser.id,
      adminEmail: adminUser.email,
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
        message: 'Tenant created successfully',
      },
    })
  } catch (error) {
    logger.error('[Admin] Failed to create tenant for user', {
      error,
      userId: params.userId,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create tenant',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
