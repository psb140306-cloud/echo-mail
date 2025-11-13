import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.log('[Admin Check API] No user or auth error:', error?.message)
      return NextResponse.json(
        { error: 'Unauthorized', isAdmin: false },
        { status: 401 }
      )
    }

    console.log('[Admin Check API] User metadata:', user.user_metadata)
    console.log('[Admin Check API] User role:', user.user_metadata?.role)
    console.log('[Admin Check API] Current user email:', user.email)

    // user_metadata.role로 슈퍼어드민 확인
    const isAdmin = user.user_metadata?.role === 'super_admin'

    // 임시: park8374@naver.com은 기본적으로 슈퍼어드민으로 처리 (초기 설정용)
    const isDefaultAdmin = user.email === 'park8374@naver.com'

    const finalIsAdmin = isAdmin || isDefaultAdmin
    console.log('[Admin Check API] Is admin (role)?:', isAdmin)
    console.log('[Admin Check API] Is default admin?:', isDefaultAdmin)
    console.log('[Admin Check API] Final admin status:', finalIsAdmin)

    return NextResponse.json({
      isAdmin: finalIsAdmin,
      email: user.email,
      userId: user.id,
      role: user.user_metadata?.role || 'user'
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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 현재 사용자가 슈퍼어드민인지 확인
    const isAdmin = user.user_metadata?.role === 'super_admin' || user.email === 'park8374@naver.com'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

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