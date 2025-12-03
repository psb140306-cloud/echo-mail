import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 슈퍼어드민 권한 확인 유틸리티
 *
 * 환경변수 SUPER_ADMIN_EMAILS에 등록된 이메일 또는
 * user_metadata.role이 'super_admin'인 사용자만 슈퍼어드민으로 인정
 */

// 환경변수에서 슈퍼어드민 이메일 목록 가져오기
function getSuperAdminEmails(): string[] {
  const emails = process.env.SUPER_ADMIN_EMAILS || ''
  return emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

/**
 * 이메일이 슈퍼어드민인지 확인
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const superAdminEmails = getSuperAdminEmails()
  return superAdminEmails.includes(email.toLowerCase())
}

/**
 * 사용자가 슈퍼어드민인지 확인 (이메일 또는 역할 기반)
 */
export function checkSuperAdminStatus(
  email?: string | null,
  role?: string | null
): boolean {
  // 1. user_metadata.role이 'super_admin'인 경우
  if (role === 'super_admin') return true

  // 2. 환경변수 SUPER_ADMIN_EMAILS에 포함된 경우
  if (isSuperAdminEmail(email)) return true

  return false
}

export interface SuperAdminCheckResult {
  isAdmin: boolean
  user: {
    id: string
    email: string
    role: string
  } | null
  error?: string
}

/**
 * 현재 요청의 사용자가 슈퍼어드민인지 확인
 * API Route에서 사용
 */
export async function verifySuperAdmin(): Promise<SuperAdminCheckResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        isAdmin: false,
        user: null,
        error: 'Unauthorized - 인증이 필요합니다'
      }
    }

    const userRole = user.user_metadata?.role || 'user'
    const isAdmin = checkSuperAdminStatus(user.email, userRole)

    return {
      isAdmin,
      user: {
        id: user.id,
        email: user.email || '',
        role: userRole
      },
      error: isAdmin ? undefined : 'Forbidden - 슈퍼어드민 권한이 필요합니다'
    }
  } catch (error) {
    console.error('[SuperAdmin] Verification error:', error)
    return {
      isAdmin: false,
      user: null,
      error: 'Internal server error'
    }
  }
}

/**
 * 슈퍼어드민 전용 API 미들웨어
 * 권한이 없으면 NextResponse 반환, 있으면 null 반환
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const result = await verifySuperAdmin()

  if (!result.isAdmin) {
    const status = result.error?.includes('Unauthorized') ? 401 : 403
    return NextResponse.json(
      { error: result.error, isAdmin: false },
      { status }
    )
  }

  return null // 권한 확인 성공
}

/**
 * 슈퍼어드민 전용 API 래퍼
 * 권한 확인 후 핸들러 실행
 */
export async function withSuperAdmin<T>(
  handler: (user: { id: string; email: string; role: string }) => Promise<T>
): Promise<NextResponse | T> {
  const result = await verifySuperAdmin()

  if (!result.isAdmin || !result.user) {
    const status = result.error?.includes('Unauthorized') ? 401 : 403
    return NextResponse.json(
      { error: result.error, isAdmin: false },
      { status }
    )
  }

  return handler(result.user)
}
