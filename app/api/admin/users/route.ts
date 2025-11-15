import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // 관리자 권한 확인
    const isDefaultAdmin = user.email === 'seah0623@naver.com'
    if (!isDefaultAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // 모든 tenant members 조회
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
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // userId 기준으로 그룹화하여 고유 사용자 목록 생성
    const userMap = new Map()

    members.forEach(member => {
      if (!userMap.has(member.userId)) {
        userMap.set(member.userId, {
          userId: member.userId,
          email: member.userEmail,
          name: member.userName,
          createdAt: member.createdAt,
          tenants: []
        })
      }

      userMap.get(member.userId).tenants.push({
        tenantId: member.tenantId,
        tenantName: member.tenant.name,
        subdomain: member.tenant.subdomain,
        role: member.role,
        status: member.status,
      })
    })

    const users = Array.from(userMap.values())

    return NextResponse.json({
      users,
      total: users.length
    })
  } catch (error) {
    console.error('[Admin Users API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
