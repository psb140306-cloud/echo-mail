import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 슈퍼어드민용 테넌트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 슈퍼어드민 권한 확인
    const isDefaultAdmin = user.email === 'seah0623@naver.com'
    if (!isDefaultAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // 모든 테넌트 조회
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            members: true,
            companies: true,
          },
        },
        members: {
          select: {
            userId: true,
            userEmail: true,
            userName: true,
            role: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 테넌트별 통계 정보 계산
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        // 최근 활동 조회 (회사 생성, 사용자 초대 등)
        const recentActivity = await prisma.company.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        })

        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          createdAt: tenant.createdAt.toISOString(),
          memberCount: tenant._count.members,
          companyCount: tenant._count.companies,
          lastActivity: recentActivity?.updatedAt?.toISOString() || tenant.createdAt.toISOString(),
          members: tenant.members,
        }
      })
    )

    return NextResponse.json({
      success: true,
      tenants: tenantsWithStats,
    })
  } catch (error) {
    console.error('[Admin Tenants API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
