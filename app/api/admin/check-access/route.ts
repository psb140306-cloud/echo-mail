import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 슈퍼어드민 이메일 목록 (환경변수에서 읽기)
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || 'park8374@naver.com')
  .split(',')
  .map(email => email.trim().toLowerCase())

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', isAdmin: false },
        { status: 401 }
      )
    }

    // 이메일로 슈퍼어드민 확인
    const isAdmin = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')

    // 나중에 user_metadata.role로 확장 가능
    // const isAdmin = user.user_metadata?.role === 'super_admin'

    return NextResponse.json({
      isAdmin,
      email: user.email,
      userId: user.id
    })
  } catch (error) {
    console.error('Admin check error:', error)
    return NextResponse.json(
      { error: 'Internal server error', isAdmin: false },
      { status: 500 }
    )
  }
}

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
    const currentUserIsAdmin = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')

    if (!currentUserIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      )
    }

    // 슈퍼어드민 목록 반환
    return NextResponse.json({
      admins: SUPER_ADMIN_EMAILS,
      message: 'Admin list retrieved successfully'
    })
  } catch (error) {
    console.error('Admin list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}