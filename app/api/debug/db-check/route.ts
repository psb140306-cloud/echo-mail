import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * DEBUG: Vercel 환경에서 실제 DB 연결 확인
 * Production에서는 제거할 것!
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 환경변수 확인
    const envCheck = {
      DATABASE_URL: process.env.DATABASE_URL?.substring(0, 50) + '...', // 보안상 일부만
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    }

    // 2. 테넌트 조회
    const host = 'echo-mail-blush.vercel.app'
    const subdomain = host.replace('.vercel.app', '')

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ subdomain: subdomain }, { customDomain: host }],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        customDomain: true,
      },
    })

    // 3. 모든 테넌트 목록
    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        customDomain: true,
      },
    })

    return NextResponse.json({
      success: true,
      environment: envCheck,
      searchQuery: {
        subdomain,
        customDomain: host,
      },
      foundTenant: tenant,
      allTenants,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
