import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    // 1. Supabase auth.users에서 모든 사용자 조회 (service_role 사용)
    const adminSupabase = createAdminClient()
    const { data: authUsers, error: authUsersError } = await adminSupabase.auth.admin.listUsers()

    if (authUsersError) {
      throw new Error(`Failed to list auth users: ${authUsersError.message}`)
    }

    // 2. 모든 tenant members 조회
    const members = await prisma.tenantMember.findMany({
      select: {
        id: true,
        userId: true,
        userEmail: true,
        userName: true,
        role: true,
        status: true,
        createdAt: true,
        tenantId: true,
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 3. userId 기준으로 membership 그룹화
    const membershipMap = new Map<string, any[]>()

    members.forEach((member) => {
      if (!membershipMap.has(member.userId)) {
        membershipMap.set(member.userId, [])
      }

      membershipMap.get(member.userId)!.push({
        tenantId: member.tenantId,
        tenantName: member.tenant.name,
        subdomain: member.tenant.subdomain,
        role: member.role,
        status: member.status,
      })
    })

    // 4. auth.users와 membership 결합
    const users = authUsers.users.map((authUser) => {
      const memberships = membershipMap.get(authUser.id) || []

      return {
        userId: authUser.id,
        email: authUser.email || 'Unknown',
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown',
        createdAt: authUser.created_at,
        tenants: memberships,
      }
    })

    // 5. 생성일 기준 정렬 (최신순)
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      users,
      total: users.length,
    })
  } catch (error) {
    console.error('[Admin Users API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
