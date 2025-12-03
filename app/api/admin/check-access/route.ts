import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin, requireSuperAdmin } from '@/lib/auth/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const result = await verifySuperAdmin()

    if (!result.user) {
      return NextResponse.json(
        { error: 'Unauthorized', isAdmin: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      isAdmin: result.isAdmin,
      email: result.user.email,
      userId: result.user.id,
      role: result.user.role
    })
  } catch (error) {
    console.error('Admin check error:', error)
    return NextResponse.json(
      { error: 'Internal server error', isAdmin: false },
      { status: 500 }
    )
  }
}

// 사용자 역할 업데이트 (슈퍼어드민만 가능)
export async function POST(req: NextRequest) {
  try {
    // 슈퍼어드민 권한 확인
    const authError = await requireSuperAdmin()
    if (authError) return authError

    const supabase = await createClient()

    // 요청 바디에서 업데이트할 사용자 정보 가져오기
    const body = await req.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      )
    }

    // 사용자 메타데이터 업데이트 (관리자 권한으로)
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: { role } }
    )

    if (error) {
      console.error('Failed to update user role:', error)
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User role updated successfully',
      userId,
      role
    })
  } catch (error) {
    console.error('Admin list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}