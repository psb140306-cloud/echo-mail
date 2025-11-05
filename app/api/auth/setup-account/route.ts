import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'

/**
 * 회원가입 후 Tenant 생성
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
    const existingTenant = await prisma.tenant.findFirst({
      where: { ownerId: authUser.id },
    })

    if (existingTenant) {
      logger.info('User already has a tenant', {
        userId: authUser.id,
        tenantId: existingTenant.id,
      })
      return NextResponse.json({
        success: true,
        data: {
          tenantId: existingTenant.id,
        },
      })
    }

    // Tenant 생성 (간단!)
    const tenant = await prisma.tenant.create({
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

    logger.info('Tenant created successfully', {
      tenantId: tenant.id,
      ownerId: authUser.id,
      email: authUser.email,
    })

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
