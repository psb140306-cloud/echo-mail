import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'
import bcrypt from 'bcryptjs'

/**
 * Supabase Auth Webhook
 * 회원가입 시 자동으로 Tenant와 User 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 웹훅 비밀 키 검증
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET
    const authHeader = request.headers.get('authorization')

    if (!webhookSecret) {
      logger.error('SUPABASE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { success: false, error: 'Webhook not configured' },
        { status: 503 }
      )
    }

    // Bearer 토큰 검증
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Webhook authentication failed: Missing authorization header', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const providedSecret = authHeader.substring(7)
    if (providedSecret !== webhookSecret) {
      logger.warn('Webhook authentication failed: Invalid secret', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        providedPrefix: providedSecret.substring(0, 8) + '...',
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    logger.info('Auth webhook received', {
      type: body.type,
      email: body.record?.email
    })

    // INSERT 이벤트 (회원가입)만 처리
    if (body.type !== 'INSERT') {
      return NextResponse.json({ success: true, message: 'Ignored non-insert event' })
    }

    const record = body.record
    if (!record) {
      return NextResponse.json({ success: false, error: 'No record provided' }, { status: 400 })
    }

    const { id, email, raw_user_meta_data } = record
    const metadata = raw_user_meta_data || {}

    // 메타데이터에서 회사 정보 추출
    const companyName = metadata.company_name || '내 회사'
    const subdomain = metadata.subdomain || email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '')
    const subscriptionPlan = metadata.subscription_plan || 'FREE_TRIAL'
    const ownerName = metadata.full_name || email.split('@')[0]
    const role = metadata.role || 'OWNER'

    logger.info('Creating tenant for new user', {
      email,
      companyName,
      subdomain,
      subscriptionPlan,
    })

    // 트랜잭션으로 Tenant와 User 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tenant 생성
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          subdomain,
          subscriptionPlan,
          subscriptionStatus: subscriptionPlan === 'FREE_TRIAL' ? 'TRIAL' : 'ACTIVE',
          trialEndsAt: subscriptionPlan === 'FREE_TRIAL'
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
          id, // Supabase Auth ID 사용
          email,
          name: ownerName,
          password: hashedPassword,
          role: 'ADMIN',
          emailVerified: null, // 이메일 인증 대기
          tenantId: tenant.id,
        },
      })

      // 3. TenantUser 관계 설정
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: role as any,
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

    logger.info('Tenant and user created successfully', {
      tenantId: result.tenant.id,
      userId: result.user.id,
      email,
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: result.tenant.id,
        userId: result.user.id,
      },
    })
  } catch (error) {
    logger.error('Auth webhook error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process auth webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
