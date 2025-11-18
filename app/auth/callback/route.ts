import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // ✅ 이메일 인증 완료 후 테넌트 자동 생성
      try {
        const existingTenant = await prisma.tenant.findFirst({
          where: { ownerId: data.user.id },
        })

        if (!existingTenant) {
          logger.info('[Auth Callback] Creating tenant for new user', {
            userId: data.user.id,
            email: data.user.email,
          })

          const metadata = data.user.user_metadata || {}
          const companyName = metadata.company_name || data.user.email?.split('@')[0] || '내 회사'
          const subdomain =
            metadata.subdomain ||
            data.user.email!.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '')

          await prisma.$transaction(async (tx) => {
            const newTenant = await tx.tenant.create({
              data: {
                name: companyName,
                subdomain,
                ownerId: data.user.id,
                ownerEmail: data.user.email!,
                ownerName: metadata.full_name || data.user.email!.split('@')[0],
                subscriptionPlan: metadata.subscription_plan || 'FREE_TRIAL',
                subscriptionStatus: 'TRIAL',
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                maxCompanies: 10,
                maxContacts: 50,
                maxEmails: 100,
                maxNotifications: 100,
              },
            })

            await tx.tenantMember.create({
              data: {
                userId: data.user.id,
                tenantId: newTenant.id,
                userEmail: data.user.email!,
                role: 'OWNER',
                status: 'ACTIVE',
              },
            })

            logger.info('[Auth Callback] Tenant created successfully', {
              tenantId: newTenant.id,
              userId: data.user.id,
            })
          })
        } else {
          logger.info('[Auth Callback] User already has tenant', {
            userId: data.user.id,
            tenantId: existingTenant.id,
          })
        }
      } catch (tenantError) {
        logger.error('[Auth Callback] Failed to create tenant', {
          error: tenantError,
          userId: data.user.id,
        })
        // 테넌트 생성 실패해도 로그인은 허용 (수동으로 나중에 생성 가능)
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}