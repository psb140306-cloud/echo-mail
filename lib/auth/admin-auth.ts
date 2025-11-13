import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * 슈퍼어드민 권한 확인
 */
export async function checkSuperAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false

  const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || []
  return SUPER_ADMIN_EMAILS.includes(email)
}

/**
 * 슈퍼어드민 전용 API 미들웨어
 */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: '인증이 필요합니다' },
      { status: 401 }
    )
  }

  const isSuperAdmin = await checkSuperAdmin(session.user.email)

  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: '슈퍼어드민 권한이 필요합니다' },
      { status: 403 }
    )
  }

  return null // 권한 확인 성공
}