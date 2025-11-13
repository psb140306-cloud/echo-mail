'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import AdminNav from './components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAdmin, isCheckingAccess, user, error } = useAdminAccess()

  useEffect(() => {
    // 체크가 완료되었고 관리자가 아니면 리다이렉트
    if (!isCheckingAccess && !isAdmin) {
      if (!user) {
        console.log('[Admin Layout] No user, redirecting to login')
        router.push('/auth/login')
      } else {
        console.log('[Admin Layout] Not admin, redirecting to dashboard')
        router.push('/dashboard')
      }
    }
  }, [isCheckingAccess, isAdmin, user, router])

  // 권한 확인 중
  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 dark:text-gray-400 mb-2">권한 확인 중...</div>
          <div className="text-sm text-gray-500">
            관리자 권한을 확인하고 있습니다
          </div>
        </div>
      </div>
    )
  }

  // 에러 발생
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">오류 발생</h1>
          <p className="text-gray-600 dark:text-gray-400">
            권한 확인 중 오류가 발생했습니다.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {error}
          </p>
        </div>
      </div>
    )
  }

  // 관리자가 아님 (리다이렉트 전 잠시 표시)
  if (!isAdmin) {
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
            잠시 후 이동합니다...
          </p>
        </div>
      </div>
    )
  }

  // 관리자 권한 확인됨
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