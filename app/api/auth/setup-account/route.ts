import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { templateManager } from '@/lib/notifications/templates/template-manager'
import { PLAN_PRICING } from '@/lib/subscription/plans'

export const dynamic = 'force-dynamic'

/**
 * 회원가입 후 Tenant 생성
 * Supabase Auth 완료 후 프론트엔드에서 호출
 */
export async function POST(request: NextRequest) {
  try {
    // API Route에서 Supabase 클라이언트 생성 (request.cookies 사용)
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
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      logger.error('Unauthorized setup account attempt', {
        error: authError?.message,
        cookieCount: request.cookies.getAll().length
      })
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

    // 이미 Tenant가 있는지 확인 (Idempotent)
    const existingTenant = await prisma.tenant.findFirst({
      where: { ownerId: authUser.id },
    })

    if (existingTenant) {
      logger.info('User already has a tenant - returning existing', {
        userId: authUser.id,
        email: authUser.email,
        tenantId: existingTenant.id,
        tenantName: existingTenant.name,
      })
      return NextResponse.json({
        success: true,
        data: {
          tenantId: existingTenant.id,
          message: 'Tenant already exists',
        },
      })
    }

    // Tenant + TenantMember를 트랜잭션으로 함께 생성
    const tenant = await prisma.$transaction(async (tx) => {
      // 1. Tenant 생성
      const newTenant = await tx.tenant.create({
        data: {
          name: companyName || '내 회사',
          subdomain: subdomain || authUser.email!.split('@')[0].replace(/[^a-zA-Z0-9-]/g, ''),
          ownerId: authUser.id, // Supabase Auth UUID
          ownerEmail: authUser.email!,
          ownerName: ownerName || authUser.email!.split('@')[0],
          subscriptionPlan: subscriptionPlan || 'FREE_TRIAL',
          subscriptionStatus: subscriptionPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
          trialEndsAt:
            subscriptionPlan === 'FREE_TRIAL'
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14일
              : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 기본 14일
          maxCompanies: subscriptionPlan === 'FREE_TRIAL' ? 10 : 50,
          maxContacts: subscriptionPlan === 'FREE_TRIAL' ? 50 : 300,
          maxEmails: subscriptionPlan === 'FREE_TRIAL' ? 100 : 5000,
          maxNotifications: subscriptionPlan === 'FREE_TRIAL' ? 100 : 10000,
        },
      })

      // 2. TenantMember 생성 (OWNER)
      await tx.tenantMember.create({
        data: {
          userId: authUser.id,
          tenantId: newTenant.id,
          userEmail: authUser.email!,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      // 3. Subscription 생성 (무료 체험)
      const plan = subscriptionPlan || 'FREE_TRIAL'
      await tx.subscription.create({
        data: {
          tenantId: newTenant.id,
          plan: plan,
          status: plan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일
          priceAmount: PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.monthly || 0,
          currency: 'KRW',
        },
      })

      return newTenant
    })

    logger.info('Tenant and membership created successfully', {
      tenantId: tenant.id,
      ownerId: authUser.id,
      email: authUser.email,
    })

    // 기본 메시지 템플릿 생성
    try {
      await templateManager.createDefaultTemplatesForTenant(tenant.id)
      logger.info('Default templates created for new tenant', { tenantId: tenant.id })
    } catch (templateError) {
      logger.error('Failed to create default templates', {
        tenantId: tenant.id,
        error: templateError,
      })
      // 템플릿 생성 실패해도 계정 생성은 성공으로 처리
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant.id,
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
