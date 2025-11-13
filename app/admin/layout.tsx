'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import AdminNav from './components/AdminNav'
import { getSuperAdminEmails, isSuperAdmin } from '@/lib/config/admin'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    console.log('[Admin Layout] State:', {
      loading,
      user: user?.email,
      isChecking,
      hasAccess
    })

    // 아직 로딩 중이면 대기
    if (loading) {
      console.log('[Admin Layout] Auth still loading, waiting...')
      return
    }

    // 로그인하지 않았으면 로그인 페이지로
    if (!user) {
      console.log('[Admin Layout] No user found, redirecting to login')
      router.push('/auth/login')
      setIsChecking(false)
      return
    }

    // 슈퍼어드민 체크
    const isAdmin = isSuperAdmin(user.email)
    console.log('[Admin Layout] Admin check result:', {
      email: user.email,
      isAdmin,
      adminEmails: getSuperAdminEmails()
    })

    if (!isAdmin) {
      console.log('[Admin Layout] Not super admin, redirecting to dashboard')
      router.push('/dashboard')
      setIsChecking(false)
      setHasAccess(false)
      return
    }

    // 접근 권한 있음
    console.log('[Admin Layout] Access granted!')
    setHasAccess(true)
    setIsChecking(false)
  }, [user, loading, router])

  // 인증 로딩 중이거나 권한 체크 중
  if (loading || isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 dark:text-gray-400 mb-2">권한 확인 중...</div>
          <div className="text-sm text-gray-500">
            {loading ? '인증 정보 로딩 중' : '관리자 권한 확인 중'}
          </div>
        </div>
      </div>
    )
  }

  // 접근 권한이 없으면 메시지 표시 (리다이렉트 전 잠시 표시)
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">접근 거부</h1>
          <p className="text-gray-600 dark:text-gray-400">
            슈퍼어드민 권한이 필요합니다.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            현재 로그인: {user?.email || '없음'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
            잠시 후 대시보드로 이동합니다...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <AdminNav />
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}