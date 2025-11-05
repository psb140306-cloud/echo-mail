import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

/**
 * 회원가입 후 계정 설정 (Tenant & User 생성)
 * Supabase Auth 완료 후 프론트엔드에서 호출
 */
export async function POST(request: NextRequest) {
  try {
    // Supabase 세션 확인
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      logger.error('Unauthorized setup account attempt', { error: authError?.message })
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { companyName, ownerName, subscriptionPlan, subdomain } = body

    logger.info('Setting up account for new user', {
      email: authUser.email,
      companyName,
      subdomain,
      subscriptionPlan,
    })

    // 이미 Tenant가 있는지 확인
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { tenant: true },
    })

    if (existingUser?.tenant) {
      logger.info('User already has a tenant', {
        userId: authUser.id,
        tenantId: existingUser.tenantId,
      })
      return NextResponse.json({
        success: true,
        data: {
          tenantId: existingUser.tenantId,
          userId: existingUser.id,
        },
      })
    }

    // 트랜잭션으로 Tenant와 User 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tenant 생성
      const tenant = await tx.tenant.create({
        data: {
          name: companyName || '내 회사',
          subdomain: subdomain || authUser.email!.split('@')[0].replace(/[^a-zA-Z0-9-]/g, ''),
          subscriptionPlan: subscriptionPlan || 'FREE_TRIAL',
          subscriptionStatus: subscriptionPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
          trialEndsAt:
            subscriptionPlan === 'FREE_TRIAL'
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14일
              : null,
          maxCompanies: subscriptionPlan === 'FREE_TRIAL' ? 10 : 50,
          maxContacts: subscriptionPlan === 'FREE_TRIAL' ? 50 : 300,
          maxEmails: subscriptionPlan === 'FREE_TRIAL' ? 100 : 5000,
          maxNotifications: subscriptionPlan === 'FREE_TRIAL' ? 100 : 10000,
        },
      })

      // 2. User 생성 (Supabase ID와 연결)
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), 12) // 임시 비밀번호
      const user = await tx.user.create({
        data: {
          id: authUser.id, // Supabase Auth ID 사용
          email: authUser.email!,
          name: ownerName || authUser.email!.split('@')[0],
          password: hashedPassword,
          role: 'ADMIN',
          emailVerified: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null,
          tenantId: tenant.id,
        },
      })

      // 3. TenantUser 관계 설정
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
          acceptedAt: new Date(),
        },
      })

      // 4. Tenant의 소유자 설정
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerId: user.id },
      })

      return { tenant, user }
    })

    logger.info('Account setup completed successfully', {
      tenantId: result.tenant.id,
      userId: result.user.id,
      email: authUser.email,
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
      },
    })
  } catch (error) {
    logger.error('Account setup error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup account',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
