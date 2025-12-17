import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { verifySuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

/**
 * 관리자 전용: 특정 사용자에게 Tenant 강제 생성
 * 사용 케이스:
 * - Trigger 실패로 tenant가 생성되지 않은 사용자
 * - 수동으로 tenant를 재생성해야 하는 경우
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await context.params
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

    // 1. 슈퍼어드민 권한 확인
    const adminResult = await verifySuperAdmin()

    if (!adminResult.isAdmin || !adminResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: adminResult.error || 'Forbidden - Admin access required',
        },
        { status: adminResult.error?.includes('Unauthorized') ? 401 : 403 }
      )
    }

    const adminUser = adminResult.user

    // 2. 대상 사용자 확인 (Service Role 사용)
    const adminSupabase = createAdminClient()
    const { data: targetUser, error: targetUserError } = await adminSupabase.auth.admin.getUserById(userId)

    if (targetUserError || !targetUser?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target user not found',
        },
        { status: 404 }
      )
    }

    const targetUserData = targetUser.user

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
    const params = await context.params
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
