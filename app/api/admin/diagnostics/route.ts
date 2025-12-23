import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

/**
 * 관리자 페이지 진단용 API
 * 환경 변수 및 인증 상태 확인
 */
export async function GET() {
  try {
    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks: {},
    }

    // 1. 환경 변수 확인
    diagnostics.checks.envVars = {
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPER_ADMIN_EMAILS: !!process.env.SUPER_ADMIN_EMAILS,
    }

    // 2. Supabase 연결 확인
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getUser()

      diagnostics.checks.supabase = {
        connected: true,
        hasUser: !!data.user,
        userEmail: data.user?.email || null,
        error: error?.message || null,
      }
    } catch (error) {
      diagnostics.checks.supabase = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    // 3. 슈퍼어드민 권한 확인
    try {
      const adminCheck = await verifySuperAdmin()
      diagnostics.checks.superAdmin = {
        isAdmin: adminCheck.isAdmin,
        userId: adminCheck.user?.id || null,
        email: adminCheck.user?.email || null,
        role: adminCheck.user?.role || null,
        error: adminCheck.error || null,
      }
    } catch (error) {
      diagnostics.checks.superAdmin = {
        isAdmin: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    return NextResponse.json({
      success: true,
      diagnostics,
    })
  } catch (error) {
    console.error('[Diagnostics] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
